const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createClassList() {
    const classes = new Set();

    return {
        add(name) {
            classes.add(name);
        },
        remove(name) {
            classes.delete(name);
        },
        replace(from, to) {
            if (classes.has(from)) {
                classes.delete(from);
            }

            classes.add(to);
        },
        contains(name) {
            return classes.has(name);
        },
    };
}

function createElement(tagName) {
    return {
        tagName,
        children: [],
        attributes: {},
        listeners: {},
        className: '',
        classList: createClassList(),
        style: {},
        focus() {},
        getAttribute(name) { return this.attributes[name] ?? null; },
        innerHTML: '',
        textContent: '',
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        replaceChildren(...children) {
            this.children = [];
            children.forEach((child) => this.appendChild(child));
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
        addEventListener(type, handler) {
            if (!this.listeners[type]) {
                this.listeners[type] = [];
            }

            this.listeners[type].push(handler);
        },
        dispatchEvent(event) {
            const handlers = this.listeners[event.type] || [];
            handlers.forEach((handler) => handler(event));
        },
        querySelector(selector) {
            if (selector === '.collapse-icon') {
                return { classList: createClassList() };
            }

            return null;
        },
        querySelectorAll(selector) {
            if (selector === '.exercise-card') {
                return this.children.filter((child) => child.className === 'exercise-card');
            }

            return [];
        },
    };
}

function createTimerController() {
    let nextId = 1;
    const timers = new Map();

    return {
        setTimeout(callback, delay) {
            const id = nextId++;
            timers.set(id, { callback, delay });
            return id;
        },
        clearTimeout(id) {
            timers.delete(id);
        },
        runAll() {
            const pending = [...timers.entries()];
            timers.clear();
            pending.forEach(([, timer]) => timer.callback());
        },
        count() {
            return timers.size;
        },
    };
}

function createScriptEnvironment() {
    const timerController = createTimerController();
    const intervalCalls = [];
    const fetchCalls = [];
    const observerInstances = [];
    const documentListeners = {};
    const windowListeners = {};
    const exercisesContainer = createElement('div');

    exercisesContainer.id = 'exercises-container';

    const document = {
        addEventListener(type, handler) {
            if (!documentListeners[type]) {
                documentListeners[type] = [];
            }

            documentListeners[type].push(handler);
        },
        dispatchEvent(event) {
            const handlers = documentListeners[event.type] || [];
            handlers.forEach((handler) => handler(event));
        },
        getElementById(id) {
            if (id === 'exercises-container') {
                return exercisesContainer;
            }

            return null;
        },
        createElement,
        body: {
            offsetHeight: 1000,
        },
    };

    const window = {
        innerHeight: 900,
        scrollY: 0,
        addEventListener(type, handler) {
            if (!windowListeners[type]) {
                windowListeners[type] = [];
            }

            windowListeners[type].push(handler);
        },
        setTimeout: timerController.setTimeout,
        clearTimeout: timerController.clearTimeout,
    };

    class FakeIntersectionObserver {
        constructor(callback, options) {
            this.callback = callback;
            this.options = options;
            this.observed = [];
            this.unobserved = [];
            observerInstances.push(this);
        }

        observe(target) {
            this.observed.push(target);
        }

        unobserve(target) {
            this.unobserved.push(target);
        }
    }

    const context = {
        console,
        window,
        document,
        IntersectionObserver: FakeIntersectionObserver,
        fetch(url) {
            fetchCalls.push(url);
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve([{
                    name: 'Push Up',
                    id: 'Push_Up',
                    images: ['Push_Up/0.jpg', 'Push_Up/1.jpg'],
                    level: 'beginner',
                    category: 'strength',
                    force: 'push',
                    equipment: null,
                    primaryMuscles: ['chest'],
                    secondaryMuscles: ['triceps'],
                    instructions: ['Step 1'],
                }]),
            });
        },
        setInterval(callback, delay) {
            intervalCalls.push({ callback, delay });
            return intervalCalls.length;
        },
        clearInterval() {},
        CustomEvent: class CustomEvent {
            constructor(type, init = {}) {
                this.type = type;
                this.detail = init.detail;
            }
        },
    };

    context.global = context;
    context.globalThis = context;
    context.self = context;
    context.window.document = document;
    context.window.CustomEvent = context.CustomEvent;

    return {
        context,
        document,
        window,
        fetchCalls,
        intervalCalls,
        observerInstances,
        windowListeners,
        exercisesContainer,
    };
}

function createSearchEnvironment({ keepFetchPending = false, emptyResults = false, errorResponse = false } = {}) {
    const timerController = createTimerController();
    const fetchCalls = [];
    const dispatchedEvents = [];
    const placeholder = createElement('div');
    const documentListeners = {};

    let currentAbortSignal = null;
    let pendingFetchResolve = null;

    const document = {
        addEventListener(type, handler) {
            if (!documentListeners[type]) {
                documentListeners[type] = [];
            }

            documentListeners[type].push(handler);
        },
        dispatchEvent(event) {
            dispatchedEvents.push(event);
            const handlers = documentListeners[event.type] || [];
            handlers.forEach((handler) => handler(event));
        },
        getElementById(id) {
            if (id === 'search-placeholder') {
                return placeholder;
            }

            return null;
        },
        createElement,
    };

    const window = {
        setTimeout: timerController.setTimeout,
        clearTimeout: timerController.clearTimeout,
    };

    const context = {
        console,
        window,
        document,
        setTimeout: timerController.setTimeout,
        clearTimeout: timerController.clearTimeout,
        apiBaseUrl: 'https://libapi.vercel.app',
        fetchExercises() {
            throw new Error('search.js should not call fetchExercises directly when clearing');
        },
        fetch(url, options = {}) {
            fetchCalls.push({ url, options });
            currentAbortSignal = options.signal;

            if (keepFetchPending) {
                return new Promise((resolve) => {
                    pendingFetchResolve = () => resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            exercises: [{ name: 'Push Up' }],
                        }),
                    });
                });
            }

            if (errorResponse) {
                return Promise.resolve({
                    ok: false,
                    statusText: 'Internal Server Error',
                });
            }

            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    exercises: emptyResults ? [] : [{ name: 'Push Up' }],
                }),
            });
        },
        AbortController,
        CustomEvent: class CustomEvent {
            constructor(type, init = {}) {
                this.type = type;
                this.detail = init.detail;
            }
        },
    };

    context.global = context;
    context.globalThis = context;
    context.self = context;
    context.window.document = document;
    context.window.CustomEvent = context.CustomEvent;

    return {
        context,
        placeholder,
        timerController,
        fetchCalls,
        dispatchedEvents,
        getCurrentAbortSignal() {
            return currentAbortSignal;
        },
        resolvePendingFetch() {
            if (pendingFetchResolve) {
                pendingFetchResolve();
                pendingFetchResolve = null;
            }
        },
    };
}

function createFilterSelect(field) {
    let value = '';
    const children = [];
    const listeners = {};
    const defaultOption = { value: '', textContent: '' };

    return {
        tagName: 'SELECT',
        dataset: { filter: field },
        get value() { return value; },
        set value(v) { value = v; },
        get children() { return children; },
        querySelector(selector) {
            if (selector === 'option[value=""]') return defaultOption;
            return null;
        },
        replaceChildren(...newChildren) {
            children.length = 0;
            newChildren.forEach((c) => children.push(c));
        },
        appendChild(child) {
            children.push(child);
            return child;
        },
        addEventListener(type, handler) {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(handler);
        },
        dispatchEvent(event) {
            (listeners[event.type] || []).forEach((h) => h(event));
        },
    };
}

function createFilterScriptEnvironment({
    exerciseFetchResponse = null,
    exerciseFetchStatus = 200,
    filterFetchPending = [],
    filterFetchResponses = null,
} = {}) {
    const fetchCalls = [];
    const dispatchedEvents = [];
    const documentListeners = {};
    const windowListeners = {};
    const filterFetchResolvers = [];
    let filterFetchIndex = 0;

    const exercisesContainer = createElement('div');
    exercisesContainer.id = 'exercises-container';

    const filterStatus = createElement('div');
    filterStatus.id = 'filter-status';

    const loadingIndicator = createElement('div');
    loadingIndicator.id = 'loading-indicator';

    const languageSelectListeners = {};
    let languageSelectValue = 'pt';
    const languageSelect = {
        tagName: 'SELECT',
        get value() { return languageSelectValue; },
        set value(v) { languageSelectValue = v; },
        addEventListener(type, handler) {
            if (!languageSelectListeners[type]) languageSelectListeners[type] = [];
            languageSelectListeners[type].push(handler);
        },
        dispatchEvent(event) {
            (languageSelectListeners[event.type] || []).forEach((h) => h(event));
        },
    };

    const clearButtonListeners = {};
    const clearButton = {
        tagName: 'BUTTON',
        addEventListener(type, handler) {
            if (!clearButtonListeners[type]) clearButtonListeners[type] = [];
            clearButtonListeners[type].push(handler);
        },
        dispatchEvent(event) {
            (clearButtonListeners[event.type] || []).forEach((h) => h(event));
        },
    };

    const filterSelectFields = ['primaryMuscles', 'secondaryMuscles', 'level', 'force', 'equipment', 'category'];
    const filterSelects = {};
    filterSelectFields.forEach((field) => {
        filterSelects[field] = createFilterSelect(field);
    });

    const documentEl = { lang: '' };

    const document = {
        documentElement: documentEl,
        body: { offsetHeight: 1000 },
        addEventListener(type, handler) {
            if (!documentListeners[type]) documentListeners[type] = [];
            documentListeners[type].push(handler);
        },
        dispatchEvent(event) {
            dispatchedEvents.push(event);
            (documentListeners[event.type] || []).forEach((h) => h(event));
        },
        getElementById(id) {
            if (id === 'exercises-container') return exercisesContainer;
            if (id === 'filter-status') return filterStatus;
            if (id === 'loading-indicator') return loadingIndicator;
            if (id === 'language-select') return languageSelect;
            if (id === 'clear-filters') return clearButton;
            return null;
        },
        querySelector(selector) {
            const filterMatch = selector.match(/\[data-filter="([^"]+)"\]/);
            if (filterMatch) return filterSelects[filterMatch[1]] || null;
            return null;
        },
        querySelectorAll(selector) {
            if (selector === '[data-filter]') return Object.values(filterSelects);
            if (selector === '[data-i18n]') return [];
            return [];
        },
        createElement,
    };

    const window = {
        innerHeight: 900,
        scrollY: 0,
        addEventListener(type, handler) {
            if (!windowListeners[type]) windowListeners[type] = [];
            windowListeners[type].push(handler);
        },
        setTimeout() {},
        clearTimeout() {},
    };

    const defaultFilterResponse = {
        primaryMuscles: ['chest', 'legs'],
        secondaryMuscles: ['triceps'],
        level: ['beginner', 'intermediate'],
        force: ['push', 'pull'],
        equipment: ['barbell'],
        category: ['strength'],
    };

    const defaultExercise = [{
        name: 'Push Up',
        id: 'Push_Up',
        images: ['Push_Up/0.jpg', 'Push_Up/1.jpg'],
        level: 'beginner',
        category: 'strength',
        force: 'push',
        equipment: null,
        primaryMuscles: ['chest'],
        secondaryMuscles: ['triceps'],
        instructions: ['Step 1'],
    }];

    const context = {
        console,
        window,
        document,
        localStorage: {
            getItem: () => null,
            setItem: () => {},
        },
        IntersectionObserver: class {
            constructor() {}
            observe() {}
            unobserve() {}
        },
        fetch(url) {
            fetchCalls.push(url);

            if (url.includes('/filters')) {
                const index = filterFetchIndex++;
                const response = (filterFetchResponses && filterFetchResponses[index]) || defaultFilterResponse;

                if (filterFetchPending.includes(index)) {
                    return new Promise((resolve) => {
                        filterFetchResolvers[index] = () => resolve({
                            ok: true,
                            json: () => Promise.resolve(response),
                        });
                    });
                }

                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(response),
                });
            }

            const status = exerciseFetchStatus;
            const exercises = exerciseFetchResponse || defaultExercise;
            return Promise.resolve({
                ok: status < 400,
                status,
                statusText: status === 404 ? 'Not Found' : (status === 200 ? 'OK' : 'Error'),
                json: () => Promise.resolve(exercises),
            });
        },
        setInterval() {},
        clearInterval() {},
        CustomEvent: class CustomEvent {
            constructor(type, init = {}) {
                this.type = type;
                this.detail = init.detail;
            }
        },
    };

    context.global = context;
    context.globalThis = context;
    context.self = context;
    context.window.document = document;
    context.window.CustomEvent = context.CustomEvent;
    context.window.localStorage = context.localStorage;

    return {
        context,
        document,
        window,
        fetchCalls,
        dispatchedEvents,
        exercisesContainer,
        filterStatus,
        loadingIndicator,
        languageSelect,
        clearButton,
        filterSelects,
        windowListeners,
        documentListeners,
        resolveFilterFetch(index = 0) {
            if (filterFetchResolvers[index]) {
                filterFetchResolvers[index]();
            }
        },
    };
}

function loadScript(relativePath, context) {
    if (!context.testFetchWrapped && context.fetch) {
        const fetch = context.fetch;
        context.fetch = async (...args) => {
            const response = await fetch(...args);
            response.clone = () => ({ ...response });
            return response;
        };
        context.testFetchWrapped = true;
    }
    context.Image ||= class Image {};
    const filePath = path.join(__dirname, '..', relativePath);
    const source = fs.readFileSync(filePath, 'utf8');
    vm.runInNewContext(source, context, { filename: filePath });
}

function flushPromises() {
    return new Promise((resolve) => setImmediate(resolve));
}

async function runTest(name, fn) {
    try {
        await fn();
        console.log(`PASS ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}`);
        console.error(error);
        process.exitCode = 1;
    }
}

async function main() {
    await runTest('script.js renders cards without creating looping image intervals', async () => {
        const env = createScriptEnvironment();

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        assert.equal(env.fetchCalls.length, 1);
        assert.equal(env.intervalCalls.length, 0);
        assert.equal(env.exercisesContainer.children.length, 1);

        const card = env.exercisesContainer.children[0];
        const image = card.children[0].children[0];

        assert.equal(image.src, 'https://libapi.vercel.app/exercises/Push_Up/0.jpg');
        assert.equal(image.loading, 'lazy');
        assert.equal(env.observerInstances[0].observed.length, 1);
    });

    await runTest('script.js blocks infinite scroll while search results are active and resets cleanly', async () => {
        const env = createScriptEnvironment();

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        const initialCard = env.exercisesContainer.children[0];
        env.document.dispatchEvent({
            type: 'searchResults',
            detail: [{
                name: 'Squat',
                images: ['/squat/0.jpg'],
                level: 'beginner',
                category: 'strength',
                force: 'push',
                equipment: null,
                primaryMuscles: ['legs'],
                secondaryMuscles: [],
                instructions: ['Step 1'],
            }],
        });

        env.window.scrollY = 200;
        env.windowListeners.scroll[0]();
        await flushPromises();

        assert.equal(env.fetchCalls.length, 1);
        assert.equal(env.observerInstances[0].unobserved[0], initialCard);

        env.document.dispatchEvent({ type: 'clearSearchResults' });
        await flushPromises();

        assert.equal(env.fetchCalls.length, 1, 'clearing search can reuse the cached first page');
        assert.equal(env.exercisesContainer.children.length, 1);
    });

    await runTest('search.js debounces input and encodes the query before fetching', async () => {
        const env = createSearchEnvironment();

        loadScript(path.join('public', 'js', 'components', 'search.js'), env.context);

        const searchContainer = env.placeholder.children[0];
        const input = searchContainer.children[0];

        input.dispatchEvent({ type: 'input', target: { value: 'push' } });
        input.dispatchEvent({ type: 'input', target: { value: 'push up' } });

        assert.equal(env.timerController.count(), 1);
        assert.equal(env.fetchCalls.length, 0);

        env.timerController.runAll();
        await flushPromises();

        assert.equal(env.fetchCalls.length, 1);
        assert.match(env.fetchCalls[0].url, /query=push%20up/);
        assert.equal(env.dispatchedEvents.at(-1).type, 'searchResults');
    });

    await runTest('search.js aborts in-flight searches and clears via event only once', async () => {
        const env = createSearchEnvironment({ keepFetchPending: true });

        loadScript(path.join('public', 'js', 'components', 'search.js'), env.context);

        const searchContainer = env.placeholder.children[0];
        const input = searchContainer.children[0];

        input.dispatchEvent({ type: 'input', target: { value: 'push' } });
        env.timerController.runAll();
        await flushPromises();

        const activeSignal = env.getCurrentAbortSignal();
        assert.equal(activeSignal.aborted, false);

        input.dispatchEvent({ type: 'input', target: { value: '' } });

        assert.equal(activeSignal.aborted, true);
        assert.equal(env.dispatchedEvents.at(-1).type, 'clearSearchResults');

        env.resolvePendingFetch();
        await flushPromises();
    });

    await runTest('search.js dispatches empty searchResults when API returns empty exercises', async () => {
        const env = createSearchEnvironment({ emptyResults: true });

        loadScript(path.join('public', 'js', 'components', 'search.js'), env.context);

        const searchContainer = env.placeholder.children[0];
        const input = searchContainer.children[0];

        input.dispatchEvent({ type: 'input', target: { value: 'xyz' } });
        env.timerController.runAll();
        await flushPromises();

        assert.equal(env.fetchCalls.length, 1);
        assert.equal(env.dispatchedEvents.at(-1).type, 'searchResults');
        assert.equal(env.dispatchedEvents.at(-1).detail.length, 0);
    });

    await runTest('search.js dispatches clearSearchResults when API response is not ok', async () => {
        const env = createSearchEnvironment({ errorResponse: true });

        loadScript(path.join('public', 'js', 'components', 'search.js'), env.context);

        const searchContainer = env.placeholder.children[0];
        const input = searchContainer.children[0];

        input.dispatchEvent({ type: 'input', target: { value: 'push' } });
        env.timerController.runAll();
        await flushPromises();

        assert.equal(env.fetchCalls.length, 1);
        assert.equal(env.dispatchedEvents.at(-1).type, 'clearSearchResults');
        assert.ok(!env.dispatchedEvents.some((e) => e.type === 'searchResults'));
    });

    await runTest('search.js treats whitespace-only input as empty and clears without fetching', async () => {
        const env = createSearchEnvironment();

        loadScript(path.join('public', 'js', 'components', 'search.js'), env.context);

        const searchContainer = env.placeholder.children[0];
        const input = searchContainer.children[0];

        input.dispatchEvent({ type: 'input', target: { value: '   ' } });

        assert.equal(env.fetchCalls.length, 0);
        assert.equal(env.timerController.count(), 0);
        assert.equal(env.dispatchedEvents.at(-1).type, 'clearSearchResults');
    });

    await runTest('search.js lowercases the query before sending to the API', async () => {
        const env = createSearchEnvironment();

        loadScript(path.join('public', 'js', 'components', 'search.js'), env.context);

        const searchContainer = env.placeholder.children[0];
        const input = searchContainer.children[0];

        input.dispatchEvent({ type: 'input', target: { value: 'PUSH UP' } });
        env.timerController.runAll();
        await flushPromises();

        assert.equal(env.fetchCalls.length, 1);
        assert.match(env.fetchCalls[0].url, /query=push%20up/);
    });

    await runTest('script.js exercise URL always includes lang, page, and limit', async () => {
        const env = createFilterScriptEnvironment();

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        const exerciseUrl = env.fetchCalls.find((url) => !url.includes('/filters'));
        assert.ok(exerciseUrl, 'exercise fetch should be made');
        assert.match(exerciseUrl, /lang=pt/);
        assert.match(exerciseUrl, /page=0/);
        assert.match(exerciseUrl, /limit=50/);
    });

    await runTest('script.js omits empty filter fields from exercise URL', async () => {
        const env = createFilterScriptEnvironment();

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        const exerciseUrl = env.fetchCalls.find((url) => !url.includes('/filters'));
        assert.ok(!exerciseUrl.includes('primaryMuscles='), 'empty primaryMuscles should be omitted');
        assert.ok(!exerciseUrl.includes('level='), 'empty level should be omitted');
    });

    await runTest('script.js includes active filter field in exercise URL after filter change', async () => {
        const env = createFilterScriptEnvironment();

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        env.filterSelects.level.value = 'beginner';
        env.filterSelects.level.dispatchEvent({ type: 'change' });
        await flushPromises();

        const exerciseUrls = env.fetchCalls.filter((url) => !url.includes('/filters'));
        assert.match(exerciseUrls.at(-1), /level=beginner/);
    });

    await runTest('script.js makes a filter options fetch on initialization with correct lang', async () => {
        const env = createFilterScriptEnvironment();

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        const filterUrl = env.fetchCalls.find((url) => url.includes('/filters'));
        assert.ok(filterUrl, 'filter options fetch should be made');
        assert.match(filterUrl, /lang=pt/);
    });

    await runTest('script.js populates filter selects with options and correct labels after load', async () => {
        const env = createFilterScriptEnvironment({
            filterFetchResponses: [{
                primaryMuscles: ['chest', 'back', 'legs'],
                secondaryMuscles: [],
                level: ['beginner'],
                force: ['push'],
                equipment: ['barbell'],
                category: ['strength'],
            }],
        });

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        const primaryChildren = env.filterSelects.primaryMuscles.children;
        assert.equal(primaryChildren.length, 4, 'should have default option + 3 muscle options');
        assert.equal(primaryChildren[1].textContent, 'Chest', 'option label should be title-cased');
        assert.equal(primaryChildren[2].textContent, 'Back');
        assert.equal(primaryChildren[3].textContent, 'Legs');
    });

    await runTest('script.js formatOptionLabel does not uppercase letters after non-ASCII chars', async () => {
        const env = createFilterScriptEnvironment({
            filterFetchResponses: [{
                primaryMuscles: ['antebraços', 'latíssimo do dorso', 'pescoço'],
                secondaryMuscles: [],
                level: [],
                force: [],
                equipment: [],
                category: [],
            }],
        });

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        const children = env.filterSelects.primaryMuscles.children;
        assert.equal(children[1].textContent, 'Antebraços', 'ç should not trigger uppercase on following letter');
        assert.equal(children[2].textContent, 'Latíssimo Do Dorso', 'í should not trigger uppercase on following letter');
        assert.equal(children[3].textContent, 'Pescoço', 'ç at end should not uppercase trailing letter');
    });

    await runTest('script.js loadFilterOptions ignores stale response when language changes mid-flight', async () => {
        const env = createFilterScriptEnvironment({
            filterFetchPending: [0],
            filterFetchResponses: [
                { primaryMuscles: ['chest'], secondaryMuscles: [], level: [], force: [], equipment: [], category: [] },
                { primaryMuscles: ['legs'], secondaryMuscles: [], level: [], force: [], equipment: [], category: [] },
            ],
        });

        loadScript(path.join('public', 'js', 'script.js'), env.context);

        env.languageSelect.value = 'en';
        env.languageSelect.dispatchEvent({ type: 'change' });
        await flushPromises();

        env.resolveFilterFetch(0);
        await flushPromises();

        const values = env.filterSelects.primaryMuscles.children
            .map((c) => c.value)
            .filter((v) => v !== '');
        assert.deepEqual(values, ['legs'], 'stale first response should not overwrite the fresh second response');
    });

    await runTest('script.js shows empty state on 404 response for page 0', async () => {
        const env = createFilterScriptEnvironment({ exerciseFetchStatus: 404 });

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        const emptyState = env.exercisesContainer.children.find((c) => c.className === 'empty-state');
        assert.ok(emptyState, 'empty-state element should be in the container');
    });

    await runTest('script.js shows empty state when API returns empty exercise list on page 0', async () => {
        const env = createFilterScriptEnvironment({ exerciseFetchResponse: [] });

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        const emptyState = env.exercisesContainer.children.find((c) => c.className === 'empty-state');
        assert.ok(emptyState, 'empty-state element should be in the container');
    });

    await runTest('script.js searchResults displays all exercises when no filter is active', async () => {
        const env = createFilterScriptEnvironment();

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        env.document.dispatchEvent({
            type: 'searchResults',
            detail: [
                { name: 'Push Up', images: [], level: 'beginner', category: 'strength', force: 'push', equipment: null, primaryMuscles: ['chest'], secondaryMuscles: [], instructions: [] },
                { name: 'Squat', images: [], level: 'intermediate', category: 'strength', force: 'push', equipment: null, primaryMuscles: ['legs'], secondaryMuscles: [], instructions: [] },
            ],
        });

        const cards = env.exercisesContainer.children.filter((c) => c.className === 'exercise-card');
        assert.equal(cards.length, 2);
    });

    await runTest('script.js searchResults filters results by active string field (level)', async () => {
        const env = createFilterScriptEnvironment();

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        env.filterSelects.level.value = 'beginner';
        env.filterSelects.level.dispatchEvent({ type: 'change' });
        await flushPromises();

        env.document.dispatchEvent({
            type: 'searchResults',
            detail: [
                { name: 'Push Up', images: [], level: 'beginner', category: 'strength', force: 'push', equipment: null, primaryMuscles: ['chest'], secondaryMuscles: [], instructions: [] },
                { name: 'Squat', images: [], level: 'intermediate', category: 'strength', force: 'push', equipment: null, primaryMuscles: ['legs'], secondaryMuscles: [], instructions: [] },
            ],
        });

        const cards = env.exercisesContainer.children.filter((c) => c.className === 'exercise-card');
        assert.equal(cards.length, 1, 'only the beginner exercise should pass the filter');
    });

    await runTest('script.js searchResults filters results by active array field (primaryMuscles)', async () => {
        const env = createFilterScriptEnvironment();

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        env.filterSelects.primaryMuscles.value = 'chest';
        env.filterSelects.primaryMuscles.dispatchEvent({ type: 'change' });
        await flushPromises();

        env.document.dispatchEvent({
            type: 'searchResults',
            detail: [
                { name: 'Push Up', images: [], level: 'beginner', category: 'strength', force: 'push', equipment: null, primaryMuscles: ['chest'], secondaryMuscles: [], instructions: [] },
                { name: 'Squat', images: [], level: 'beginner', category: 'strength', force: 'push', equipment: null, primaryMuscles: ['legs'], secondaryMuscles: [], instructions: [] },
            ],
        });

        const cards = env.exercisesContainer.children.filter((c) => c.className === 'exercise-card');
        assert.equal(cards.length, 1, 'only the chest exercise should pass the filter');
    });

    await runTest('script.js searchResults filter matching is case-insensitive', async () => {
        const env = createFilterScriptEnvironment();

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        env.filterSelects.level.value = 'BEGINNER';
        env.filterSelects.level.dispatchEvent({ type: 'change' });
        await flushPromises();

        env.document.dispatchEvent({
            type: 'searchResults',
            detail: [
                { name: 'Push Up', images: [], level: 'beginner', category: 'strength', force: 'push', equipment: null, primaryMuscles: ['chest'], secondaryMuscles: [], instructions: [] },
            ],
        });

        const cards = env.exercisesContainer.children.filter((c) => c.className === 'exercise-card');
        assert.equal(cards.length, 1, 'BEGINNER filter should match beginner exercise');
    });

    await runTest('script.js searchResults shows empty state when active filter removes all results', async () => {
        const env = createFilterScriptEnvironment();

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        env.filterSelects.level.value = 'advanced';
        env.filterSelects.level.dispatchEvent({ type: 'change' });
        await flushPromises();

        env.document.dispatchEvent({
            type: 'searchResults',
            detail: [
                { name: 'Push Up', images: [], level: 'beginner', category: 'strength', force: 'push', equipment: null, primaryMuscles: ['chest'], secondaryMuscles: [], instructions: [] },
            ],
        });

        const emptyState = env.exercisesContainer.children.find((c) => c.className === 'empty-state');
        assert.ok(emptyState, 'empty state should be shown when filter removes all search results');
    });

    await runTest('script.js clear button resets all filters and reloads without filter params', async () => {
        const env = createFilterScriptEnvironment();

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        env.filterSelects.level.value = 'beginner';
        env.filterSelects.level.dispatchEvent({ type: 'change' });
        await flushPromises();

        env.clearButton.dispatchEvent({ type: 'click' });
        await flushPromises();

        const exerciseUrls = env.fetchCalls.filter((url) => !url.includes('/filters'));
        assert.equal(env.context.getActiveFilters().level, '', 'level filter should be absent after clear');
        assert.equal(env.exercisesContainer.children.length, 1);
    });

    await runTest('script.js language change dispatches languageChanged event and reloads with new lang', async () => {
        const env = createFilterScriptEnvironment();

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        env.languageSelect.value = 'en';
        env.languageSelect.dispatchEvent({ type: 'change' });
        await flushPromises();

        const langChangedEvent = env.dispatchedEvents.find((e) => e.type === 'languageChanged');
        assert.ok(langChangedEvent, 'languageChanged event should be dispatched');
        assert.equal(langChangedEvent.detail, 'en');

        const exerciseUrls = env.fetchCalls.filter((url) => !url.includes('/filters'));
        assert.match(exerciseUrls.at(-1), /lang=en/, 'reloaded exercises should use the new language');
    });

    await runTest('script.js updateFilterStatus shows count of active filters', async () => {
        const env = createFilterScriptEnvironment();

        loadScript(path.join('public', 'js', 'script.js'), env.context);
        await flushPromises();

        env.filterSelects.level.value = 'beginner';
        env.filterSelects.level.dispatchEvent({ type: 'change' });
        await flushPromises();

        assert.ok(env.filterStatus.textContent.includes('1'), 'filter status should show 1 active filter');

        env.filterSelects.category.value = 'strength';
        env.filterSelects.category.dispatchEvent({ type: 'change' });
        await flushPromises();

        assert.ok(env.filterStatus.textContent.includes('2'), 'filter status should show 2 active filters');
    });
}

module.exports = { createElement, createSearchEnvironment, createFilterScriptEnvironment, loadScript, flushPromises };

if (require.main === module) {
    for (const file of fs.readdirSync(__dirname)) {
        if (file.endsWith('.test.js') && !['frontend.test.js', 'mobile-navbar.test.js'].includes(file)) {
            require(path.join(__dirname, file));
        }
    }
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createElement, createFilterScriptEnvironment, createSearchEnvironment, loadScript, flushPromises } = require('./frontend.test');

function environment() {
    const env = createFilterScriptEnvironment();
    env.errors = createElement('div');
    const getElementById = env.document.getElementById;
    env.document.getElementById = id => id === 'request-errors' ? env.errors : getElementById(id);
    env.document.createElement = tag => {
        const element = createElement(tag);
        element.remove = () => { element.parentNode.children = element.parentNode.children.filter(child => child !== element); };
        return element;
    };
    return env;
}
const response = (data, status = 200) => ({ ok: status < 400, status, statusText: 'Error', json: async () => data, clone() { return response(data, status); } });
const exercise = name => ({ name, images: [], primaryMuscles: [], secondaryMuscles: [] });
const alert = env => env.errors.children[0];
const retry = env => alert(env).children.find(child => child.tagName === 'button').dispatchEvent({ type: 'click' });

test('failed filter loading shows a localized alert and can be retried', async () => {
    const env = environment();
    let fail = true;
    env.context.fetch = async url => {
        if (!url.includes('/filters')) return response([exercise('Squat')]);
        if (fail) throw new TypeError('Failed to fetch');
        return response({ level: ['beginner'] });
    };
    loadScript('public/js/script.js', env.context);
    await flushPromises();
    assert.equal(env.errors.children.length, 1);
    assert.equal(alert(env).attributes.role, 'alert');
    fail = false;
    retry(env);
    await flushPromises();
    assert.equal(env.errors.children.length, 0);
    assert.equal(env.filterSelects.level.children[1].textContent, 'Beginner');
});

test('a failed filter reload preserves cards, offers retry and does not show a false empty state', async () => {
    const env = environment();
    let fail = false;
    env.context.fetch = async url => url.includes('/filters') ? response({}) : fail ? response({}, 500) : response([exercise('Squat')]);
    loadScript('public/js/script.js', env.context);
    await flushPromises();
    const original = env.exercisesContainer.children[0];
    fail = true;
    env.filterSelects.level.value = 'beginner';
    env.filterSelects.level.dispatchEvent({ type: 'change' });
    await flushPromises();
    assert.equal(env.exercisesContainer.children[0], original);
    assert.equal(env.errors.children.length, 1);
    assert.equal(env.loadingIndicator.style.display, 'none');
    fail = false;
    retry(env);
    await flushPromises();
    assert.equal(env.errors.children.length, 0);
    assert.notEqual(env.exercisesContainer.children[0], original);
});

test('a new filter request supersedes a pending request', async () => {
    const env = environment();
    let resolveOld;
    env.context.fetch = async url => {
        if (url.includes('/filters')) return response({});
        if (url.includes('level=beginner')) return new Promise(resolve => { resolveOld = resolve; });
        return response([exercise(url.includes('level=expert') ? 'Expert squat' : 'Initial squat')]);
    };
    loadScript('public/js/script.js', env.context);
    await flushPromises();
    env.filterSelects.level.value = 'beginner';
    env.filterSelects.level.dispatchEvent({ type: 'change' });
    env.filterSelects.level.value = 'expert';
    env.filterSelects.level.dispatchEvent({ type: 'change' });
    await flushPromises();
    resolveOld(response([exercise('Old squat')]));
    await flushPromises();
    assert.equal(env.exercisesContainer.children[0].children[0].textContent, 'Expert squat');
});

test('failed searches expose a retry for the same query instead of clearing results', async () => {
    const env = createSearchEnvironment({ errorResponse: true });
    loadScript('public/js/components/search.js', env.context);
    env.placeholder.children[0].children[0].dispatchEvent({ type: 'input', target: { value: 'sentadilla' } });
    env.timerController.runAll();
    await flushPromises();
    const event = env.dispatchedEvents.at(-1);
    assert.equal(event.type, 'searchError');
    assert.equal(env.dispatchedEvents.some(e => e.type === 'clearSearchResults'), false);
    env.context.fetch = async url => { env.fetchCalls.push({ url }); return response({ exercises: [exercise('Sentadilla')] }); };
    await event.detail.retry();
    assert.equal(env.dispatchedEvents.at(-1).type, 'searchResults');
    assert.match(env.fetchCalls.at(-1).url, /query=sentadilla/);
});

test('search errors render in the catalogue without removing existing results', async () => {
    const env = environment();
    loadScript('public/js/script.js', env.context);
    await flushPromises();
    const original = env.exercisesContainer.children[0];
    let retried = false;
    env.document.dispatchEvent({ type: 'searchError', detail: { retry: () => { retried = true; } } });
    assert.equal(env.errors.children.length, 1);
    assert.equal(env.exercisesContainer.children[0], original);
    retry(env);
    assert.equal(retried, true);
});

test('an aborted search cannot report a stale error after the query is cleared', async () => {
    const env = createSearchEnvironment();
    let reject;
    env.context.fetch = () => new Promise((resolve, rejectFetch) => { reject = rejectFetch; });
    loadScript('public/js/components/search.js', env.context);
    const input = env.placeholder.children[0].children[0];
    input.dispatchEvent({ type: 'input', target: { value: 'squat' } });
    env.timerController.runAll();
    input.dispatchEvent({ type: 'input', target: { value: '' } });
    reject(new TypeError('Failed to fetch'));
    await flushPromises();
    assert.equal(env.dispatchedEvents.at(-1).type, 'clearSearchResults');
});

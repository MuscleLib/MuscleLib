const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createFilterScriptEnvironment, loadScript, flushPromises } = require('./frontend.test');

const squat = level => ({ name: `Squat ${level}`, images: [], level, category: 'strength', primaryMuscles: ['legs'], secondaryMuscles: [], instructions: [] });
const cards = env => env.exercisesContainer.children.filter(e => e.className === 'exercise-card');

test('changing and clearing filters operates on the current search results', async () => {
    const env = createFilterScriptEnvironment();
    loadScript('public/js/script.js', env.context);
    await flushPromises();
    env.document.dispatchEvent({ type: 'searchResults', detail: [squat('beginner'), squat('intermediate')] });
    const before = env.fetchCalls.length;
    env.filterSelects.level.value = 'beginner';
    env.filterSelects.level.dispatchEvent({ type: 'change' });
    await flushPromises();
    assert.equal(cards(env).length, 1);
    assert.equal(cards(env)[0].children[0].textContent, 'Squat beginner');
    env.clearButton.dispatchEvent({ type: 'click' });
    await flushPromises();
    assert.equal(cards(env).length, 2, 'clearing must restore both matching squats');
    assert.equal(env.fetchCalls.length, before, 'filters must not reload the general catalogue');
    env.windowListeners.scroll[0]();
    await flushPromises();
    assert.equal(env.fetchCalls.length, before, 'filtered search stays out of infinite scroll');
});

test('empty search results remain empty when filters are cleared', async () => {
    const env = createFilterScriptEnvironment();
    loadScript('public/js/script.js', env.context);
    await flushPromises();
    env.document.dispatchEvent({ type: 'searchResults', detail: [] });
    env.clearButton.dispatchEvent({ type: 'click' });
    await flushPromises();
    assert.equal(env.exercisesContainer.children[0].className, 'empty-state');
});

test('clearing a search or changing language restores the normal catalogue', async () => {
    for (const action of ['clear', 'language']) {
        const env = createFilterScriptEnvironment();
        loadScript('public/js/script.js', env.context);
        await flushPromises();
        env.document.dispatchEvent({ type: 'searchResults', detail: [squat('beginner')] });
        if (action === 'clear') env.document.dispatchEvent({ type: 'clearSearchResults' });
        else {
            env.languageSelect.value = 'es';
            env.languageSelect.dispatchEvent({ type: 'change' });
        }
        await flushPromises();
        assert.equal(cards(env)[0].children.find(e => e.tagName === 'h3').textContent, 'Push Up');
    }
});

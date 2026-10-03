const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSearchEnvironment, createFilterScriptEnvironment, loadScript, flushPromises } = require('./frontend.test');

test('a successful search with no matches renders an empty state instead of the full catalogue', async () => {
    const search = createSearchEnvironment({ emptyResults: true });
    loadScript('public/js/components/search.js', search.context);
    const input = search.placeholder.children[0].children[0];
    input.dispatchEvent({ type: 'input', target: { value: 'zzzzinexistente987' } });
    search.timerController.runAll();
    await flushPromises();
    const event = search.dispatchedEvents.at(-1);
    assert.equal(event.type, 'searchResults');
    assert.equal(event.detail.length, 0);
    assert.equal(search.dispatchedEvents.some(e => e.type === 'clearSearchResults'), false);

    const catalogue = createFilterScriptEnvironment();
    loadScript('public/js/script.js', catalogue.context);
    await flushPromises();
    const before = catalogue.fetchCalls.length;
    catalogue.document.dispatchEvent(event);
    assert.equal(catalogue.exercisesContainer.children.length, 1);
    assert.equal(catalogue.exercisesContainer.children[0].className, 'empty-state');
    catalogue.windowListeners.scroll[0]();
    await flushPromises();
    assert.equal(catalogue.fetchCalls.length, before, 'infinite scroll must not refill empty search results');
});

test('clearing the query still restores the catalogue', async () => {
    const search = createSearchEnvironment({ emptyResults: true });
    loadScript('public/js/components/search.js', search.context);
    const input = search.placeholder.children[0].children[0];
    input.dispatchEvent({ type: 'input', target: { value: '' } });
    assert.equal(search.dispatchedEvents.at(-1).type, 'clearSearchResults');
});

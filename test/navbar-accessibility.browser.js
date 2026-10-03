const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function main() {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
    try {
        for (const width of [390, 1280]) {
            const page = await browser.newPage({ viewport: { width, height: 844 } });
            await page.route('**/*', async route => {
                if (route.request().url() === 'http://musclelib.test/') return route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' });
                if (route.request().url().includes('/api/exercises')) return route.fulfill({ contentType: 'application/json', body: route.request().url().includes('/filters') ? '{}' : '[]' });
                return route.abort();
            });
            await page.goto('http://musclelib.test/');
            for (const file of ['css/styles.css', 'css/responsive.css']) await page.addStyleTag({ content: fs.readFileSync(path.join(__dirname, '../public', file), 'utf8') });
            for (const file of ['js/components/navbar.js', 'js/script.js', 'js/components/search.js']) await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../public', file), 'utf8') });
            for (const [language, names] of [
                ['pt', { filters: 'Filtros', search: 'Pesquisar', theme: 'Alternar tema', language: 'Idioma' }],
                ['en', { filters: 'Filters', search: 'Search', theme: 'Toggle theme', language: 'Language' }],
                ['es', { filters: 'Filtros', search: 'Buscar', theme: 'Cambiar tema', language: 'Idioma' }],
            ]) {
                await page.locator('#language-select').selectOption(language);
                for (const key of ['filters', 'search', 'theme']) {
                    assert.equal(await page.getByRole('button', { name: names[key], exact: true }).count(), 1,
                        `${width}px ${language}: ${key} must have a localized accessible name`);
                }
                assert.equal(await page.getByRole('combobox', { name: names.language, exact: true }).count(), 1);
            }
            await page.close();
        }
        console.log('PASS navbar accessible names in PT, EN and ES at mobile and desktop sizes');
    } finally {
        await browser.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

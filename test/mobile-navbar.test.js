const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

// Exercise the production navbar and responsive styles without external services.
async function main() {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
    try {
        for (const viewport of [
            { width: 320, height: 568 },
            { width: 390, height: 844 },
            { width: 430, height: 932 },
            { width: 768, height: 1024 },
            { width: 820, height: 1180 },
        ]) {
            const page = await browser.newPage({ viewport });
            await page.route('**/*', route => route.abort());
            await page.setContent('<style>*{box-sizing:border-box}body{margin:0}.navbar{position:fixed;top:0;left:0;right:0}</style><body></body>');
            for (const file of ['css/styles.css', 'css/responsive.css']) {
                await page.addStyleTag({ content: fs.readFileSync(path.join(__dirname, '../public', file), 'utf8') });
            }
            for (const file of ['js/components/navbar.js', 'js/components/search.js']) {
                await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../public', file), 'utf8') });
            }
            for (const expanded of [false, true]) {
                if (expanded) await page.getByRole('button', { name: 'Pesquisar' }).click();
                const controls = await page.locator('nav button, nav select').evaluateAll(elements =>
                    elements.map(element => {
                        const rect = element.getBoundingClientRect();
                        return { name: element.id || element.className, left: rect.left, right: rect.right };
                    })
                );
                for (const control of controls) {
                    assert.ok(control.left >= 0 && control.right <= viewport.width,
                        `${viewport.width}x${viewport.height}, expanded=${expanded}: ${control.name} extends to ${control.right}px`);
                }
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
            }
            await page.close();
        }
        console.log('PASS mobile navbar controls fit at 320, 390, 430, 768 and 820 px, with search collapsed and expanded');
    } finally {
        await browser.close();
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

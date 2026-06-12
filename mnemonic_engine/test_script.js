const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('dialog', async dialog => {
        console.log('DIALOG APPEARED:', dialog.message());
        await dialog.accept();
    });

    await page.goto('http://localhost:8000/');
    
    await page.waitForSelector('.book-card h3');
    const cards = await page.$$('.book-card');
    for (const card of cards) {
        const title = await page.evaluate(el => el.querySelector('h3').innerText, card);
        if (title === 'Networking') {
            await card.click();
            break;
        }
    }
    
    await page.waitForSelector('.chapters-list .chapter-item');
    const chapters = await page.$$('.chapters-list .chapter-item');
    for (const chapter of chapters) {
        const text = await page.evaluate(el => el.innerText, chapter);
        if (text.includes('Chapter 01')) {
            await chapter.click();
            break;
        }
    }
    
    await page.waitForSelector('.bs-list-item');
    await page.click('#btn-edit-toggle');
    
    await page.waitForSelector('.btn-delete-section', { visible: true });
    
    // Inject a console log into the deleteSection function!
    await page.evaluate(() => {
        const oldDelete = window.deleteSection;
        window.deleteSection = async function(idx) {
            console.log("INSIDE DELETE SECTION, idx:", idx);
            return oldDelete(idx);
        };
        // Re-bind the first button to our hooked function just to test if it's the binding
        document.querySelector('.btn-delete-section').onclick = () => {
            console.log("BUTTON CLICKED DIRECTLY!");
            window.deleteSection(0);
        };
    });
    
    console.log("Clicking delete button...");
    await page.click('.btn-delete-section');
    await page.waitForTimeout(2000);
    
    await browser.close();
})();

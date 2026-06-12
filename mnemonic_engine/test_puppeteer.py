import asyncio
from pyppeteer import launch

async def main():
    browser = await launch(headless=True, args=['--no-sandbox'])
    page = await browser.newPage()
    
    # Intercept dialogs and accept them!
    page.on('dialog', lambda dialog: asyncio.ensure_future(dialog.accept()))
    
    # Listen to console
    page.on('console', lambda msg: print('CONSOLE:', msg.text))
    
    await page.goto('http://localhost:8000/')
    await page.waitForSelector('.books-grid .book-card')
    
    # Click Networking book
    cards = await page.querySelectorAll('.books-grid .book-card')
    for card in cards:
        title = await page.evaluate('(element) => element.querySelector("h3").innerText', card)
        if title == 'Networking':
            await card.click()
            break
            
    await page.waitForSelector('.chapters-list .chapter-item')
    
    # Click Chapter 1
    chapters = await page.querySelectorAll('.chapters-list .chapter-item')
    for chapter in chapters:
        title = await page.evaluate('(element) => element.innerText', chapter)
        if 'Chapter 01' in title:
            await chapter.click()
            break
            
    await page.waitForSelector('.bs-list-item')
    
    # Click Edit Toggle
    await page.evaluate('''() => {
        document.getElementById('btn-edit-toggle').click();
    }''')
    
    await page.waitForSelector('.btn-delete-section', {'visible': True})
    
    print("Clicking delete section 0")
    # Click Delete Section
    await page.evaluate('''() => {
        const btn = document.querySelector('.btn-delete-section');
        if (btn) {
            console.log("Found delete button, clicking...");
            btn.click();
        } else {
            console.log("Delete button not found");
        }
    }''')
    
    await page.waitFor(2000)
    await browser.close()

asyncio.get_event_loop().run_until_complete(main())

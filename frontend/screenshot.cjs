const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  // Set viewport to a standard desktop size
  await page.setViewport({ width: 1440, height: 1080 });
  
  try {
    console.log("Navigating to team dashboard...");
    await page.goto('http://localhost:3000/teams/10', { waitUntil: 'networkidle0' });
    
    // Wait for the stats to load and the Diamond Architecture to render
    await page.waitForSelector('.max-w-7xl h2', { timeout: 10000 });
    
    // Scroll to the bottom of the page to trigger any lazy loading or animations
    await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
    });
    
    // Wait a second for animations to settle
    await new Promise(r => setTimeout(r, 1000));
    
    // Take a screenshot of just the Diamond Architecture section
    const element = await page.$('section.mt-16'); 
    if (element) {
        await element.screenshot({ path: 'diamond.png' });
        console.log("Screenshot saved to diamond.png");
    } else {
        console.log("Could not find diamond section. Taking full page screenshot.");
        await page.screenshot({ path: 'full_page.png', fullPage: true });
    }
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await browser.close();
  }
})();

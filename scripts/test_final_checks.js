const { chromium } = require('@playwright/test');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  // Test desktop collapsed sidebar
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Test claim page for group booking
  console.log('Testing claim portal...');
  await page.goto('http://localhost:3000/signin', { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-signin-final.png') });
  
  await browser.close();
  console.log('Final checks complete!');
})();

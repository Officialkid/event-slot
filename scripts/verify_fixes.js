const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots_verification');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

(async () => {
  console.log('Starting verification audit on localhost:3000...');
  const browser = await chromium.launch({ headless: true });
  
  for (const theme of ['light', 'dark']) {
    console.log(`\n=== Testing Theme: ${theme.toUpperCase()} ===`);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      colorScheme: theme,
    });
    const page = await context.newPage();

    for (const route of [
      { name: '01-home', url: 'https://www.eventsslot.com/' },
      { name: '02-signup', url: 'https://www.eventsslot.com/signup' },
      { name: '03-signin', url: 'https://www.eventsslot.com/signin' },
      { name: '04-pricing', url: 'https://www.eventsslot.com/pricing' },
    ]) {
      try {
        console.log(`Navigating to ${route.name} (${route.url})...`);
        await page.goto(route.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1000);
        
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
          document.documentElement.className = t;
        }, theme);

        await page.waitForTimeout(1000);
        const screenshotPath = path.join(SCREENSHOT_DIR, `${route.name}-${theme}.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`✓ Captured: ${route.name}-${theme}.png`);
      } catch (err) {
        console.error(`✗ Error on ${route.name}:`, err.message);
      }
    }
    await context.close();
  }

  await browser.close();
  console.log('\nVerification audit finished!');
})();

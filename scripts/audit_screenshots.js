const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const routes = [
  { name: '01-landing', url: 'http://localhost:3000/' },
  { name: '02-signin', url: 'http://localhost:3000/signin' },
  { name: '03-pricing', url: 'http://localhost:3000/pricing' },
  { name: '04-features', url: 'http://localhost:3000/features' },
  { name: '05-terms', url: 'http://localhost:3000/terms' },
  { name: '06-privacy', url: 'http://localhost:3000/privacy' },
];

(async () => {
  console.log('Launching browser for automated E2E audit...');
  const browser = await chromium.launch({ headless: true });
  
  for (const theme of ['dark', 'light']) {
    console.log(`\n=== Testing Theme: ${theme.toUpperCase()} ===`);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      colorScheme: theme,
    });
    const page = await context.newPage();

    for (const r of routes) {
      try {
        console.log(`Navigating to ${r.name} (${r.url})...`);
        await page.goto(r.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(2000);
        
        // Force document theme attribute for complete visual audit
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
          document.documentElement.className = t;
        }, theme);

        await page.waitForTimeout(1000);
        const screenshotPath = path.join(SCREENSHOT_DIR, `${r.name}-${theme}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`✓ Captured: ${r.name}-${theme}.png`);
      } catch (err) {
        console.error(`✗ Error on ${r.name} (${theme}):`, err.message);
      }
    }
    await context.close();
  }

  await browser.close();
  console.log('\nAudit complete! Screenshots saved in:', SCREENSHOT_DIR);
})();

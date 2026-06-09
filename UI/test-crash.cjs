const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.toString());
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });

  try {
    console.log("Navigating to dashboard...");
    await page.goto('https://opsagent-nu.vercel.app/#dashboard', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    console.log("Navigating to reports...");
    await page.goto('https://opsagent-nu.vercel.app/#reports', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    console.log("Navigating to dashboard again...");
    await page.goto('https://opsagent-nu.vercel.app/#dashboard', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Done.");
  } catch (e) {
    console.error("Script error:", e);
  } finally {
    await browser.close();
  }
})();

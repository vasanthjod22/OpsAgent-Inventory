import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => {
    console.log('BROWSER PAGE ERROR:', error.message);
    console.log(error.stack);
  });
  page.on('requestfailed', request => {
    console.log('BROWSER REQUEST FAILED:', request.url(), request.failure().errorText);
  });

  // Mock localStorage to bypass login
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('opsagent_token', 'mock_token');
    localStorage.setItem('opsagent_user', JSON.stringify({
      id: 1, name: 'Admin', role: 'admin'
    }));
  });

  console.log('Navigating to http://localhost:4173 ...');
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
  console.log('Done.');
})();

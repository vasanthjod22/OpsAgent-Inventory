import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--disable-web-security'] });
  const page = await browser.newPage();
  
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/')) {
      request.respond({
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [{date: '2021-01-01', revenue: 100, sales: 100, count: 1, amount: 100, units: 10, value: 100, profit: 100, name: 'test', qty: 10}], items: [], kpis: { totalSales: 100 }, financeSummary: {} })
      });
    } else {
      request.continue();
    }
  });

  // Navigate to root to set localStorage
  await page.goto('http://localhost:4173', { waitUntil: 'domcontentloaded' });
  
  await page.evaluate(() => {
    localStorage.setItem('opsagent_auth', JSON.stringify({ isLoggedIn: true, currentUser: { id: 1 } }));
    localStorage.setItem('opsagent_token', 'test-token');
  });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
    console.log('STACK:', error.stack);
  });

  // Reload to bypass auth and load dashboard
  await page.goto('http://localhost:4173/dashboard', { waitUntil: 'networkidle0' });
  
  await browser.close();
})();

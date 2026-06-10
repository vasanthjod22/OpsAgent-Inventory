const https = require('https');

https.get('https://opsagent-inventory-ui-backend.onrender.com/api/inventory/stats', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
}).on('error', console.error);

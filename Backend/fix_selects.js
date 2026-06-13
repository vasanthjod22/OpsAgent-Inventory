const fs = require('fs');
const file = 'd:/Inventory/Backend/routes/reports.js';
let content = fs.readFileSync(file, 'utf8');

// For Product Report
content = content.replace(
  /\.select\('items, payment_status'\)/g,
  `.select('items, payment_status, date')`
);

// For Demand Report
content = content.replace(
  /\.select\('items, created_at'\)/g,
  `.select('items, created_at, date')`
);

// For Demand Report prevBills
content = content.replace(
  /\.select\('items'\)/g,
  `.select('items, date')`
);

fs.writeFileSync(file, content);
console.log('Fixed selects in reports.js successfully!');

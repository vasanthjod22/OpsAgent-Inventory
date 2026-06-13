const fs = require('fs');
const file = 'd:/Inventory/Backend/routes/reports.js';
let content = fs.readFileSync(file, 'utf8');

// Replace created_at with date in bills query for /customers
content = content.replace(
  /\.gte\('created_at', fromDate\)\s*\n\s*\.lte\('created_at', toDate\);/g,
  `.gte('date', fromDate.split('T')[0])\n      .lte('date', toDate.split('T')[0]);`
);

// Specifically for /billing order by
content = content.replace(
  /\.gte\('created_at', fromDate\)\s*\n\s*\.lte\('created_at', toDate\)\s*\n\s*\.order\('created_at', \{ ascending: false \}\);/g,
  `.gte('date', fromDate.split('T')[0])\n      .lte('date', toDate.split('T')[0])\n      .order('date', { ascending: false });`
);

// Specifically for /demand prevBills
content = content.replace(
  /\.gte\('created_at', prevFrom\)\s*\n\s*\.lt\('created_at', fromDate\);/g,
  `.gte('date', prevFrom.split('T')[0])\n      .lt('date', fromDate.split('T')[0]);`
);

// Fix date iteration for monthlyMap in /customers and /demand and /billing
// For /customers
content = content.replace(
  /const key = new Date\(b\.created_at\)\.toLocaleDateString\('en-IN', \{ month: 'short', year: '2-digit' \}\);/g,
  `const key = new Date(b.date || b.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });`
);

// Fix unpaid bills map
content = content.replace(
  /if \(b\.created_at < outstandingMap\[name\]\.oldestBill\) outstandingMap\[name\]\.oldestBill = b\.created_at;/g,
  `if ((b.date || b.created_at) < outstandingMap[name].oldestBill) outstandingMap[name].oldestBill = (b.date || b.created_at);`
);

// Fix firstOrder / lastOrder in /customers
content = content.replace(
  /firstOrder: b\.created_at,/g,
  `firstOrder: b.date || b.created_at,`
);
content = content.replace(
  /lastOrder: b\.created_at/g,
  `lastOrder: b.date || b.created_at`
);
content = content.replace(
  /if \(b\.created_at > custMap\[name\]\.lastOrder\) custMap\[name\]\.lastOrder = b\.created_at;/g,
  `if ((b.date || b.created_at) > custMap[name].lastOrder) custMap[name].lastOrder = (b.date || b.created_at);`
);
content = content.replace(
  /if \(b\.created_at < custMap\[name\]\.firstOrder\) custMap\[name\]\.firstOrder = b\.created_at;/g,
  `if ((b.date || b.created_at) < custMap[name].firstOrder) custMap[name].firstOrder = (b.date || b.created_at);`
);

// Fix oldestBill in unpaid bills
content = content.replace(
  /oldestBill: b\.created_at/g,
  `oldestBill: b.date || b.created_at`
);

// Fix daily trend in /billing
content = content.replace(
  /const date = new Date\(b\.created_at\)\.toLocaleDateString\('en-IN'/g,
  `const date = new Date(b.date || b.created_at).toLocaleDateString('en-IN'`
);

// Fix unpaid bills daysPending in /billing
content = content.replace(
  /daysPending: Math\.floor\(\(new Date\(\) - new Date\(b\.created_at\)\) \/ 86400000\)/g,
  `daysPending: Math.floor((new Date() - new Date(b.date || b.created_at)) / 86400000)`
);


fs.writeFileSync(file, content);
console.log('Fixed reports.js successfully!');

const fs = require('fs');
const file = 'd:/Inventory/Backend/routes/reports.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix /finance monthly trend
content = content.replace(
  /const monthlyData = \{\};\s*const months = 6;\s*for \(let i = months - 1; i >= 0; i--\) \{\s*const d = new Date\(\);\s*d\.setMonth\(d\.getMonth\(\) - i\);\s*const key = d\.toLocaleDateString\('en-IN', \{ month: 'short', year: '2-digit' \}\);\s*monthlyData\[key\] = \{ month: key, revenue: 0, expenses: 0, profit: 0 \};\s*\}/g,
  `const monthlyData = {};
    let currentData = new Date(fromDate);
    const endData = new Date(toDate);
    let maxData = 120;
    while (currentData <= endData && maxData > 0) {
      const key = currentData.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      if (!monthlyData[key]) monthlyData[key] = { month: key, revenue: 0, expenses: 0, profit: 0 };
      currentData.setMonth(currentData.getMonth() + 1);
      maxData--;
    }
    const endKeyData = endData.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    if (!monthlyData[endKeyData]) monthlyData[endKeyData] = { month: endKeyData, revenue: 0, expenses: 0, profit: 0 };`
);

// 2. Fix /customers monthly trend and Total Customers
content = content.replace(
  /const monthlyMap = \{\};\s*const months = 6;\s*for \(let i = months-1; i >= 0; i--\) \{\s*const d = new Date\(\);\s*d\.setMonth\(d\.getMonth\(\) - i\);\s*const key = d\.toLocaleDateString\('en-IN', \{ month: 'short', year: '2-digit' \}\);\s*monthlyMap\[key\] = \{ month: key, newCustomers: 0, orders: 0 \};\s*\}/g,
  `const monthlyMap = {};
    let currentMap = new Date(fromDate);
    const endMap = new Date(toDate);
    let maxMap = 120;
    while (currentMap <= endMap && maxMap > 0) {
      const key = currentMap.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      if (!monthlyMap[key]) monthlyMap[key] = { month: key, newCustomers: 0, orders: 0 };
      currentMap.setMonth(currentMap.getMonth() + 1);
      maxMap--;
    }
    const endKeyMap = endMap.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    if (!monthlyMap[endKeyMap]) monthlyMap[endKeyMap] = { month: endKeyMap, newCustomers: 0, orders: 0 };`
);

// Fix /customers totalCustomers KPI
content = content.replace(
  /totalCustomers: totalCustomers \|\| 0,/g,
  `totalCustomers: Math.max(totalCustomers || 0, Object.keys(custMap).length),`
);

// Fix /customers newCustomers fallback to firstOrder
content = content.replace(
  /newCustomers,/g,
  `newCustomers: newCustomers > 0 ? newCustomers : Object.values(custMap).filter(c => c.firstOrder >= fromDate && c.firstOrder <= toDate).length,`
);

// 3. Fix /demand monthly trend
content = content.replace(
  /const monthlyMap = \{\};\s*const months = 6;\s*for \(let i = months - 1; i >= 0; i--\) \{\s*const d = new Date\(\);\s*d\.setMonth\(d\.getMonth\(\) - i\);\s*const key = d\.toLocaleDateString\('en-IN', \{ month: 'short', year: '2-digit' \}\);\s*monthlyMap\[key\] = \{ month: key, units: 0 \};\s*\}/g,
  `const monthlyMap = {};
    let currentMap = new Date(fromDate);
    const endMap = new Date(toDate);
    let maxMap = 120;
    while (currentMap <= endMap && maxMap > 0) {
      const key = currentMap.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      if (!monthlyMap[key]) monthlyMap[key] = { month: key, units: 0 };
      currentMap.setMonth(currentMap.getMonth() + 1);
      maxMap--;
    }
    const endKeyMap = endMap.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    if (!monthlyMap[endKeyMap]) monthlyMap[endKeyMap] = { month: endKeyMap, units: 0 };`
);

fs.writeFileSync(file, content);
console.log('Fixed trends in reports.js successfully!');

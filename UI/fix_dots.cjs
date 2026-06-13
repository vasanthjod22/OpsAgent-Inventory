const fs = require('fs');
const glob = require('glob');

const files = [
  'd:/Inventory/UI/src/components/panels/SalesReport.jsx',
  'd:/Inventory/UI/src/components/panels/PurchaseReport.jsx',
  'd:/Inventory/UI/src/components/panels/DashboardPanel.jsx',
  'd:/Inventory/UI/src/components/panels/CustomerReport.jsx',
  'd:/Inventory/UI/src/components/panels/BillingReport.jsx',
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');

  if (f.includes('SalesReport.jsx')) {
    content = content.replace(/dot=\{\{ fill: '#3B82F6', strokeWidth: 2, r: 4 \}\}/g, "dot={data?.trend?.length > 24 ? false : { fill: '#3B82F6', strokeWidth: 2, r: 4 }}");
  } else if (f.includes('PurchaseReport.jsx')) {
    content = content.replace(/dot=\{\{ r: 4, fill: '#2563EB', strokeWidth: 2, stroke: 'white' \}\}/g, "dot={data?.trend?.length > 24 ? false : { r: 4, fill: '#2563EB', strokeWidth: 2, stroke: 'white' }}");
  } else if (f.includes('DashboardPanel.jsx')) {
    content = content.replace(/dot=\{\{ fill: '#2563EB', r: 4 \}\}/g, "dot={chartData?.length > 24 ? false : { fill: '#2563EB', r: 4 }}");
    content = content.replace(/dot=\{\{ fill: '#7C3AED', r: 3 \}\}/g, "dot={chartData?.length > 24 ? false : { fill: '#7C3AED', r: 3 }}");
  } else if (f.includes('CustomerReport.jsx')) {
    content = content.replace(/dot=\{\{ r: 4 \}\}/g, "dot={data?.monthlyTrend?.length > 24 ? false : { r: 4 }}");
  } else if (f.includes('BillingReport.jsx')) {
    content = content.replace(/dot=\{\{ r: 4 \}\}/g, "dot={data?.trend?.length > 24 ? false : { r: 4 }}");
  }

  fs.writeFileSync(f, content);
});

console.log('Fixed dots successfully!');

const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'UI', 'src', 'components', 'panels');

const filesToUpdate = [
  'DashboardPanel.jsx', // include DashboardPanel to redo it!
  'SalesReport.jsx',
  'ReportsPanel.jsx',
  'PurchaseReport.jsx',
  'ProductReport.jsx',
  'InventoryReport.jsx',
  'FinanceReport.jsx',
  'FinancePanel.jsx',
  'DemandAnalysis.jsx',
  'CustomerReport.jsx',
  'BillingReport.jsx'
];

filesToUpdate.forEach(file => {
  const filePath = path.join(targetDir, file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf-8');

  // Add import if not present
  if (!content.includes('ANIMATION_DEFAULTS')) {
    content = content.replace(
      /import \{ CHART_COLORS,.*?\} from '\.\.\/\.\.\/utils\/chartTheme'/,
      match => match.replace('}', ', ANIMATION_DEFAULTS }')
    );
  }

  // Ensure ANIMATION_DEFAULTS isn't duplicated
  content = content.replace(/\{\.\.\.ANIMATION_DEFAULTS\}\s*/g, '');

  // Inject {...ANIMATION_DEFAULTS} right after the tag names
  content = content.replace(/<(Line|Bar|Pie)(?=\s|>)/g, '<$1 {...ANIMATION_DEFAULTS}');

  // Add cascade classes to DashboardPanel specifically since we lost them
  if (file === 'DashboardPanel.jsx') {
    content = content.replace(/<div style=\{\{ display: 'grid', gridTemplateColumns: 'repeat\(auto-fit, minmax\(240px, 1fr\)\)', gap: 16, marginBottom: 24 \}\}>/, '<div className="cascade-1" style={{ display: \'grid\', gridTemplateColumns: \'repeat(auto-fit, minmax(240px, 1fr))\', gap: 16, marginBottom: 24 }}>');
    
    content = content.replace(/<div style=\{\{ background: 'var\(--bg-card\)', border: '1px solid var\(--border\)', borderRadius: 12, padding: '20px 24px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, boxShadow: 'var\(--shadow-card\)' \}\}>/, '<div className="cascade-2" style={{ background: \'var(--bg-card)\', border: \'1px solid var(--border)\', borderRadius: 12, padding: \'20px 24px\', marginBottom: 24, display: \'flex\', flexWrap: \'wrap\', alignItems: \'center\', justifyContent: \'space-between\', gap: 16, boxShadow: \'var(--shadow-card)\' }}>');
    
    content = content.replace(/<div style=\{\{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 \}\}>/, '<div className="cascade-3" style={{ display: \'grid\', gridTemplateColumns: \'2fr 1fr\', gap: 24, marginBottom: 24 }}>');

    content = content.replace(/<div style=\{\{ background: 'var\(--bg-card\)', border: '1px solid var\(--border\)', borderRadius: 12, padding: 24, marginBottom: 24 \}\}>/, '<div className="cascade-4" style={{ background: \'var(--bg-card)\', border: \'1px solid var(--border)\', borderRadius: 12, padding: 24, marginBottom: 24 }}>');

    content = content.replace(/<div style=\{\{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 \}\}>/, '<div className="cascade-5" style={{ display: \'grid\', gridTemplateColumns: \'1fr 1fr\', gap: 24 }}>');
  }

  fs.writeFileSync(filePath, content, 'utf-8');
});

console.log('Done updating charts');

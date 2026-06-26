const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'UI', 'src', 'components', 'panels');

const filesToUpdate = [
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

  // If ANIMATION_DEFAULTS is not imported, import it!
  if (!content.includes('import { ANIMATION_DEFAULTS } from') && !content.includes('import { CHART_COLORS, CHART_DEFAULTS, tooltipStyle, gridStyle, axisStyle, ANIMATION_DEFAULTS } from')) {
    // Inject at the top below other imports
    const importStatement = "\nimport { ANIMATION_DEFAULTS } from '../../utils/chartTheme';\n";
    
    // Find the last import
    const lastImportIndex = content.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const endOfLastImport = content.indexOf('\n', lastImportIndex);
      content = content.slice(0, endOfLastImport + 1) + importStatement + content.slice(endOfLastImport + 1);
    } else {
      content = importStatement + content;
    }
  }

  // Ensure tooltips are frosted glass. Instead of replacing local tooltipStyle (which might be complex), we can just let ANIMATION_DEFAULTS fix the crash for now.
  // Wait, I promised frosted glass tooltips. I can add wrapperClassName="glass-tooltip" to <RechartsTooltip> locally.
  content = content.replace(/<RechartsTooltip(?![^>]*wrapperClassName)/g, '<RechartsTooltip wrapperClassName="glass-tooltip"');

  fs.writeFileSync(filePath, content, 'utf-8');
});

console.log('Fixed imports');

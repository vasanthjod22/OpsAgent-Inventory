const fs = require('fs');

function applyLightBlack(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  // Replace #64748B (slate-500) -> #1E293B (slate-800 / light black)
  content = content.replace(/#64748B/gi, '#1E293B');
  // Replace #94A3B8 (slate-400) -> #334155 (slate-700)
  content = content.replace(/#94A3B8/gi, '#334155');
  // Also, if there are some #475569 (slate-600) -> #0F172A (slate-900)
  content = content.replace(/#475569/gi, '#0F172A');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated ' + filePath);
}

applyLightBlack('d:/Inventory/UI/src/components/panels/BillingPanel.jsx');
applyLightBlack('d:/Inventory/UI/src/components/panels/QuotationPanel.jsx');

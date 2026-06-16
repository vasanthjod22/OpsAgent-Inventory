const fs = require('fs');
const file = 'd:/Inventory/UI/src/components/panels/InventoryPanel.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const lastR = item\.last_restocked/g,
  `const lastR = item.last_restocked || item.date_added`
);

fs.writeFileSync(file, content);
console.log('Fixed lastR fallback to date_added');

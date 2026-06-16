const fs = require('fs');
const path = require('path');

// 1. Create dateUtils.js
fs.writeFileSync('d:/Inventory/UI/src/utils/dateUtils.js', `export const formatDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return \`\${day}-\${month}-\${year}\`;
};
`);

// 2. Remove inline formatDate and add import
const formatDateStr = `const formatDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return \`\${day}-\${month}-\${year}\`;
};\n`;

const panelsDir = 'd:/Inventory/UI/src/components/panels';
const files = fs.readdirSync(panelsDir);
for (const file of files) {
  if (file.endsWith('.jsx')) {
    const fullPath = path.join(panelsDir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    let changed = false;
    
    if (content.includes('const formatDate = (d) => {\n  if (!d) return')) {
      content = content.replace(formatDateStr, '');
      changed = true;
    }

    if (content.includes('formatDate(') && !content.includes('import { formatDate }')) {
      content = `import { formatDate } from '../../utils/dateUtils';\n` + content;
      changed = true;
    }
    
    if (changed) {
      fs.writeFileSync(fullPath, content);
      console.log('Fixed', file);
    }
  }
}

// Do the same for utils
const utilsDir = 'd:/Inventory/UI/src/utils';
for (const file of ['exportUtils.js', 'pdfGenerator.js']) {
  const fullPath = path.join(utilsDir, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    let changed = false;
    if (content.includes('const formatDate = (d) => {\n  if (!d) return')) {
      content = content.replace(formatDateStr, '');
      changed = true;
    }
    if (content.includes('formatDate(') && !content.includes('import { formatDate }')) {
      content = `import { formatDate } from './dateUtils';\n` + content;
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(fullPath, content);
      console.log('Fixed', file);
    }
  }
}

// Do the same for backend routes
const backendDir = 'd:/Inventory/Backend/routes';
const backendFiles = fs.readdirSync(backendDir);
for (const file of backendFiles) {
  if (file.endsWith('.js')) {
    const fullPath = path.join(backendDir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    let changed = false;
    if (content.includes('const formatDate = (d) => {\n  if (!d) return')) {
      content = content.replace(formatDateStr, '');
      changed = true;
    }

    if (content.includes('formatDate(') && !content.includes('const { formatDate }')) {
      content = `const { formatDate } = require('../services/dateUtils');\n` + content;
      changed = true;
    }
    
    if (changed) {
      fs.writeFileSync(fullPath, content);
      console.log('Fixed', file);
    }
  }
}

// Write backend dateUtils
fs.writeFileSync('d:/Inventory/Backend/services/dateUtils.js', `const formatDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return \`\${day}-\${month}-\${year}\`;
};
module.exports = { formatDate };
`);

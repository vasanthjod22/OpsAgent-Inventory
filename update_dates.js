const fs = require('fs');
const path = require('path');

const formatDateStr = `const formatDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return \`\${day}-\${month}-\${year}\`;
};
`;

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Add formatDate utility if not present and we need it
  let needsFormatDate = false;

  // Pattern 1: new Date(X).toLocaleDateString(...)
  content = content.replace(/new Date\(([^)]+)\)\.toLocaleDateString\([^)]*\)/g, (match, inner) => {
    needsFormatDate = true;
    return `formatDate(${inner})`;
  });

  // Pattern 2: d.toLocaleDateString(...) where d is already a date variable
  content = content.replace(/([a-zA-Z0-9_]+)\.toLocaleDateString\([^)]*\)/g, (match, varName) => {
    needsFormatDate = true;
    return `formatDate(${varName})`;
  });
  
  // Pattern 3: new Date().toLocaleDateString(...)
  content = content.replace(/new Date\(\)\.toLocaleDateString\([^)]*\)/g, (match) => {
    needsFormatDate = true;
    return `formatDate(new Date())`;
  });

  if (needsFormatDate && !content.includes('const formatDate =')) {
    // Insert after imports
    const lastImportIndex = content.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const endOfImports = content.indexOf('\n', content.indexOf(';', lastImportIndex));
      if (endOfImports !== -1) {
        content = content.slice(0, endOfImports + 1) + '\n' + formatDateStr + content.slice(endOfImports + 1);
      } else {
        content = formatDateStr + content;
      }
    } else {
      const lastRequireIndex = content.lastIndexOf('require(');
      if (lastRequireIndex !== -1) {
        const endOfRequire = content.indexOf('\n', content.indexOf(';', lastRequireIndex));
        if (endOfRequire !== -1) {
          content = content.slice(0, endOfRequire + 1) + '\n' + formatDateStr + content.slice(endOfRequire + 1);
        } else {
          content = formatDateStr + content;
        }
      } else {
        content = formatDateStr + content;
      }
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log('Updated', filePath);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file.endsWith('.cjs')) continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      replaceInFile(fullPath);
    }
  }
}

walk('d:/Inventory/UI/src');
walk('d:/Inventory/Backend/routes');
walk('d:/Inventory/Backend/services');
console.log('Done');

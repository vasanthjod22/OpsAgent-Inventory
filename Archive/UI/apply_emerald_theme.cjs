const fs = require('fs');
const path = require('path');

const replacements = {
  // Primary Blues to Emeralds
  '#2563EB': '#10B981', // Blue-600 -> Emerald-500
  '#2563eb': '#10B981',
  '#1D4ED8': '#059669', // Blue-700 -> Emerald-600
  '#1d4ed8': '#059669',
  '#1E3A8A': '#064E3B', // Blue-900 -> Emerald-900
  '#1e3a8a': '#064E3B',
  '#3B82F6': '#34D399', // Blue-500 -> Emerald-400
  '#3b82f6': '#34D399',
  
  // Light Background Blues to Light Emeralds
  '#EFF6FF': '#ECFDF5', // Blue-50 -> Emerald-50
  '#eff6ff': '#ECFDF5',
  '#DBEAFE': '#D1FAE5', // Blue-100 -> Emerald-100
  '#dbeaFe': '#D1FAE5',
  
  // Border / Accent Blues to Emeralds
  '#BFDBFE': '#A7F3D0', // Blue-200 -> Emerald-200
  '#bfdbfe': '#A7F3D0',
  '#93C5FD': '#6EE7B7', // Blue-300 -> Emerald-300
  '#93c5fd': '#6EE7B7',
  '#60A5FA': '#34D399', // Blue-400 -> Emerald-400
  '#60a5fa': '#34D399',
  
  // Sky Blue used in some accents
  '#38BDF8': '#34D399', // Sky-400 -> Emerald-400
  '#38bdf8': '#34D399',
  '#E0F2FE': '#ECFDF5', // Sky-100 -> Emerald-50
  '#e0f2fe': '#ECFDF5',
  '#BAE6FD': '#D1FAE5', // Sky-200 -> Emerald-100
  '#bae6fd': '#D1FAE5',
};

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walkDir(file));
    } else { 
      if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.css')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walkDir(path.join(__dirname, 'src'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  for (const [blue, emerald] of Object.entries(replacements)) {
    // Escape hash for regex
    const regex = new RegExp(blue, 'g');
    content = content.replace(regex, emerald);
  }
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});

console.log("Emerald theme applied successfully to all files.");

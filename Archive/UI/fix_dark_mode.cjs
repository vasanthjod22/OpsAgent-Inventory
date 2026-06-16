const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const replacements = [
  { regex: /background:\s*['"]white['"]/g, replacement: "background: 'var(--bg-card)'" },
  { regex: /background:\s*['"]#FFFFFF['"]/gi, replacement: "background: 'var(--bg-card)'" },
  { regex: /background:\s*['"]#F8FAFC['"]/gi, replacement: "background: 'var(--bg-main)'" },
  { regex: /background:\s*['"]#F1F5F9['"]/gi, replacement: "background: 'var(--bg-main)'" },
  
  { regex: /color:\s*['"]#0F172A['"]/gi, replacement: "color: 'var(--text-primary)'" },
  { regex: /color:\s*['"]#1E293B['"]/gi, replacement: "color: 'var(--text-primary)'" },
  { regex: /color:\s*['"]#334155['"]/gi, replacement: "color: 'var(--text-secondary)'" },
  { regex: /color:\s*['"]#475569['"]/gi, replacement: "color: 'var(--text-muted)'" },
  { regex: /color:\s*['"]#64748B['"]/gi, replacement: "color: 'var(--text-muted)'" },

  { regex: /border:\s*['"]1px solid #E2E8F0['"]/gi, replacement: "border: '1px solid var(--border)'" },
  { regex: /borderBottom:\s*['"]1px solid #E2E8F0['"]/gi, replacement: "borderBottom: '1px solid var(--border)'" },
  { regex: /borderTop:\s*['"]1px solid #E2E8F0['"]/gi, replacement: "borderTop: '1px solid var(--border)'" },
  { regex: /borderLeft:\s*['"]1px solid #E2E8F0['"]/gi, replacement: "borderLeft: '1px solid var(--border)'" },
  { regex: /borderRight:\s*['"]1px solid #E2E8F0['"]/gi, replacement: "borderRight: '1px solid var(--border)'" },
  { regex: /borderColor:\s*['"]#E2E8F0['"]/gi, replacement: "borderColor: 'var(--border)'" },
];

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const { regex, replacement } of replacements) {
        if (regex.test(content)) {
          content = content.replace(regex, replacement);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated:', fullPath);
      }
    }
  }
}

processDir(srcDir);
console.log('Done!');

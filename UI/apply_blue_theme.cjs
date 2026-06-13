const fs = require('fs');
const path = require('path');

const replacements = {
  // Emeralds back to Primary Blues
  '#10B981': '#2563EB', // Emerald-500 -> Blue-600
  '#10b981': '#2563EB',
  '#059669': '#1D4ED8', // Emerald-600 -> Blue-700
  '#059669': '#1D4ED8',
  '#064E3B': '#1E3A8A', // Emerald-900 -> Blue-900
  '#064e3b': '#1E3A8A',
  
  // Light Emeralds back to Light Blues
  '#ECFDF5': '#EFF6FF', // Emerald-50 -> Blue-50
  '#ecfdf5': '#EFF6FF',
  '#D1FAE5': '#DBEAFE', // Emerald-100 -> Blue-100
  '#d1fae5': '#DBEAFE',
  
  // Border / Accent Emeralds back to Blues/Sky
  '#A7F3D0': '#BFDBFE', // Emerald-200 -> Blue-200
  '#a7f3d0': '#BFDBFE',
  '#6EE7B7': '#93C5FD', // Emerald-300 -> Blue-300
  '#6ee7b7': '#93C5FD',
  '#34D399': '#38BDF8', // Emerald-400 -> Sky-400 (was mapped from multiple)
  '#34d399': '#38BDF8',
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
  
  for (const [emerald, blue] of Object.entries(replacements)) {
    const regex = new RegExp(emerald, 'g');
    content = content.replace(regex, blue);
  }
  
  // Also fix up the Sidebar which was set to custom Steel Blue/Baby Blue
  if (file.includes('Sidebar.jsx')) {
    content = content.replace(/background: '#E6F0FA'/g, "background: 'linear-gradient(180deg, #1E3A8A 0%, #2563EB 100%)'");
    content = content.replace(/background: isActive \? '#2A75D3' : 'transparent'/g, "background: isActive ? '#EFF6FF' : 'transparent'");
    content = content.replace(/color=\{isActive \? 'white' : '#1C2D42'\}/g, "color={isActive ? '#2563EB' : '#94A3B8'}");
    content = content.replace(/color: isActive \? 'white' : '#1C2D42'/g, "color: isActive ? 'white' : 'rgba(255,255,255,0.7)'");
    content = content.replace(/onMouseEnter=\{e => \{ if \(!isActive\) e\.currentTarget\.style\.background = '#D4E5F7' \}\}/g, "onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}");
    content = content.replace(/onMouseEnter=\{e => \{ if\(!isActive\) e\.currentTarget\.style\.background = '#D4E5F7' \}\}/g, "onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}");
    content = content.replace(/onMouseEnter=\{e => e\.currentTarget\.style\.background = '#D4E5F7'\}/g, "onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}");
    content = content.replace(/borderBottom: '1px solid rgba\(0,0,0,0\.05\)'/g, "borderBottom: '1px solid rgba(255,255,255,0.1)'");
    content = content.replace(/borderTop: '1px solid rgba\(0,0,0,0\.05\)'/g, "borderTop: '1px solid rgba(255,255,255,0.1)'");
    content = content.replace(/background: 'rgba\(0,0,0,0\.05\)'/g, "background: 'rgba(255,255,255,0.1)'");
    content = content.replace(/background: '#0F172A', borderRadius: '3px'/g, "background: 'white', borderRadius: '3px'");
    content = content.replace(/color: '#0F172A', letterSpacing: '-0\.02em'/g, "color: 'white', letterSpacing: '-0.02em'");
    content = content.replace(/color: '#64748B', fontWeight: 500/g, "color: 'rgba(255,255,255,0.7)', fontWeight: 500");
    content = content.replace(/color: '#0F172A', display: 'block'/g, "color: 'white', display: 'block'");
    content = content.replace(/color: '#1C2D42'/g, "color: 'rgba(255,255,255,0.7)'");
    content = content.replace(/color="#1C2D42"/g, 'color="rgba(255,255,255,0.7)"');
  }

  // Set the main background back to slate 50
  if (file.includes('index.css')) {
    content = content.replace(/--bg-main:\s*#FFFFFF;/g, "--bg-main:        #F8FAFC;");
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});

console.log("Reliable Blue theme applied successfully to all files.");

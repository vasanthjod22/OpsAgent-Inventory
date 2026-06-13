const fs = require('fs');

let sidebar = fs.readFileSync('src/components/Sidebar.jsx', 'utf8');

// 1. Background
sidebar = sidebar.replace(/background: 'linear-gradient\(180deg, #E0F2FE 0%, #BAE6FD 100%\)'/g, "background: '#E6F0FA'");
sidebar = sidebar.replace(/background: 'linear-gradient\(180deg, #064E3B 0%, #10B981 100%\)'/g, "background: '#E6F0FA'");

// 2. Active Tab
// In the mobile nav area:
sidebar = sidebar.replace(/background: isActive \? '#ECFDF5' : 'transparent'/g, "background: isActive ? '#2A75D3' : 'transparent'");
sidebar = sidebar.replace(/color=\{isActive \? '#10B981' : '#94A3B8'\}/g, "color={isActive ? 'white' : '#1C2D42'}");

// In the desktop nav area (around line 178)
sidebar = sidebar.replace(/background: isActive \? '#ECFDF5' : 'transparent'/g, "background: isActive ? '#2A75D3' : 'transparent'");
sidebar = sidebar.replace(/color=\{isActive \? 'white' : 'rgba\(255,255,255,0\.6\)'\}/g, "color={isActive ? 'white' : '#1C2D42'}");
sidebar = sidebar.replace(/color: isActive \? 'white' : 'rgba\(255,255,255,0\.8\)'/g, "color: isActive ? 'white' : '#1C2D42'");

// 3. Hover State
sidebar = sidebar.replace(/onMouseEnter=\{e => \{ if \(!isActive\) e\.currentTarget\.style\.background = 'rgba\(255,255,255,0\.1\)' \}\}/g, "onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#D4E5F7' }}");
sidebar = sidebar.replace(/onMouseEnter=\{e => \{ if\(!isActive\) e\.currentTarget\.style\.background = 'rgba\(255,255,255,0\.1\)' \}\}/g, "onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = '#D4E5F7' }}");

// 4. Update the settings button hover
sidebar = sidebar.replace(/onMouseEnter=\{e => e\.currentTarget\.style\.background = 'rgba\(255,255,255,0\.1\)'\}/g, "onMouseEnter={e => e.currentTarget.style.background = '#D4E5F7'}");

// 5. Update borders
sidebar = sidebar.replace(/borderTop: '1px solid rgba\(255,255,255,0\.1\)'/g, "borderTop: '1px solid rgba(0,0,0,0.05)'");

// Ensure everything else is dark text
sidebar = sidebar.replace(/color: 'rgba\(255,255,255,0\.6\)'/g, "color: '#1C2D42'");
sidebar = sidebar.replace(/color="rgba\(255,255,255,0\.7\)"/g, 'color="#1C2D42"');
sidebar = sidebar.replace(/color="#64748B"/g, 'color="#1C2D42"'); // From previous script
sidebar = sidebar.replace(/color: '#0F172A'/g, "color: '#1C2D42'");
sidebar = sidebar.replace(/color: '#64748B'/g, "color: '#1C2D42'");

fs.writeFileSync('src/components/Sidebar.jsx', sidebar, 'utf8');

console.log("Updated Sidebar.jsx");

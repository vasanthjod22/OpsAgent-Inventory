const fs = require('fs');

// 1. Fix ChatPanel hover
let chat = fs.readFileSync('src/components/panels/ChatPanel.jsx', 'utf8');
chat = chat.replace(/e\.currentTarget\.style\.background = '#1e293b'/g, "e.currentTarget.style.background = '#F8FAFC'");
fs.writeFileSync('src/components/panels/ChatPanel.jsx', chat, 'utf8');

// 2. Fix index.css bg-main
let css = fs.readFileSync('src/index.css', 'utf8');
css = css.replace(/--bg-main:\s*#F8FAFC;/g, "--bg-main:        #FFFFFF;");
fs.writeFileSync('src/index.css', css, 'utf8');

// 3. Fix Sidebar
let sidebar = fs.readFileSync('src/components/Sidebar.jsx', 'utf8');
sidebar = sidebar.replace(/background: 'linear-gradient\(180deg, #064E3B 0%, #10B981 100%\)'/g, "background: 'linear-gradient(180deg, #E0F2FE 0%, #BAE6FD 100%)'");
sidebar = sidebar.replace(/borderBottom: '1px solid rgba\(255,255,255,0\.1\)'/g, "borderBottom: '1px solid rgba(0,0,0,0.05)'");
sidebar = sidebar.replace(/background: 'rgba\(255,255,255,0\.2\)'/g, "background: 'rgba(0,0,0,0.05)'");
sidebar = sidebar.replace(/background: 'white', borderRadius: '3px'/g, "background: '#0F172A', borderRadius: '3px'");
sidebar = sidebar.replace(/color: 'white', letterSpacing: '-0\.02em'/g, "color: '#0F172A', letterSpacing: '-0.02em'");
sidebar = sidebar.replace(/color: 'rgba\(255,255,255,0\.7\)', fontWeight: 500/g, "color: '#64748B', fontWeight: 500");
sidebar = sidebar.replace(/color: isActive \? 'white' : 'rgba\(255,255,255,0\.7\)'/g, "color: isActive ? '#0F172A' : '#64748B'");
sidebar = sidebar.replace(/background: 'rgba\(255,255,255,0\.1\)'/g, "background: 'rgba(0,0,0,0.05)'");
sidebar = sidebar.replace(/color: 'white', display: 'block'/g, "color: '#0F172A', display: 'block'");
sidebar = sidebar.replace(/color: 'rgba\(255,255,255,0\.6\)'/g, "color: '#64748B'");
sidebar = sidebar.replace(/<Settings size=\{20\} color="rgba\(255,255,255,0\.7\)" \/>/g, '<Settings size={20} color="#64748B" />');
sidebar = sidebar.replace(/<LogOut size=\{18\} \/>/g, '<LogOut size={18} color="#64748B" />');
fs.writeFileSync('src/components/Sidebar.jsx', sidebar, 'utf8');

console.log("Fixes applied!");

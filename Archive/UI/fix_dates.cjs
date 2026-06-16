const fs = require('fs');
const path = require('path');
const dir = 'd:/Inventory/UI/src/components/panels';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

for (const f of files) {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  let changed = false;

  const r1 = content.replace(/const \[dateRange, setDateRange\] = useState\('(month|year)'\)/g, "const [dateRange, setDateRange] = useState('all')");
  const r2 = r1.replace(/const \[period, setPeriod\] = useState\('(month|year)'\)/g, "const [period, setPeriod] = useState('all')");
  const r3 = r2.replace(/const \[trendFilter, setTrendFilter\] = useState\('(month|year)'\)/g, "const [trendFilter, setTrendFilter] = useState('all')");

  if (content !== r3) {
    fs.writeFileSync(p, r3);
    console.log('Updated', f);
  }
}

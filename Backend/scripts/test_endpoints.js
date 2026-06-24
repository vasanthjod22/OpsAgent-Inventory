require('dotenv').config({ path: '../.env' });
const jwt = require('jsonwebtoken');

async function run() {
  const resUser = await fetch(`${process.env.SUPABASE_URL}/rest/v1/users?select=id&limit=1`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
    }
  });
  const users = await resUser.json();
  if (!users || users.length === 0) return console.log("No users found");
  
  const userId = users[0].id;
  
  // 2. Generate token
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
  // 3. Fetch from Render
  console.log("Fetching from Render...");
  const res = await fetch('https://opsagent-inventory-ui-backend.onrender.com/api/reports/inventory', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!res.ok) {
    console.log("Render fetch failed", res.status, await res.text());
  } else {
    const data = await res.json();
    console.log("Render totalValue:", data.kpis?.totalValue);
  }
  
  // 4. Fetch from localhost just in case
  console.log("Fetching from Localhost...");
  const localRes = await fetch('http://localhost:3001/api/reports/inventory', {
    headers: { 'Authorization': `Bearer ${token}` }
  }).catch(() => null);
  
  if (localRes && localRes.ok) {
    const localData = await localRes.json();
    console.log("Local totalValue:", localData.kpis?.totalValue);
  } else {
    console.log("Local fetch failed or server not running");
  }
}
run();

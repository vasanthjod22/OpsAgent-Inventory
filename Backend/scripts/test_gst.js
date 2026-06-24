require('dotenv').config({ path: '../.env' });

async function run() {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/inventory?select=id,name,qty,rate,cgst_percent,sgst_percent&limit=10`, {
    headers: {
      'apikey': process.env.SUPABASE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
    }
  });
  const data = await res.json();
  console.log(data);
}
run();

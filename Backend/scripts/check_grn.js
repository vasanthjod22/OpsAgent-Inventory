require('dotenv').config({ path: '../.env' });

async function run() {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/grn?date=eq.2021-08-11`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
    }
  });
  const data = await res.json();
  console.log("GRNs on 11/08/2021:", JSON.stringify(data, null, 2));
}
run();

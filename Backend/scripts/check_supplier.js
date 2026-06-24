require('dotenv').config({ path: '../.env' });

async function run() {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/inventory?supplier_name=eq.JOHNSON%20PIPES&last_restocked=eq.2021-08-11&select=name,qty,rate,cgst_percent,sgst_percent`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
    }
  });
  const data = await res.json();
  let total = 0;
  data.forEach(item => {
    const cgst = Number(item.cgst_percent) || 0;
    const sgst = Number(item.sgst_percent) || 0;
    const val = item.qty * item.rate * (1 + (cgst + sgst) / 100);
    total += val;
    console.log(`${item.name} - Qty: ${item.qty}, Rate: ${item.rate}, Val: ${val.toFixed(2)}`);
  });
  console.log("Total:", total);
}
run();

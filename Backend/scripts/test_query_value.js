require('dotenv').config({ path: '../.env' });

async function run() {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/inventory?select=qty,rate,cgst_percent,sgst_percent`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
    }
  });
  const data = await res.json();
  
  let oldVal = 0;
  let newVal = 0;
  
  data.forEach(item => {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const cgst = Number(item.cgst_percent) || 0;
    const sgst = Number(item.sgst_percent) || 0;
    
    oldVal += qty * rate;
    newVal += qty * rate * (1 + (cgst + sgst) / 100);
  });
  
  console.log({ oldVal, newVal });
}
run();

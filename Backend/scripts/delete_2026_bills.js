require('dotenv').config({ path: '.env' });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

async function fixBills() {
  const getRes = await fetch(`${url}/rest/v1/bills?created_at=gte.2026-01-01&select=id`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  
  const data = await getRes.json();
  console.log("Bills in 2026:", data);
  
  if (data && data.length > 0) {
    const ids = data.map(b => b.id).join(',');
    console.log(`Deleting these ${data.length} bills to clean up the graph...`);
    
    const delRes = await fetch(`${url}/rest/v1/bills?id=in.(${ids})`, {
      method: 'DELETE',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    if (delRes.ok) {
      console.log("Deleted successfully.");
    } else {
      console.log("Delete failed:", await delRes.text());
    }
  }
}

fixBills();

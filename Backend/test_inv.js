const supabase = require('./data/supabaseClient');

async function test() {
  const fromDate = new Date(new Date().getFullYear(), 0, 1).toISOString();
  console.log("From:", fromDate);
  
  // Just take any user_id that exists in inventory, let's fetch first
  const { data: anyInv } = await supabase.from('inventory').select('user_id').limit(1);
  if (!anyInv || anyInv.length === 0) return console.log("No inventory");
  const userId = anyInv[0].user_id;

  const { data: inventoryItems, error } = await supabase
    .from('inventory')
    .select('qty, rate, created_at')
    .eq('user_id', userId)
    .gte('created_at', fromDate);
    
  console.log("Error:", error);
  console.log("Items count since this year:", inventoryItems?.length);
  if(inventoryItems?.length > 0) {
     console.log("First item:", inventoryItems[0]);
  }
}

test();

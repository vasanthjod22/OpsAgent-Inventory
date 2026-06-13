const supabase = require('./data/supabaseClient');

async function test() {
  const { data: inventory, error: invErr } = await supabase.from('inventory').select('id, name, sku, cost_price, rate, qty');
  console.log("INVENTORY ERROR:", invErr);
  console.log("INVENTORY DATA LENGTH:", inventory?.length);
  if (inventory && inventory.length > 0) {
     console.log(inventory[0]);
  }

  const { data: bills, error: billErr } = await supabase.from('bills').select('id, items').limit(2);
  console.log("BILL ERROR:", billErr);
}

test().catch(console.error);

const supabase = require('./data/supabaseClient');
async function run() {
  const { data, error } = await supabase.from('inventory').select('id, name, qty, rate, cost_price').eq('supplier_name', "KHUMAR'S CERAMICS").limit(5);
  if (error) { console.error(error); return; }
  console.log(data);
}
run();

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
  const { data } = await supabase.from('inventory').select('id, name, sku, hsn').ilike('name', '%TMT BARS%');
  console.log("Items:", data);
}
test();

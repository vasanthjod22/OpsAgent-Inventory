require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const sku = "72142090";
  let query = supabase
    .from('inventory')
    .select('*')
    // No user_id for service role
    .or(`sku.eq.${sku},hsn.eq.${sku},id.eq.${sku}`);

  const { data: item, error: itemErr } = await query.maybeSingle();
  console.log("Error:", itemErr);
  console.log("Data:", item ? item.id : null);
}
test();

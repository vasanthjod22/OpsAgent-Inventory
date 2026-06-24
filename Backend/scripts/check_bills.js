require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkBills() {
  const { data, error } = await supabase.from('bills').select('id, bill_number, date, created_at').order('created_at', { ascending: false }).limit(10);
  if (error) console.error(error);
  console.log(data);
}

checkBills();

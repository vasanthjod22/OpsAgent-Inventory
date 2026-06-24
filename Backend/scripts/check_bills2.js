const { supabase } = require('../utils/supabase.js');

async function checkBills() {
  const { data, error } = await supabase.from('bills').select('id, bill_number, date, created_at').order('created_at', { ascending: false }).limit(20);
  if (error) console.error(error);
  console.log(data);
}

checkBills();

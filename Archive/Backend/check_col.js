const supabase = require('./data/supabaseClient');

async function check() {
  const { data, error } = await supabase.from('bills').select('payment_method').limit(1);
  if (error) {
    console.error("Column missing or error:", error.message);
  } else {
    console.log("Column exists!", data);
  }
}
check();

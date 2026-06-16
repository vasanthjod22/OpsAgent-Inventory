const supabase = require('./data/supabaseClient');

async function check() {
  const { data, error } = await supabase.from('bills').select('*').limit(1);
  console.log(data, error);
}

check();

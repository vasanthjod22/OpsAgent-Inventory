require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  // Wait, I can just curl the Render endpoint directly using my JWT secret? No, JWTs need to match the user.
  // Instead, I'll just check if Render is accessible
  const res = await fetch('https://opsagent-inventory-ui-backend.onrender.com/health', { method: 'GET' }).catch(e => console.error(e));
  if (res) console.log(await res.text().catch(e => null));
}
run();

/**
 * Script: update_bill_dates.js
 * Updates the dates for specific bills in Supabase:
 *   Bill 9  → 2021-10-05
 *   Bill 10 → 2021-10-18
 *   Bill 11 → 2021-11-13
 *
 * Usage: node scripts/update_bill_dates.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const supabase = require('../data/supabaseClient');

const BILL_UPDATES = [
  { position: 9,  date: '2021-10-05' },
  { position: 10, date: '2021-10-18' },
  { position: 11, date: '2021-11-13' },
];

async function run() {
  console.log('Fetching all bills ordered by creation date...');

  // Fetch all bills ordered ascending (oldest first)
  const { data: bills, error } = await supabase
    .from('bills')
    .select('id, bill_number, date, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching bills:', error.message);
    process.exit(1);
  }

  console.log(`Found ${bills.length} total bills.`);

  for (const update of BILL_UPDATES) {
    const bill = bills[update.position - 1]; // 1-indexed
    if (!bill) {
      console.warn(`Bill #${update.position} not found (only ${bills.length} bills exist)`);
      continue;
    }

    console.log(`\nUpdating Bill #${update.position}: ${bill.bill_number} (current date: ${bill.date}) → ${update.date}`);

    const { error: updateErr } = await supabase
      .from('bills')
      .update({ date: update.date })
      .eq('id', bill.id);

    if (updateErr) {
      console.error(`  ❌ Failed to update ${bill.bill_number}:`, updateErr.message);
    } else {
      console.log(`  ✅ ${bill.bill_number} date updated to ${update.date}`);
    }
  }

  console.log('\nDone!');
  process.exit(0);
}

run();

require('dotenv').config({ path: '../.env' });
const supabase = require('../data/supabaseClient');
const store = require('../data/store');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('Seeding Supabase Database...');

  // 1. Users
  console.log('Seeding Users...');
  for (const u of store.users) {
    const { data: existing } = await supabase.from('users').select('id').eq('username', u.username).single();
    if (!existing) {
      await supabase.from('users').insert({
        username: u.username,
        email: u.email,
        full_name: u.fullName,
        password: u.password, // already hashed in store
        company: u.company || '',
        avatar: u.avatar || '',
        role: u.role || 'user'
      });
    }
  }

  // Demo user if not exists
  let demoUser;
  const { data: demoExists } = await supabase.from('users').select('id').eq('username', 'demo').single();
  if (!demoExists) {
    const hashed = await bcrypt.hash('demo123', 10);
    const { data: insertedDemo } = await supabase.from('users').insert({
      username: 'demo',
      email: 'demo@opsagent.app',
      full_name: 'Demo User',
      password: hashed,
      role: 'user'
    }).select().single();
    demoUser = insertedDemo;
  } else {
    demoUser = demoExists;
  }

  const demoUserId = demoUser.id;

  // 2. Inventory
  console.log('Seeding Inventory...');
  if (store.inventory.length > 0) {
    const inv = store.inventory.map(i => ({
      user_id: demoUserId,
      sku: i.sku,
      name: i.name,
      category: i.category,
      qty: i.qty,
      unit: i.unit,
      min: i.min,
      max: i.max
    }));
    await supabase.from('inventory').upsert(inv, { onConflict: 'user_id,sku' });
  }

  // 3. Finance
  console.log('Seeding Finance...');
  if (store.finance.length > 0) {
    const fin = store.finance.map(f => ({
      user_id: demoUserId,
      date: f.date,
      type: f.type,
      category: f.category,
      description: f.description,
      customer: f.customer,
      amount: f.amount,
      status: f.status
    }));
    await supabase.from('finance').insert(fin);
  }

  // 4. GRN
  console.log('Seeding GRN...');
  if (store.grn.length > 0) {
    const grns = store.grn.map(g => ({
      id: g.id,
      user_id: demoUserId,
      date: g.date,
      supplier: g.supplier,
      items: g.items || [],
      item_count: g.itemCount || 0,
      status: g.status,
      inventory_updated: g.inventoryUpdated || false
    }));
    await supabase.from('grn').upsert(grns, { onConflict: 'user_id,id' });
  }

  // 5. Company
  console.log('Seeding Company...');
  if (Object.keys(store.company).length > 0) {
    const comp = {
      user_id: demoUserId,
      name: store.company.name || '',
      address: store.company.address || '',
      phone: store.company.phone || '',
      gstin: store.company.gstin || '',
      bank_name: store.company.bankName || '',
      account_number: store.company.accountNumber || '',
      ifsc: store.company.ifsc || ''
    };
    await supabase.from('company').insert(comp);
  }

  console.log('Database Seeding Complete.');
}

seed().catch(err => {
  console.error('Seeding Error:', err);
  process.exit(1);
});

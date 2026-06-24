const express = require('express');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/company
router.get('/', auth, async (req, res) => {
  const { data: company, error } = await supabase.from('company').select('*').eq('user_id', req.user.id).limit(1).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });

  if (!company) {
    return res.json({});
  }
  
  // convert snake to camel case
  const formatted = {
    name: company.name,
    address: company.address,
    phone: company.phone,
    gstin: company.gstin,
    bankName: company.bank_name,
    accountNumber: company.account_number,
    ifsc: company.ifsc,
    state: company.state || '',
    email: company.email || '',
    logo_base64: company.logo_base64 || ''
  };
  
  res.json(formatted);
});

// PUT /api/company — save company profile
router.put('/', auth, async (req, res) => {
  const payload = {
    name: req.body.name || '',
    address: req.body.address || '',
    phone: req.body.phone || '',
    gstin: req.body.gstin || '',
    bank_name: req.body.bankName || '',
    account_number: req.body.accountNumber || '',
    ifsc: req.body.ifsc || '',
    state: req.body.state || '',
    email: req.body.email || '',
    logo_base64: req.body.logo_base64 || ''
  };

  const { data: existing } = await supabase.from('company').select('user_id').eq('user_id', req.user.id).limit(1).maybeSingle();

  let result;
  if (existing) {
    const { data, error } = await supabase.from('company').update(payload).eq('user_id', req.user.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    result = data;
  } else {
    const insertPayload = { ...payload, user_id: req.user.id };
    const { data, error } = await supabase.from('company').insert([insertPayload]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    result = data;
  }

  res.json({
    name: result.name,
    address: result.address,
    phone: result.phone,
    gstin: result.gstin,
    bankName: result.bank_name,
    accountNumber: result.account_number,
    ifsc: result.ifsc,
    state: result.state || '',
    email: result.email || '',
    logo_base64: result.logo_base64 || ''
  });
});

// DELETE /api/company/wipe-data
router.delete('/wipe-data', auth, async (req, res) => {
  const userId = req.user.id;
  const tables = [
    'inventory',
    'bills',
    'grn',
    'finance',
    'breakdown_quotations',
    'finalized_quotations',
    'purchase_orders',
    'customers',
    'customer_tags',
    'customer_contacts',
    'report_history',
    'activity_log',
    'expenses'
  ];

  try {
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().eq('user_id', userId);
      if (error) {
        console.error(`Error deleting from ${table}:`, error.message);
        // Continue attempting to delete other tables even if one fails (e.g. if table doesn't exist)
      }
    }
    res.json({ success: true, message: 'Data wiped successfully' });
  } catch (err) {
    console.error('Wipe data error:', err);
    res.status(500).json({ error: 'Failed to wipe data.' });
  }
});

module.exports = router;

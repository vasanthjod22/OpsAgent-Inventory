const express = require('express');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// BREAKDOWN QUOTATIONS
// ─────────────────────────────────────────────────────────────

// GET /api/quotations/breakdown
router.get('/breakdown', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('breakdown_quotations')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/quotations/breakdown
router.post('/breakdown', auth, async (req, res) => {
  const { count, error: countErr } = await supabase
    .from('breakdown_quotations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.user.id);

  if (countErr) return res.status(500).json({ error: countErr.message });

  const next = (count || 0) + 1;
  const qtNumber = req.body.qt_number || `QT-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`;

  const payload = {
    ...req.body,
    user_id: req.user.id,
    qt_number: qtNumber
  };

  const { data, error } = await supabase
    .from('breakdown_quotations')
    .insert([payload])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/quotations/breakdown/:id
router.put('/breakdown/:id', auth, async (req, res) => {
  const payload = { ...req.body };
  delete payload.id;
  delete payload.user_id;

  const { data, error } = await supabase
    .from('breakdown_quotations')
    .update(payload)
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// DELETE /api/quotations/breakdown/:id
router.delete('/breakdown/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('breakdown_quotations')
    .delete()
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
});

// PATCH /api/quotations/breakdown/:id/status
router.patch('/breakdown/:id/status', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('breakdown_quotations')
    .update({ status: req.body.status })
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// ─────────────────────────────────────────────────────────────
// CONVERT BREAKDOWN TO FINALIZED
// ─────────────────────────────────────────────────────────────
// POST /api/quotations/breakdown/:id/finalize
router.post('/breakdown/:id/finalize', auth, async (req, res) => {
  // 1. Get original
  const { data: bq, error: getErr } = await supabase
    .from('breakdown_quotations')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .single();

  if (getErr || !bq) return res.status(404).json({ error: 'Breakdown quotation not found' });

  // 2. Generate new FQ number
  const { count, error: countErr } = await supabase
    .from('finalized_quotations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.user.id);

  if (countErr) return res.status(500).json({ error: countErr.message });

  const next = (count || 0) + 1;
  const fqNumber = `FQ-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`;

  // Use overrides from body or fallback to original
  const payload = {
    user_id: req.user.id,
    fq_number: fqNumber,
    original_qt_number: bq.qt_number,
    customer_name: bq.customer_name,
    customer_phone: bq.customer_phone,
    customer_email: bq.customer_email,
    customer_address: bq.customer_address,
    items: req.body.items || bq.items,
    subtotal: req.body.subtotal !== undefined ? req.body.subtotal : bq.subtotal,
    discount: req.body.discount !== undefined ? req.body.discount : bq.discount,
    grand_total: req.body.grand_total !== undefined ? req.body.grand_total : bq.grand_total,
    include_terms: bq.include_terms,
    terms: bq.terms,
    notes: bq.notes,
    status: 'Active'
  };

  // 3. Insert into finalized
  const { data: fq, error: insErr } = await supabase
    .from('finalized_quotations')
    .insert([payload])
    .select()
    .single();

  if (insErr) return res.status(500).json({ error: insErr.message });

  // 4. Update breakdown status
  await supabase
    .from('breakdown_quotations')
    .update({ status: 'Converted', converted_to: fqNumber })
    .eq('id', bq.id);

  res.status(201).json(fq);
});

// ─────────────────────────────────────────────────────────────
// FINALIZED QUOTATIONS
// ─────────────────────────────────────────────────────────────

// GET /api/quotations/finalized
router.get('/finalized', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('finalized_quotations')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/quotations/finalized/:id
router.delete('/finalized/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('finalized_quotations')
    .delete()
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
});

// PATCH /api/quotations/finalized/:id/status
router.patch('/finalized/:id/status', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('finalized_quotations')
    .update({ 
      status: req.body.status,
      bill_number: req.body.bill_number || ''
    })
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// GET /api/quotations/finalized/:id/bill-data
router.get('/finalized/:id/bill-data', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('finalized_quotations')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });

  // Map to bill payload
  const billData = {
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    customerEmail: data.customer_email,
    customerAddress: data.customer_address,
    items: data.items.map(i => ({
      ...i,
      quantity: i.qty, // Map qty to quantity for bills
    })),
    subtotal: data.subtotal,
    discount: data.discount,
    grandTotal: data.grand_total,
    linkedFQNumber: data.fq_number,
    linkedFQId: data.id
  };

  res.json(billData);
});

module.exports = router;

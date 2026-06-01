const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/quotations
router.get('/', auth, async (req, res) => {
  const { data: quotations, error } = await supabase.from('quotations').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const formatted = quotations.map(q => ({
    id: q.id,
    quotationNumber: q.quotation_number,
    customerName: q.customer_name,
    customerPhone: q.customer_phone,
    customerEmail: q.customer_email,
    customerAddress: q.customer_address,
    date: q.date,
    validity: q.validity,
    items: q.items,
    subtotal: q.subtotal,
    discount: q.discount,
    grandTotal: q.grand_total,
    notes: q.notes,
    includeTerms: q.include_terms,
    terms: q.terms,
    status: q.status,
    createdAt: q.created_at
  }));
  res.json(formatted);
});

// POST /api/quotations — create quotation
router.post('/', auth, async (req, res) => {
  const { customerName, customerPhone, customerEmail, customerAddress, items, subtotal, discount, grandTotal, notes, includeTerms, terms, date, validity } = req.body;

  if (!customerName || !items || items.length === 0) {
    return res.status(400).json({ error: 'customerName and items are required' });
  }

  const { count, error: countErr } = await supabase.from('quotations').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id);
  if (countErr) return res.status(500).json({ error: countErr.message });

  const next = (count || 0) + 1;
  const quotationNumber = `QT-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`;

  const quotation = {
    user_id: req.user.id,
    quotation_number: quotationNumber,
    customer_name: customerName,
    customer_phone: customerPhone || '',
    customer_email: customerEmail || '',
    customer_address: customerAddress || '',
    items,
    subtotal: subtotal || 0,
    discount: discount || 0,
    grand_total: grandTotal || 0,
    notes: notes || '',
    include_terms: includeTerms || false,
    terms: terms || '',
    date: date || new Date().toISOString().split('T')[0],
    validity: validity || '',
    status: 'Draft'
  };

  const { data: inserted, error } = await supabase.from('quotations').insert([quotation]).select().single();
  if (error) return res.status(500).json({ error: error.message });

  inserted.quotationNumber = inserted.quotation_number;
  inserted.customerName = inserted.customer_name;
  res.status(201).json(inserted);
});

// PATCH /api/quotations/:id/status
router.patch('/:id/status', auth, async (req, res) => {
  const { data: updated, error } = await supabase
    .from('quotations')
    .update({ status: req.body.status })
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!updated) return res.status(404).json({ error: 'Quotation not found' });
  
  res.json(updated);
});

// DELETE /api/quotations/:id
router.delete('/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('quotations').delete().eq('user_id', req.user.id).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
});

module.exports = router;

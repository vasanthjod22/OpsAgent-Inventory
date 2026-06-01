const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/inventory — list all items
router.get('/', auth, async (req, res) => {
  const { data: inventory, error } = await supabase.from('inventory').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(inventory);
});

// POST /api/inventory — add a new item
router.post('/', auth, async (req, res) => {
  const { sku, name, category, qty, unit, min, max } = req.body;
  if (!sku || !name || !category || qty === undefined || !unit) {
    return res.status(400).json({ error: 'sku, name, category, qty and unit are required' });
  }

  const { data: existing, error: errCheck } = await supabase.from('inventory').select('sku').eq('user_id', req.user.id).eq('sku', sku).single();
  if (existing) {
    return res.status(409).json({ error: `SKU "${sku}" already exists` });
  }

  const item = { user_id: req.user.id, sku, name, category, qty: Number(qty), unit, min: Number(min) || 0, max: Number(max) || 0 };
  const { data: inserted, error } = await supabase.from('inventory').insert([item]).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(inserted);
});

// PUT /api/inventory/:sku — update an item
router.put('/:sku', auth, async (req, res) => {
  const { data: updated, error } = await supabase
    .from('inventory')
    .update(req.body)
    .eq('user_id', req.user.id)
    .eq('sku', req.params.sku)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!updated) return res.status(404).json({ error: 'Item not found' });
  
  res.json(updated);
});

// PATCH /api/inventory/:sku/stock — increment / decrement qty
router.patch('/:sku/stock', auth, async (req, res) => {
  const { delta } = req.body; // positive = add, negative = deduct
  const { data: item, error: fetchErr } = await supabase.from('inventory').select('*').eq('user_id', req.user.id).eq('sku', req.params.sku).single();
  if (fetchErr || !item) return res.status(404).json({ error: 'Item not found' });

  const newQty = Math.max(0, item.qty + Number(delta));
  const { data: updated, error: updateErr } = await supabase
    .from('inventory')
    .update({ qty: newQty })
    .eq('user_id', req.user.id)
    .eq('sku', req.params.sku)
    .select()
    .single();

  if (updateErr) return res.status(500).json({ error: updateErr.message });
  res.json(updated);
});

// DELETE /api/inventory/:sku
router.delete('/:sku', auth, async (req, res) => {
  const { data, error } = await supabase.from('inventory').delete().eq('user_id', req.user.id).eq('sku', req.params.sku).select();
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Item not found' });
  res.json({ message: 'Deleted' });
});

// POST /api/inventory/import — bulk import CSV rows
router.post('/import', auth, async (req, res) => {
  const { items } = req.body; // array of inventory objects
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }

  const { data: existingItems } = await supabase.from('inventory').select('sku').eq('user_id', req.user.id);
  const existingSkus = new Set((existingItems || []).map(i => i.sku));

  const added = [];
  const skipped = [];
  const toInsert = [];

  items.forEach(item => {
    if (!item.sku || existingSkus.has(item.sku)) {
      skipped.push(item.sku || '(no sku)');
    } else {
      const newItem = { user_id: req.user.id, sku: item.sku, name: item.name || '', category: item.category || 'General', qty: Number(item.qty) || 0, unit: item.unit || 'Nos', min: Number(item.min) || 0, max: Number(item.max) || 0 };
      toInsert.push(newItem);
      added.push(newItem);
      existingSkus.add(item.sku); // prevent duplicates in the same batch
    }
  });

  if (toInsert.length > 0) {
    const { error } = await supabase.from('inventory').insert(toInsert);
    if (error) return res.status(500).json({ error: error.message });
  }

  res.json({ added: added.length, skipped: skipped.length, skippedSkus: skipped });
});

module.exports = router;

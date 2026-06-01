const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
const store = require('../data/store');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/inventory — list all items
router.get('/', auth, (req, res) => {
  res.json(store.inventory);
});

// POST /api/inventory — add a new item
router.post('/', auth, (req, res) => {
  const { sku, name, category, qty, unit, min, max } = req.body;
  if (!sku || !name || !category || qty === undefined || !unit) {
    return res.status(400).json({ error: 'sku, name, category, qty and unit are required' });
  }
  if (store.inventory.find(i => i.sku === sku)) {
    return res.status(409).json({ error: `SKU "${sku}" already exists` });
  }
  const item = { sku, name, category, qty: Number(qty), unit, min: Number(min) || 0, max: Number(max) || 0 };
  store.inventory.push(item);
  res.status(201).json(item);
});

// PUT /api/inventory/:sku — update an item
router.put('/:sku', auth, (req, res) => {
  const idx = store.inventory.findIndex(i => i.sku === req.params.sku);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  store.inventory[idx] = { ...store.inventory[idx], ...req.body, sku: req.params.sku };
  res.json(store.inventory[idx]);
});

// PATCH /api/inventory/:sku/stock — increment / decrement qty
router.patch('/:sku/stock', auth, (req, res) => {
  const { delta } = req.body; // positive = add, negative = deduct
  const item = store.inventory.find(i => i.sku === req.params.sku);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  item.qty = Math.max(0, item.qty + Number(delta));
  res.json(item);
});

// DELETE /api/inventory/:sku
router.delete('/:sku', auth, (req, res) => {
  const before = store.inventory.length;
  store.inventory = store.inventory.filter(i => i.sku !== req.params.sku);
  if (store.inventory.length === before) return res.status(404).json({ error: 'Item not found' });
  res.json({ message: 'Deleted' });
});

// POST /api/inventory/import — bulk import CSV rows
router.post('/import', auth, (req, res) => {
  const { items } = req.body; // array of inventory objects
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }
  const added = [], skipped = [];
  items.forEach(item => {
    if (!item.sku || store.inventory.find(i => i.sku === item.sku)) {
      skipped.push(item.sku || '(no sku)');
    } else {
      const newItem = { sku: item.sku, name: item.name || '', category: item.category || 'General', qty: Number(item.qty) || 0, unit: item.unit || 'Nos', min: Number(item.min) || 0, max: Number(item.max) || 0 };
      store.inventory.push(newItem);
      added.push(newItem);
    }
  });
  res.json({ added: added.length, skipped: skipped.length, skippedSkus: skipped });
});

module.exports = router;

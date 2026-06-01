const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
const store = require('../data/store');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/grn
router.get('/', auth, (req, res) => {
  res.json(store.grn);
});

// POST /api/grn — create GRN and update inventory
router.post('/', auth, (req, res) => {
  const { supplier, date, items, updateInventory } = req.body;

  if (!supplier || !items || items.length === 0) {
    return res.status(400).json({ error: 'supplier and items are required' });
  }

  const next = store.grn.length + 1;
  const grnId = `GRN-${1000 + next}`;

  const grn = {
    id: grnId,
    supplier,
    date: date || new Date().toISOString().split('T')[0],
    items,
    itemCount: items.length,
    status: 'Pending',
    inventoryUpdated: false,
    createdAt: new Date().toISOString(),
  };

  // Update inventory stock if requested
  if (updateInventory) {
    items.forEach(item => {
      if (item.sku) {
        const inv = store.inventory.find(i => i.sku === item.sku);
        if (inv) {
          inv.qty += Number(item.quantity) || 0;
        } else {
          // Auto-create new inventory item from GRN
          store.inventory.push({
            sku: item.sku,
            name: item.description || item.sku,
            category: 'General',
            qty: Number(item.quantity) || 0,
            unit: item.unit || 'Nos',
            min: 0,
            max: 0,
          });
        }
      }
    });
    grn.status = 'Processed';
    grn.inventoryUpdated = true;
  }

  store.grn.unshift(grn);
  res.status(201).json(grn);
});

// PATCH /api/grn/:id/status
router.patch('/:id/status', auth, (req, res) => {
  const grn = store.grn.find(g => g.id === req.params.id);
  if (!grn) return res.status(404).json({ error: 'GRN not found' });
  grn.status = req.body.status || grn.status;
  res.json(grn);
});

// DELETE /api/grn/:id
router.delete('/:id', auth, (req, res) => {
  const before = store.grn.length;
  store.grn = store.grn.filter(g => g.id !== req.params.id);
  if (store.grn.length === before) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
});

module.exports = router;

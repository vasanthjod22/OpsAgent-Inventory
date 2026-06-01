const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
const store = require('../data/store');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/quotations
router.get('/', auth, (req, res) => {
  res.json(store.quotations);
});

// POST /api/quotations — create quotation
router.post('/', auth, (req, res) => {
  const { customerName, customerPhone, customerEmail, customerAddress, items, subtotal, discount, grandTotal, notes, includeTerms, terms, date, validity } = req.body;

  if (!customerName || !items || items.length === 0) {
    return res.status(400).json({ error: 'customerName and items are required' });
  }

  const next = store.quotations.length + 1;
  const quotationNumber = `QT-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`;

  const quotation = {
    id: uuidv4(),
    quotationNumber,
    customerName,
    customerPhone: customerPhone || '',
    customerEmail: customerEmail || '',
    customerAddress: customerAddress || '',
    items,
    subtotal: subtotal || 0,
    discount: discount || 0,
    grandTotal: grandTotal || 0,
    notes: notes || '',
    includeTerms: includeTerms || false,
    terms: terms || '',
    date: date || new Date().toISOString().split('T')[0],
    validity: validity || '',
    status: 'Draft',
    createdAt: new Date().toISOString(),
  };

  store.quotations.unshift(quotation);
  res.status(201).json(quotation);
});

// PATCH /api/quotations/:id/status
router.patch('/:id/status', auth, (req, res) => {
  const q = store.quotations.find(q => q.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'Quotation not found' });
  q.status = req.body.status || q.status;
  res.json(q);
});

// DELETE /api/quotations/:id
router.delete('/:id', auth, (req, res) => {
  const before = store.quotations.length;
  store.quotations = store.quotations.filter(q => q.id !== req.params.id);
  if (store.quotations.length === before) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
});

module.exports = router;

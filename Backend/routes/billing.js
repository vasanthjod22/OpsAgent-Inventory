const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
const store = require('../data/store');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/bills
router.get('/', auth, (req, res) => {
  res.json(store.bills);
});

// POST /api/bills — create bill, deduct inventory stock
router.post('/', auth, (req, res) => {
  const { customerName, customerPhone, customerAddress, items, subtotal, discount, grandTotal, paymentStatus, amountPaid, balanceDue, notes, includeTerms, terms, date, updateInventory } = req.body;

  if (!customerName || !items || items.length === 0) {
    return res.status(400).json({ error: 'customerName and items are required' });
  }

  // Generate sequential bill number
  const next = store.bills.length + 1;
  const billNumber = `BILL-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`;

  const bill = {
    id: uuidv4(),
    billNumber,
    customerName,
    customerPhone: customerPhone || '',
    customerAddress: customerAddress || '',
    items,
    subtotal: subtotal || 0,
    discount: discount || 0,
    grandTotal: grandTotal || 0,
    paymentStatus: paymentStatus || 'Unpaid',
    amountPaid: amountPaid || null,
    balanceDue: balanceDue || null,
    notes: notes || '',
    includeTerms: includeTerms || false,
    terms: terms || '',
    date: date || new Date().toISOString().split('T')[0],
    inventoryUpdated: false,
    createdAt: new Date().toISOString(),
  };

  // Optionally deduct inventory stock
  if (updateInventory) {
    items.forEach(item => {
      if (item.inventorySku) {
        const inv = store.inventory.find(i => i.sku === item.inventorySku);
        if (inv) {
          inv.qty = Math.max(0, inv.qty - (Number(item.quantity) || 0));
        }
      }
    });
    bill.inventoryUpdated = true;
  }

  store.bills.unshift(bill);
  res.status(201).json(bill);
});

// PATCH /api/bills/:id/status — update payment status
router.patch('/:id/status', auth, (req, res) => {
  const bill = store.bills.find(b => b.id === req.params.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  const { paymentStatus, amountPaid } = req.body;
  bill.paymentStatus = paymentStatus || bill.paymentStatus;
  if (paymentStatus === 'Partial') {
    bill.amountPaid = Number(amountPaid) || 0;
    bill.balanceDue = bill.grandTotal - bill.amountPaid;
  }
  res.json(bill);
});

// DELETE /api/bills/:id
router.delete('/:id', auth, (req, res) => {
  const before = store.bills.length;
  store.bills = store.bills.filter(b => b.id !== req.params.id);
  if (store.bills.length === before) return res.status(404).json({ error: 'Bill not found' });
  res.json({ message: 'Deleted' });
});

module.exports = router;

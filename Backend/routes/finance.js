const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
const store = require('../data/store');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/finance — list all transactions
router.get('/', auth, (req, res) => {
  res.json(store.finance);
});

// GET /api/finance/summary — computed totals
router.get('/summary', auth, (req, res) => {
  const income = store.finance.filter(t => t.type === 'Income');
  const expenses = store.finance.filter(t => t.type === 'Expense');

  const totalRevenue = income.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalExpenses = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const netProfit = totalRevenue - totalExpenses;

  // Group expenses by category
  const expMap = {};
  expenses.forEach(t => {
    expMap[t.category] = (expMap[t.category] || 0) + Math.abs(t.amount);
  });
  const topExpenseCategories = Object.entries(expMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  res.json({ totalRevenue, totalExpenses, netProfit, topExpenseCategories, transactionCount: store.finance.length });
});

// POST /api/finance — add transaction
router.post('/', auth, (req, res) => {
  const { date, type, category, description, customer, amount, status } = req.body;
  if (!date || !type || !category || !description || amount === undefined) {
    return res.status(400).json({ error: 'date, type, category, description, amount are required' });
  }
  const transaction = {
    id: uuidv4(),
    date,
    type,
    category,
    description,
    customer: customer || '',
    amount: Number(amount),
    status: status || 'Completed',
    createdAt: new Date().toISOString(),
  };
  store.finance.unshift(transaction);
  res.status(201).json(transaction);
});

// PUT /api/finance/:id — update transaction
router.put('/:id', auth, (req, res) => {
  const idx = store.finance.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });
  store.finance[idx] = { ...store.finance[idx], ...req.body, id: req.params.id };
  res.json(store.finance[idx]);
});

// DELETE /api/finance/:id
router.delete('/:id', auth, (req, res) => {
  const before = store.finance.length;
  store.finance = store.finance.filter(t => t.id !== req.params.id);
  if (store.finance.length === before) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
});

module.exports = router;

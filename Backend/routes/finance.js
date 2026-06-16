const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/finance — list all transactions
router.get('/', auth, async (req, res) => {
  const { data: finance, error } = await supabase.from('finance').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(finance);
});

// GET /api/finance/summary — computed totals
router.get('/summary', auth, async (req, res) => {
  const [
    { data: finance, error: finErr },
    { data: inventoryItems, error: invErr },
    { data: billsData, error: billsErr }
  ] = await Promise.all([
    supabase.from('finance').select('type, amount, category').eq('user_id', req.user.id),
    supabase.from('inventory').select('qty, rate').eq('user_id', req.user.id),
    supabase.from('bills').select('grand_total, amount_paid, payment_status').eq('user_id', req.user.id).in('payment_status', ['Paid', 'Partial'])
  ]);
  
  if (finErr) return res.status(500).json({ error: finErr.message });
  if (invErr) return res.status(500).json({ error: invErr.message });

  const expenses = finance ? finance.filter(t => t.type === 'Expense') : [];

  // Calculate revenue purely from bills
  const totalRevenue = Math.round((billsData || []).reduce((s, b) => {
    if (b.payment_status === 'Paid') return s + Number(b.grand_total || 0);
    if (b.payment_status === 'Partial') return s + Number(b.amount_paid || 0);
    return s;
  }, 0));

  const manualExpenses = Math.round(expenses.reduce((s, t) => s + Math.abs(Number(t.amount)), 0));
  
  const inventoryValuation = Math.round((inventoryItems || []).reduce((s, item) => s + (Number(item.qty || 0) * Number(item.rate || 0)), 0));
  const totalExpenses = manualExpenses + inventoryValuation;
  const netProfit = totalRevenue - totalExpenses;

  const expMap = {};
  expenses.forEach(t => {
    expMap[t.category] = (expMap[t.category] || 0) + Math.abs(Number(t.amount));
  });
  if (inventoryValuation > 0) {
    expMap['Inventory Purchases'] = (expMap['Inventory Purchases'] || 0) + inventoryValuation;
  }

  const topExpenseCategories = Object.entries(expMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  res.json({ totalRevenue, totalExpenses, netProfit, topExpenseCategories, transactionCount: finance ? finance.length : 0 });
});

// POST /api/finance — add transaction
router.post('/', auth, async (req, res) => {
  const { date, type, category, description, customer, amount, status } = req.body;
  if (!date || !type || !category || !description || amount === undefined) {
    return res.status(400).json({ error: 'date, type, category, description, amount are required' });
  }

  const transaction = {
    user_id: req.user.id,
    date,
    type,
    category,
    description,
    customer: customer || '',
    amount: Number(amount),
    status: status || 'Completed',
  };

  const { data: inserted, error } = await supabase.from('finance').insert([transaction]).select().single();
  if (error) return res.status(500).json({ error: error.message });
  
  res.status(201).json(inserted);
});

// PUT /api/finance/:id — update transaction
router.put('/:id', auth, async (req, res) => {
  const { data: updated, error } = await supabase
    .from('finance')
    .update(req.body)
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!updated) return res.status(404).json({ error: 'Transaction not found' });
  res.json(updated);
});

// DELETE /api/finance/:id
router.delete('/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('finance').delete().eq('user_id', req.user.id).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
});

module.exports = router;

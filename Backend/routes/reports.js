const express = require('express');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Helper: get period start date as ISO string
const getPeriodStart = (period) => {
  const now = new Date();
  switch (period) {
    case 'week':
      return new Date(now.setDate(now.getDate() - 7)).toISOString();
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    case 'quarter':
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString();
    case 'year':
      return new Date(now.getFullYear(), 0, 1).toISOString();
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
};

// GET /api/reports — Fetch history
router.get('/', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('report_history')
    .select('*')
    .eq('user_id', req.user.id)
    .order('generated_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/reports — Save new report to history
router.post('/', auth, async (req, res) => {
  const { report_id, report_type, period_from, period_to, summary } = req.body;

  const { data, error } = await supabase
    .from('report_history')
    .insert([{
      user_id: req.user.id,
      report_id,
      report_type,
      period_from,
      period_to,
      summary: summary || {}
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// GET /api/reports/category-inventory
// Returns inventory grouped by category with sold data from bills in selected period
router.get('/category-inventory', auth, async (req, res) => {
  try {
    const { category, period, from, to } = req.query;

    // Get all inventory items
    let inventoryQuery = supabase
      .from('inventory')
      .select('*')
      .eq('user_id', req.user.id);

    if (category && category !== 'all') {
      inventoryQuery = inventoryQuery.eq('category', category);
    }

    const { data: items, error: invErr } = await inventoryQuery;
    if (invErr) throw invErr;

    // Get bills for sold quantities in the selected period
    let periodStart = getPeriodStart(period || 'month');
    let periodEnd = new Date().toISOString();
    
    if (from) periodStart = new Date(from).toISOString();
    if (to) periodEnd = new Date(to).toISOString();

    const { data: bills } = await supabase
      .from('bills')
      .select('items, created_at, date')
      .eq('user_id', req.user.id)
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd);

    // Build 6-month history for sparklines
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const { data: historicalBills } = await supabase
      .from('bills')
      .select('items, created_at, date')
      .eq('user_id', req.user.id)
      .gte('created_at', sixMonthsAgo.toISOString());

    // Group inventory by category
    const categoryMap = {};
    (items || []).forEach(item => {
      const cat = item.category || 'Uncategorized';
      if (!categoryMap[cat]) {
        categoryMap[cat] = {
          category: cat,
          totalItems: 0,
          totalQty: 0,
          totalValue: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          overstockCount: 0,
          soldQty: 0,
          soldValue: 0,
          monthlyTrend: Array(6).fill(0), // last 6 months sold qty
          items: []
        };
      }
      const value = (item.qty || 0) * (item.rate || 0);
      categoryMap[cat].totalItems++;
      categoryMap[cat].totalQty += Number(item.qty) || 0;
      categoryMap[cat].totalValue += value;
      categoryMap[cat].items.push(item);

      if (Number(item.qty) === 0) categoryMap[cat].outOfStockCount++;
      else if (Number(item.qty) < Number(item.min)) categoryMap[cat].lowStockCount++;
      else if (Number(item.qty) > Number(item.max) && Number(item.max) > 0) categoryMap[cat].overstockCount++;
    });

    // Add sold data from bills (current period)
    (bills || []).forEach(bill => {
      const billItems = bill.items || [];
      billItems.forEach(billItem => {
        const invItem = (items || []).find(i =>
          i.name && billItem.description &&
          i.name.toLowerCase() === billItem.description.toLowerCase()
        );
        if (invItem) {
          const cat = invItem.category || 'Uncategorized';
          if (categoryMap[cat]) {
            categoryMap[cat].soldQty += Number(billItem.quantity) || 0;
            categoryMap[cat].soldValue += Number(billItem.amount) || Number(billItem.total) || 0;
          }
        }
      });
    });

    // Add 6-month trend sparkline data
    const now = new Date();
    (historicalBills || []).forEach(bill => {
      const billDate = new Date(bill.created_at || bill.date);
      const monthsAgo = (now.getFullYear() - billDate.getFullYear()) * 12 + (now.getMonth() - billDate.getMonth());
      if (monthsAgo >= 0 && monthsAgo < 6) {
        const monthIdx = 5 - monthsAgo; // 0 = 5 months ago, 5 = current month
        const billItems = bill.items || [];
        billItems.forEach(billItem => {
          const invItem = (items || []).find(i =>
            i.name && billItem.description &&
            i.name.toLowerCase() === billItem.description.toLowerCase()
          );
          if (invItem) {
            const cat = invItem.category || 'Uncategorized';
            if (categoryMap[cat]) {
              categoryMap[cat].monthlyTrend[monthIdx] += Number(billItem.quantity) || 0;
            }
          }
        });
      }
    });

    const result = Object.values(categoryMap)
      .sort((a, b) => b.totalValue - a.totalValue);

    const totalValue = result.reduce((s, c) => s + c.totalValue, 0);
    const mostValuable = result[0] || null;
    const lowStockCats = result.filter(c => c.lowStockCount > 0 || c.outOfStockCount > 0).length;

    res.json({
      success: true,
      data: result,
      summary: {
        totalCategories: result.length,
        totalValue,
        mostValuableCategory: mostValuable ? { name: mostValuable.category, value: mostValuable.totalValue } : null,
        lowStockCategories: lowStockCats
      },
      period: period || 'month',
      periodStart
    });
  } catch (err) {
    console.error('Category inventory report error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/kpis', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().split('T')[0];
    const weekAgoStr = new Date(today.getTime() - 7 * 86400000).toISOString().split('T')[0];

    // TODAY'S SALES
    const { data: todayBills } = await supabase
      .from('bills')
      .select('grand_total, payment_status')
      .eq('user_id', userId)
      .gte('created_at', `${todayStr}T00:00:00`);

    const todaySales = todayBills
      ?.filter(b => b.payment_status === 'Paid')
      .reduce((s, b) => s + Number(b.grand_total || 0), 0) || 0;

    const todayOrders = todayBills?.length || 0;

    // YESTERDAY COMPARISON
    const { data: yesterdayBills } = await supabase
      .from('bills')
      .select('grand_total, payment_status')
      .eq('user_id', userId)
      .gte('created_at', `${yesterdayStr}T00:00:00`)
      .lt('created_at', `${todayStr}T00:00:00`);

    const yesterdaySales = yesterdayBills
      ?.filter(b => b.payment_status === 'Paid')
      .reduce((s, b) => s + Number(b.grand_total || 0), 0) || 0;

    // TODAY'S PROFIT
    // Profit = SUM(amount - (cost_price * quantity)) for Paid bills today
    // To do this perfectly we need bill items and inventory cost price. 
    // The user's prompt says: "Sum of (bill_items.amount - inventory.cost_price × qty)".
    // Let's do a simplified calculation based on items in todayBills if we fetch them.
    const { data: todayBillsWithItems } = await supabase
      .from('bills')
      .select('items, payment_status')
      .eq('user_id', userId)
      .eq('payment_status', 'Paid')
      .gte('created_at', `${todayStr}T00:00:00`);

    const { data: inventoryData } = await supabase
      .from('inventory')
      .select('name, sku, cost_price')
      .eq('user_id', userId);

    let todayProfit = 0;
    todayBillsWithItems?.forEach(b => {
      (b.items || []).forEach(item => {
        const invItem = inventoryData?.find(i => (i.name?.toLowerCase() === item.description?.toLowerCase()) || (i.sku === item.sku));
        const costPrice = invItem?.cost_price || 0;
        const revenue = Number(item.amount || 0);
        const qty = Number(item.quantity || 0);
        todayProfit += (revenue - (costPrice * qty));
      });
    });

    let yesterdayProfit = 0;
    const { data: yesterdayBillsWithItems } = await supabase
      .from('bills')
      .select('items, payment_status')
      .eq('user_id', userId)
      .eq('payment_status', 'Paid')
      .gte('created_at', `${yesterdayStr}T00:00:00`)
      .lt('created_at', `${todayStr}T00:00:00`);

    yesterdayBillsWithItems?.forEach(b => {
      (b.items || []).forEach(item => {
        const invItem = inventoryData?.find(i => (i.name?.toLowerCase() === item.description?.toLowerCase()) || (i.sku === item.sku));
        const costPrice = invItem?.cost_price || 0;
        const revenue = Number(item.amount || 0);
        const qty = Number(item.quantity || 0);
        yesterdayProfit += (revenue - (costPrice * qty));
      });
    });

    // PENDING BILLS
    const { data: pendingBillsData } = await supabase
      .from('bills')
      .select('grand_total, balance_due, payment_status')
      .eq('user_id', userId)
      .neq('payment_status', 'Paid');

    const pendingBillsCount = pendingBillsData?.length || 0;
    const pendingBillsAmount = pendingBillsData?.reduce((s, b) => s + Number(b.balance_due || b.grand_total || 0), 0) || 0;

    // PENDING POs
    const { count: pendingPOs } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('status', 'in', '("Fully Received","Cancelled")');

    // LOW STOCK
    const { data: lowStockInventory } = await supabase
      .from('inventory')
      .select('qty, min')
      .eq('user_id', userId);

    const lowStock = lowStockInventory?.filter(i => (i.qty || 0) < (i.min || 0)).length || 0;

    // CUSTOMER DUE (Outstanding receivables)
    const { data: unpaidBills } = await supabase
      .from('bills')
      .select('grand_total, balance_due')
      .eq('user_id', userId)
      .in('payment_status', ['Unpaid', 'Partial']);

    const customerDue = unpaidBills?.reduce((s, b) => s + Number(b.balance_due || b.grand_total || 0), 0) || 0;

    // TOTAL CUSTOMERS
    const { count: totalCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { count: newCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', `${weekAgoStr}T00:00:00`);

    res.json({
      success: true,
      todaySales,
      todaySalesChange: yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : 0,
      todayProfit,
      todayProfitChange: yesterdayProfit > 0 ? ((todayProfit - yesterdayProfit) / yesterdayProfit) * 100 : 0,
      todayOrders,
      todayOrdersChange: (yesterdayBills?.length || 0) > 0 ? ((todayOrders - (yesterdayBills?.length || 0)) / (yesterdayBills?.length || 1)) * 100 : 0,
      pendingBills: {
        count: pendingBillsCount,
        amount: pendingBillsAmount
      },
      pendingPOs: pendingPOs || 0,
      lowStock,
      customerDue,
      totalCustomers: totalCustomers || 0,
      newCustomersThisWeek: newCustomers || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sales-trend', auth, async (req, res) => {
  try {
    const { from, to } = req.query;

    const { data: bills } = await supabase
      .from('bills')
      .select('grand_total, created_at, payment_status')
      .eq('user_id', req.user.id)
      .gte('created_at', from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      .lte('created_at', to || new Date().toISOString())
      .order('created_at');

    // Group by date
    const grouped = {};
    bills?.forEach(bill => {
      const dateObj = new Date(bill.created_at);
      // Format to "DD MMM"
      const date = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      if (!grouped[date]) {
        grouped[date] = { date, sales: 0, orders: 0, _sort: dateObj.getTime() };
      }
      grouped[date].orders++;
      if (bill.payment_status === 'Paid') {
        grouped[date].sales += Number(bill.grand_total || 0);
      }
    });

    const dataArray = Object.values(grouped).sort((a, b) => a._sort - b._sort).map(d => {
      delete d._sort;
      return d;
    });

    res.json({ success: true, data: dataArray });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sales-by-category', auth, async (req, res) => {
  try {
    const { from, to } = req.query;

    const { data: bills } = await supabase
      .from('bills')
      .select('items, payment_status, created_at')
      .eq('user_id', req.user.id)
      .eq('payment_status', 'Paid')
      .gte('created_at', from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      .lte('created_at', to || new Date().toISOString());

    const { data: inventory } = await supabase
      .from('inventory')
      .select('name, sku, category')
      .eq('user_id', req.user.id);

    const categoryMap = {};

    bills?.forEach(bill => {
      (bill.items || []).forEach(item => {
        const invItem = inventory?.find(i =>
          i.name?.toLowerCase() === item.description?.toLowerCase() ||
          i.sku === item.sku
        );
        const category = invItem?.category || 'Other';

        if (!categoryMap[category]) {
          categoryMap[category] = { category, revenue: 0, qty: 0 };
        }
        categoryMap[category].revenue += Number(item.amount || 0);
        categoryMap[category].qty += Number(item.quantity || 0);
      });
    });

    const result = Object.values(categoryMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/top-products', auth, async (req, res) => {
  try {
    const { from, to } = req.query;

    const { data: bills } = await supabase
      .from('bills')
      .select('items')
      .eq('user_id', req.user.id)
      .eq('payment_status', 'Paid')
      .gte('created_at', from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      .lte('created_at', to || new Date().toISOString());

    const productMap = {};
    bills?.forEach(bill => {
      (bill.items || []).forEach(item => {
        const name = item.description || 'Unknown';
        if (!productMap[name]) {
          productMap[name] = {
            name: name.length > 20 ? name.substring(0, 20) + '...' : name,
            fullName: name,
            revenue: 0,
            qty: 0
          };
        }
        productMap[name].revenue += Number(item.amount || 0);
        productMap[name].qty += Number(item.quantity || 0);
      });
    });

    const result = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Expenses Route inline as requested in "Record Expense modal"
router.post('/expenses', auth, async (req, res) => {
  try {
    const { title, category, amount, payment_method, date, notes } = req.body;
    if (!title || !amount) return res.status(400).json({ error: 'Title and amount required' });

    const { data, error } = await supabase
      .from('expenses')
      .insert([{
        user_id: req.user.id,
        title,
        category: category || 'General',
        amount: Number(amount),
        payment_method: payment_method || 'Cash',
        date: date || new Date().toISOString().split('T')[0],
        notes: notes || ''
      }])
      .select()
      .single();

    if (error) throw error;

    // Log Activity
    const { ActivityService } = require('../services/activity.service');
    await ActivityService.log(req.user.id, ActivityService.templates.expenseAdded(title, amount));

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

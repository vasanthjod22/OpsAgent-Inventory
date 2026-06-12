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

    let inventoryQuery = supabase
      .from('inventory')
      .select('*')
      .eq('user_id', req.user.id);

    if (category && category !== 'all') {
      inventoryQuery = inventoryQuery.eq('category', category);
    }

    let periodStart = getPeriodStart(period || 'month');
    let periodEnd = new Date().toISOString();
    
    if (from) periodStart = new Date(from).toISOString();
    if (to) periodEnd = new Date(to).toISOString();

    // We do NOT filter the inventory items themselves by period.
    // The period only applies to the sales/bills data to show what was sold in that period.
    // If we filter inventory by date_added, old items will just disappear from the report!

    const { data: items, error: invErr } = await inventoryQuery;
    if (invErr) throw invErr;

    // Get bills for sold quantities in the selected period

    const { data: bills } = await supabase
      .from('bills')
      .select('items, created_at, date')
      .eq('user_id', req.user.id)
      .gte('date', periodStart)
      .lte('date', periodEnd);

    // Build 6-month history for sparklines
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const { data: historicalBills } = await supabase
      .from('bills')
      .select('items, created_at, date')
      .eq('user_id', req.user.id)
      .gte('date', sixMonthsAgo.toISOString());

    // Group inventory by category
    const categoryMap = {};
    (items || []).forEach(item => {
      let cat = item.category || 'Steel Bars';
      if (cat === 'Uncategorized') cat = 'Steel Bars';
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
      else if (Number(item.qty) <= Number(item.min)) categoryMap[cat].lowStockCount++;
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
          let cat = invItem.category || 'Steel Bars';
          if (cat === 'Uncategorized') cat = 'Steel Bars';
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
            let cat = invItem.category || 'Steel Bars';
            if (cat === 'Uncategorized') cat = 'Steel Bars';
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

// GET /api/reports/sales
// Returns data for the Sales Report page
router.get('/sales', auth, async (req, res) => {
  try {
    const { from, to, category: reqCategory } = req.query;

    const fromDate = from ? new Date(from).toISOString().substring(0, 10) : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().substring(0, 10);
    const toDate = to ? new Date(to).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10);

    const { AnalyticsService } = require('../services/analytics.service');
    const metrics = await AnalyticsService.getCoreMetrics(req.user.id, fromDate, toDate, reqCategory);

    const trend = Object.values(metrics.dateMap).sort((a, b) => new Date(a.date) - new Date(b.date)).map(d => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
    }));

    const byCategory = Object.values(metrics.categoryMap).sort((a, b) => b.revenue - a.revenue);
    const topProducts = Object.values(metrics.productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const paymentMethods = Object.values(metrics.paymentMap).sort((a, b) => b.value - a.value);
    
    const customerSummary = Object.values(metrics.customerMap).map(c => ({
      ...c,
      avgOrder: c.total / c.orders,
      lastOrder: new Date(c.lastOrder).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'Paid'
    })).sort((a, b) => b.total - a.total).slice(0, 50);

    res.json({
      kpis: {
        totalSales: metrics.totalRevenue,
        totalOrders: metrics.totalOrders,
        avgOrderValue: metrics.avgOrderValue,
        totalProfit: metrics.grossProfit
      },
      trend,
      byCategory,
      topProducts,
      paymentMethods,
      customerSummary
    });
  } catch (err) {
    console.error('Sales Report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/finance
router.get('/finance', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];

    const { AnalyticsService } = require('../services/analytics.service');
    const metrics = await AnalyticsService.getCoreMetrics(req.user.id, fromDate, toDate);
    const expenseData = await AnalyticsService.getExpenses(req.user.id, fromDate, toDate, metrics.totalCogs);
    const outstanding = await AnalyticsService.getOutstandingReceivables(req.user.id);

    // monthlyProfit based on monthMap
    const monthlyMap = {};
    const formatMonthYear = (d) => {
      const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${mNames[d.getMonth()]} ${d.getFullYear().toString().substr(-2)}`;
    };

    // Pre-fill empty months between fromDate and toDate
    let current = new Date(fromDate);
    current.setDate(1);
    const end = new Date(toDate);
    end.setDate(1);
    
    let loops = 0;
    while (current <= end && loops < 120) {
      const key = formatMonthYear(current);
      if (!monthlyMap[key]) monthlyMap[key] = { month: key, revenue: 0, expenses: 0, profit: 0, _sort: current.getTime() };
      current.setMonth(current.getMonth() + 1);
      loops++;
    }

    Object.values(metrics.monthMap).forEach(m => {
       const d = new Date(`${m.month}-01T00:00:00`);
       const key = formatMonthYear(d);
       if (!monthlyMap[key]) monthlyMap[key] = { month: key, revenue: 0, expenses: 0, profit: 0, _sort: d.getTime() };
       monthlyMap[key].revenue += m.revenue;
       monthlyMap[key].expenses += m.cogs;
    });

    expenseData.rawExpenses.forEach(e => {
       const d = new Date(e.date);
       d.setDate(1);
       const key = formatMonthYear(d);
       if (!monthlyMap[key]) monthlyMap[key] = { month: key, revenue: 0, expenses: 0, profit: 0, _sort: d.getTime() };
       monthlyMap[key].expenses += Number(e.amount || 0);
    });

    const trendArray = Object.values(monthlyMap).sort((a, b) => a._sort - b._sort).map(m => {
      m.profit = m.revenue - m.expenses;
      delete m._sort;
      return m;
    });

    res.json({
      success: true,
      kpis: {
        totalRevenue: metrics.totalRevenue,
        totalExpenses: expenseData.totalExpenses,
        grossProfit: metrics.totalRevenue - expenseData.totalExpenses,
        profitMargin: metrics.totalRevenue > 0 ? ((metrics.totalRevenue - expenseData.totalExpenses) / metrics.totalRevenue) * 100 : 0
      },
      trend: trendArray,
      monthlyProfit: trendArray,
      expenseCategories: expenseData.expenseCategories,
      outstanding: outstanding.customerDueList
    });
  } catch (err) {
    console.error('Finance Report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/inventory
router.get('/inventory', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const userId = req.user.id;

    const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];

    const ninetyDaysAgo = new Date(toDate);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { AnalyticsService } = require('../services/analytics.service');
    
    // Get metrics for dead stock (last 90 days)
    const deadStockMetrics = await AnalyticsService.getCoreMetrics(userId, ninetyDaysAgo.toISOString().split('T')[0], toDate);
    
    // Get metrics for selected period (fast/slow moving)
    const periodMetrics = await AnalyticsService.getCoreMetrics(userId, fromDate, toDate);

    const items = periodMetrics.rawInventory || [];
    const inventoryStatus = await AnalyticsService.getInventoryStatus(userId, items);

    // Dead stock: in inventory but not in 90-day sold map
    const deadStockMap = deadStockMetrics.productMap;
    const deadStock = items.filter(i => {
      const qty = Number(i.qty) || 0;
      if (qty === 0) return false;
      return !deadStockMap[i.name || 'Unknown'];
    }).map(i => ({
      ...i,
      name: i.name || 'Unknown',
      daysIdle: Math.floor(
        (new Date() - new Date(i.last_restocked || i.created_at || new Date())) / (1000 * 60 * 60 * 24)
      ),
      valueLocked: (Number(i.qty) || 0) * (Number(i.rate) || 0)
    })).sort((a,b) => b.daysIdle - a.daysIdle);

    // Category value
    const catMap = {};
    items.forEach(i => {
      const cat = i.category || 'Uncategorized';
      if (!catMap[cat]) {
        catMap[cat] = { category: cat, value: 0, items: 0 };
      }
      catMap[cat].value += (Number(i.qty) || 0) * (Number(i.rate) || 0);
      catMap[cat].items++;
    });

    // Fast moving
    const fastMoving = Object.values(periodMetrics.productMap)
      .map(p => ({ ...p, name: p.name.length > 25 ? p.name.substring(0,25) + '...' : p.name }))
      .sort((a,b) => b.qty - a.qty)
      .slice(0,8);

    // Slow moving
    const slowMoving = items.map(i => {
      const n = i.name || 'Unknown';
      return {
        name: n.length > 25 ? n.substring(0,25)+'...' : n,
        qty: periodMetrics.productMap[n]?.qty || 0,
        stock: Number(i.qty) || 0
      };
    }).sort((a,b) => a.qty - b.qty).slice(0, 8);

    res.json({
      success: true,
      kpis: {
        totalValue: inventoryStatus.totalInventoryValue,
        lowStockCount: inventoryStatus.lowStockCount,
        outOfStockCount: inventoryStatus.outOfStockCount,
        deadStockCount: deadStock.length
      },
      categoryValue: Object.values(catMap).sort((a,b) => b.value - a.value),
      fastMoving,
      slowMoving,
      deadStock: deadStock.slice(0, 20)
    });
  } catch (err) {
    console.error('Inventory Report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/purchase
router.get('/purchase', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const userId = req.user.id;

    const fromDate = from || new Date(
      new Date().getFullYear(), 0, 1
    ).toISOString();
    const toDate = to || new Date().toISOString();

    const { data: pos } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    const { data: allPending } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('user_id', userId)
      .not('status', 'in', '("Fully Received","Cancelled")');

    const totalValue = pos?.filter(
      p => p.status === 'Fully Received'
    ).reduce(
      (s, p) => s + (Number(p.grand_total) || 0), 0
    ) || 0;

    const today = new Date().toISOString().split('T')[0];
    const overdue = allPending?.filter(p =>
      p.expected_date && p.expected_date < today
    ).length || 0;

    // Monthly trend
    const monthlyMap = {};
    pos?.forEach(p => {
      const month = new Date(p.created_at)
        .toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      if (!monthlyMap[month]) {
        monthlyMap[month] = { month, value: 0, count: 0 };
      }
      monthlyMap[month].value += Number(p.grand_total) || 0;
      monthlyMap[month].count++;
    });

    // Supplier summary
    const supplierMap = {};
    pos?.forEach(p => {
      const sup = p.supplier_name || 'Unknown';
      if (!supplierMap[sup]) {
        supplierMap[sup] = {
          supplier: sup,
          totalPOs: 0,
          totalValue: 0,
          onTime: 0,
          lastOrder: p.created_at
        };
      }
      supplierMap[sup].totalPOs++;
      supplierMap[sup].totalValue += Number(p.grand_total) || 0;
      
      if (p.status === 'Fully Received' && p.received_at && p.expected_date && p.received_at <= p.expected_date) {
        supplierMap[sup].onTime++;
      }
      if (p.created_at > supplierMap[sup].lastOrder) {
        supplierMap[sup].lastOrder = p.created_at;
      }
    });

    const supplierSummary = Object.values(supplierMap).map(s => ({
      ...s,
      avgValue: s.totalValue / s.totalPOs,
      onTimePct: s.totalPOs > 0 ? Math.round((s.onTime / s.totalPOs) * 100) : 0
    })).sort((a,b) => b.totalValue - a.totalValue);

    const pendingWithDays = allPending?.map(p => ({
      ...p,
      daysPending: Math.floor(
        (new Date() - new Date(p.created_at)) / (1000 * 60 * 60 * 24)
      )
    })).sort((a,b) => b.daysPending - a.daysPending);

    res.json({
      success: true,
      kpis: {
        totalValue,
        totalPOs: pos?.length || 0,
        pendingCount: allPending?.length || 0,
        pendingValue: allPending?.reduce((s, p) => s + (Number(p.grand_total) || 0), 0) || 0,
        overdueCount: overdue
      },
      monthlyTrend: Object.values(monthlyMap),
      supplierChart: supplierSummary.slice(0,8).map(s => ({
        name: s.supplier.length > 15 ? s.supplier.substring(0,15)+'...' : s.supplier,
        value: s.totalValue
      })),
      pendingOrders: pendingWithDays || [],
      supplierSummary
    });
  } catch (err) {
    console.error('Purchase Report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/customers
router.get('/customers', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const userId = req.user.id;

    const fromDate = from || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const toDate = to || new Date().toISOString();

    // All bills to calculate true customer stats
    const { data: bills } = await supabase
      .from('bills')
      .select('customer_name, customer_phone, grand_total, payment_status, created_at')
      .eq('user_id', userId);

    // Build customer stats
    const custMap = {};
    bills?.forEach(b => {
      const name = b.customer_name || 'Walk-in Customer';
      if (!custMap[name]) {
        custMap[name] = {
          customer: name,
          phone: b.customer_phone || '',
          orders: 0,
          totalSpent: 0,
          firstOrder: b.created_at,
          lastOrder: b.created_at
        };
      }
      custMap[name].orders++;
      if (b.payment_status === 'Paid') {
        custMap[name].totalSpent += Number(b.grand_total) || 0;
      }
      if (b.created_at > custMap[name].lastOrder) custMap[name].lastOrder = b.created_at;
      if (b.created_at < custMap[name].firstOrder) custMap[name].firstOrder = b.created_at;
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartStr = todayStart.toISOString();

    const customerStats = Object.values(custMap).map(c => ({
      ...c,
      avgOrder: c.orders > 0 ? c.totalSpent / c.orders : 0,
      isNew: c.firstOrder >= fromDate && c.firstOrder <= toDate,
      isRepeat: c.orders >= 2,
      activeToday: c.lastOrder >= todayStartStr,
      newToday: c.firstOrder >= todayStartStr
    })).sort((a,b) => b.totalSpent - a.totalSpent);

    const totalCustomers = customerStats.length;
    const newCustomers = customerStats.filter(c => c.isNew).length;
    const repeatCustomers = customerStats.filter(c => c.isRepeat).length;
    const todayCustomersCount = customerStats.filter(c => c.activeToday).length;
    const todayNewCustomersCount = customerStats.filter(c => c.newToday).length;

    // Top 10 for chart
    const topCustomers = customerStats.slice(0, 10).map(c => ({
      name: c.customer.length > 20 ? c.customer.substring(0,20)+'...' : c.customer,
      revenue: c.totalSpent,
      orders: c.orders
    }));

    // Monthly new customers trend
    const monthlyMap = {};
    const months = 6;
    for (let i = months-1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      monthlyMap[key] = { month: key, newCustomers: 0, existingCustomers: 0, orders: 0, _customersThisMonth: new Set() };
    }

    bills?.forEach(b => {
      const key = new Date(b.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      if (monthlyMap[key]) {
        monthlyMap[key].orders++;
        monthlyMap[key]._customersThisMonth.add(b.customer_name || 'Walk-in Customer');
      }
    });

    customerStats.forEach(c => {
      const key = new Date(c.firstOrder).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      if (monthlyMap[key]) monthlyMap[key].newCustomers++;
    });

    Object.values(monthlyMap).forEach(m => {
      m.existingCustomers = Math.max(0, m._customersThisMonth.size - m.newCustomers);
      delete m._customersThisMonth;
    });

    // Outstanding
    const { data: unpaidBills } = await supabase
      .from('bills')
      .select('*')
      .eq('user_id', userId)
      .in('payment_status', ['Unpaid','Partial']);

    const outstandingMap = {};
    unpaidBills?.forEach(b => {
      const name = b.customer_name || 'Walk-in Customer';
      if (!outstandingMap[name]) {
        outstandingMap[name] = {
          customer: name,
          phone: b.customer_phone || '',
          bills: 0,
          totalDue: 0,
          oldestBill: b.created_at
        };
      }
      outstandingMap[name].bills++;
      outstandingMap[name].totalDue += Number(b.balance_due) || Number(b.grand_total) || 0;
      if (b.created_at < outstandingMap[name].oldestBill) outstandingMap[name].oldestBill = b.created_at;
    });

    const outstanding = Object.values(outstandingMap).map(o => ({
      ...o,
      daysOverdue: Math.floor((new Date() - new Date(o.oldestBill)) / 86400000)
    })).sort((a,b) => b.totalDue - a.totalDue);

    res.json({
      success: true,
      kpis: {
        totalCustomers: totalCustomers || 0,
        newCustomers,
        repeatCustomers,
        outstandingDue: outstanding.reduce((s,o) => s + o.totalDue, 0),
        todayCustomersCount,
        todayNewCustomersCount
      },
      topCustomers,
      monthlyTrend: Object.values(monthlyMap),
      customerHistory: customerStats,
      outstanding
    });
  } catch (err) {
    console.error('Customer Report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/products
router.get('/products', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const userId = req.user.id;

    const fromDate = from || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const toDate = to || new Date().toISOString();

    // All inventory
    const { data: inventory } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId);

    // Bills in period
    const { data: bills } = await supabase
      .from('bills')
      .select('items, payment_status')
      .eq('user_id', userId)
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    // Build product performance map
    const productMap = {};
    bills?.forEach(bill => {
      (bill.items || []).forEach(item => {
        const name = item.description;
        if (!productMap[name]) {
          // Find in inventory
          const invItem = inventory?.find(i =>
            i.name?.toLowerCase() === name?.toLowerCase()
          );
          productMap[name] = {
            name,
            sku: invItem?.sku || '—',
            category: invItem?.category || 'Other',
            costPrice: Number(invItem?.cost_price) || 0,
            sellingPrice: Number(invItem?.rate) || Number(item.rate) || 0,
            inStock: Number(invItem?.qty) || 0,
            qtySold: 0,
            revenue: 0
          };
        }
        productMap[name].qtySold += Number(item.quantity) || 0;
        productMap[name].revenue += Number(item.amount) || 0;
      });
    });

    const products = Object.values(productMap)
      .map(p => ({
        ...p,
        avgPrice: p.qtySold > 0 ? p.revenue / p.qtySold : 0,
        margin: p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100 : 0,
        totalProfit: p.qtySold * (p.sellingPrice - p.costPrice)
      }))
      .sort((a,b) => b.revenue - a.revenue);

    // Category revenue
    const catRevMap = {};
    products.forEach(p => {
      const cat = p.category;
      catRevMap[cat] = (catRevMap[cat] || 0) + p.revenue;
    });

    res.json({
      success: true,
      kpis: {
        totalProducts: inventory?.length || 0,
        bestSelling: products[0] || null,
        leastSelling: products.filter(p => p.qtySold > 0).slice(-1)[0] || null,
        totalRevenue: products.reduce((s,p) => s + p.revenue, 0)
      },
      salesRanking: products.slice(0,10).map(p => ({
        name: p.name.length > 20 ? p.name.substring(0,20)+'...' : p.name,
        revenue: p.revenue,
        qty: p.qtySold
      })),
      categoryRevenue: Object.entries(catRevMap)
        .map(([category, revenue]) => ({ category, revenue }))
        .sort((a,b) => b.revenue - a.revenue),
      performance: products,
      profitability: [...products].sort((a,b) => b.totalProfit - a.totalProfit)
    });
  } catch (err) {
    console.error('Product Report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/billing
router.get('/billing', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const userId = req.user.id;

    const fromDate = from || new Date(
      new Date().getFullYear(),
      new Date().getMonth(), 1
    ).toISOString();
    const toDate = to || new Date().toISOString();

    const { data: bills } = await supabase
      .from('bills')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .order('created_at', { ascending: false });

    const totalBills = bills?.length || 0;
    const totalAmount = bills?.reduce((s,b) => s + (Number(b.grand_total) || 0), 0) || 0;
    const totalDiscount = bills?.reduce((s,b) => s + (Number(b.discount) || 0), 0) || 0;

    // Calculate GST from items
    let totalGST = 0;
    bills?.forEach(b => {
      (b.items || []).forEach(item => {
        const base = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
        const gstPct = Number(item.gstPercent) || Number(item.gst_percent) || 0;
        const gst = base * (gstPct / 100);
        totalGST += gst;
      });
    });

    // Daily trend
    const dailyMap = {};
    bills?.forEach(b => {
      const date = new Date(b.created_at).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: '2-digit'
      });
      if (!dailyMap[date]) {
        dailyMap[date] = { date, count: 0, amount: 0 };
      }
      dailyMap[date].count++;
      dailyMap[date].amount += Number(b.grand_total) || 0;
    });

    // Payment methods
    const paymentMap = {};
    bills?.forEach(b => {
      const method = b.payment_method || 'Cash';
      paymentMap[method] = (paymentMap[method] || 0) + (Number(b.grand_total) || 0);
    });

    const paymentMethods = Object.entries(paymentMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value);

    // Unpaid bills
    const unpaid = bills?.filter(b => b.payment_status !== 'Paid').map(b => ({
      ...b,
      daysPending: Math.floor((new Date() - new Date(b.created_at)) / 86400000)
    }));

    res.json({
      success: true,
      kpis: {
        totalBills,
        avgBillValue: totalBills > 0 ? totalAmount / totalBills : 0,
        totalGST,
        totalDiscount
      },
      trend: Object.values(dailyMap),
      paymentMethods,
      recentBills: bills?.slice(0, 20) || [],
      unpaidBills: unpaid || []
    });
  } catch (err) {
    console.error('Billing Report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/demand
router.get('/demand', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const userId = req.user.id;

    const fromDate = from || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const toDate = to || new Date().toISOString();

    // Current period bills
    const { data: bills } = await supabase
      .from('bills')
      .select('items, created_at')
      .eq('user_id', userId)
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    // Previous period for trend
    const periodMs = new Date(toDate) - new Date(fromDate);
    const prevFrom = new Date(new Date(fromDate) - periodMs).toISOString();

    const { data: prevBills } = await supabase
      .from('bills')
      .select('items')
      .eq('user_id', userId)
      .gte('created_at', prevFrom)
      .lt('created_at', fromDate);

    // Build demand map current period
    const demandMap = {};
    bills?.forEach(b => {
      (b.items || []).forEach(item => {
        const name = item.description || item.name;
        if (!name) return;
        if (!demandMap[name]) {
          demandMap[name] = { name, category: item.category || 'N/A', units: 0, revenue: 0, prevUnits: 0 };
        }
        demandMap[name].units += Number(item.quantity) || 0;
        demandMap[name].revenue += Number(item.amount) || 0;
      });
    });

    // Previous period demand
    prevBills?.forEach(b => {
      (b.items || []).forEach(item => {
        const name = item.description || item.name;
        if (name && demandMap[name]) {
          demandMap[name].prevUnits += Number(item.quantity) || 0;
        }
      });
    });

    // Monthly trend (6 months)
    const monthlyMap = {};
    const months = 6;
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      monthlyMap[key] = { month: key, units: 0 };
    }

    bills?.forEach(b => {
      const key = new Date(b.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      if (monthlyMap[key]) {
        (b.items || []).forEach(item => {
          monthlyMap[key].units += Number(item.quantity) || 0;
        });
      }
    });

    const products = Object.values(demandMap)
      .map((p, i) => ({
        ...p,
        demandScore: p.units > 50 ? 'High' : p.units >= 10 ? 'Medium' : p.units > 0 ? 'Low' : 'None',
        trend: p.prevUnits > 0 ? (p.units > p.prevUnits ? 'up' : p.units < p.prevUnits ? 'down' : 'stable') : 'new'
      }))
      .sort((a, b) => b.units - a.units)
      .map((p, i) => ({ ...p, rank: i + 1 }));

    const totalUnits = products.reduce((s, p) => s + p.units, 0);

    res.json({
      success: true,
      kpis: {
        highestDemand: products[0] || null,
        lowestDemand: products.filter(p => p.units > 0).slice(-1)[0] || null,
        totalUnits
      },
      topDemand: products.slice(0, 10).map(p => ({
        name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
        units: p.units
      })),
      lowDemand: [...products].filter(p => p.units > 0).reverse().slice(0, 8).map(p => ({
        name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
        units: p.units
      })),
      monthlyTrend: Object.values(monthlyMap),
      rankingTable: products
    });
  } catch (err) {
    console.error('Demand Report error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

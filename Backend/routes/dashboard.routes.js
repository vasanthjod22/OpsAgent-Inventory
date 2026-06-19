const { formatDate } = require('../services/dateUtils');
const express = require('express');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');
const { AnalyticsService } = require('../services/analytics.service');
const CacheService = require('../services/cache.service');

const router = express.Router();

router.get('/kpis', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().split('T')[0];
    const weekAgoStr = new Date(today.getTime() - 7 * 86400000).toISOString().split('T')[0];

    const cacheKey = `dashboard:kpis:${userId}:${todayStr}`;
    const cachedData = await CacheService.get(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    const todayMetrics = await AnalyticsService.getCoreMetrics(userId, todayStr, todayStr);
    const yesterdayMetrics = await AnalyticsService.getCoreMetrics(userId, yesterdayStr, yesterdayStr);
    const outstanding = await AnalyticsService.getOutstandingReceivables(userId);
    const inventoryStatus = await AnalyticsService.getInventoryStatus(userId);
    const customerMetrics = await AnalyticsService.getCustomerMetrics(userId, `${weekAgoStr}T00:00:00`, `${todayStr}T23:59:59`);
    const purchaseMetrics = await AnalyticsService.getPurchaseMetrics(userId, todayStr, todayStr);

    const { data: allPaidBills } = await supabase
      .from('bills')
      .select('grand_total')
      .eq('user_id', userId)
      .eq('payment_status', 'Paid');

    const totalSalesAllTime = allPaidBills?.reduce((s, b) => s + Number(b.grand_total || 0), 0) || 0;

    const responseData = {
      success: true,
      todaySales: todayMetrics.totalRevenue,
      todaySalesChange: yesterdayMetrics.totalRevenue > 0 ? ((todayMetrics.totalRevenue - yesterdayMetrics.totalRevenue) / yesterdayMetrics.totalRevenue) * 100 : 0,
      todayProfit: todayMetrics.grossProfit,
      todayProfitChange: yesterdayMetrics.grossProfit > 0 ? ((todayMetrics.grossProfit - yesterdayMetrics.grossProfit) / yesterdayMetrics.grossProfit) * 100 : 0,
      todayOrders: todayMetrics.totalOrders,
      todayOrdersChange: yesterdayMetrics.totalOrders > 0 ? ((todayMetrics.totalOrders - yesterdayMetrics.totalOrders) / yesterdayMetrics.totalOrders) * 100 : 0,
      pendingBills: {
        count: outstanding.pendingBillsCount,
        amount: outstanding.totalOutstanding
      },
      pendingPOs: purchaseMetrics.pendingPOsCount,
      lowStock: inventoryStatus.lowStockCount,
      inventoryValue: inventoryStatus.totalInventoryValue,
      customerDue: outstanding.totalOutstanding,
      totalCustomers: customerMetrics.totalCustomers,
      newCustomersThisWeek: customerMetrics.newCustomers,
      totalSalesAllTime,
      todayPaymentMap: todayMetrics.paymentMap
    };

    // Cache for 5 minutes (300 seconds)
    await CacheService.set(cacheKey, responseData, 300);

    res.json(responseData);
  } catch (err) {
    console.error('Dashboard KPIs Error:', err);
    res.status(500).json({ error: err.message });
  }
});


router.get('/sales-trend', auth, async (req, res) => {
  try {
    const { from, to } = req.query;

    const fromDate = from ? from.substring(0, 10) : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().substring(0, 10);
    const toDate = to ? to.substring(0, 10) : new Date().toISOString().substring(0, 10);

    const metrics = await AnalyticsService.getCoreMetrics(req.user.id, fromDate, toDate);

    const dataArray = Object.values(metrics.dateMap)
      .map(d => ({
        date: formatDate(d.date),
        sales: d.revenue,
        orders: d.orders,
        _sort: new Date(d.date).getTime()
      }))
      .sort((a, b) => a._sort - b._sort)
      .map(d => { delete d._sort; return d; });

    res.json({ success: true, data: dataArray });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sales-by-category', auth, async (req, res) => {
  try {
    const { from, to, category: reqCategory } = req.query;

    const fromDate = from ? from.substring(0, 10) : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().substring(0, 10);
    const toDate = to ? to.substring(0, 10) : new Date().toISOString().substring(0, 10);

    const metrics = await AnalyticsService.getCoreMetrics(req.user.id, fromDate, toDate, reqCategory);

    const result = Object.values(metrics.categoryMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/top-products', auth, async (req, res) => {
  try {
    const { from, to, category } = req.query;

    const fromDate = from ? from.substring(0, 10) : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().substring(0, 10);
    const toDate = to ? to.substring(0, 10) : new Date().toISOString().substring(0, 10);

    const metrics = await AnalyticsService.getCoreMetrics(req.user.id, fromDate, toDate, category);

    const result = Object.values(metrics.productMap)
      .map(p => ({
        name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
        fullName: p.name,
        revenue: p.revenue,
        qty: p.qty
      }))
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

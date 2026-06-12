const express = require('express');
const { auth } = require('../middleware/auth');
const supabase = require('../data/supabaseClient');

const router = express.Router();

// Helper to calculate health score
const calculateHealthScore = (data) => {
  let score = 0
  const weights = {
    revenue: 25,
    profit: 20,
    inventory: 20,
    payments: 20,
    orders: 15
  }

  // Revenue score (25 pts)
  if (data.revenue > 0) score += 15
  if (data.revenueGrowth > 0) score += 10
  else if (data.revenueGrowth === 0) score += 5

  // Profit score (20 pts)
  const margin = data.revenue > 0
    ? (data.profit / data.revenue) * 100 : 0
  if (margin > 20) score += 20
  else if (margin > 10) score += 15
  else if (margin > 0) score += 8

  // Inventory score (20 pts)
  const lowStockPct = data.totalProducts > 0
    ? (data.lowStock / data.totalProducts) * 100
    : 0
  if (lowStockPct < 5) score += 20
  else if (lowStockPct < 15) score += 15
  else if (lowStockPct < 30) score += 8

  // Payments score (20 pts)
  const duePct = data.revenue > 0
    ? (data.customerDue / data.revenue) * 100
    : 100
  if (duePct < 10) score += 20
  else if (duePct < 25) score += 15
  else if (duePct < 50) score += 8

  // Orders score (15 pts)
  if (data.totalOrders > 50) score += 15
  else if (data.totalOrders > 20) score += 10
  else if (data.totalOrders > 5) score += 5

  return Math.min(100, Math.round(score))
}

router.post('/business-snapshot', auth, async (req, res) => {
  try {
    const { from, to } = req.body
    const userId = req.user.id

    const { AnalyticsService } = require('../services/analytics.service');

    const coreMetrics = await AnalyticsService.getCoreMetrics(userId, from, to);
    const expensesData = await AnalyticsService.getExpenses(userId, from, to, coreMetrics.totalCogs);
    const inventoryStatus = await AnalyticsService.getInventoryStatus(userId, coreMetrics.rawInventory);
    const purchaseMetrics = await AnalyticsService.getPurchaseMetrics(userId, from, to);
    const receivables = await AnalyticsService.getOutstandingReceivables(userId);

    const snapshotData = {
      revenue: coreMetrics.totalRevenue,
      profit: coreMetrics.grossProfit - expensesData.manualExpenses,
      totalExpenses: expensesData.totalExpenses,
      totalOrders: coreMetrics.totalOrders,
      pendingBills: {
        count: receivables.pendingBillsCount,
        amount: receivables.totalOutstanding
      },
      customerDue: receivables.totalOutstanding,
      lowStock: inventoryStatus.lowStockCount,
      pendingPOs: purchaseMetrics.pendingPOsCount,
      uniqueCustomers: Object.keys(coreMetrics.customerMap).length,
      totalProducts: inventoryStatus.totalItems,
      topCategory: Object.values(coreMetrics.categoryMap).sort((a,b) => b.revenue - a.revenue)[0]?.category || 'N/A'
    }

    const healthScore = calculateHealthScore(snapshotData)

    res.json({
      success: true,
      data: snapshotData,
      healthScore,
      dateRange: { from, to }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Context: Inventory data
router.get('/context/inventory', auth, async (req, res) => {
  try {
    const { data: inventory } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', req.user.id)
      .order('qty')

    const lowStock = inventory?.filter(
      i => (i.qty || 0) <= (i.min || 0)
    ) || []

    res.json({ 
      success: true, 
      data: { inventory, lowStock }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Context: Top products in date range
router.get('/context/products', auth, async (req, res) => {
  try {
    const { from, to } = req.query
    const { AnalyticsService } = require('../services/analytics.service');
    const coreMetrics = await AnalyticsService.getCoreMetrics(req.user.id, from, to);

    const products = Object.values(coreMetrics.productMap)
      .sort((a,b) => b.revenue - a.revenue)

    res.json({ success: true, data: products })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Context: Outstanding payments
router.get('/context/outstanding', auth, async (req, res) => {
  try {
    const { AnalyticsService } = require('../services/analytics.service');
    const receivables = await AnalyticsService.getOutstandingReceivables(req.user.id);

    res.json({ success: true, data: receivables.customerDueList })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Main AI ask endpoint
router.post('/ask', auth, async (req, res) => {
  try {
    const { 
      question, 
      context, 
      apiKey 
    } = req.body

    const actualKey = apiKey || req.headers['x-groq-api-key'] || process.env.GROQ_API_KEY;

    if (!actualKey) {
      return res.status(503).json({ error: 'AI service not configured.' });
    }

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${actualKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'You are OpsAgent AI, a professional business consultant for a hardware shop CRM. Always structure responses with Observation, Reason, and Recommendation sections. Be specific with numbers and always reference the date range provided.'
            },
            {
              role: 'user',
              content: context
            }
          ],
          temperature: 0.3,
          max_tokens: 1024
        })
      }
    )

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error?.message || `Groq API Error: ${response.status} ${response.statusText}`)
    }

    const answer = data.choices?.[0]?.message?.content

    if (!answer) {
      throw new Error('Empty response from AI')
    }

    res.json({ success: true, answer })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router;

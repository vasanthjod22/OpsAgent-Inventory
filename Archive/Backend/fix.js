const fs = require('fs');
const file = 'd:/Inventory/Backend/routes/reports.js';
let content = fs.readFileSync(file, 'utf8');

// The file is currently broken around line 310.
// Let's find the start of res.json({ for sales report.
const topProductsIdx = content.indexOf('const topProducts =');
const endSalesIdx = content.indexOf('res.json({', topProductsIdx);
const beforeBroken = content.substring(0, endSalesIdx);

// Find the end of the broken part which is where `const expenseCategories = ` starts
const expenseCatIdx = content.indexOf('const expenseCategories =');
const afterBroken = content.substring(expenseCatIdx);

const fixedMiddle = `res.json({
      kpis: {
        totalSales,
        totalOrders: filteredTotalOrders,
        avgOrderValue,
        totalProfit
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
    const userId = req.user.id;

    const fromDate = from || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const toDate = to || new Date().toISOString();

    // Revenue from paid bills
    const { data: paidBills } = await supabase
      .from('bills')
      .select('grand_total, created_at, customer_name, date')
      .eq('user_id', userId)
      .eq('payment_status', 'Paid')
      .gte('date', fromDate.split('T')[0])
      .lte('date', toDate.split('T')[0]);

    const totalRevenue = paidBills?.reduce((s, b) => s + Number(b.grand_total || 0), 0) || 0;

    // Expenses
    const { data: expenses } = await supabase
      .from('finance')
      .select('amount, category, date')
      .eq('user_id', userId)
      .eq('type', 'Expense')
      .gte('date', fromDate.split('T')[0])
      .lte('date', toDate.split('T')[0]);

    const totalExpenses = expenses?.reduce((s, e) => s + Number(e.amount || 0), 0) || 0;

    // Monthly trend (last 6 months)
    const monthlyData = {};
    const months = 6;
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      monthlyData[key] = { month: key, revenue: 0, expenses: 0, profit: 0 };
    }

    paidBills?.forEach(b => {
      const key = new Date(b.date || b.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      if (monthlyData[key]) {
        monthlyData[key].revenue += Number(b.grand_total || 0);
      }
    });

    expenses?.forEach(e => {
      const key = new Date(e.date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      if (monthlyData[key]) {
        monthlyData[key].expenses += Number(e.amount || 0);
      }
    });

    Object.values(monthlyData).forEach(m => {
      m.profit = m.revenue - m.expenses;
    });

    // Expense by category
    const catMap = {};
    expenses?.forEach(e => {
      const cat = e.category || 'Other';
      catMap[cat] = (catMap[cat] || 0) + Number(e.amount || 0);
    });
    
    `;

fs.writeFileSync(file, beforeBroken + fixedMiddle + afterBroken);
console.log('Fixed reports.js successfully!');

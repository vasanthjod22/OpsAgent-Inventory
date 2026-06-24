const supabase = require('../data/supabaseClient');

class AnalyticsService {
  /**
   * Helper to ensure valid numbers and prevent NaN/Infinity
   */
  static safeNumber(val) {
    const num = Number(val);
    return (Number.isFinite(num) && !Number.isNaN(num)) ? num : 0;
  }

  /**
   * Centralized method to fetch and calculate core sales & profit data for a date range.
   * This guarantees that Dashboard, Sales Report, and Finance use the exact same logic.
   */
  static async getCoreMetrics(userId, fromDate, toDate, categoryFilter = null) {
    try {
      // 1. Fetch Paid/Partial Bills in date range
      const { data: bills, error: billsError } = await supabase
        .from('bills')
        .select('id, grand_total, payment_status, date, created_at, items, customer_name, payment_method')
        .eq('user_id', userId)
        .in('payment_status', ['Paid', 'Partial'])
        .gte('date', fromDate)
        .lte('date', toDate)
        .order('date', { ascending: true });

      if (billsError) throw billsError;

      // 2. Fetch all inventory to map Cost Prices and Categories
      const { data: inventoryData, error: invError } = await supabase
        .from('inventory')
        .select('id, name, sku, category, cost_price, rate, qty, min, max, last_restocked, cgst_percent, sgst_percent')
        .eq('user_id', userId);

      if (invError) throw invError;

      let totalRevenue = 0;
      let totalCogs = 0;
      let totalOrders = bills?.length || 0;
      
      const categoryMap = {};
      const productMap = {};
      const dateMap = {};
      const monthMap = {};
      const customerMap = {};
      const paymentMap = {};

      (bills || []).forEach(bill => {
        const billDateStr = new Date(bill.date || bill.created_at).toISOString().split('T')[0];
        let billRevenue = this.safeNumber(bill.grand_total);
        
        let billCogs = 0;
        let sumItemAmounts = 0;
        let filteredBillRevenue = 0;

        (bill.items || []).forEach(item => {
          sumItemAmounts += this.safeNumber(item.amount || item.total);
        });

        // Determine proportional discount/tax ratio applied to the bill
        let ratio = sumItemAmounts > 0 ? (billRevenue / sumItemAmounts) : 1;
        if (!Number.isFinite(ratio)) ratio = 1;

        (bill.items || []).forEach(item => {
          // Find corresponding inventory item for Cost Price and Category
          const invItem = inventoryData?.find(i => 
            i.id === item.inventoryId || 
            (i.name && item.description && i.name.toLowerCase() === item.description.toLowerCase()) || 
            (i.sku && item.inventorySku && i.sku === item.inventorySku)
          );

          const cat = invItem?.category || 'Uncategorized';
          
          // Apply Category Filter if specified
          if (categoryFilter && categoryFilter !== 'All Categories' && categoryFilter !== 'all' && cat !== categoryFilter) {
            return; // Skip this item
          }

          const itemRevenue = this.safeNumber(item.amount || item.total) * ratio;
          const itemQty = this.safeNumber(item.quantity);
          const itemCostPrice = this.safeNumber(invItem?.cost_price);
          const itemCogs = itemQty * itemCostPrice;

          filteredBillRevenue += itemRevenue;
          billCogs += itemCogs;

          // Aggregations
          if (!categoryMap[cat]) categoryMap[cat] = { category: cat, revenue: 0, cogs: 0, qty: 0 };
          categoryMap[cat].revenue += itemRevenue;
          categoryMap[cat].cogs += itemCogs;
          categoryMap[cat].qty += itemQty;

          const pName = item.description || 'Unknown';
          if (!productMap[pName]) productMap[pName] = { name: pName, revenue: 0, cogs: 0, qty: 0 };
          productMap[pName].revenue += itemRevenue;
          productMap[pName].cogs += itemCogs;
          productMap[pName].qty += itemQty;
        });

        totalRevenue += filteredBillRevenue;
        totalCogs += billCogs;

        // Trends & Groupings
        if (filteredBillRevenue > 0) {
          if (!dateMap[billDateStr]) dateMap[billDateStr] = { date: billDateStr, revenue: 0, cogs: 0, orders: 0 };
          dateMap[billDateStr].revenue += filteredBillRevenue;
          dateMap[billDateStr].cogs += billCogs;
          dateMap[billDateStr].orders += 1;

          const billMonthStr = billDateStr.substring(0, 7); // YYYY-MM
          if (!monthMap[billMonthStr]) monthMap[billMonthStr] = { month: billMonthStr, revenue: 0, cogs: 0, orders: 0 };
          monthMap[billMonthStr].revenue += filteredBillRevenue;
          monthMap[billMonthStr].cogs += billCogs;
          monthMap[billMonthStr].orders += 1;

          const pm = bill.payment_mode || bill.payment_method || 'Cash';
          if (!paymentMap[pm]) paymentMap[pm] = { name: pm, value: 0 };
          paymentMap[pm].value += filteredBillRevenue;

          const cid = bill.customer_id || bill.customer_name || 'Walk-in Customer';
          const cname = bill.customer_name || 'Walk-in Customer';
          if (!customerMap[cid]) customerMap[cid] = { customer: cname, orders: 0, total: 0, lastOrder: billDateStr, paymentMode: pm };
          customerMap[cid].orders += 1;
          customerMap[cid].total += filteredBillRevenue;
          if (billDateStr >= customerMap[cid].lastOrder) {
            customerMap[cid].lastOrder = billDateStr;
            customerMap[cid].paymentMode = pm;
          }
        }
      });

      const grossProfit = totalRevenue - totalCogs;
      const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      return {
        totalRevenue,
        totalCogs,
        grossProfit,
        profitMargin,
        totalOrders,
        avgOrderValue,
        categoryMap,
        productMap,
        dateMap,
        monthMap,
        customerMap,
        paymentMap,
        rawInventory: inventoryData // Useful for passing down to inventory calculations
      };
    } catch (error) {
      console.error('AnalyticsService.getCoreMetrics error:', error);
      throw error;
    }
  }

  /**
   * Centralized method for Financial Expenses (combines COGS and Manual Expenses)
   */
  static async getExpenses(userId, fromDate, toDate, totalCogs) {
    try {
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, category, date')
        .eq('user_id', userId)
        .gte('date', fromDate)
        .lte('date', toDate);

      const manualExpenses = (expenses || []).reduce((s, e) => s + this.safeNumber(e.amount), 0);
      const totalExpenses = manualExpenses + this.safeNumber(totalCogs);

      const catMap = {};
      if (this.safeNumber(totalCogs) > 0) catMap['Cost of Goods Sold'] = this.safeNumber(totalCogs);
      
      (expenses || []).forEach(e => {
        const cat = e.category || 'Other';
        catMap[cat] = (catMap[cat] || 0) + this.safeNumber(e.amount);
      });

      const expenseCategories = Object.entries(catMap)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      return {
        manualExpenses,
        totalExpenses,
        expenseCategories,
        rawExpenses: expenses || []
      };
    } catch (error) {
      console.error('AnalyticsService.getExpenses error:', error);
      throw error;
    }
  }

  /**
   * Centralized method for Outstanding Receivables (Unpaid/Partial Bills)
   */
  static async getOutstandingReceivables(userId) {
    try {
      const { data: unpaidBills } = await supabase
        .from('bills')
        .select('customer_name, customer_phone, grand_total, balance_due, payment_status, date, created_at')
        .eq('user_id', userId)
        .in('payment_status', ['Unpaid', 'Partial'])
        .order('date', { ascending: true });

      let totalOutstanding = 0;
      const customerDueMap = {};

      (unpaidBills || []).forEach(b => {
        const name = b.customer_name || 'Walk-in Customer';
        const due = b.payment_status === 'Partial' ? this.safeNumber(b.balance_due) : this.safeNumber(b.grand_total);
        totalOutstanding += due;

        if (!customerDueMap[name]) {
          customerDueMap[name] = {
            customer: name,
            phone: b.customer_phone || '',
            billsCount: 0,
            totalDue: 0,
            oldestBill: b.date || b.created_at
          };
        }
        customerDueMap[name].billsCount++;
        customerDueMap[name].totalDue += due;
        if (new Date(b.date || b.created_at) < new Date(customerDueMap[name].oldestBill)) {
          customerDueMap[name].oldestBill = b.date || b.created_at;
        }
      });

      const customerDueList = Object.values(customerDueMap).map(o => {
        const diffTime = Math.abs(new Date() - new Date(o.oldestBill));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { ...o, daysOverdue: diffDays };
      }).sort((a, b) => b.totalDue - a.totalDue);

      return {
        totalOutstanding,
        customerDueList,
        pendingBillsCount: unpaidBills?.length || 0
      };
    } catch (error) {
      console.error('AnalyticsService.getOutstandingReceivables error:', error);
      throw error;
    }
  }

  /**
   * Centralized method for Inventory Value and Status.
   * When asOfDate is provided, reconstructs historical stock via:
   *   historicalQty = currentQty + (salesQtyAfterDate) - (purchasesQtyAfterDate)
   */
  static async getInventoryStatus(userId, rawInventory = null, asOfDate = null) {
    try {
      let inventoryData = rawInventory;
      if (!inventoryData) {
        const { data } = await supabase
          .from('inventory')
          .select('*')
          .eq('user_id', userId);
        inventoryData = data || [];
      }

      // ── Time-Travel: build qty-delta maps for items sold/purchased AFTER asOfDate ──
      let salesAfterMap = {};    // itemName → qty sold after asOfDate
      let purchasesAfterMap = {}; // itemName → qty purchased after asOfDate

      if (asOfDate) {
        // Bills sold AFTER asOfDate (these reduced current stock; we add them back)
        const { data: futureBills } = await supabase
          .from('bills')
          .select('items')
          .eq('user_id', userId)
          .gt('date', asOfDate);

        (futureBills || []).forEach(bill => {
          (bill.items || []).forEach(item => {
            const name = (item.description || '').toLowerCase();
            const qty  = this.safeNumber(item.quantity);
            salesAfterMap[name] = (salesAfterMap[name] || 0) + qty;
          });
        });

        // GRN purchases AFTER asOfDate (these increased current stock; we subtract them)
        const { data: futureGrns } = await supabase
          .from('grn')
          .select('items')
          .eq('user_id', userId)
          .eq('inventory_updated', true)
          .gt('date', asOfDate);

        (futureGrns || []).forEach(grn => {
          (grn.items || []).forEach(item => {
            const name = (item.description || '').toLowerCase();
            const qty  = this.safeNumber(item.quantity);
            purchasesAfterMap[name] = (purchasesAfterMap[name] || 0) + qty;
          });
        });
      }

      let totalInventoryValue = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      inventoryData.forEach(item => {
        let qty = this.safeNumber(item.qty);
        const rate = this.safeNumber(item.rate);
        const min  = this.safeNumber(item.min);
        const cgst = this.safeNumber(item.cgst_percent);
        const sgst = this.safeNumber(item.sgst_percent);
        const gstMultiplier = 1 + ((cgst + sgst) / 100);

        if (asOfDate) {
          const name = (item.name || '').toLowerCase();
          qty = qty + (salesAfterMap[name] || 0) - (purchasesAfterMap[name] || 0);
          qty = Math.max(0, qty); // never go negative in historical view
        }

        totalInventoryValue += (qty * rate * gstMultiplier);
        if (qty === 0) outOfStockCount++;
        else if (qty <= min) lowStockCount++;
      });

      return {
        totalInventoryValue,
        lowStockCount,
        outOfStockCount,
        totalItems: inventoryData.length
      };
    } catch (error) {
      console.error('AnalyticsService.getInventoryStatus error:', error);
      throw error;
    }
  }

  /**
   * Centralized method for Customers
   */
  static async getCustomerMetrics(userId, fromDate, toDate) {
    try {
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { count: newCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', fromDate)
        .lte('created_at', toDate);

      return {
        totalCustomers: totalCustomers || 0,
        newCustomers: newCustomers || 0
      };
    } catch (error) {
      console.error('AnalyticsService.getCustomerMetrics error:', error);
      throw error;
    }
  }

  /**
   * Centralized method for Purchase Orders
   */
  static async getPurchaseMetrics(userId, fromDate, toDate) {
    try {
      const { data: pos } = await supabase
        .from('purchase_orders')
        .select('grand_total, status, created_at, expected_date')
        .eq('user_id', userId);

      let pendingPOsCount = 0;
      let pendingPOsValue = 0;
      let totalValueInPeriod = 0;
      let overdueCount = 0;

      const todayStr = new Date().toISOString().split('T')[0];

      (pos || []).forEach(p => {
        const pDate = new Date(p.created_at).toISOString().split('T')[0];
        
        // Value for the specific period (only Fully Received)
        if (p.status === 'Fully Received' && pDate >= fromDate && pDate <= toDate) {
          totalValueInPeriod += this.safeNumber(p.grand_total);
        }

        // Pending across ALL TIME (for dashboard and KPI)
        if (p.status !== 'Fully Received' && p.status !== 'Cancelled') {
          pendingPOsCount++;
          pendingPOsValue += this.safeNumber(p.grand_total);
          
          if (p.expected_date && p.expected_date < todayStr) {
            overdueCount++;
          }
        }
      });

      return {
        pendingPOsCount,
        pendingPOsValue,
        totalValueInPeriod,
        overdueCount
      };
    } catch (error) {
      console.error('AnalyticsService.getPurchaseMetrics error:', error);
      throw error;
    }
  }
}

module.exports = { AnalyticsService };

const express = require('express');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');

const router = express.Router();

const formatBill = (b) => ({
  id: b.id,
  billNumber: b.bill_number,
  customerName: b.customer_name,
  customerPhone: b.customer_phone,
  customerAddress: b.customer_address,
  date: b.date || b.created_at,
  items: b.items,
  subtotal: b.subtotal,
  discount: b.discount,
  grandTotal: b.grand_total,
  paymentStatus: b.payment_status,
  balanceDue: b.balance_due,
  amountPaid: b.amount_paid,
  notes: b.notes,
  status: b.status,
  includeTerms: b.include_terms,
  terms: b.terms,
  inventoryUpdated: b.inventory_updated,
  createdAt: b.created_at
});

const formatQuotation = (q) => ({
  id: q.id,
  quotationNumber: q.quotation_number,
  type: q.type || 'breakdown',
  customerName: q.customer_name,
  customerPhone: q.customer_phone,
  customerEmail: q.customer_email,
  customerAddress: q.customer_address,
  date: q.date || q.created_at,
  validity: q.validity,
  projectName: q.project_name || '',
  sections: q.sections || [],
  items: q.items || [],
  packageName: q.package_name || '',
  packageDescription: q.package_description || '',
  inclusions: q.inclusions || [],
  exclusions: q.exclusions || [],
  basePrice: q.base_price || 0,
  gstPercent: q.gst_percent || 18,
  subtotal: q.subtotal,
  discount: q.discount,
  grandTotal: q.grand_total,
  notes: q.notes,
  includeTerms: q.include_terms,
  terms: q.terms,
  status: q.status,
  createdAt: q.created_at
});

const formatPO = (po) => ({
  id: po.id,
  poNumber: po.po_number,
  supplierName: po.supplier_name,
  supplierPhone: po.supplier_phone,
  supplierEmail: po.supplier_email,
  supplierAddress: po.supplier_address,
  expectedDate: po.expected_date,
  items: po.items,
  subtotal: po.subtotal,
  taxAmount: po.tax_amount,
  grandTotal: po.grand_total,
  status: po.status,
  notes: po.notes,
  paymentTerms: po.payment_terms,
  receivedAt: po.received_at,
  createdAt: po.created_at
});

const formatCustomer = (c) => ({
  id: c.id,
  name: c.name,
  phone: c.phone || '',
  email: c.email || '',
  address: c.address || '',
  city: c.city || '',
  gstin: c.gstin || '',
  notes: c.notes || '',
  tags: c.tags || [],
  contacts: c.contacts || [],
  addedManually: c.added_manually || false,
  createdAt: c.created_at,
  updatedAt: c.updated_at,
});

router.get('/', auth, async (req, res) => {
  const userId = req.user.id;

  try {
    const [
      { data: inventory },
      { data: bills },
      { data: quotations },
      { data: finance },
      { data: grn },
      { data: customers },
      { data: pos }
    ] = await Promise.all([
      supabase.from('inventory').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('bills').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('quotations').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('finance').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('grn').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('customers').select('*, contacts:customer_contacts(*)').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('purchase_orders').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    ]);

    // Calculate Finance Summary
    const income = finance ? finance.filter(t => t.type === 'Income') : [];
    const expenses = finance ? finance.filter(t => t.type === 'Expense') : [];

    const totalRevenue = income.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const totalExpenses = expenses.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const netProfit = totalRevenue - totalExpenses;

    const expMap = {};
    expenses.forEach(t => {
      expMap[t.category] = (expMap[t.category] || 0) + Math.abs(Number(t.amount));
    });
    const topExpenseCategories = Object.entries(expMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

const formatGRN = (g) => ({
  id: g.id,
  poNumber: g.po_number,
  supplier: g.supplier,
  date: g.date || g.created_at,
  items: g.items,
  itemCount: g.item_count,
  status: g.status,
  inventoryUpdated: g.inventory_updated,
  createdAt: g.created_at
});

    const financeSummary = { 
      totalRevenue, 
      totalExpenses, 
      netProfit, 
      topExpenseCategories, 
      transactionCount: finance ? finance.length : 0 
    };

    res.json({
      inventory: inventory || [],
      bills: (bills || []).map(formatBill),
      quotations: (quotations || []).map(formatQuotation),
      finance: finance || [],
      financeSummary,
      grn: (grn || []).map(formatGRN),
      customers: (customers || []).map(formatCustomer),
      purchase_orders: (pos || []).map(formatPO)
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

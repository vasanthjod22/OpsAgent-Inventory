const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/bills
router.get('/', auth, async (req, res) => {
  const { data: bills, error } = await supabase.from('bills').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  
  // Convert snake_case to camelCase
  const formatted = bills.map(b => ({
    id: b.id,
    billNumber: b.bill_number,
    customerName: b.customer_name,
    customerPhone: b.customer_phone,
    customerAddress: b.customer_address,
    date: b.date,
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
  }));
  res.json(formatted);
});

// POST /api/bills — create bill, deduct inventory stock
router.post('/', auth, async (req, res) => {
  const { customerName, customerPhone, customerAddress, items, subtotal, discount, grandTotal, paymentStatus, amountPaid, balanceDue, notes, includeTerms, terms, date, updateInventory } = req.body;

  if (!customerName || !items || items.length === 0) {
    return res.status(400).json({ error: 'customerName and items are required' });
  }

  // Generate sequential bill number
  const { count, error: countErr } = await supabase.from('bills').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id);
  if (countErr) return res.status(500).json({ error: countErr.message });
  
  const next = (count || 0) + 1;
  const billNumber = `BILL-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`;

  let inventoryUpdated = false;
  
  // Deduct inventory stock if requested
  if (updateInventory) {
    // Note: A real transaction should be used in production via RPC
    for (const item of items) {
      if (item.inventorySku) {
        const { data: inv } = await supabase.from('inventory').select('qty').eq('user_id', req.user.id).eq('sku', item.inventorySku).single();
        if (inv) {
          const newQty = Math.max(0, inv.qty - (Number(item.quantity) || 0));
          await supabase.from('inventory').update({ qty: newQty }).eq('user_id', req.user.id).eq('sku', item.inventorySku);
        }
      }
    }
    inventoryUpdated = true;
  }

  const bill = {
    user_id: req.user.id,
    bill_number: billNumber,
    customer_name: customerName,
    customer_phone: customerPhone || '',
    customer_address: customerAddress || '',
    items,
    subtotal: subtotal || 0,
    discount: discount || 0,
    grand_total: grandTotal || 0,
    payment_status: paymentStatus || 'Unpaid',
    amount_paid: amountPaid || null,
    balance_due: balanceDue || null,
    notes: notes || '',
    include_terms: includeTerms || false,
    terms: terms || '',
    date: date || new Date().toISOString().split('T')[0],
    inventory_updated: inventoryUpdated
  };

  const { data: inserted, error } = await supabase.from('bills').insert([bill]).select().single();
  if (error) return res.status(500).json({ error: error.message });
  
  inserted.billNumber = inserted.bill_number;
  inserted.customerName = inserted.customer_name;
  res.status(201).json(inserted);
});

// PATCH /api/bills/:id/status — update payment status
router.patch('/:id/status', auth, async (req, res) => {
  const { paymentStatus, amountPaid } = req.body;
  const { data: bill, error: fetchErr } = await supabase.from('bills').select('*').eq('user_id', req.user.id).eq('id', req.params.id).single();
  if (fetchErr || !bill) return res.status(404).json({ error: 'Bill not found' });

  const updates = { payment_status: paymentStatus || bill.payment_status };
  
  if (paymentStatus === 'Partial') {
    updates.amount_paid = Number(amountPaid) || 0;
    updates.balance_due = bill.grand_total - updates.amount_paid;
  }

  const { data: updated, error } = await supabase.from('bills').update(updates).eq('user_id', req.user.id).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  res.json(updated);
});

// DELETE /api/bills/:id
router.delete('/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('bills').delete().eq('user_id', req.user.id).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Bill not found' });
  res.json({ message: 'Deleted' });
});

module.exports = router;

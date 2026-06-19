const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');
const { NotificationService } = require('../services/notification.service');
const { ActivityService } = require('../services/activity.service');

const router = express.Router();

const formatBill = (b) => ({
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
  transportDetails: b.transport_details || null,
  paymentMethod: b.payment_method || 'Cash',
  createdAt: b.created_at
});

// GET /api/bills
router.get('/', auth, async (req, res) => {
  const { data: bills, error } = await supabase.from('bills').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  
  // Convert snake_case to camelCase
  const formatted = bills.map(formatBill);
  res.json(formatted);
});

// POST /api/bills — create bill, deduct inventory stock
router.post('/', auth, async (req, res) => {
  const { customerName, customerPhone, customerAddress, items, subtotal, discount, grandTotal, paymentStatus, paymentMethod, amountPaid, balanceDue, notes, includeTerms, terms, date, updateInventory } = req.body;

  if (!customerName || !items || items.length === 0) {
    return res.status(400).json({ error: 'customerName and items are required' });
  }

  // Generate sequential bill number
  const { count, error: countErr } = await supabase.from('bills').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id);
  if (countErr) return res.status(500).json({ error: countErr.message });
  
  const next = (count || 0) + 1;
  const billYear = date ? new Date(date).getFullYear() : new Date().getFullYear();
  const billNumber = `BILL-${billYear}-${String(next).padStart(4, '0')}`;

  let inventoryUpdated = false;
  
  // Deduct inventory stock if requested
  if (updateInventory) {
    // Note: A real transaction should be used in production via RPC
    for (const item of items) {
      if (item.inventoryId) {
        const { data: inv } = await supabase.from('inventory').select('qty').eq('user_id', req.user.id).eq('id', item.inventoryId).single();
        if (inv) {
          const newQty = Math.max(0, inv.qty - (Number(item.quantity) || 0));
          await supabase.from('inventory').update({ qty: newQty }).eq('user_id', req.user.id).eq('id', item.inventoryId);
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
    payment_method: paymentMethod || 'Cash',
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
  
  try {
    await NotificationService.create(req.user.id, NotificationService.templates.billCreated(inserted.bill_number, inserted.customer_name, inserted.grand_total));
    await ActivityService.log(req.user.id, ActivityService.templates.billCreated(inserted.bill_number, inserted.customer_name, inserted.grand_total));
  } catch (err) {
    console.error('Failed to create notification or activity:', err);
  }

  res.status(201).json(formatBill(inserted));
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

  res.json(formatBill(updated));
});

// PATCH /api/bills/:id/transport — update transport details
router.patch('/:id/transport', auth, async (req, res) => {
  const { transportDetails } = req.body;
  
  const { data: updated, error } = await supabase
    .from('bills')
    .update({ transport_details: transportDetails })
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .select()
    .single();
    
  if (error) return res.status(500).json({ error: error.message });
  res.json(formatBill(updated));
});

// PATCH /api/bills/:id/date — update bill date only
router.patch('/:id/date', auth, async (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'date is required' });

  const { data: updated, error } = await supabase
    .from('bills')
    .update({ date })
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(formatBill(updated));
});

// DELETE /api/bills/:id
router.delete('/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('bills').delete().eq('user_id', req.user.id).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Bill not found' });
  
  const deletedBill = data[0];
  
  // Revert inventory if it was previously updated
  if (deletedBill.inventory_updated && deletedBill.items) {
    for (const item of deletedBill.items) {
      if (item.inventoryId) {
        const { data: inv } = await supabase.from('inventory').select('qty').eq('user_id', req.user.id).eq('id', item.inventoryId).single();
        if (inv) {
          const newQty = inv.qty + (Number(item.quantity) || 0);
          await supabase.from('inventory').update({ qty: newQty }).eq('user_id', req.user.id).eq('id', item.inventoryId);
        }
      }
    }
  }
  
  res.json({ message: 'Deleted' });
});

// PUT /api/bills/:id — edit bill
router.put('/:id', auth, async (req, res) => {
  const { customerName, customerPhone, customerAddress, items, subtotal, discount, grandTotal, paymentStatus, paymentMethod, amountPaid, balanceDue, notes, includeTerms, terms, date, updateInventory } = req.body;

  if (!customerName || !items || items.length === 0) {
    return res.status(400).json({ error: 'customerName and items are required' });
  }

  // Fetch existing bill
  const { data: oldBill, error: fetchErr } = await supabase.from('bills').select('*').eq('user_id', req.user.id).eq('id', req.params.id).single();
  if (fetchErr || !oldBill) return res.status(404).json({ error: 'Bill not found' });

  // Revert old inventory
  if (oldBill.inventory_updated && oldBill.items) {
    for (const item of oldBill.items) {
      if (item.inventoryId) {
        const { data: inv } = await supabase.from('inventory').select('qty').eq('user_id', req.user.id).eq('id', item.inventoryId).single();
        if (inv) {
          const newQty = inv.qty + (Number(item.quantity) || 0);
          await supabase.from('inventory').update({ qty: newQty }).eq('user_id', req.user.id).eq('id', item.inventoryId);
        }
      }
    }
  }

  let inventoryUpdated = false;

  // Deduct new inventory
  if (updateInventory) {
    for (const item of items) {
      if (item.inventoryId) {
        const { data: inv } = await supabase.from('inventory').select('qty').eq('user_id', req.user.id).eq('id', item.inventoryId).single();
        if (inv) {
          const newQty = Math.max(0, inv.qty - (Number(item.quantity) || 0));
          await supabase.from('inventory').update({ qty: newQty }).eq('user_id', req.user.id).eq('id', item.inventoryId);
        }
      }
    }
    inventoryUpdated = true;
  }

  const updates = {
    customer_name: customerName,
    customer_phone: customerPhone || '',
    customer_address: customerAddress || '',
    items,
    subtotal: subtotal || 0,
    discount: discount || 0,
    grand_total: grandTotal || 0,
    payment_status: paymentStatus || 'Unpaid',
    payment_method: paymentMethod || 'Cash',
    amount_paid: amountPaid || null,
    balance_due: balanceDue || null,
    notes: notes || '',
    include_terms: includeTerms || false,
    terms: terms || '',
    date: date || new Date().toISOString().split('T')[0],
    inventory_updated: inventoryUpdated
  };

  const { data: updated, error } = await supabase.from('bills').update(updates).eq('user_id', req.user.id).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  
  res.json(formatBill(updated));
});

module.exports = router;

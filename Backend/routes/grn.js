const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');
const { NotificationService } = require('../services/notification.service');
const { ActivityService } = require('../services/activity.service');

const router = express.Router();

function parseDate(d) {
  if (!d) return new Date().toISOString().split('T')[0];
  const parts = d.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 2 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return d;
}

// GET /api/grn
router.get('/', auth, async (req, res) => {
  const { data: grn, error } = await supabase.from('grn').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const formatted = grn.map(g => ({
    id: g.id,
    supplier: g.supplier,
    date: g.date,
    items: g.items,
    itemCount: g.item_count,
    status: g.status,
    inventoryUpdated: g.inventory_updated,
    createdAt: g.created_at
  }));
  res.json(formatted);
});

// POST /api/grn — create GRN and update inventory
router.post('/', auth, async (req, res) => {
  const { supplier, date, items, updateInventory } = req.body;

  if (!supplier || !items || items.length === 0) {
    return res.status(400).json({ error: 'supplier and items are required' });
  }

  const grnId = `GRN-${uuidv4().split('-')[0].toUpperCase()}`;

  let inventoryUpdated = false;
  let status = 'Pending';
  const today = new Date().toISOString().split('T')[0];

  // Update inventory stock if requested
  if (updateInventory) {
    for (const item of items) {
      if (item.hsn || item.description) {
        let invMatch = null;

        // 1. Try case-insensitive match on name
        if (item.description) {
          const { data: nameMatches } = await supabase
            .from('inventory')
            .select('id, qty')
            .eq('user_id', req.user.id)
            .ilike('name', item.description);
          
          if (nameMatches && nameMatches.length > 0) {
            invMatch = nameMatches[0]; // take first match
          }
        }

        // 2. Fallback: Try exact match on HSN ONLY if no name is provided
        else if (item.hsn) {
          const { data: hsnMatches } = await supabase
            .from('inventory')
            .select('id, qty')
            .eq('user_id', req.user.id)
            .eq('hsn', item.hsn);

          if (hsnMatches && hsnMatches.length > 0) {
            invMatch = hsnMatches[0];
          }
        }

        if (invMatch) {
          // Update existing item - Only update qty and rate, do NOT affect other properties
          const newQty = (Number(invMatch.qty) || 0) + (Number(item.quantity) || 0);
          const newTotalQty = (Number(invMatch.total_qty) ?? Number(invMatch.qty) ?? 0) + (Number(item.quantity) || 0);
          const updates = { qty: newQty, total_qty: newTotalQty, last_restocked: parseDate(date) || today, restock_source: grnId };
          
          if (item.unit_price !== undefined && item.unit_price !== null && item.unit_price !== '') {
            updates.rate = Number(item.unit_price);
          }

          await supabase.from('inventory').update(updates).eq('user_id', req.user.id).eq('id', invMatch.id);
        } else {
          // Auto-create new inventory item from GRN
          await supabase.from('inventory').insert([{
            user_id: req.user.id,
            hsn: item.hsn || '',
            name: item.description || item.hsn || 'Unknown Item',
            category: item.category || 'General',
            qty: Number(item.quantity) || 0,
            total_qty: Number(item.quantity) || 0,
            unit: item.unit || 'Nos',
            rate: Number(item.unit_price) || 0,
            min: Number(item.min) || 0,
            max: Number(item.max) || 0,
            date_added: today,
            last_restocked: parseDate(date) || today,
            restock_source: grnId
          }]);
        }
      }
    }
    status = 'Processed';
    inventoryUpdated = true;
  }

  const grn = {
    id: grnId,
    user_id: req.user.id,
    supplier,
    date: parseDate(date),
    items,
    item_count: items.length,
    status,
    inventory_updated: inventoryUpdated
  };

  const { data: inserted, error } = await supabase.from('grn').insert([grn]).select().single();
  if (error) return res.status(500).json({ error: error.message });

  try {
    await NotificationService.create(req.user.id, NotificationService.templates.grnReceived(inserted.id, inserted.supplier, inserted.item_count));
  } catch (err) {
    console.error('Failed to create notification:', err);
  }

  inserted.itemCount = inserted.item_count;
  inserted.inventoryUpdated = inserted.inventory_updated;

  if (req.body.po_number && inserted.status === 'Processed') {
    const { data: po } = await supabase.from('purchase_orders').select('*').eq('user_id', req.user.id).eq('po_number', req.body.po_number).maybeSingle();
    if (po) {
      const grnTotalQty = items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
      const poTotalQty = po.items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
      const newStatus = grnTotalQty >= poTotalQty ? 'Fully Received' : 'Partially Received';
      
      const updates = { status: newStatus };
      if (newStatus === 'Fully Received' || newStatus === 'Partially Received') {
        updates.received_at = new Date().toISOString();
      }
      await supabase.from('purchase_orders').update(updates).eq('id', po.id);
      
      if (newStatus === 'Fully Received') {
        try {
          await NotificationService.create(req.user.id, NotificationService.templates.poDelivered(po.po_number, po.supplier_name));
        } catch (err) {}
      }
    }
  }

  res.status(201).json(inserted);
});

// PATCH /api/grn/:id/status
router.patch('/:id/status', auth, async (req, res) => {
  const { data: updated, error } = await supabase
    .from('grn')
    .update({ status: req.body.status })
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!updated) return res.status(404).json({ error: 'GRN not found' });

  if (req.body.status === 'Processed' || req.body.status === 'Approved') {
    try {
      await NotificationService.create(req.user.id, NotificationService.templates.grnReceived(updated.id, updated.supplier, updated.item_count));
      await ActivityService.log(req.user.id, ActivityService.templates.grnApproved(updated.id, updated.supplier));
    } catch (err) {
      console.error('Failed to create notification or activity:', err);
    }

    if (updated.po_number) {
      const { data: po } = await supabase.from('purchase_orders').select('*').eq('user_id', req.user.id).eq('po_number', updated.po_number).maybeSingle();
      if (po) {
        const grnTotalQty = updated.items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
        const poTotalQty = po.items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
        const newStatus = grnTotalQty >= poTotalQty ? 'Fully Received' : 'Partially Received';
        
        const poUpdates = { status: newStatus };
        if (newStatus === 'Fully Received' || newStatus === 'Partially Received') {
          poUpdates.received_at = new Date().toISOString();
        }
        await supabase.from('purchase_orders').update(poUpdates).eq('id', po.id);
        
        if (newStatus === 'Fully Received') {
          try {
            await NotificationService.create(req.user.id, NotificationService.templates.poDelivered(po.po_number, po.supplier_name));
          } catch (err) {}
        }
      }
    }
  }

  res.json(updated);
});

// DELETE /api/grn/:id
router.delete('/:id', auth, async (req, res) => {
  // First, fetch the GRN to see its items
  const { data: grn, error: fetchErr } = await supabase.from('grn').select('*').eq('user_id', req.user.id).eq('id', req.params.id).single();
  if (fetchErr) return res.status(500).json({ error: fetchErr.message });
  if (!grn) return res.status(404).json({ error: 'GRN not found' });

  // If inventory was updated by this GRN, we need to reverse it
  if (grn.inventory_updated && grn.items && Array.isArray(grn.items)) {
    for (const item of grn.items) {
      if (item.hsn || item.description) {
        let invMatch = null;
        
        if (item.description) {
          const { data: nameMatches } = await supabase.from('inventory').select('id, qty').eq('user_id', req.user.id).ilike('name', item.description);
          if (nameMatches && nameMatches.length > 0) invMatch = nameMatches[0];
        } else if (item.hsn) {
          const { data: hsnMatches } = await supabase.from('inventory').select('id, qty').eq('user_id', req.user.id).eq('hsn', item.hsn);
          if (hsnMatches && hsnMatches.length > 0) invMatch = hsnMatches[0];
        }

        if (invMatch) {
          const newQty = Math.max(0, (Number(invMatch.qty) || 0) - (Number(item.quantity) || 0));
          const newTotalQty = Math.max(0, (Number(invMatch.total_qty) ?? Number(invMatch.qty) ?? 0) - (Number(item.quantity) || 0));
          await supabase.from('inventory').update({ qty: newQty, total_qty: newTotalQty }).eq('user_id', req.user.id).eq('id', invMatch.id);
        }
      }
    }
  }

  // Delete the GRN record
  const { data, error } = await supabase.from('grn').delete().eq('user_id', req.user.id).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  
  res.json({ message: 'Deleted and inventory reversed' });
});

module.exports = router;

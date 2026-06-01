const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');

const router = express.Router();

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

  const { count, error: countErr } = await supabase.from('grn').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id);
  if (countErr) return res.status(500).json({ error: countErr.message });

  const next = (count || 0) + 1;
  const grnId = `GRN-${1000 + next}`;

  let inventoryUpdated = false;
  let status = 'Pending';

  // Update inventory stock if requested
  if (updateInventory) {
    for (const item of items) {
      if (item.sku) {
        const { data: inv } = await supabase.from('inventory').select('qty').eq('user_id', req.user.id).eq('sku', item.sku).single();
        if (inv) {
          const newQty = inv.qty + (Number(item.quantity) || 0);
          await supabase.from('inventory').update({ qty: newQty }).eq('user_id', req.user.id).eq('sku', item.sku);
        } else {
          // Auto-create new inventory item from GRN
          await supabase.from('inventory').insert([{
            user_id: req.user.id,
            sku: item.sku,
            name: item.description || item.sku,
            category: 'General',
            qty: Number(item.quantity) || 0,
            unit: item.unit || 'Nos',
            min: 0,
            max: 0,
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
    date: date || new Date().toISOString().split('T')[0],
    items,
    item_count: items.length,
    status,
    inventory_updated: inventoryUpdated
  };

  const { data: inserted, error } = await supabase.from('grn').insert([grn]).select().single();
  if (error) return res.status(500).json({ error: error.message });

  inserted.itemCount = inserted.item_count;
  inserted.inventoryUpdated = inserted.inventory_updated;
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
  res.json(updated);
});

// DELETE /api/grn/:id
router.delete('/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('grn').delete().eq('user_id', req.user.id).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
});

module.exports = router;

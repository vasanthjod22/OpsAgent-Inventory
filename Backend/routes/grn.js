const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');
const { NotificationService } = require('../services/notification.service');
const { ActivityService } = require('../services/activity.service');

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(d) {
  if (!d) return new Date().toISOString().split('T')[0];
  const parts = d.split(/[-/]/);
  if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return d;
}

/**
 * Weighted Average Cost formula.
 * Used whenever new stock arrives at a (possibly) different price.
 *
 *   new_avg = (existing_qty × existing_rate + incoming_qty × incoming_rate)
 *             ────────────────────────────────────────────────────────────
 *                              (existing_qty + incoming_qty)
 */
function calculateWeightedAverageCost(existingQty, existingRate, incomingQty, incomingRate) {
  const eQty  = Number(existingQty)  || 0;
  const eRate = Number(existingRate) || 0;
  const iQty  = Number(incomingQty)  || 0;
  const iRate = Number(incomingRate) || 0;

  if (eQty === 0) return iRate;   // no prior stock – new rate is the rate
  if (iQty === 0) return eRate;   // no incoming – unchanged

  const weighted = (eQty * eRate + iQty * iRate) / (eQty + iQty);
  return Math.round(weighted * 100) / 100;
}

/**
 * Write an audit row to stock_movements (best-effort – never throws).
 */
async function logStockMovement(payload) {
  try {
    await supabase.from('stock_movements').insert([payload]);
  } catch (err) {
    console.error('[GRN] logStockMovement failed:', err.message);
  }
}

// ─── GET /api/grn ─────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const { data: grn, error } = await supabase
    .from('grn')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

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

// ─── GET /api/grn/valuation ──────────────────────────────────────────────────
// Live total inventory value: SUM(qty × rate) – never uses a stored column
router.get('/valuation', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('inventory')
    .select('name, qty, rate, category')
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });

  const breakdown = data.map(i => ({
    name:     i.name,
    category: i.category,
    qty:      Number(i.qty)  || 0,
    rate:     Number(i.rate) || 0,
    value:    (Number(i.qty) || 0) * (Number(i.rate) || 0)
  }));
  const total = breakdown.reduce((sum, item) => sum + item.value, 0);
  res.json({ total, breakdown });
});

// ─── GET /api/grn/inventory/:id/valuation-breakdown ─────────────────────────
// Returns the full WAC calculation history for one inventory item
router.get('/inventory/:id/valuation-breakdown', auth, async (req, res) => {
  try {
    const { data: item, error: itemErr } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (itemErr || !item) return res.status(404).json({ error: 'Item not found' });

    const { data: movements } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('item_name', item.name)
      .eq('movement_type', 'GRN')
      .order('movement_date', { ascending: true });

    // Replay movements to show running weighted average
    let runningQty   = 0;
    let runningValue = 0;
    const history = (movements || []).map(m => {
      const qty   = Number(m.quantity_in) || 0;
      const rate  = Number(m.rate)        || 0;
      const value = qty * rate;
      runningQty   += qty;
      runningValue += value;
      const avgSoFar = runningQty > 0 ? Math.round((runningValue / runningQty) * 100) / 100 : rate;
      return {
        date:        m.movement_date,
        reference:   m.reference_no,
        qty_in:      qty,
        rate,
        value,
        running_qty: runningQty,
        running_avg: avgSoFar,
        notes:       m.notes
      };
    });

    const currentQty  = Number(item.qty)  || 0;
    const currentRate = Number(item.rate) || 0;

    res.json({
      item: {
        id:          item.id,
        name:        item.name,
        sku:         item.sku || item.hsn || '',
        qty:         currentQty,
        avg_rate:    currentRate,
        total_value: currentQty * currentRate
      },
      purchase_history: history,
      calculation: {
        formula:     'qty × weighted_avg_cost',
        current_qty: currentQty,
        avg_cost:    currentRate,
        total_value: currentQty * currentRate
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/grn ───────────────────────────────────────────────────────────
// Create GRN. If updateInventory=true, apply WEIGHTED AVERAGE COST to each item.
router.post('/', auth, async (req, res) => {
  let { supplier, date, items, updateInventory } = req.body;

  // Normalize specific supplier typos
  if (supplier) {
    const up = supplier.toUpperCase();
    if (up.includes('STAYBR')) {
      supplier = 'STAYBRIIT TRADING CORPORATION';
    } else if (up.includes('JHONON') || up.includes('JHONSSON') || up.includes('JOHNSON')) {
      supplier = up.includes('PIPE') ? 'JOHNSON PIPES' : 'JOHNSON ENTERPRISES';
    }
    if (up.includes('KUMAR STEEL')) {
      supplier = 'KUMAR STEELS';
    }
  }

  if (!supplier || !items || items.length === 0) {
    return res.status(400).json({ error: 'supplier and items are required' });
  }

  const grnId   = `GRN-${uuidv4().split('-')[0].toUpperCase()}`;
  const today   = parseDate(date) || new Date().toISOString().split('T')[0];
  const updateLog = [];

  let inventoryUpdated = false;
  let status = 'Pending';

  if (updateInventory) {
    for (const item of items) {
      if (!item.hsn && !item.description) continue;

      let invMatch = null;

      // 1. Name match (case-insensitive)
      if (item.description) {
        const { data: nameMatches } = await supabase
          .from('inventory')
          .select('*')
          .eq('user_id', req.user.id)
          .ilike('name', item.description);
        if (nameMatches && nameMatches.length > 0) invMatch = nameMatches[0];
      }

      // 2. Fallback: HSN match - REMOVED
      // Do not match purely by HSN because many different items can share the same HSN code.

      if (invMatch) {
        // ── WEIGHTED AVERAGE COST ─────────────────────────────────────────
        const existingQty  = Number(invMatch.qty)  || 0;
        const existingRate = Number(invMatch.rate) || 0;   // current avg cost
        const incomingQty  = Number(item.quantity)  || 0;
        let incomingRate = Number(item.unit_price) || 0;
        const totalAmount = Number(item.total_amount) || 0;

        // Strip 18% GST for suppliers whose invoice total_amount is GST-inclusive (Net Amt column)
        if (supplier === 'JOHNSON ENTERPRISES' || supplier === 'JOHNSON PIPES' || supplier === 'STAYBRIIT TRADING CORPORATION') {
          if (totalAmount > 0 && incomingQty > 0) {
            const amountExGst = totalAmount / 1.18;
            incomingRate = amountExGst / incomingQty;
          } else {
            incomingRate = incomingRate / 1.18;
          }
        } else if (supplier === "KHUMAR'S CERAMICS" || supplier === 'M/S.SHANTHINI POLYMERS') {
          if (totalAmount > 0 && incomingQty > 0) {
            const amountWithGst = totalAmount * 1.18;
            incomingRate = amountWithGst / incomingQty;
          } else {
            incomingRate = incomingRate * 1.18;
          }
        }

        const newAvgRate  = calculateWeightedAverageCost(existingQty, existingRate, incomingQty, incomingRate);
        const newQty      = existingQty + incomingQty;
        const newTotalQty = (Number(invMatch.total_qty) ?? existingQty) + incomingQty;

        const updates = {
          qty:            newQty,
          total_qty:      newTotalQty,
          rate:           newAvgRate,           // ← weighted average, not raw price
          last_restocked: today,
          restock_source: grnId,
          stock_in:       (Number(invMatch.stock_in) || 0) + incomingQty
        };
        if (supplier) updates.supplier_name = supplier;

        await supabase
          .from('inventory')
          .update(updates)
          .eq('user_id', req.user.id)
          .eq('id', invMatch.id);

        updateLog.push({
          item:     invMatch.name,
          before:   { qty: existingQty, rate: existingRate, value: existingQty * existingRate },
          incoming: { qty: incomingQty, rate: incomingRate, value: incomingQty * incomingRate },
          after:    { qty: newQty,      rate: newAvgRate,   value: newQty * newAvgRate }
        });

        await logStockMovement({
          user_id:       req.user.id,
          item_sku:      invMatch.sku  || invMatch.hsn || '',
          item_name:     invMatch.name,
          movement_type: 'GRN',
          quantity_in:   incomingQty,
          quantity_out:  0,
          balance:       newQty,
          rate:          incomingRate,
          value:         incomingQty * incomingRate,
          reference_no:  grnId,
          notes:         `WAC: ₹${existingRate} → ₹${newAvgRate} (GRN price: ₹${incomingRate})`,
          movement_date: today
        });

      } else {
        // ── NEW ITEM – auto-create from GRN ─────────────────────────────
        const incomingQty  = Number(item.quantity)  || 0;
        let incomingRate = Number(item.unit_price) || 0;
        const totalAmount = Number(item.total_amount) || 0;

        // Strip 18% GST for suppliers whose invoice total_amount is GST-inclusive (Net Amt column)
        if (supplier === 'JOHNSON ENTERPRISES' || supplier === 'JOHNSON PIPES' || supplier === 'STAYBRIIT TRADING CORPORATION') {
          if (totalAmount > 0 && incomingQty > 0) {
            const amountExGst = totalAmount / 1.18;
            incomingRate = amountExGst / incomingQty;
          } else {
            incomingRate = incomingRate / 1.18;
          }
        } else if (supplier === "KHUMAR'S CERAMICS" || supplier === 'M/S.SHANTHINI POLYMERS') {
          if (totalAmount > 0 && incomingQty > 0) {
            const amountWithGst = totalAmount * 1.18;
            incomingRate = amountWithGst / incomingQty;
          } else {
            incomingRate = incomingRate * 1.18;
          }
        }

        let defaultCat = 'General';
        let defaultMin = 0;
        let defaultMax = 0;
        let defaultGst = 0;
        let defaultCgst = 0;
        let defaultSgst = 0;

        if (supplier === 'STAYBRIIT TRADING CORPORATION') {
          defaultCat = 'Pipe Fittings';
          defaultMin = 5;
          defaultMax = 75;
          defaultGst = 18;
          defaultCgst = 9;
          defaultSgst = 9;
        }

        if (supplier === 'JOHNSON ENTERPRISES' || supplier === 'JOHNSON PIPES') {
          defaultGst = 18;
          defaultCgst = 9;
          defaultSgst = 9;
        }

        const { data: created } = await supabase.from('inventory').insert([{
          user_id:        req.user.id,
          hsn:            item.hsn       || '',
          name:           item.description || item.hsn || 'Unknown Item',
          category:       item.category  || defaultCat,
          qty:            incomingQty,
          total_qty:      incomingQty,
          opening_stock:  incomingQty,
          stock_in:       incomingQty,
          unit:           item.unit      || 'Nos',
          rate:           incomingRate,
          min:            Number(item.min) || defaultMin,
          max:            Number(item.max) || defaultMax,
          gst:            defaultGst,
          cgst_percent:   defaultCgst,
          sgst_percent:   defaultSgst,
          date_added:     today,
          last_restocked: today,
          restock_source: grnId,
          supplier_name:  supplier || null
        }]).select().maybeSingle();

        updateLog.push({ item: item.description, isNew: true, qty: incomingQty, rate: incomingRate });

        if (created) {
          await logStockMovement({
            user_id:       req.user.id,
            item_sku:      created.sku   || created.hsn || '',
            item_name:     created.name,
            movement_type: 'GRN',
            quantity_in:   incomingQty,
            quantity_out:  0,
            balance:       incomingQty,
            rate:          incomingRate,
            value:         incomingQty * incomingRate,
            reference_no:  grnId,
            notes:         'New item created via GRN',
            movement_date: today
          });
        }
      }
    }

    status = 'Processed';
    inventoryUpdated = true;
  }

  const grn = {
    id:                grnId,
    user_id:           req.user.id,
    supplier,
    date:              today,
    items,
    item_count:        items.length,
    status,
    inventory_updated: inventoryUpdated
  };

  const { data: inserted, error } = await supabase.from('grn').insert([grn]).select().single();
  if (error) return res.status(500).json({ error: error.message });

  try {
    await NotificationService.create(
      req.user.id,
      NotificationService.templates.grnReceived(inserted.id, inserted.supplier, inserted.item_count)
    );
  } catch (err) {
    console.error('Notification error:', err.message);
  }

  // Link to PO if provided
  if (req.body.po_number && inserted.status === 'Processed') {
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('po_number', req.body.po_number)
      .maybeSingle();

    if (po) {
      const grnTotalQty = items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
      const poTotalQty  = po.items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
      const newStatus   = grnTotalQty >= poTotalQty ? 'Fully Received' : 'Partially Received';
      const poUpdates   = { status: newStatus, received_at: new Date().toISOString() };
      await supabase.from('purchase_orders').update(poUpdates).eq('id', po.id);

      if (newStatus === 'Fully Received') {
        try {
          await NotificationService.create(
            req.user.id,
            NotificationService.templates.poDelivered(po.po_number, po.supplier_name)
          );
        } catch (_) {}
      }
    }
  }

  inserted.itemCount        = inserted.item_count;
  inserted.inventoryUpdated = inserted.inventory_updated;
  inserted.updateLog        = updateLog;

  res.status(201).json(inserted);
});

// ─── POST /api/grn/reconcile-valuations ─────────────────────────────────────
// One-shot tool: replay stock_movements to correct historical WAC errors
router.post('/reconcile-valuations', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: items, error: itemsErr } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId);

    if (itemsErr) throw itemsErr;

    const results = [];

    for (const item of items) {
      const { data: movements } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('user_id', userId)
        .eq('item_name', item.name)
        .eq('movement_type', 'GRN')
        .order('movement_date', { ascending: true });

      if (!movements || movements.length === 0) {
        results.push({ item: item.name, status: 'skipped — no GRN history' });
        continue;
      }

      // Replay all GRN movements to derive true weighted average
      let runningQty   = 0;
      let runningValue = 0;
      for (const m of movements) {
        const qty  = Number(m.quantity_in) || 0;
        const rate = Number(m.rate)        || 0;
        runningQty   += qty;
        runningValue += qty * rate;
      }

      const correctedAvgRate = runningQty > 0
        ? Math.round((runningValue / runningQty) * 100) / 100
        : Number(item.rate) || 0;

      const oldRate = Number(item.rate) || 0;
      const changed = Math.abs(oldRate - correctedAvgRate) > 0.01;

      if (changed) {
        await supabase
          .from('inventory')
          .update({ rate: correctedAvgRate })
          .eq('id', item.id)
          .eq('user_id', userId);
      }

      results.push({
        item:           item.name,
        old_rate:       oldRate,
        corrected_rate: correctedAvgRate,
        current_qty:    item.qty,
        old_value:      (item.qty * oldRate).toFixed(2),
        new_value:      (item.qty * correctedAvgRate).toFixed(2),
        changed
      });
    }

    const changedCount = results.filter(r => r.changed).length;
    res.json({
      success:     true,
      message:     `Reconciliation complete. ${changedCount} item(s) corrected.`,
      total_items: results.length,
      corrected:   changedCount,
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/grn/:id/status ───────────────────────────────────────────────
// When status changes to Processed/Approved AND inventory has NOT been updated yet,
// apply Weighted Average Cost to each GRN item — same logic as the POST route.
router.patch('/:id/status', auth, async (req, res) => {
  const newStatus = req.body.status;

  const { data: grn, error: fetchErr } = await supabase
    .from('grn')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .single();

  if (fetchErr) return res.status(500).json({ error: fetchErr.message });
  if (!grn) return res.status(404).json({ error: 'GRN not found' });

  const isApproving = (newStatus === 'Processed' || newStatus === 'Approved');
  const needsInventoryUpdate = isApproving && !grn.inventory_updated;

  const updateLog = [];

  // ── Apply WAC to inventory when approving a pending GRN ───────────────────
  if (needsInventoryUpdate && Array.isArray(grn.items)) {
    const today = grn.date || new Date().toISOString().split('T')[0];

    for (const item of grn.items) {
      if (!item.hsn && !item.description) continue;

      let invMatch = null;

      // 1. Name match (case-insensitive)
      if (item.description) {
        const { data: nameMatches } = await supabase
          .from('inventory')
          .select('*')
          .eq('user_id', req.user.id)
          .ilike('name', item.description);
        if (nameMatches && nameMatches.length > 0) invMatch = nameMatches[0];
      }

      // 2. Fallback: HSN match - REMOVED
      // Do not match purely by HSN because many different items can share the same HSN code.

      if (invMatch) {
        // ── WEIGHTED AVERAGE COST ──────────────────────────────────────────
        const existingQty  = Number(invMatch.qty)        || 0;
        const existingRate = Number(invMatch.rate)       || 0;
        const incomingQty  = Number(item.quantity)       || 0;
        let incomingRate = Number(item.unit_price)     || 0;
        const totalAmount = Number(item.total_amount) || 0;

        if (grn.supplier === 'JOHNSON ENTERPRISES' || grn.supplier === 'JOHNSON PIPES') {
          if (totalAmount > 0 && incomingQty > 0) {
            const amountExGst = totalAmount / 1.18;
            incomingRate = amountExGst / incomingQty;
          } else {
            incomingRate = incomingRate / 1.18;
          }
        } else if (grn.supplier === "KHUMAR'S CERAMICS" || grn.supplier === 'M/S.SHANTHINI POLYMERS') {
          if (totalAmount > 0 && incomingQty > 0) {
            const amountWithGst = totalAmount * 1.18;
            incomingRate = amountWithGst / incomingQty;
          } else {
            incomingRate = incomingRate * 1.18;
          }
        }

        const newAvgRate  = calculateWeightedAverageCost(existingQty, existingRate, incomingQty, incomingRate);
        const newQty      = existingQty + incomingQty;
        const newTotalQty = (Number(invMatch.total_qty) ?? existingQty) + incomingQty;

        const updates = {
          qty:            newQty,
          total_qty:      newTotalQty,
          rate:           newAvgRate,           // ← weighted average, not raw price
          last_restocked: today,
          restock_source: grn.id,
          stock_in:       (Number(invMatch.stock_in) || 0) + incomingQty
        };
        if (grn.supplier) updates.supplier_name = grn.supplier;

        await supabase
          .from('inventory')
          .update(updates)
          .eq('user_id', req.user.id)
          .eq('id', invMatch.id);

        updateLog.push({
          item:     invMatch.name,
          before:   { qty: existingQty,  rate: existingRate,  value: existingQty * existingRate },
          incoming: { qty: incomingQty,  rate: incomingRate,  value: incomingQty * incomingRate },
          after:    { qty: newQty,       rate: newAvgRate,    value: newQty * newAvgRate }
        });

        await logStockMovement({
          user_id:       req.user.id,
          item_sku:      invMatch.sku   || invMatch.hsn || '',
          item_name:     invMatch.name,
          movement_type: 'GRN',
          quantity_in:   incomingQty,
          quantity_out:  0,
          balance:       newQty,
          rate:          incomingRate,
          value:         incomingQty * incomingRate,
          reference_no:  grn.id,
          notes:         `WAC: ₹${existingRate} → ₹${newAvgRate} (GRN price: ₹${incomingRate}) [approved]`,
          movement_date: today
        });

      } else {
        // ── NEW ITEM – auto-create from GRN approval ───────────────────────
        const incomingQty  = Number(item.quantity)   || 0;
        let incomingRate = Number(item.unit_price)  || 0;
        const totalAmount = Number(item.total_amount) || 0;
        const today2       = grn.date || new Date().toISOString().split('T')[0];

        if (grn.supplier === 'JOHNSON ENTERPRISES' || grn.supplier === 'JOHNSON PIPES') {
          if (totalAmount > 0 && incomingQty > 0) {
            const amountExGst = totalAmount / 1.18;
            incomingRate = amountExGst / incomingQty;
          } else {
            incomingRate = incomingRate / 1.18;
          }
        } else if (grn.supplier === "KHUMAR'S CERAMICS" || grn.supplier === 'M/S.SHANTHINI POLYMERS') {
          if (totalAmount > 0 && incomingQty > 0) {
            const amountWithGst = totalAmount * 1.18;
            incomingRate = amountWithGst / incomingQty;
          } else {
            incomingRate = incomingRate * 1.18;
          }
        }

        let defaultCat = 'General';
        let defaultMin = 0;
        let defaultMax = 0;
        let defaultGst = 0;
        let defaultCgst = 0;
        let defaultSgst = 0;

        if (grn.supplier === 'STAYBRIIT TRADING CORPORATION') {
          defaultCat = 'Pipe Fittings';
          defaultMin = 5;
          defaultMax = 75;
          defaultGst = 18;
          defaultCgst = 9;
          defaultSgst = 9;
        }

        const { data: created } = await supabase.from('inventory').insert([{
          user_id:        req.user.id,
          hsn:            item.hsn         || '',
          name:           item.description || item.hsn || 'Unknown Item',
          category:       item.category    || defaultCat,
          qty:            incomingQty,
          total_qty:      incomingQty,
          opening_stock:  incomingQty,
          stock_in:       incomingQty,
          unit:           item.unit        || 'Nos',
          rate:           incomingRate,
          min:            Number(item.min) || defaultMin,
          max:            Number(item.max) || defaultMax,
          gst:            defaultGst,
          cgst_percent:   defaultCgst,
          sgst_percent:   defaultSgst,
          date_added:     today2,
          last_restocked: today2,
          restock_source: grn.id,
          supplier_name:  grn.supplier || null
        }]).select().maybeSingle();

        updateLog.push({ item: item.description, isNew: true, qty: incomingQty, rate: incomingRate });

        if (created) {
          await logStockMovement({
            user_id:       req.user.id,
            item_sku:      created.sku   || created.hsn || '',
            item_name:     created.name,
            movement_type: 'GRN',
            quantity_in:   incomingQty,
            quantity_out:  0,
            balance:       incomingQty,
            rate:          incomingRate,
            value:         incomingQty * incomingRate,
            reference_no:  grn.id,
            notes:         'New item created via GRN approval',
            movement_date: grn.date || new Date().toISOString().split('T')[0]
          });
        }
      }
    }
  }

  // ── Update GRN status (and mark inventory_updated if we just applied WAC) ──
  const grnUpdatePayload = { status: newStatus };
  if (needsInventoryUpdate) grnUpdatePayload.inventory_updated = true;

  const { data: updated, error: updateErr } = await supabase
    .from('grn')
    .update(grnUpdatePayload)
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .select()
    .single();

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  if (isApproving) {
    try {
      await NotificationService.create(
        req.user.id,
        NotificationService.templates.grnReceived(updated.id, updated.supplier, updated.item_count)
      );
      await ActivityService.log(
        req.user.id,
        ActivityService.templates.grnApproved(updated.id, updated.supplier)
      );
    } catch (err) {
      console.error('Notification/Activity error:', err.message);
    }

    if (updated.po_number) {
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('po_number', updated.po_number)
        .maybeSingle();

      if (po) {
        const grnTotalQty = updated.items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
        const poTotalQty  = po.items.reduce((acc, i)  => acc + (Number(i.quantity) || 0), 0);
        const newPoStatus = grnTotalQty >= poTotalQty ? 'Fully Received' : 'Partially Received';
        await supabase.from('purchase_orders').update({
          status:      newPoStatus,
          received_at: new Date().toISOString()
        }).eq('id', po.id);

        if (newPoStatus === 'Fully Received') {
          try {
            await NotificationService.create(
              req.user.id,
              NotificationService.templates.poDelivered(po.po_number, po.supplier_name)
            );
          } catch (_) {}
        }
      }
    }
  }

  updated.itemCount        = updated.item_count;
  updated.inventoryUpdated = updated.inventory_updated;
  updated.updateLog        = updateLog;

  res.json(updated);
});

// ─── DELETE /api/grn/:id ─────────────────────────────────────────────────────
// Reverses quantity only (WAC cannot be cleanly reversed without full history replay)
router.delete('/:id', auth, async (req, res) => {
  const { data: grn, error: fetchErr } = await supabase
    .from('grn')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .single();

  if (fetchErr) return res.status(500).json({ error: fetchErr.message });
  if (!grn) return res.status(404).json({ error: 'GRN not found' });

  if (grn.inventory_updated && Array.isArray(grn.items)) {
    for (const item of grn.items) {
      if (!item.hsn && !item.description) continue;
      let invMatch = null;

      if (item.description) {
        const { data: nm } = await supabase.from('inventory').select('id, qty, total_qty').eq('user_id', req.user.id).ilike('name', item.description);
        if (nm && nm.length > 0) invMatch = nm[0];
      }

      if (invMatch) {
        // User requested: deleting a GRN should completely delete the items from the table
        await supabase.from('inventory').delete().eq('user_id', req.user.id).eq('id', invMatch.id);
      }
    }
  }

  const { error } = await supabase.from('grn').delete().eq('user_id', req.user.id).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ message: 'GRN deleted and quantities reversed' });
});

module.exports = router;

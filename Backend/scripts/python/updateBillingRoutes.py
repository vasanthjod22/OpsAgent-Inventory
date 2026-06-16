import sys

filepath = "d:/Inventory/Backend/routes/billing.js"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace the DELETE endpoint
delete_old = """// DELETE /api/bills/:id
router.delete('/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('bills').delete().eq('user_id', req.user.id).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Bill not found' });
  res.json({ message: 'Deleted' });
});"""

delete_new = """// DELETE /api/bills/:id
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
  const { customerName, customerPhone, customerAddress, items, subtotal, discount, grandTotal, paymentStatus, amountPaid, balanceDue, notes, includeTerms, terms, date, updateInventory } = req.body;

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
  
  updated.billNumber = updated.bill_number;
  updated.customerName = updated.customer_name;
  
  res.json(updated);
});"""

if delete_old in content:
    content = content.replace(delete_old, delete_new)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Backend routes updated successfully.")
else:
    print("Error: Could not find delete block to replace")
    sys.exit(1)

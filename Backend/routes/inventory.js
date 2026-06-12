const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');
const { NotificationService } = require('../services/notification.service');

const router = express.Router();

// GET /api/inventory/categories
router.get('/categories', auth, async (req, res) => {
  try {
    const { data: catData, error: catErr } = await supabase
      .from('categories')
      .select('name')
      .eq('user_id', req.user.id)

    if (catErr && catErr.code !== '42P01') throw catErr // Ignore if table doesn't exist yet

    const { data: invData, error: invErr } = await supabase
      .from('inventory')
      .select('category')
      .eq('user_id', req.user.id)
      .not('category', 'is', null)

    if (invErr) throw invErr

    const cats = [...new Set([
      ...(catData || []).map(c => c.name),
      ...invData.map(item => item.category).filter(Boolean)
    ])].sort()

    res.json({ categories: cats })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/inventory/categories
router.post('/categories', auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    
    const { data, error } = await supabase
      .from('categories')
      .insert([{ user_id: req.user.id, name: name.trim() }])
      .select()
      .single();

    if (error && error.code !== '23505') throw error; // Ignore unique constraint violation

    res.status(201).json(data || { name: name.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/inventory/units
router.get('/units', auth, async (req, res) => {
  try {
    const { data: unitData, error: unitErr } = await supabase
      .from('units')
      .select('name')
      .eq('user_id', req.user.id)

    if (unitErr && unitErr.code !== '42P01') throw unitErr // Ignore if table doesn't exist yet

    const { data: invData, error: invErr } = await supabase
      .from('inventory')
      .select('unit')
      .eq('user_id', req.user.id)
      .not('unit', 'is', null)

    if (invErr) throw invErr

    const baseUnits = ['Nos', 'Kg', 'Ltrs', 'Set', 'Metre', 'Sqft']
    const units = [...new Set([
      ...baseUnits,
      ...(unitData || []).map(u => u.name),
      ...invData.map(item => item.unit).filter(Boolean)
    ])].sort()

    res.json({ units })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/inventory/units
router.post('/units', auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    
    const { data, error } = await supabase
      .from('units')
      .insert([{ user_id: req.user.id, name: name.trim() }])
      .select()
      .single();

    if (error && error.code !== '23505') throw error;

    res.status(201).json(data || { name: name.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/inventory/stats
router.get('/stats', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('qty, min, max, rate, gst')
      .eq('user_id', req.user.id)

    if (error) throw error

    const stats = {
      totalItems: data.length,
      lowStock: data.filter(i => i.qty <= i.min && i.qty > 0).length,
      outOfStock: data.filter(i => i.qty === 0).length,
      overstock: data.filter(i => i.qty > i.max).length,
      totalValue: data.reduce((sum, i) => sum + (i.qty * (i.rate || 0) * (1 + (i.gst || 0) / 100)), 0)
    }

    res.json(stats)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/inventory — list paginated items
router.get('/', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      category = '',
      status = '',
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query

    const offset = (parseInt(page) - 1) * parseInt(limit)

    let query = supabase
      .from('inventory')
      .select('*')
      .eq('user_id', req.user.id)

    if (search && search.trim()) {
      query = query.or(`name.ilike.%${search}%,hsn.ilike.%${search}%,category.ilike.%${search}%`)
    }

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if (status === 'out') {
      query = query.eq('qty', 0)
    }

    const sortColumn = {
      'name': 'name',
      'qty_asc': 'qty',
      'qty_desc': 'qty',
      'category': 'category',
      'created': 'created_at',
      'date_added_desc': 'date_added',
      'date_added_asc': 'date_added',
      'last_restocked_desc': 'last_restocked',
      'not_restocked': 'last_restocked'
    }[sortBy] || 'name'

    const isDesc = sortBy === 'qty_desc' || sortBy === 'date_added_desc' || sortBy === 'last_restocked_desc' || sortOrder === 'desc';
    const ascending = !isDesc;
    const nullsFirst = sortBy === 'not_restocked';
    query = query.order(sortColumn, { ascending, nullsFirst })

    let { data, error } = await query
    if (error) throw error

    if (search && search.trim()) {
      const lowerSearch = search.toLowerCase()
      data.sort((a, b) => {
        const aName = (a.name || '').toLowerCase()
        const bName = (b.name || '').toLowerCase()
        const aHsn = (a.hsn || '').toLowerCase()
        const bHsn = (b.hsn || '').toLowerCase()

        const aStarts = aName.startsWith(lowerSearch) || aHsn.startsWith(lowerSearch)
        const bStarts = bName.startsWith(lowerSearch) || bHsn.startsWith(lowerSearch)

        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
        return 0
      })
    }

    // Apply column-to-column status filters in memory
    if (status === 'low') {
      data = data.filter(i => i.qty <= i.min && i.qty > 0)
    } else if (status === 'ok') {
      data = data.filter(i => i.qty > i.min && i.qty <= i.max)
    } else if (status === 'overstock') {
      data = data.filter(i => i.qty > i.max)
    }

    const totalItems = data.length
    const totalPages = search ? 1 : Math.ceil(totalItems / parseInt(limit))

    let items = data
    if (!search || !search.trim()) {
      items = items.slice(offset, offset + parseInt(limit))
    }

    res.json({
      items,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
});

// POST /api/inventory — add a new item
router.post('/', auth, async (req, res) => {
  const { hsn, name, category, qty, unit, min, max } = req.body;
  if (!hsn || !name || !category || qty === undefined || !unit) {
    return res.status(400).json({ error: 'hsn, name, category, qty and unit are required' });
  }

  const today = new Date().toISOString().split('T')[0];
  const item = {
    user_id: req.user.id, hsn, name, category,
    qty: Number(qty), unit,
    min: Number(min) || 0, max: Number(max) || 0,
    rate: Number(req.body.rate) || 0,
    gst: Number(req.body.gst) || 0,
    total_qty: req.body.total_qty !== undefined ? Number(req.body.total_qty) : Number(qty),
    cost_price: Number(req.body.cost_price) || 0,
    date_added: req.body.date_added || today,
    restock_source: req.body.restock_source || 'manual'
  };
  const { data: inserted, error } = await supabase.from('inventory').insert([item]).select().single();

  if (error) return res.status(500).json({ error: error.message });
  
  await supabase.from('categories').insert([{ user_id: req.user.id, name: category }]).catch(() => {});
  await supabase.from('units').insert([{ user_id: req.user.id, name: unit }]).catch(() => {});
  
  res.status(201).json(inserted);
});

// PUT /api/inventory/:id — update an item
router.put('/:id', auth, async (req, res) => {
  const { data: updated, error } = await supabase
    .from('inventory')
    .update(req.body)
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!updated) return res.status(404).json({ error: 'Item not found' });
  
  if (updated.qty <= updated.min) {
    try {
      await NotificationService.create(
        req.user.id,
        updated.qty === 0
          ? NotificationService.templates.criticalStock(updated.name, updated.qty, updated.unit)
          : NotificationService.templates.lowStock(updated.name, updated.qty, updated.min, updated.unit)
      );
    } catch (err) { console.error('Failed to create notification:', err); }
  }

  if (req.body.category) {
    await supabase.from('categories').insert([{ user_id: req.user.id, name: req.body.category }]).catch(() => {});
  }
  if (req.body.unit) {
    await supabase.from('units').insert([{ user_id: req.user.id, name: req.body.unit }]).catch(() => {});
  }

  res.json(updated);
});

// PATCH /api/inventory/:id/stock — increment / decrement qty
router.patch('/:id/stock', auth, async (req, res) => {
  const { delta } = req.body; // positive = add, negative = deduct
  const { data: item, error: fetchErr } = await supabase.from('inventory').select('*').eq('user_id', req.user.id).eq('id', req.params.id).single();
  if (fetchErr || !item) return res.status(404).json({ error: 'Item not found' });

  const newQty = Math.max(0, item.qty + Number(delta));
  let newTotalQty = item.total_qty ?? item.qty;
  if (Number(delta) > 0) {
    newTotalQty += Number(delta);
  }

  const { data: updated, error: updateErr } = await supabase
    .from('inventory')
    .update({ qty: newQty, total_qty: newTotalQty })
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .select()
    .single();

  if (updateErr) return res.status(500).json({ error: updateErr.message });
    
  if (newQty <= updated.min) {
    try {
      await NotificationService.create(
        req.user.id,
        newQty === 0
          ? NotificationService.templates.criticalStock(updated.name, newQty, updated.unit)
          : NotificationService.templates.lowStock(updated.name, newQty, updated.min, updated.unit)
      );
    } catch (err) { console.error('Failed to create notification:', err); }
  }

  res.json(updated);
});

// DELETE /api/inventory/:id
router.delete('/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('inventory').delete().eq('user_id', req.user.id).eq('id', req.params.id).select();
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Item not found' });
  res.json({ message: 'Deleted' });
});

// POST /api/inventory/import — bulk import CSV rows
router.post('/import', auth, async (req, res) => {
  const { items } = req.body; // array of inventory objects
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }

  const added = [];
  const skipped = [];
  const toInsert = [];

  items.forEach(item => {
    if (!item.hsn) {
      skipped.push('(no hsn)');
    } else {
      const newItem = { user_id: req.user.id, hsn: item.hsn, name: item.name || '', category: item.category || 'General', qty: Number(item.qty) || 0, unit: item.unit || 'Nos', min: Number(item.min) || 0, max: Number(item.max) || 0, rate: Number(item.rate) || 0, gst: Number(item.gst) || 0, total_qty: item.total_qty !== undefined ? Number(item.total_qty) : Number(item.qty), cost_price: Number(item.cost_price) || 0 };
      toInsert.push(newItem);
      added.push(newItem);
    }
  });

  if (toInsert.length > 0) {
    const { error } = await supabase.from('inventory').insert(toInsert);
    if (error) return res.status(500).json({ error: error.message });

    const newCats = [...new Set(toInsert.map(i => i.category))].map(c => ({ user_id: req.user.id, name: c }));
    await supabase.from('categories').insert(newCats);
  }

  res.json({ added: added.length, skipped: skipped.length, skippedSkus: skipped });
});

module.exports = router;

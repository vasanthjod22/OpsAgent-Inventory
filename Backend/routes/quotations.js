const express = require('express');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');
const { ActivityService } = require('../services/activity.service');

const router = express.Router();

// Apply auth middleware to all routes in this router
router.use(auth);

// ─────────────────────────────────────────
// HELPER: Generate document number
// ─────────────────────────────────────────
const generateDocNumber = async (userId, tableName, prefix, startKey) => {
  const year = new Date().getFullYear();

  // Get start number from company settings
  const { data: company } = await supabase
    .from('company')
    .select(startKey)
    .eq('user_id', userId)
    .maybeSingle();

  const startNumber = company?.[startKey] || 1001;

  // Count existing docs this year
  const { count } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', `${year}-01-01T00:00:00`);

  const nextNumber = startNumber + (count || 0);
  return `${prefix}-${year}-${nextNumber}`;
};

// ─────────────────────────────────────────
// BREAKDOWN QUOTATIONS
// ─────────────────────────────────────────

// GET all breakdown quotations
router.get('/breakdown', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('breakdown_quotations')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create breakdown quotation
router.post('/breakdown', async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      project_name,
      validity_date,
      items,
      subtotal,
      discount,
      grand_total,
      include_terms,
      terms,
      notes,
      status
    } = req.body;

    // Validate required fields
    if (!customer_name) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    // Generate QT number
    const qt_number = await generateDocNumber(
      req.user.id,
      'breakdown_quotations',
      'QT',
      'qt_start_number'
    );

    // Save to database
    const { data, error } = await supabase
      .from('breakdown_quotations')
      .insert([{
        user_id: req.user.id,
        qt_number,
        customer_name,
        customer_phone: customer_phone || '',
        customer_email: customer_email || '',
        customer_address: customer_address || '',
        project_name: project_name || '',
        validity_date: validity_date || null,
        items: items || [],
        subtotal: subtotal || 0,
        discount: discount || 0,
        grand_total: grand_total || 0,
        include_terms: include_terms || false,
        terms: terms || '',
        notes: notes || '',
        status: status || 'Draft'
      }])
      .select()
      .single();

    if (error) throw error;
    await ActivityService.log(req.user.id, ActivityService.templates.quotationCreated(qt_number, customer_name));

    res.status(201).json({ 
      success: true, 
      data,
      message: `Quotation ${qt_number} saved!`
    });
  } catch (err) {
    console.error('Create QT error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update breakdown quotation
router.put('/breakdown/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('breakdown_quotations')
      .update({
        ...req.body,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update status only
router.patch('/breakdown/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const { data, error } = await supabase
      .from('breakdown_quotations')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE breakdown quotation
router.delete('/breakdown/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('breakdown_quotations')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true, message: 'Quotation deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// FINALIZED QUOTATIONS
// ─────────────────────────────────────────

// GET all finalized quotations
router.get('/finalized', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('finalized_quotations')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST convert breakdown to finalized
router.post('/breakdown/:id/finalize', async (req, res) => {
  try {
    const {
      items,
      subtotal,
      discount,
      grand_total,
      notes,
      include_terms,
      terms
    } = req.body;

    // Get original breakdown QT
    const { data: original, error: fetchError } = await supabase
        .from('breakdown_quotations')
        .select('*')
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .single();

    if (fetchError) throw fetchError;
    if (!original) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Generate FQ number
    const fq_number = await generateDocNumber(
      req.user.id,
      'finalized_quotations',
      'FQ',
      'fq_start_number'
    );

    // Create finalized quotation
    const { data: finalized, error: createError } = await supabase
        .from('finalized_quotations')
        .insert([{
          user_id: req.user.id,
          fq_number,
          original_qt_number: original.qt_number,
          customer_name: original.customer_name,
          customer_phone: original.customer_phone,
          customer_email: original.customer_email,
          customer_address: original.customer_address,
          items: items || original.items,
          subtotal: subtotal || original.subtotal,
          discount: discount || original.discount,
          grand_total: grand_total || original.grand_total,
          include_terms: include_terms || original.include_terms,
          terms: terms || original.terms,
          notes: notes || original.notes,
          status: 'Active',
          finalized_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (createError) throw createError;

    // Update original to Converted
    await supabase
      .from('breakdown_quotations')
      .update({ 
        status: 'Converted',
        converted_to: fq_number,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    res.status(201).json({ 
      success: true, 
      data: finalized,
      message: `Finalized as ${fq_number}`
    });
  } catch (err) {
    console.error('Finalize error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET bill prefill data from finalized QT
router.get('/finalized/:id/bill-data', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('finalized_quotations')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;
    
    // Map to bill payload
    const billData = {
      customerName: data.customer_name,
      customerPhone: data.customer_phone,
      customerEmail: data.customer_email,
      customerAddress: data.customer_address,
      items: data.items.map(i => ({
        ...i,
        quantity: i.qty || i.quantity, // Handle either qty or quantity based on frontend
      })),
      subtotal: data.subtotal,
      discount: data.discount,
      grandTotal: data.grand_total,
      linkedFQNumber: data.fq_number,
      linkedFQId: data.id
    };
    
    res.json({ success: true, data: billData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update finalized QT status
router.patch('/finalized/:id/status', async (req, res) => {
  try {
    const { status, bill_number } = req.body;

    const { data, error } = await supabase
      .from('finalized_quotations')
      .update({ 
        status,
        bill_number: bill_number || '',
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// NEXT NUMBER PREVIEW
// ─────────────────────────────────────────

router.get('/next-number', async (req, res) => {
  try {
    const { type } = req.query;

    const config = {
      qt: {
        table: 'breakdown_quotations',
        prefix: 'QT',
        key: 'qt_start_number'
      },
      fq: {
        table: 'finalized_quotations',
        prefix: 'FQ',
        key: 'fq_start_number'
      }
    };

    const conf = config[type];
    if (!conf) {
      return res.status(400).json({ error: 'Invalid type. Use qt or fq' });
    }

    const number = await generateDocNumber(
      req.user.id,
      conf.table,
      conf.prefix,
      conf.key
    );

    res.json({ number });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

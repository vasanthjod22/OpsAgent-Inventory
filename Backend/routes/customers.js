const express = require('express');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/customers — fetch manually saved customers and their contacts
router.get('/', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('customers')
    .select('*, contacts:customer_contacts(*)')
    .eq('user_id', req.user.id)
    .order('name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const formatted = (data || []).map(c => ({
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
  }));

  res.json(formatted);
});

// POST /api/customers — create customer manually
router.post('/', auth, async (req, res) => {
  const { name, phone, email, address, city, gstin, notes, tags } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const { data, error } = await supabase
    .from('customers')
    .upsert([{
      user_id: req.user.id,
      name,
      phone: phone || '',
      email: email || '',
      address: address || '',
      city: city || '',
      gstin: gstin || '',
      notes: notes || '',
      tags: tags || [],
      added_manually: true,
      updated_at: new Date().toISOString(),
    }], { onConflict: 'user_id,name' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ...data, addedManually: true });
});

// PATCH /api/customers/:id — update customer
router.patch('/:id', auth, async (req, res) => {
  const { phone, email, address, city, gstin, notes, tags } = req.body;

  const { data, error } = await supabase
    .from('customers')
    .update({
      phone: phone ?? undefined,
      email: email ?? undefined,
      address: address ?? undefined,
      city: city ?? undefined,
      gstin: gstin ?? undefined,
      notes: notes ?? undefined,
      tags: tags ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Customer not found' });
  res.json(data);
});

// DELETE /api/customers/:id
router.delete('/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('customers')
    .delete()
    .eq('user_id', req.user.id)
    .eq('id', req.params.id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
});

/* -----------------------------------------------------
 *  CONTACTS
 * ----------------------------------------------------- */

// POST /api/customers/:id/contacts
router.post('/:id/contacts', auth, async (req, res) => {
  const { full_name, designation, phone, email, is_primary } = req.body;
  
  if (is_primary) {
    // demote others
    await supabase.from('customer_contacts')
      .update({ is_primary: false })
      .eq('customer_id', req.params.id)
      .eq('user_id', req.user.id);
  }

  const { data, error } = await supabase
    .from('customer_contacts')
    .insert([{
      user_id: req.user.id,
      customer_id: req.params.id,
      full_name,
      designation: designation || '',
      phone,
      email: email || '',
      is_primary: is_primary || false
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/customers/contacts/:cid
router.patch('/contacts/:cid', auth, async (req, res) => {
  const { full_name, designation, phone, email, is_primary } = req.body;

  if (is_primary) {
    // Need customer_id to demote others
    const { data: c } = await supabase.from('customer_contacts').select('customer_id').eq('id', req.params.cid).single();
    if (c) {
      await supabase.from('customer_contacts')
        .update({ is_primary: false })
        .eq('customer_id', c.customer_id)
        .eq('user_id', req.user.id);
    }
  }

  const { data, error } = await supabase
    .from('customer_contacts')
    .update({
      full_name: full_name ?? undefined,
      designation: designation ?? undefined,
      phone: phone ?? undefined,
      email: email ?? undefined,
      is_primary: is_primary ?? undefined
    })
    .eq('user_id', req.user.id)
    .eq('id', req.params.cid)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/customers/contacts/:cid
router.delete('/contacts/:cid', auth, async (req, res) => {
  const { error } = await supabase
    .from('customer_contacts')
    .delete()
    .eq('user_id', req.user.id)
    .eq('id', req.params.cid);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Deleted' });
});

/* -----------------------------------------------------
 *  TAGS
 * ----------------------------------------------------- */

// GET /api/customers/tags/all
router.get('/tags/all', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('customer_tags')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/customers/tags/all
router.post('/tags/all', auth, async (req, res) => {
  const { label, color } = req.body;
  if (!label) return res.status(400).json({ error: 'label required' });

  const { data, error } = await supabase
    .from('customer_tags')
    .insert([{
      user_id: req.user.id,
      label,
      color: color || '#2563EB'
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/customers/tags/all/:id
router.delete('/tags/all/:id', auth, async (req, res) => {
  const { error } = await supabase
    .from('customer_tags')
    .delete()
    .eq('user_id', req.user.id)
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Deleted' });
});

module.exports = router;

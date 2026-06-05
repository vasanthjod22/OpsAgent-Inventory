const express = require('express');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/customers — fetch manually saved customers
router.get('/', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
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
    addedManually: c.added_manually || false,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));

  res.json(formatted);
});

// POST /api/customers — create customer manually
router.post('/', auth, async (req, res) => {
  const { name, phone, email, address, city, gstin, notes } = req.body;
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
  const { phone, email, address, city, gstin, notes } = req.body;

  const { data, error } = await supabase
    .from('customers')
    .update({
      phone: phone ?? undefined,
      email: email ?? undefined,
      address: address ?? undefined,
      city: city ?? undefined,
      gstin: gstin ?? undefined,
      notes: notes ?? undefined,
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

module.exports = router;

const express = require('express');
const supabase = require('../data/supabaseClient');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports — Fetch history
router.get('/', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('report_history')
    .select('*')
    .eq('user_id', req.user.id)
    .order('generated_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/reports — Save new report to history
router.post('/', auth, async (req, res) => {
  const { report_id, report_type, period_from, period_to, summary } = req.body;

  const { data, error } = await supabase
    .from('report_history')
    .insert([{
      user_id: req.user.id,
      report_id,
      report_type,
      period_from,
      period_to,
      summary: summary || {}
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

module.exports = router;

const express = require('express');
const store = require('../data/store');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/company
router.get('/', auth, (req, res) => {
  res.json(store.company);
});

// PUT /api/company — save company profile
router.put('/', auth, (req, res) => {
  store.company = { ...req.body };
  res.json(store.company);
});

module.exports = router;

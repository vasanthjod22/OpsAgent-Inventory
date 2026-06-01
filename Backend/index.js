require('dotenv').config();
const express = require('express');
const cors = require('cors');

// ─── Routes ────────────────────────────────────────────────
const authRoutes      = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const billingRoutes   = require('./routes/billing');
const quotationRoutes = require('./routes/quotations');
const financeRoutes   = require('./routes/finance');
const grnRoutes       = require('./routes/grn');
const companyRoutes   = require('./routes/company');
const aiRoutes        = require('./routes/ai');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ─────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));  // 10mb for base64 image uploads
app.use(express.urlencoded({ extended: true }));

// ─── API Routes ─────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/inventory',  inventoryRoutes);
app.use('/api/bills',      billingRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/finance',    financeRoutes);
app.use('/api/grn',        grnRoutes);
app.use('/api/company',    companyRoutes);
app.use('/api/ai',         aiRoutes);

// ─── Health Check ───────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/api/health'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'OpsAgent Backend is running',
    timestamp: new Date().toISOString(),
    routes: ['/api/auth', '/api/inventory', '/api/bills', '/api/quotations', '/api/finance', '/api/grn', '/api/company', '/api/ai'],
  });
});

// ─── 404 Handler ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start Server ────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production' || require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n✅  OpsAgent Backend running on http://localhost:${PORT}`);
    console.log(`📋  Health check: http://localhost:${PORT}/api/health\n`);
  });
}

module.exports = app;

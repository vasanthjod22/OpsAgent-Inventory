require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const supabase = require('./data/supabaseClient');
const { auth } = require('./middleware/auth');

// ─── Routes ────────────────────────────────────────────────
const authRoutes      = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const billingRoutes   = require('./routes/billing');
const quotationRoutes = require('./routes/quotations');
const financeRoutes   = require('./routes/finance');
const grnRoutes       = require('./routes/grn');
const companyRoutes   = require('./routes/company');
const aiRoutes        = require('./routes/ai.routes.js');
const aiOldRoutes     = require('./routes/ai.js');
const customerRoutes  = require('./routes/customers');
const reportsRoutes   = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const purchaseOrdersRoutes = require('./routes/purchase-orders');
const dashboardRoutes = require('./routes/dashboard.routes');

const app  = express();
const PORT = process.env.PORT || 3001;

const initRoutes       = require('./routes/init');

// ─── Middleware ─────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-groq-api-key'],
}));

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api', globalLimiter);

app.use(express.json({ limit: '10mb' }));  // 10mb for base64 image uploads
app.use(express.urlencoded({ extended: true }));

// ─── API Routes ─────────────────────────────────────────────
app.use('/api/init',       initRoutes);
app.use('/api/auth',       authRoutes);
app.use('/api/inventory',  inventoryRoutes);
app.use('/api/bills',      billingRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/finance',    financeRoutes);
app.use('/api/grn',        grnRoutes);
app.use('/api/company',    companyRoutes);
app.use('/api/ai',         aiRoutes);
app.use('/api/ai',         aiOldRoutes);
app.use('/api/customers',  customerRoutes);
app.use('/api/reports',    reportsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/purchase-orders', purchaseOrdersRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/activity', auth, async (req, res) => {
  try {
    const limit = req.query.limit || 20
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Health Check ───────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/api/health'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'OpsAgent Backend is running',
    timestamp: new Date().toISOString(),
    routes: ['/api/auth', '/api/inventory', '/api/bills', '/api/quotations', '/api/finance', '/api/grn', '/api/company', '/api/ai', '/api/customers', '/api/reports'],
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

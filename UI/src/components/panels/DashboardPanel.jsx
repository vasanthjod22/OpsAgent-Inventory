import { useState, useEffect, useCallback } from 'react'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell
} from 'recharts'
import { 
  TrendingUp, DollarSign, FileText, ShoppingCart, AlertTriangle, Users, Package, UserCheck, 
  Receipt, ArrowRight, X, UserPlus, Box, DollarSign as MoneyIcon, FileSignature, RefreshCw
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import DateRangePicker, { getDateRange } from '../ui/DateRangePicker'
import { CHART_COLORS, CHART_DEFAULTS, tooltipStyle, gridStyle, axisStyle } from '../../utils/chartTheme'

export default function DashboardPanel({ onNavigate }) {
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState(null)
  
  // Sales Trend State
  const [trendFilter, setTrendFilter] = useState('week')
  const [trendCustomFrom, setTrendCustomFrom] = useState(null)
  const [trendCustomTo, setTrendCustomTo] = useState(null)
  const [salesTrend, setSalesTrend] = useState([])

  // Other Charts Data
  const [categorySales, setCategorySales] = useState([])
  const [topProducts, setTopProducts] = useState([])
  
  // Lists
  const [lowStockList, setLowStockList] = useState([])
  const [activities, setActivities] = useState([])

  // Modal State
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    title: '', category: 'General', amount: '', payment_method: 'Cash', date: new Date().toISOString().split('T')[0], notes: ''
  })

  // ─── FETCH LOGIC ──────────────────────────────────────────────
  
  const fetchKpis = async () => {
    try {
      const res = await backendFetch('/dashboard/kpis')
      if (res.success) setKpis(res)
    } catch (err) { console.error('Failed to fetch KPIs', err) }
  }

  const fetchSalesTrend = async () => {
    try {
      let from, to;
      if (trendFilter === 'custom') {
        if (!trendCustomFrom) return;
        from = trendCustomFrom.toISOString()
        to = trendCustomTo ? trendCustomTo.toISOString() : new Date().toISOString()
      } else {
        const range = getDateRange(trendFilter)
        from = range.from
        to = range.to
      }
      const res = await backendFetch(`/dashboard/sales-trend?from=${from}&to=${to}`)
      if (res.success) setSalesTrend(res.data)
    } catch (err) { console.error('Failed to fetch sales trend', err) }
  }

  const fetchCategorySales = async () => {
    try {
      const range = getDateRange('month')
      const res = await backendFetch(`/dashboard/sales-by-category?from=${range.from}&to=${range.to}`)
      if (res.success) setCategorySales(res.data)
    } catch (err) { console.error('Failed to fetch category sales', err) }
  }

  const fetchTopProducts = async () => {
    try {
      const range = getDateRange('month')
      const res = await backendFetch(`/dashboard/top-products?from=${range.from}&to=${range.to}`)
      if (res.success) setTopProducts(res.data)
    } catch (err) { console.error('Failed to fetch top products', err) }
  }

  const fetchLowStock = async () => {
    try {
      const inventoryRes = await backendFetch('/inventory')
      const low = (inventoryRes || []).filter(i => (i.qty || 0) < (i.min || 0))
      setLowStockList(low.slice(0, 8))
    } catch (err) { console.error('Failed to fetch low stock', err) }
  }

  const fetchActivities = async () => {
    try {
      const res = await backendFetch('/activity?limit=10')
      if (res.success) setActivities(res.data)
    } catch (err) { console.error('Failed to fetch activities', err) }
  }

  const fetchAllData = useCallback(async () => {
    setLoading(true)
    await Promise.all([
      fetchKpis(),
      fetchSalesTrend(),
      fetchCategorySales(),
      fetchTopProducts(),
      fetchLowStock(),
      fetchActivities()
    ])
    setLoading(false)
  }, [trendFilter, trendCustomFrom, trendCustomTo])

  // ─── EFFECTS ──────────────────────────────────────────────────

  useEffect(() => {
    fetchAllData()
    const interval = setInterval(fetchAllData, 60000)
    return () => clearInterval(interval)
  }, [fetchAllData])

  useEffect(() => {
    fetchSalesTrend()
  }, [trendFilter, trendCustomFrom, trendCustomTo])

  // ─── HELPERS ──────────────────────────────────────────────────

  const getChange = (current, previous) => {
    if (!previous || previous === 0) return { value: '0.0', direction: 'none', color: '#94A3B8', arrow: '—' }
    const pct = ((current - previous) / Math.abs(previous)) * 100
    if (pct === 0) return { value: '0.0', direction: 'none', color: '#94A3B8', arrow: '—' }
    return {
      value: Math.abs(pct).toFixed(1),
      direction: pct > 0 ? 'up' : 'down',
      color: pct > 0 ? '#16A34A' : '#DC2626',
      arrow: pct > 0 ? '↑' : '↓'
    }
  }

  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const timeAgo = (dateStr) => {
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000)
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds/60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds/3600)}h ago`
    return `${Math.floor(seconds/86400)}d ago`
  }

  const getLowStockStatus = (qty, min) => {
    if (qty === 0) return { label: 'Out of Stock', color: '#DC2626', bg: '#FEF2F2' }
    const pct = (qty / min) * 100
    if (pct <= 25) return { label: 'Critical', color: '#DC2626', bg: '#FEF2F2' }
    if (pct <= 50) return { label: 'Very Low', color: '#EA580C', bg: '#FFF7ED' }
    return { label: 'Low Stock', color: '#D97706', bg: '#FFFBEB' }
  }

  const handleExpenseSave = async (e) => {
    e.preventDefault()
    try {
      await backendFetch('/dashboard/expenses', {
        method: 'POST',
        body: JSON.stringify(expenseForm)
      })
      setShowExpenseModal(false)
      setExpenseForm({ title: '', category: 'General', amount: '', payment_method: 'Cash', date: new Date().toISOString().split('T')[0], notes: '' })
      fetchAllData()
    } catch (err) {
      alert('Failed to save expense: ' + err.message)
    }
  }

  // ─── RENDER KPI CARDS ─────────────────────────────────────────

  const renderKPIs = () => {
    if (!kpis) return null

    const kpiData = [
      { 
        title: "Today's Sales", val: formatCurrency(kpis.todaySales), sub: "Revenue today", 
        icon: TrendingUp, color: '#16A34A', 
        change: kpis.todaySalesChange !== undefined ? { pct: kpis.todaySalesChange } : null
      },
      { 
        title: "Today's Profit", val: formatCurrency(kpis.todayProfit), sub: "Profit today", 
        icon: DollarSign, color: '#2563EB', 
        change: kpis.todayProfitChange !== undefined ? { pct: kpis.todayProfitChange } : null
      },
      { 
        title: "Pending Bills", val: kpis.pendingBills?.count || 0, sub: "Awaiting payment", 
        valSub: `(${formatCurrency(kpis.pendingBills?.amount)})`,
        icon: FileText, color: '#D97706', onClick: () => onNavigate('billing')
      },
      { 
        title: "Pending POs", val: kpis.pendingPOs || 0, sub: "Orders pending", 
        icon: ShoppingCart, color: '#9333EA', onClick: () => onNavigate('purchase_orders')
      },
      { 
        title: "Low Stock Products", val: kpis.lowStock || 0, sub: "Below reorder level", 
        icon: AlertTriangle, color: '#DC2626', onClick: () => onNavigate('inventory')
      },
      { 
        title: "Customer Due Amount", val: formatCurrency(kpis.customerDue), sub: "Outstanding receivables", 
        icon: Users, color: '#EA580C', onClick: () => onNavigate('customers')
      },
      { 
        title: "Today's Orders", val: kpis.todayOrders || 0, sub: "Bills created today", 
        icon: Package, color: '#0891B2', 
        change: kpis.todayOrdersChange !== undefined ? { pct: kpis.todayOrdersChange } : null
      },
      { 
        title: "Total Customers", val: kpis.totalCustomers || 0, sub: "Registered customers", 
        icon: UserCheck, color: '#4F46E5', 
        change: kpis.newCustomersThisWeek !== undefined ? { pct: kpis.newCustomersThisWeek, label: 'new this week' } : null
      }
    ]

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        {kpiData.map((item, i) => {
          const Icon = item.icon
          return (
            <div 
              key={i} 
              onClick={item.onClick}
              style={{ 
                background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, 
                cursor: item.onClick ? 'pointer' : 'default', transition: 'all 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={(e) => { if(item.onClick) e.currentTarget.style.borderColor = item.color }}
              onMouseLeave={(e) => { if(item.onClick) e.currentTarget.style.borderColor = '#E2E8F0' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#64748B', fontWeight: 500, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    {item.val}
                    {item.valSub && <span style={{ fontSize: 14, color: '#64748B', fontWeight: 500 }}>{item.valSub}</span>}
                  </div>
                </div>
                <div style={{ background: `${item.color}15`, width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color }}>
                  <Icon size={20} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{item.sub}</span>
                {item.change && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: item.change.pct >= 0 ? '#16A34A' : '#DC2626' }}>
                    {item.change.label ? (
                      <span style={{ color: '#16A34A' }}>+{item.change.pct} {item.change.label}</span>
                    ) : (
                      <>
                        <span>{item.change.pct >= 0 ? '↑' : '↓'}</span>
                        <span>{Math.abs(item.change.pct).toFixed(1)}%</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ─── MAIN RENDER ──────────────────────────────────────────────

  return (
    <div style={{ padding: 24, background: '#F8FAFC', minHeight: '100%' }}>
      
      {/* ── QUICK ACTIONS ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { label: 'Create Bill', icon: Receipt, onClick: () => onNavigate('billing') },
          { label: 'Add Customer', icon: UserPlus, onClick: () => onNavigate('customers') },
          { label: 'Add Product', icon: Box, onClick: () => onNavigate('inventory') },
          { label: 'Create PO', icon: ShoppingCart, onClick: () => onNavigate('purchase_orders') },
          { label: 'Record Expense', icon: MoneyIcon, onClick: () => setShowExpenseModal(true) },
          { label: 'Create Quotation', icon: FileSignature, onClick: () => onNavigate('quotations') }
        ].map((btn, i) => (
          <button 
            key={i} onClick={btn.onClick}
            style={{ 
              display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', 
              background: 'white', border: '1px solid #2563EB', borderRadius: 8, color: '#2563EB',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2563EB'; e.currentTarget.style.color = 'white' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#2563EB' }}
          >
            <btn.icon size={16} /> {btn.label}
          </button>
        ))}
      </div>

      {renderKPIs()}

      {/* ── CHARTS ROW 1 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
        
        {/* Sales Trend */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Sales Trend</h3>
            <DateRangePicker 
              value={trendFilter} onChange={setTrendFilter}
              customFrom={trendCustomFrom} customTo={trendCustomTo}
              onCustomChange={(type, val) => type === 'from' ? setTrendCustomFrom(val) : setTrendCustomTo(val)}
            />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={salesTrend}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="date" {...axisStyle} />
              <YAxis {...axisStyle} tickFormatter={v => `₹${(v/1000).toFixed(2)}k`} />
              <RechartsTooltip {...tooltipStyle} formatter={(v, n) => [n === 'sales' ? formatCurrency(v) : v, n === 'sales' ? 'Sales' : 'Orders']} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              <Line name="Sales Revenue" type="monotone" dataKey="sales" stroke="#2563EB" strokeWidth={3} dot={{ fill: '#2563EB', r: 4 }} activeDot={{ r: 6 }} />
              <Line name="Total Orders" type="monotone" dataKey="orders" stroke="#7C3AED" strokeWidth={2} dot={{ fill: '#7C3AED', r: 3 }} strokeDasharray="5 5" yAxisId="right" />
              <YAxis yAxisId="right" orientation="right" {...axisStyle} tickLine={false} axisLine={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category Sales */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Revenue by Category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categorySales}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="category" {...axisStyle} tick={{ fontSize: 11, fill: '#64748B' }} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis {...axisStyle} tickFormatter={v => `₹${(v/1000).toFixed(2)}k`} />
              <RechartsTooltip {...tooltipStyle} formatter={(v) => [formatCurrency(v), 'Revenue']} cursor={{ fill: '#F1F5F9' }} />
              <Bar dataKey="revenue" radius={[4,4,0,0]} maxBarSize={40}>
                {categorySales.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── TOP PRODUCTS ── */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Top 5 Selling Products (This Month)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={topProducts} layout="vertical" margin={{ left: 10, right: 30 }}>
            <CartesianGrid {...gridStyle} horizontal={false}/>
            <XAxis type="number" {...axisStyle} tickFormatter={v => `₹${(v/1000).toFixed(2)}k`} />
            <YAxis type="category" dataKey="name" width={180} {...axisStyle} tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }} />
            <RechartsTooltip {...tooltipStyle} cursor={{ fill: '#F1F5F9' }} formatter={(v, n) => [n === 'revenue' ? formatCurrency(v) : v, n === 'revenue' ? 'Revenue' : 'Units Sold']} />
            <Bar dataKey="revenue" name="Revenue" radius={[0,4,4,0]} maxBarSize={28}>
              {topProducts.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── BOTTOM ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        
        {/* Low Stock */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0F172A' }}>Low Stock Alerts</h3>
            <button onClick={() => onNavigate('inventory')} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              View All <ArrowRight size={14} />
            </button>
          </div>
          {lowStockList.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748B', fontSize: 14 }}>All stock levels are healthy!</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#F8FAFC', fontSize: 12, color: '#64748B', textTransform: 'uppercase' }}>
                  <tr>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>Product</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>Current Qty</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>Min Level</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockList.map((item, i) => {
                    const status = getLowStockStatus(item.qty, item.min)
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 20px', fontSize: 14, color: '#0F172A', fontWeight: 500 }}>{item.name}</td>
                        <td style={{ padding: '14px 20px', fontSize: 14, color: '#374151' }}>{item.qty} {item.unit}</td>
                        <td style={{ padding: '14px 20px', fontSize: 14, color: '#64748B' }}>{item.min} {item.unit}</td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: status.bg, color: status.color }}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0F172A' }}>Recent Activity</h3>
            <button onClick={() => fetchActivities()} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><RefreshCw size={14} /></button>
          </div>
          <div style={{ padding: '20px', flex: 1, overflowY: 'auto', maxHeight: 400 }}>
            {activities.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748B', marginTop: 40 }}>No recent activity</div>
            ) : (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 20, top: 20, bottom: 20, width: 2, background: '#E2E8F0' }} />
                {activities.map((act, i) => (
                  <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 20, position: 'relative' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${act.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, zIndex: 2, border: '4px solid white', flexShrink: 0 }}>
                      {act.icon}
                    </div>
                    <div style={{ paddingTop: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{act.title}</div>
                      <div style={{ fontSize: 13, color: '#475569', margin: '4px 0' }}>{act.description}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{timeAgo(act.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── EXPENSE MODAL ── */}
      {showExpenseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: 12, width: 450, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Record Expense</h3>
              <button onClick={() => setShowExpenseModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}><X size={20}/></button>
            </div>
            <form onSubmit={handleExpenseSave} style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Expense Title *</label>
                <input required value={expenseForm.title} onChange={e => setExpenseForm({...expenseForm, title: e.target.value})} style={{ width: '100%', height: 38, borderRadius: 6, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 14 }} placeholder="e.g. Office Supplies" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Amount *</label>
                  <input required type="number" min="0" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} style={{ width: '100%', height: 38, borderRadius: 6, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 14 }} placeholder="0.00" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Category</label>
                  <select value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})} style={{ width: '100%', height: 38, borderRadius: 6, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 14, background: 'white' }}>
                    {['General', 'Fuel', 'Labour', 'Rent', 'Maintenance', 'Utilities', 'Other'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Payment Method</label>
                  <select value={expenseForm.payment_method} onChange={e => setExpenseForm({...expenseForm, payment_method: e.target.value})} style={{ width: '100%', height: 38, borderRadius: 6, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 14, background: 'white' }}>
                    {['Cash', 'Bank', 'UPI'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Date</label>
                  <input required type="date" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} style={{ width: '100%', height: 38, borderRadius: 6, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 14 }} />
                </div>
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Notes</label>
                <textarea value={expenseForm.notes} onChange={e => setExpenseForm({...expenseForm, notes: e.target.value})} style={{ width: '100%', height: 60, borderRadius: 6, border: '1px solid #CBD5E1', padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'none' }} placeholder="Optional notes..." />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" onClick={() => setShowExpenseModal(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', color: '#64748B', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2563EB', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

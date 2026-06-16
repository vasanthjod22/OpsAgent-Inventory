import { formatDate } from '../../utils/dateUtils';
import React, { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft, Download, TrendingUp, TrendingDown,
  DollarSign, Percent, X, Plus
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { exportToPDF, exportToExcel } from '../../utils/exportUtils'
import DateRangePicker, { getDateRange } from '../ui/DateRangePicker'
import ExportButton from '../ui/ExportButton'

const CHART_COLORS = ['#38BDF8', '#8B5CF6', '#2563EB', '#F59E0B', '#EF4444', '#6366F1', '#EC4899', '#14B8A6']
const axisStyle = { tick: { fontSize: 12, fill: '#64748B' }, axisLine: { stroke: '#E2E8F0' }, tickLine: false }
const gridStyle = { strokeDasharray: '3 3', stroke: '#F1F5F9', vertical: false }
const tooltipStyle = {
  contentStyle: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
  itemStyle: { color: 'var(--text-primary)', fontWeight: 600 }
}

const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`

export default function FinanceReport({ onBack }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [dateRange, setDateRange] = useState('all')
  const [customFrom, setCustomFrom] = useState(null)
  const [customTo, setCustomTo] = useState(null)
  
  // Expense Modal State
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    title: '', category: 'General', amount: '', payment_method: 'Cash',
    date: new Date().toISOString().split('T')[0], notes: ''
  })

  const reportRef = useRef(null)

  useEffect(() => {
    fetchData()
  }, [dateRange, customFrom, customTo])

  const fetchData = async () => {
    let from, to;


    if (dateRange !== 'custom') {
      const range = getDateRange(dateRange)
      from = range.from
      to = range.to
    } else {
      if (!customFrom || !customTo) {
        return
      }
      from = customFrom.toISOString()
      to = new Date(customTo.getTime() + 86399999).toISOString()
    }

    setLoading(true)
    try {
      let query = `?from=${from}`
      if (to) query += `&to=${to}`
      const res = await backendFetch(`/reports/finance${query}`)
      setData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
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
      fetchData() // Refresh report
    } catch (err) {
      alert('Failed to save expense: ' + err.message)
    }
  }

  const handleExportPDF = () => {
    if (!data) return
    const titleDate = dateRange === 'Custom' ? customFrom : dateRange
    const headers = ['Customer', 'Phone', 'Bills', 'Total Due', 'Oldest Bill', 'Days Overdue']
    const rows = data.outstanding.map(o => [
      o.customer, o.phone, o.bills, formatCurrency(o.totalDue), 
      formatDate(o.oldestBill), o.daysOverdue
    ])
    exportToPDF('Finance Report - ' + titleDate, headers, rows, `Finance_Report_${titleDate}`)
  }

  const handleExportExcel = () => {
    if (!data) return
    const titleDate = dateRange === 'Custom' ? customFrom : dateRange
    exportToExcel(data.outstanding, `Finance_Report_${titleDate}`)
  }

  const getMarginColor = (margin) => {
    if (margin > 20) return '#16A34A' // green
    if (margin >= 10) return '#D97706' // amber
    return '#DC2626' // red
  }

  return (
    <div className="finance-report-page" ref={reportRef} style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button 
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--text-muted)', transition: 'all 0.2s' }}
          >
            <ArrowLeft size={16} /> Back to Reports
          </button>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Finance Report</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setShowExpenseModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563EB', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'white' }}>
            <Plus size={16} /> Record Expense
          </button>

          <DateRangePicker 
            value={dateRange}
            onChange={setDateRange}
            customFrom={customFrom}
            customTo={customTo}
            onCustomChange={(type, date) => {
              if (type === 'from') setCustomFrom(date)
              else setCustomTo(date)
            }}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <ExportButton onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} />
          </div>
        </div>
      </div>

      {loading || !data ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* ── KPI CARDS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
                  <TrendingUp size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Revenue</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Total collected revenue</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(data.kpis.totalRevenue)}</div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                  <TrendingDown size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Expenses</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Total recorded expenses</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(data.kpis.totalExpenses)}</div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                  <DollarSign size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Gross Profit</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Revenue minus expenses</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: data.kpis.grossProfit >= 0 ? '#16A34A' : '#DC2626' }}>
                {formatCurrency(data.kpis.grossProfit)}
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED' }}>
                  <Percent size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Net Profit Margin</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Profit as % of revenue</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: getMarginColor(data.kpis.profitMargin) }}>
                {data.kpis.profitMargin.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* ── CHARTS ── */}
          <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 12, border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Revenue vs Expense Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.trend}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="month" {...axisStyle} />
                <YAxis {...axisStyle} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip {...tooltipStyle} formatter={(v, name) => [formatCurrency(v), name]} />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#16A34A" strokeWidth={2} fill="url(#revGrad)" />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#DC2626" strokeWidth={2} fill="url(#expGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 12, border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Monthly Profit</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.monthlyProfit}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="month" {...axisStyle} />
                  <YAxis {...axisStyle} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [formatCurrency(v), 'Profit']} />
                  <Line {...ANIMATION_DEFAULTS} type="monotone" dataKey="profit" stroke="#2563EB" strokeWidth={2.5} dot={(props) => {
                    const { cx, cy, value, key } = props
                    return <circle key={key} cx={cx} cy={cy} r={5} fill={value >= 0 ? '#16A34A' : '#DC2626'} stroke="white" strokeWidth={2} />
                  }} />
                  <ReferenceLine y={0} stroke="#E2E8F0" strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 12, border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Expense Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie {...ANIMATION_DEFAULTS}
                    data={data.expenseCategories}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85}
                    dataKey="amount" nameKey="category"
                    label={({ category, percent }) => `${category} ${(percent*100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {data.expenseCategories.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v) => [formatCurrency(v), 'Amount']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── REVENUE VS EXPENSE TABLE ── */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Monthly Revenue & Expense Summary</h3>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 350 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: 'var(--bg-main)', fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>Month</th>
                    <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>Revenue</th>
                    <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>Expenses</th>
                    <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.trend].reverse().map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t.month}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 500, color: '#16A34A' }}>{formatCurrency(t.revenue)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 500, color: '#DC2626' }}>{formatCurrency(t.expenses)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: t.profit >= 0 ? '#16A34A' : '#DC2626' }}>
                        {formatCurrency(t.profit)}
                      </td>
                    </tr>
                  ))}
                  {data.trend.length === 0 && (
                    <tr><td colSpan="4" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No data available for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── OUTSTANDING PAYMENTS TABLE ── */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Outstanding Customer Payments</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: 'var(--bg-main)', fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <tr>
                    <th style={{ padding: '16px 24px' }}>Customer</th>
                    <th style={{ padding: '16px 24px' }}>Phone</th>
                    <th style={{ padding: '16px 24px' }}>Bills</th>
                    <th style={{ padding: '16px 24px' }}>Total Due</th>
                    <th style={{ padding: '16px 24px' }}>Oldest Bill</th>
                    <th style={{ padding: '16px 24px' }}>Days Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.outstanding.map((o, i) => {
                    let bg = 'white'
                    if (o.daysOverdue > 30) bg = '#FEF2F2'
                    else if (o.daysOverdue >= 15) bg = '#FFFBEB'
                    
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: bg }}>
                        <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{o.customer}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, color: 'var(--text-muted)' }}>{o.phone || '-'}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, color: '#374151' }}>{o.bills}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#DC2626' }}>{formatCurrency(o.totalDue)}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, color: 'var(--text-muted)' }}>{formatDate(o.oldestBill)}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: o.daysOverdue > 30 ? '#DC2626' : '#D97706' }}>{o.daysOverdue} days</td>
                      </tr>
                    )
                  })}
                  {data.outstanding.length === 0 && (
                    <tr><td colSpan="6" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No outstanding payments!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ── EXPENSE MODAL ── */}
      {showExpenseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: 400, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Record Expense</h3>
              <button onClick={() => setShowExpenseModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20}/></button>
            </div>
            <form onSubmit={handleExpenseSave} style={{ padding: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Expense Title *</label>
                  <input required value={expenseForm.title} onChange={e => setExpenseForm({...expenseForm, title: e.target.value})} style={{ width: '100%', height: 38, borderRadius: 6, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 14 }} placeholder="e.g. Office Supplies" />
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Amount (₹) *</label>
                    <input required type="number" min="0" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} style={{ width: '100%', height: 38, borderRadius: 6, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 14 }} placeholder="0.00" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Category</label>
                    <select value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})} style={{ width: '100%', height: 38, borderRadius: 6, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 14, background: 'var(--bg-card)' }}>
                      <option>General</option>
                      <option>Fuel</option>
                      <option>Rent</option>
                      <option>Labour</option>
                      <option>Utilities</option>
                      <option>Maintenance</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Payment Method</label>
                    <select value={expenseForm.payment_method} onChange={e => setExpenseForm({...expenseForm, payment_method: e.target.value})} style={{ width: '100%', height: 38, borderRadius: 6, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 14, background: 'var(--bg-card)' }}>
                      <option>Cash</option>
                      <option>UPI</option>
                      <option>Bank Transfer</option>
                      <option>Card</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Date *</label>
                    <input required type="date" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} style={{ width: '100%', height: 38, borderRadius: 6, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 14 }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Notes</label>
                  <textarea value={expenseForm.notes} onChange={e => setExpenseForm({...expenseForm, notes: e.target.value})} style={{ width: '100%', height: 60, borderRadius: 6, border: '1px solid #CBD5E1', padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'none' }} placeholder="Optional notes..." />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                <button type="button" onClick={() => setShowExpenseModal(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2563EB', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

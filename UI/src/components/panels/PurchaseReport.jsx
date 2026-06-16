import { formatDate } from '../../utils/dateUtils';
import React, { useState, useEffect } from 'react'
import {
  ArrowLeft, ShoppingCart, FileText, Clock, AlertCircle
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { exportToPDF, exportToExcel } from '../../utils/exportUtils'
import ExportButton from '../ui/ExportButton'
import DateRangePicker, { getDateRange } from '../ui/DateRangePicker'

const CHART_COLORS = ['#38BDF8', '#8B5CF6', '#2563EB', '#F59E0B', '#EF4444', '#6366F1', '#EC4899', '#14B8A6']
const axisStyle = { tick: { fontSize: 12, fill: '#64748B' }, axisLine: { stroke: '#E2E8F0' }, tickLine: false }
const gridStyle = { strokeDasharray: '3 3', stroke: '#F1F5F9', vertical: false }
const tooltipStyle = {
  contentStyle: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
  itemStyle: { color: 'var(--text-primary)', fontWeight: 600 }
}

const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`

export default function PurchaseReport({ onBack }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  
  const [dateRange, setDateRange] = useState('all')
  const [customFrom, setCustomFrom] = useState(null)
  const [customTo, setCustomTo] = useState(null)

  useEffect(() => {
    fetchData()
  }, [dateRange, customFrom, customTo])

  const fetchData = async () => {
    let f, t;

    if (dateRange !== 'custom') {
      const range = getDateRange(dateRange)
      f = range.from
      t = range.to
    } else {
      if (!customFrom || !customTo) {
        return
      }
      f = customFrom.toISOString()
      t = new Date(customTo.getTime() + 86399999).toISOString()
    }

    setLoading(true)
    try {
      const res = await backendFetch(`/reports/purchase?from=${f}&to=${t}`)
      setData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = () => {
    if (!data) return
    const headers = ['PO No', 'Supplier', 'Items', 'Value', 'Expected Date', 'Days Pending', 'Status']
    const rows = data.pendingOrders.map(p => [
      p.po_number, p.supplier_name, p.items?.length || 0, formatCurrency(p.grand_total),
      p.expected_date ? formatDate(p.expected_date) : '-',
      p.daysPending, p.status
    ])
    exportToPDF('Pending Purchase Orders', headers, rows, 'Pending_POs')
  }

  const handleExportExcel = () => {
    if (!data) return
    import('xlsx').then(XLSX => {
      const wb = XLSX.utils.book_new()
      
      const wsPending = XLSX.utils.json_to_sheet(data.pendingOrders.map(p => ({
        'PO No': p.po_number, Supplier: p.supplier_name, Items: p.items?.length || 0, 
        Value: p.grand_total, ExpectedDate: p.expected_date ? formatDate(p.expected_date) : '-',
        DaysPending: p.daysPending, Status: p.status
      })))
      XLSX.utils.book_append_sheet(wb, wsPending, "Pending POs")

      const wsSupplier = XLSX.utils.json_to_sheet(data.supplierSummary.map(s => ({
        Supplier: s.supplier, TotalPOs: s.totalPOs, TotalValue: s.totalValue, 
        AvgValue: s.avgValue, OnTimePct: `${s.onTimePct}%`, 
        LastOrder: formatDate(s.lastOrder)
      })))
      XLSX.utils.book_append_sheet(wb, wsSupplier, "Supplier Summary")

      XLSX.writeFile(wb, `Purchase_Report_${new Date().toISOString().split('T')[0]}.xlsx`)
    })
  }

  return (
    <div className="purchase-report-page" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button 
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--text-muted)', transition: 'all 0.2s' }}
          >
            <ArrowLeft size={16} /> Back to Reports
          </button>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Purchase Report</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Purchase Value</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(data.kpis.totalValue)}</div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Orders</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{data.kpis.totalPOs}</div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
                  <Clock size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Pending Orders</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{formatCurrency(data.kpis.pendingValue)} value</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#D97706' }}>{data.kpis.pendingCount}</div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                  <AlertCircle size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Overdue Orders</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#DC2626' }}>{data.kpis.overdueCount}</div>
            </div>
          </div>

          {/* ── CHARTS ── */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 500px', background: 'var(--bg-card)', padding: 24, borderRadius: 12, border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Monthly Purchase Trend</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.monthlyTrend}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="month" {...axisStyle} />
                  <YAxis {...axisStyle} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [formatCurrency(v), 'Purchase Value']} />
                  <Line {...ANIMATION_DEFAULTS} type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={3} dot={data?.trend?.length > 24 ? false : { r: 4, fill: '#2563EB', strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ flex: '1 1 400px', background: 'var(--bg-card)', padding: 24, borderRadius: 12, border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Purchases by Supplier</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.supplierChart}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="name" {...axisStyle} angle={-25} textAnchor="end" height={60} />
                  <YAxis {...axisStyle} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [formatCurrency(v), 'Value']} />
                  <Bar {...ANIMATION_DEFAULTS} dataKey="value" radius={[4,4,0,0]}>
                    {data.supplierChart.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── PENDING POS TABLE ── */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Pending Purchase Orders</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: 'var(--bg-main)', fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <tr>
                    <th style={{ padding: '16px 24px' }}>PO No</th>
                    <th style={{ padding: '16px 24px' }}>Supplier</th>
                    <th style={{ padding: '16px 24px' }}>Items</th>
                    <th style={{ padding: '16px 24px' }}>Value</th>
                    <th style={{ padding: '16px 24px' }}>Expected Date</th>
                    <th style={{ padding: '16px 24px' }}>Days Pending</th>
                    <th style={{ padding: '16px 24px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingOrders.map((o, i) => {
                    let daysColor = '#2563EB' // green
                    let daysBg = '#EFF6FF'
                    if (o.daysPending > 7) {
                      daysColor = '#DC2626' // red
                      daysBg = '#FEF2F2'
                    } else if (o.daysPending >= 3) {
                      daysColor = '#D97706' // amber
                      daysBg = '#FFFBEB'
                    }
                    
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{o.po_number}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, color: '#374151' }}>{o.supplier_name}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, color: 'var(--text-muted)' }}>{o.items?.length || 0}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(o.grand_total)}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, color: 'var(--text-muted)' }}>{o.expected_date ? formatDate(o.expected_date) : '-'}</td>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: daysColor, background: daysBg, padding: '4px 8px', borderRadius: 4 }}>
                            {o.daysPending} days
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--text-muted)' }}>{o.status}</td>
                      </tr>
                    )
                  })}
                  {data.pendingOrders.length === 0 && (
                    <tr><td colSpan="7" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No pending orders!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SUPPLIER SUMMARY TABLE ── */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Supplier Purchase Summary</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: 'var(--bg-main)', fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <tr>
                    <th style={{ padding: '16px 24px' }}>Supplier</th>
                    <th style={{ padding: '16px 24px' }}>Total POs</th>
                    <th style={{ padding: '16px 24px' }}>Total Value</th>
                    <th style={{ padding: '16px 24px' }}>Avg Value</th>
                    <th style={{ padding: '16px 24px' }}>Last Order</th>
                    <th style={{ padding: '16px 24px' }}>On Time %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.supplierSummary.map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{s.supplier}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: 'var(--text-muted)' }}>{s.totalPOs}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(s.totalValue)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: 'var(--text-muted)' }}>{formatCurrency(s.avgValue)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: 'var(--text-muted)' }}>{formatDate(s.lastOrder)}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: s.onTimePct >= 80 ? '#2563EB' : s.onTimePct < 50 ? '#DC2626' : '#D97706' }}>
                          {s.onTimePct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {data.supplierSummary.length === 0 && (
                    <tr><td colSpan="6" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No supplier data!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  )
}

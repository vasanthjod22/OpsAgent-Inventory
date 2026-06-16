import { formatDate } from '../../utils/dateUtils';
import React, { useState, useEffect } from 'react'
import {
  ArrowLeft, Download, FileText, Hash, Percent, Tag, FileDown
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import {
  LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts'
import { exportToPDF, exportToExcel } from '../../utils/exportUtils'
import { generateBillPDF } from '../../utils/pdfGenerator'
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

export default function BillingReport({ onBack }) {
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
      const res = await backendFetch(`/reports/billing?from=${f}&to=${t}`)
      setData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = () => {
    if (!data) return
    const headers = ['Bill No', 'Customer', 'Date', 'Amount', 'Status']
    const rows = data.recentBills.map(b => [
      b.bill_number, b.customer_name || 'Walk-in', formatDate(b.created_at), 
      formatCurrency(b.grand_total), b.payment_status
    ])
    exportToPDF('Recent Bills', headers, rows, 'Recent_Bills')
  }

  const handleExportExcel = () => {
    if (!data) return
    import('xlsx').then(XLSX => {
      const wb = XLSX.utils.book_new()
      
      const wsRecent = XLSX.utils.json_to_sheet(data.recentBills.map(b => ({
        BillNo: b.bill_number, Customer: b.customer_name || 'Walk-in', Phone: b.customer_phone,
        Date: formatDate(b.created_at), Amount: b.grand_total, 
        Discount: b.discount, Method: b.payment_method, Status: b.payment_status
      })))
      XLSX.utils.book_append_sheet(wb, wsRecent, "Recent Bills")

      const wsUnpaid = XLSX.utils.json_to_sheet(data.unpaidBills.map(b => ({
        BillNo: b.bill_number, Customer: b.customer_name || 'Walk-in', Amount: b.grand_total,
        Created: formatDate(b.created_at), DaysPending: b.daysPending, Status: b.payment_status
      })))
      XLSX.utils.book_append_sheet(wb, wsUnpaid, "Unpaid Bills")

      XLSX.writeFile(wb, `Billing_Report_${new Date().toISOString().split('T')[0]}.xlsx`)
    })
  }

  return (
    <div className="billing-report-page" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button 
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--text-muted)', transition: 'all 0.2s' }}
          >
            <ArrowLeft size={16} /> Back to Reports
          </button>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Billing Report</h2>
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
                  <FileText size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Bills Generated</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{data.kpis.totalBills}</div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED' }}>
                  <Hash size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Bill Amount</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(data.kpis.totalAmount)}</div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                  <Percent size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total GST Collected</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>CGST + SGST</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#2563EB', marginBottom: 8 }}>{formatCurrency(data.kpis.totalGST)}</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                <div style={{ background: 'var(--bg-main)', padding: '4px 8px', borderRadius: 4 }}>CGST: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(data.kpis.cgst)}</span></div>
                <div style={{ background: 'var(--bg-main)', padding: '4px 8px', borderRadius: 4 }}>SGST: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(data.kpis.sgst)}</span></div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
                  <Tag size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Discounts Given</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#D97706' }}>{formatCurrency(data.kpis.totalDiscount)}</div>
            </div>
          </div>

          {/* ── CHARTS ── */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 500px', background: 'var(--bg-card)', padding: 24, borderRadius: 12, border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Billing Trend</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={[...data.trend].reverse()}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="date" {...axisStyle} />
                  <YAxis yAxisId="left" {...axisStyle} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" {...axisStyle} />
                  <Tooltip {...tooltipStyle} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
                  <Line yAxisId="left" name="Amount" type="monotone" dataKey="amount" stroke="#2563EB" strokeWidth={3} dot={data?.trend?.length > 24 ? false : { r: 4 }} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" name="Bill Count" type="monotone" dataKey="count" stroke="#7C3AED" strokeWidth={3} dot={data?.trend?.length > 24 ? false : { r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ flex: '1 1 300px', background: 'var(--bg-card)', padding: 24, borderRadius: 12, border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Payment Method Distribution</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Tooltip {...tooltipStyle} formatter={(v) => formatCurrency(v)} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
                  <Pie data={data.paymentMethods} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                    {data.paymentMethods.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── RECENT BILLS TABLE ── */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Recent Bills</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: 'var(--bg-main)', fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <tr>
                    <th style={{ padding: '16px 24px' }}>Bill No</th>
                    <th style={{ padding: '16px 24px' }}>Customer</th>
                    <th style={{ padding: '16px 24px' }}>Date</th>
                    <th style={{ padding: '16px 24px' }}>Items</th>
                    <th style={{ padding: '16px 24px' }}>Amount</th>
                    <th style={{ padding: '16px 24px' }}>Discount</th>
                    <th style={{ padding: '16px 24px' }}>Status</th>
                    <th style={{ padding: '16px 24px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentBills.map((b, i) => {
                    const gst = b.items?.reduce((s, it) => s + (it.quantity * it.rate * ((it.gstPercent || it.gst_percent || 0)/100)), 0) || 0
                    
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#2563EB' }}>{b.bill_number}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, color: 'var(--text-primary)' }}>{b.customer_name || 'Walk-in'}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, color: 'var(--text-muted)' }}>{formatDate(b.created_at)}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, color: 'var(--text-muted)' }}>{b.items?.length || 0}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(b.grand_total)}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, color: 'var(--text-muted)' }}>{formatCurrency(b.discount)}</td>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{ 
                            fontSize: 12, fontWeight: 600, padding: '4px 8px', borderRadius: 4,
                            background: b.payment_status === 'Paid' ? '#EFF6FF' : b.payment_status === 'Partial' ? '#FFFBEB' : '#FEF2F2',
                            color: b.payment_status === 'Paid' ? '#2563EB' : b.payment_status === 'Partial' ? '#D97706' : '#DC2626'
                          }}>
                            {b.payment_status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <button 
                            onClick={() => generateBillPDF(b)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-main)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}
                          >
                            <FileDown size={14} /> PDF
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {data.recentBills.length === 0 && (
                    <tr><td colSpan="8" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No recent bills!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── UNPAID / CANCELLED BILLS TABLE ── */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Unpaid & Cancelled Bills</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: 'var(--bg-main)', fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <tr>
                    <th style={{ padding: '16px 24px' }}>Bill No</th>
                    <th style={{ padding: '16px 24px' }}>Customer</th>
                    <th style={{ padding: '16px 24px' }}>Amount</th>
                    <th style={{ padding: '16px 24px' }}>Created</th>
                    <th style={{ padding: '16px 24px' }}>Days Pending</th>
                    <th style={{ padding: '16px 24px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.unpaidBills.map((b, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#2563EB' }}>{b.bill_number}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: 'var(--text-primary)' }}>{b.customer_name || 'Walk-in'}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#DC2626' }}>{formatCurrency(b.grand_total)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: 'var(--text-muted)' }}>{formatDate(b.created_at)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: b.daysPending > 7 ? '#DC2626' : '#D97706', fontWeight: 600 }}>
                        {b.daysPending} days
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ 
                          fontSize: 12, fontWeight: 600, padding: '4px 8px', borderRadius: 4,
                          background: b.payment_status === 'Cancelled' ? '#F1F5F9' : '#FEF2F2',
                          color: b.payment_status === 'Cancelled' ? '#64748B' : '#DC2626'
                        }}>
                          {b.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {data.unpaidBills.length === 0 && (
                    <tr><td colSpan="6" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No unpaid bills!</td></tr>
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

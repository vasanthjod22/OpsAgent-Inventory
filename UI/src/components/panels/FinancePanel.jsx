import React, { useState, useRef, useEffect, useMemo } from 'react'
import { callAI } from '../../utils/api'
import {
  Upload, FileText, Loader2, AlertTriangle,
  X, CheckCircle, AlertCircle, Sparkles,
  TrendingUp, TrendingDown, DollarSign, Download,
  BarChart3, Receipt, PieChart
} from 'lucide-react'
import SummaryCard from '../SummaryCard'

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(line => {
    const cells = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = '' }
      else cur += ch
    }
    cells.push(cur.trim())
    return headers.reduce((acc, h, i) => ({ ...acc, [h]: cells[i] ?? '' }), {})
  })
  return { headers, rows }
}

function TopExpenses({ categories }) {
  if (!categories?.length) return null
  const max = Math.max(...categories.map(c => c.amount))
  const colors = ['#2563EB', '#7C3AED', '#0891B2', '#059669', '#D97706']
  return (
    <div className="glass-card hover-up" style={{ borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '20px', fontFamily: "'Inter', sans-serif" }}>
        Top Expenses by Category
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {categories.map((cat, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '140px', fontSize: '13px', color: '#64748B', fontWeight: 500, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Inter', sans-serif" }}>
              {cat.category}
            </span>
            <div style={{ flex: 1, height: '8px', background: '#F1F5F9', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(cat.amount / max) * 100}%`,
                background: colors[i % colors.length],
                borderRadius: '99px',
                transition: 'width 0.6s ease',
              }} />
            </div>
            <span style={{ width: '90px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#0F172A', flexShrink: 0, fontFamily: "'Inter', sans-serif" }}>
              ₹{Number(cat.amount).toLocaleString('en-IN')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AlertBadge({ alert }) {
  const severity = alert.severity?.toLowerCase()
  const isRed = severity === 'high' || severity === 'critical' || severity === 'error'
  return (
    <div
      className="glass-card hover-up"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        padding: '14px 16px',
        borderLeft: `4px solid ${isRed ? '#DC2626' : '#D97706'}`,
        borderRadius: '0 8px 8px 0',
      }}>
      {isRed
        ? <AlertCircle size={17} color="#DC2626" style={{ marginTop: '1px', flexShrink: 0 }} />
        : <AlertTriangle size={17} color="#D97706" style={{ marginTop: '1px', flexShrink: 0 }} />
      }
      <div>
        {alert.title && (
          <p style={{ fontSize: '13px', fontWeight: 700, marginBottom: '3px', color: isRed ? '#DC2626' : '#D97706', fontFamily: "'Inter', sans-serif" }}>
            {alert.title}
          </p>
        )}
        <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#64748B', fontFamily: "'Inter', sans-serif" }}>
          {alert.message || alert}
        </p>
      </div>
    </div>
  )
}

function CSVPreview({ headers, rows }) {
  return (
    <div className="glass-card hover-up" style={{ borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((row, i) => (
              <tr key={i}>{headers.map(h => <td key={h}>{row[h]}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 5 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F5F9', fontSize: '12px', color: '#94A3B8', fontFamily: "'Inter', sans-serif" }}>
          Showing first 5 of {rows.length} rows
        </div>
      )}
    </div>
  )
}

function SkeletonLoader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px' }}>
      <div style={{ display: 'flex', gap: '16px' }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '120px', flex: 1 }} />)}
      </div>
      <div className="skeleton" style={{ height: '200px', width: '100%' }} />
    </div>
  )
}

function CSSDonut({ data }) {
  const total = data.reduce((s,d) => s + d.value, 0)
  if (!total) return <div style={{ width: '150px', height: '150px', borderRadius: '50%', background: '#F1F5F9' }} />
  let acc = 0
  const colors = ['#2563EB', '#7C3AED', '#D97706', '#059669', '#64748B']
  const gradient = data.map((d, i) => {
    const start = acc
    acc += (d.value / total) * 100
    return `${colors[i % colors.length]} ${start}% ${acc}%`
  }).join(', ')

  return (
    <div style={{ width: '150px', height: '150px', borderRadius: '50%', background: `conic-gradient(${gradient})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'white' }} />
    </div>
  )
}

const SYSTEM_PROMPT = `You are a financial analyst for a small service business. Analyze this accounting CSV data and return a weekly summary with: total revenue, total expenses, top 5 expense categories, overdue receivables, upcoming payables, and 2-3 anomaly alerts. Format as structured JSON.

Return ONLY a raw JSON object (no markdown, no code fences) with this exact structure:
{
  "total_revenue": <number>,
  "total_expenses": <number>,
  "top_expense_categories": [{"category": string, "amount": number}],
  "overdue_receivables": [{"client": string, "amount": number, "due_date": string}],
  "upcoming_payables": [{"vendor": string, "amount": number, "due_date": string}],
  "anomaly_alerts": [{"title": string, "message": string, "severity": "high"|"medium"|"low"}]
}`

export default function FinancePanel({ financeSummary: summary, setFinanceSummary: setSummary, bills = [], transactions = [], showToast }) {
  const fileRef = useRef()
  const [csvData, setCsvData] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [taxRate, setTaxRate] = useState(18)
  const [activeTab, setActiveTab] = useState('Overview')
  
  const [taxPeriod, setTaxPeriod] = useState('This Month')
  const [plPeriod, setPlPeriod] = useState('This Month')

  const handleDragOver  = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)
  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]; if (f) processFile(f)
  }
  const handleFileSelect = (e) => { const f = e.target.files[0]; if (f) processFile(f) }

  const processFile = (file) => {
    setFileName(file.name)
    setSummary(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const parsed = parseCSV(text)
      setCsvData({ ...parsed, raw: text })
    }
    reader.readAsText(file)
  }

  const generateSummary = async () => {
    if (!csvData?.raw) return
    setLoading(true); setSummary(null); setError(null)
    try {
      const text = await callAI(
        null,
        [{ role: 'user', content: `Analyze this accounting data and return a financial summary as JSON. Data:\n\n${csvData.raw}` }],
        `You are a financial analyst for a small service business. Return ONLY a raw JSON object (no markdown, no code fences) with this exact structure: {"total_revenue": <number>, "total_expenses": <number>, "top_expense_categories": [{"category": string, "amount": number}], "overdue_receivables": [{"client": string, "amount": number, "due_date": string}], "upcoming_payables": [{"vendor": string, "amount": number, "due_date": string}], "anomaly_alerts": [{"title": string, "message": string, "severity": "high"|"medium"|"low"}]}`
      )
      const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
      let parsed
      try { parsed = JSON.parse(cleaned) } catch { throw new Error('AI returned malformed data.') }
      setSummary(parsed)
      showToast?.('Finance summary generated', 'success', 'AI Analysis Complete')
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.')
      showToast?.('Error processing document', 'error', 'Analysis Failed')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setCsvData(null); setFileName(null); setSummary(null)
    setError(null); setLoading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const fmtINR = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  // Date Filtering Logic
  const filterByPeriod = (data, dateField, period) => {
    const now = new Date()
    return data.filter(d => {
      if (!d[dateField]) return false
      const dt = new Date(d[dateField])
      if (period === 'This Month') return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()
      if (period === 'Last Month') {
        const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        return dt.getMonth() === last.getMonth() && dt.getFullYear() === last.getFullYear()
      }
      if (period === 'This Quarter') {
        const q = Math.floor(now.getMonth() / 3)
        return Math.floor(dt.getMonth() / 3) === q && dt.getFullYear() === now.getFullYear()
      }
      if (period === 'Last Quarter') {
        let q = Math.floor(now.getMonth() / 3) - 1
        let y = now.getFullYear()
        if (q < 0) { q = 3; y-- }
        return Math.floor(dt.getMonth() / 3) === q && dt.getFullYear() === y
      }
      if (period === 'This Year') return dt.getFullYear() === now.getFullYear()
      return true
    })
  }

  // ---- TAX SUMMARY COMPUTATIONS ----
  const periodBills = useMemo(() => filterByPeriod(bills || [], 'date', taxPeriod), [bills, taxPeriod])
  
  const taxSummary = useMemo(() => {
    let totalTaxable = 0, totalCGST = 0, totalSGST = 0
    const rates = {}
    const hsnMap = {}

    periodBills.forEach(b => {
      (b.items || []).forEach(it => {
        const qty = parseFloat(it.quantity) || 0
        const rate = parseFloat(it.rate) || 0
        const cP = parseFloat(it.cgstPercent) || 0
        const sP = parseFloat(it.sgstPercent) || 0
        const gstP = parseFloat(it.gstPercent) || (cP + sP)
        
        let taxable = 0
        let cgst = 0
        let sgst = 0
        
        // Since item.amount contains the final amount including tax, we need base amount.
        // Or if rate * qty = taxable, then:
        taxable = qty * rate
        cgst = taxable * cP / 100
        sgst = taxable * sP / 100

        totalTaxable += taxable
        totalCGST += cgst
        totalSGST += sgst

        if (!rates[gstP]) rates[gstP] = { count: new Set(), taxable: 0, cgst: 0, sgst: 0 }
        rates[gstP].count.add(b.id)
        rates[gstP].taxable += taxable
        rates[gstP].cgst += cgst
        rates[gstP].sgst += sgst

        if (it.hsnCode) {
          if (!hsnMap[it.hsnCode]) hsnMap[it.hsnCode] = { desc: it.description, qty: 0, taxable: 0, gstP, tax: 0 }
          hsnMap[it.hsnCode].qty += qty
          hsnMap[it.hsnCode].taxable += taxable
          hsnMap[it.hsnCode].tax += (cgst + sgst)
        }
      })
    })
    return { totalTaxable, totalCGST, totalSGST, rates, hsnMap }
  }, [periodBills])

  // ---- P&L COMPUTATIONS ----
  const plBills = useMemo(() => filterByPeriod(bills || [], 'date', plPeriod), [bills, plPeriod])
  const plTx = useMemo(() => filterByPeriod(transactions || [], 'date', plPeriod), [transactions, plPeriod])

  const plSummary = useMemo(() => {
    let revenue = 0
    let expenses = 0
    const monthsMap = {}
    const catMap = {}

    plBills.forEach(b => {
      if (b.paymentStatus === 'Paid') {
        const amt = parseFloat(b.grandTotal) || 0
        revenue += amt
        const m = b.date ? b.date.substring(0, 7) : 'Unknown'
        if (!monthsMap[m]) monthsMap[m] = { rev: 0, exp: 0 }
        monthsMap[m].rev += amt
      }
    })

    plTx.forEach(t => {
      if (t.type === 'Expense') {
        const amt = parseFloat(t.amount) || 0
        expenses += amt
        const m = t.date ? t.date.substring(0, 7) : 'Unknown'
        if (!monthsMap[m]) monthsMap[m] = { rev: 0, exp: 0 }
        monthsMap[m].exp += amt

        const c = t.category || 'Others'
        catMap[c] = (catMap[c] || 0) + amt
      }
    })

    const net = revenue - expenses
    const months = Object.entries(monthsMap)
      .map(([k, v]) => ({ month: k, rev: v.rev, exp: v.exp, net: v.rev - v.exp }))
      .sort((a,b) => a.month.localeCompare(b.month))
    
    const expCategories = Object.entries(catMap)
      .map(([k, v]) => ({ name: k, value: v }))
      .sort((a,b) => b.value - a.value).slice(0, 5)

    return { revenue, expenses, net, months, expCategories }
  }, [plBills, plTx])

  const downloadCSV = (content, filename) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportTaxReport = () => {
    let csv = 'GST Rate,No. of Bills,Taxable Amt,CGST,SGST,Total Tax\n'
    Object.entries(taxSummary.rates).forEach(([r, v]) => {
      csv += `${r}%,${v.count.size},${v.taxable},${v.cgst},${v.sgst},${v.cgst + v.sgst}\n`
    })
    csv += `TOTAL,${periodBills.length},${taxSummary.totalTaxable},${taxSummary.totalCGST},${taxSummary.totalSGST},${taxSummary.totalCGST + taxSummary.totalSGST}\n`
    downloadCSV(csv, `TaxReport_${taxPeriod.replace(/\s/g, '')}.csv`)
  }

  const exportPLReport = () => {
    let csv = 'Month,Revenue,Expenses,Profit/Loss,Margin %\n'
    plSummary.months.forEach(m => {
      const margin = m.rev ? Math.round((m.net / m.rev) * 100) : 0
      csv += `${m.month},${m.rev},${m.exp},${m.net},${margin}%\n`
    })
    downloadCSV(csv, `ProfitLoss_${plPeriod.replace(/\s/g, '')}.csv`)
  }

  const uploadZoneStyle = {
    background: dragging ? '#EFF6FF' : 'white',
    border: `2px dashed ${dragging ? '#2563EB' : '#CBD5E1'}`,
    borderRadius: '12px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '48px 32px', gap: '16px', cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s',
  }

  const TABS = [
    { id: 'Overview', icon: BarChart3 },
    { id: 'Tax Summary', icon: Receipt },
    { id: 'Profit & Loss', icon: TrendingUp }
  ]

  const formatMonth = (m) => {
    if (m === 'Unknown') return m
    const d = new Date(m + '-01')
    return d.toLocaleString('default', { month: 'short', year: 'numeric' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      
      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', borderRadius: '8px',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              background: activeTab === tab.id ? '#2563EB' : 'white',
              color: activeTab === tab.id ? 'white' : '#64748B',
              border: activeTab === tab.id ? '1px solid #2563EB' : '1px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            <tab.icon size={16} /> {tab.id}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Upload / File Preview Section */}
          {!csvData ? (
            <div
              style={uploadZoneStyle}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !loading && fileRef.current.click()}
            >
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" disabled={loading} onChange={handleFileSelect} />
              <Upload size={48} color="#94A3B8" />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', marginBottom: '6px' }}>Drop your accounting CSV here</p>
                <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '20px' }}>Supports exports from Tally, QuickBooks, Excel</p>
                <button
                  onClick={e => { e.stopPropagation(); !loading && fileRef.current.click() }}
                  className="btn-press"
                  style={{ padding: '8px 20px', border: '1.5px solid #2563EB', color: '#2563EB', borderRadius: '8px', fontSize: '13px', fontWeight: 500, background: 'transparent', cursor: 'pointer' }}
                >
                  Browse Files
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle size={18} color="#16A34A" />
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#15803D' }}>{fileName}</p>
                    <p style={{ fontSize: '12px', color: '#4ADE80' }}>{csvData.rows.length} rows loaded</p>
                  </div>
                </div>
                <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16A34A' }}><X size={18} /></button>
              </div>
              <CSVPreview headers={csvData.headers} rows={csvData.rows} />
              {!summary && !loading && (
                <button onClick={generateSummary} className="btn-press" style={{ width: '100%', height: '44px', borderRadius: '8px', background: '#2563EB', color: 'white', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none', cursor: 'pointer' }}>
                  <Sparkles size={17} /> Generate AI Summary
                </button>
              )}
            </div>
          )}

          {loading && <SkeletonLoader />}
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px' }}>
              <AlertCircle size={17} color="#DC2626" style={{ marginTop: '1px' }} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#DC2626', marginBottom: '2px' }}>Analysis Failed</p>
                <p style={{ fontSize: '13px', color: '#B91C1C' }}>{error}</p>
              </div>
            </div>
          )}

          {summary && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <SummaryCard id="finance-rev" icon={TrendingUp} title="Total Revenue" value={`₹${fmtINR(summary.total_revenue)}`} trend="up" trendValue="This period" colors={{ bg: '#F0FDF4', text: '#16A34A' }} />
                <SummaryCard id="finance-exp" icon={TrendingDown} title="Total Expenses" value={`₹${fmtINR(summary.total_expenses)}`} trend="down" trendValue="This period" colors={{ bg: '#FEF2F2', text: '#DC2626' }} />
                <SummaryCard id="finance-gross" icon={DollarSign} title="Gross Cash Flow" value={`₹${fmtINR(Math.abs((Number(summary.total_revenue)||0) - (Number(summary.total_expenses)||0)))}`} trend={(Number(summary.total_revenue)||0) - (Number(summary.total_expenses)||0) >= 0 ? 'up' : 'down'} trendValue="Analysis" colors={{ bg: '#EFF6FF', text: '#2563EB' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                <TopExpenses categories={summary.top_expense_categories} />
                {summary.anomaly_alerts?.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>System Alerts</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {summary.anomaly_alerts.map((alert, i) => <AlertBadge key={i} alert={alert} />)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'Tax Summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <select value={taxPeriod} onChange={e => setTaxPeriod(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', outline: 'none', background: 'white' }}>
              {['This Month', 'Last Month', 'This Quarter', 'Last Quarter', 'This Year'].map(o => <option key={o}>{o}</option>)}
            </select>
            <button onClick={exportTaxReport} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#0F172A' }}>
              <Download size={14} /> Export Tax Report
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <SummaryCard icon={DollarSign} title="Taxable Amount" value={`₹${fmtINR(taxSummary.totalTaxable)}`} trend="neutral" trendValue={taxPeriod} colors={{ bg: '#EFF6FF', text: '#2563EB' }} />
            <SummaryCard icon={Receipt} title="CGST Collected" value={`₹${fmtINR(taxSummary.totalCGST)}`} trend="neutral" trendValue={taxPeriod} colors={{ bg: '#F3E8FF', text: '#9333EA' }} />
            <SummaryCard icon={Receipt} title="SGST Collected" value={`₹${fmtINR(taxSummary.totalSGST)}`} trend="neutral" trendValue={taxPeriod} colors={{ bg: '#EEF2FF', text: '#4F46E5' }} />
            <SummaryCard icon={Receipt} title="Total GST Collected" value={`₹${fmtINR(taxSummary.totalCGST + taxSummary.totalSGST)}`} trend="neutral" trendValue={taxPeriod} colors={{ bg: '#F0FDF4', text: '#16A34A' }} />
          </div>

          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Tax Rate Breakdown</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                  <th style={{ padding: '8px' }}>GST Rate</th>
                  <th style={{ padding: '8px' }}>No. of Bills</th>
                  <th style={{ padding: '8px' }}>Taxable Amt</th>
                  <th style={{ padding: '8px' }}>CGST</th>
                  <th style={{ padding: '8px' }}>SGST</th>
                  <th style={{ padding: '8px' }}>Total Tax</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(taxSummary.rates).map(([r, v]) => (
                  <tr key={r} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{r}%</td>
                    <td style={{ padding: '12px 8px' }}>{v.count.size}</td>
                    <td style={{ padding: '12px 8px' }}>₹{fmtINR(v.taxable)}</td>
                    <td style={{ padding: '12px 8px' }}>₹{fmtINR(v.cgst)}</td>
                    <td style={{ padding: '12px 8px' }}>₹{fmtINR(v.sgst)}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 700 }}>₹{fmtINR(v.cgst + v.sgst)}</td>
                  </tr>
                ))}
                <tr style={{ background: '#F8FAFC', fontWeight: 700 }}>
                  <td style={{ padding: '12px 8px' }}>TOTAL</td>
                  <td style={{ padding: '12px 8px' }}>{periodBills.length}</td>
                  <td style={{ padding: '12px 8px' }}>₹{fmtINR(taxSummary.totalTaxable)}</td>
                  <td style={{ padding: '12px 8px' }}>₹{fmtINR(taxSummary.totalCGST)}</td>
                  <td style={{ padding: '12px 8px' }}>₹{fmtINR(taxSummary.totalSGST)}</td>
                  <td style={{ padding: '12px 8px' }}>₹{fmtINR(taxSummary.totalCGST + taxSummary.totalSGST)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {Object.keys(taxSummary.hsnMap).length > 0 && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>HSN Wise Summary</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                    <th style={{ padding: '8px' }}>HSN Code</th>
                    <th style={{ padding: '8px' }}>Description</th>
                    <th style={{ padding: '8px' }}>Qty</th>
                    <th style={{ padding: '8px' }}>Taxable</th>
                    <th style={{ padding: '8px' }}>GST%</th>
                    <th style={{ padding: '8px' }}>Tax Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(taxSummary.hsnMap).map(([hsn, v]) => (
                    <tr key={hsn} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 600 }}>{hsn}</td>
                      <td style={{ padding: '12px 8px' }}>{v.desc}</td>
                      <td style={{ padding: '12px 8px' }}>{v.qty}</td>
                      <td style={{ padding: '12px 8px' }}>₹{fmtINR(v.taxable)}</td>
                      <td style={{ padding: '12px 8px' }}>{v.gstP}%</td>
                      <td style={{ padding: '12px 8px', fontWeight: 700 }}>₹{fmtINR(v.tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'Profit & Loss' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <select value={plPeriod} onChange={e => setPlPeriod(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', outline: 'none', background: 'white' }}>
              {['This Month', 'Last Month', 'This Quarter', 'Last Quarter', 'This Year'].map(o => <option key={o}>{o}</option>)}
            </select>
            <button onClick={exportPLReport} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#0F172A' }}>
              <Download size={14} /> Export P&L Report
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <SummaryCard icon={TrendingUp} title="Total Revenue" value={`₹${fmtINR(plSummary.revenue)}`} trend="up" trendValue={plPeriod} colors={{ bg: '#F0FDF4', text: '#16A34A' }} />
            <SummaryCard icon={TrendingDown} title="Total Expenses" value={`₹${fmtINR(plSummary.expenses)}`} trend="down" trendValue={plPeriod} colors={{ bg: '#FEF2F2', text: '#DC2626' }} />
            <div style={{ padding: '24px', background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: plSummary.net >= 0 ? '#16A34A' : '#DC2626', textTransform: 'uppercase' }}>
                {plSummary.net >= 0 ? 'Net Profit' : 'Net Loss'}
              </span>
              <span style={{ fontSize: '28px', fontWeight: 800, color: plSummary.net >= 0 ? '#16A34A' : '#DC2626' }}>
                {plSummary.net < 0 ? '-' : ''}₹{fmtINR(Math.abs(plSummary.net))} {plSummary.net >= 0 ? 'profit' : 'loss'}
              </span>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '24px' }}>Profit Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(() => {
                const max = Math.max(plSummary.revenue, plSummary.expenses, Math.abs(plSummary.net)) || 1;
                return [
                  { label: 'Revenue', val: plSummary.revenue, color: '#16A34A', bg: '#DCFCE7' },
                  { label: 'Expenses', val: plSummary.expenses, color: '#DC2626', bg: '#FEE2E2' },
                  { label: plSummary.net >= 0 ? 'Net Profit' : 'Net Loss', val: plSummary.net, color: plSummary.net >= 0 ? '#2563EB' : '#DC2626', bg: plSummary.net >= 0 ? '#DBEAFE' : '#FEE2E2' }
                ].map(b => (
                  <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ width: '80px', fontSize: '13px', color: '#64748B', fontWeight: 600 }}>{b.label}</span>
                    <div style={{ flex: 1, height: '24px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ height: '100%', width: `${Math.max(0, (Math.abs(b.val) / max) * 100)}%`, background: b.color, borderRadius: '4px', transition: 'width 1s ease-out' }} />
                    </div>
                    <span style={{ width: '100px', textAlign: 'right', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                      {b.val < 0 ? '-' : ''}₹{fmtINR(Math.abs(b.val))}
                    </span>
                  </div>
                ))
              })()}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Monthly Breakdown</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                    <th style={{ padding: '8px' }}>Month</th>
                    <th style={{ padding: '8px' }}>Revenue</th>
                    <th style={{ padding: '8px' }}>Expenses</th>
                    <th style={{ padding: '8px' }}>Profit/Loss</th>
                    <th style={{ padding: '8px' }}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {plSummary.months.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#94A3B8' }}>No data available for this period</td></tr>
                  )}
                  {plSummary.months.map(m => {
                    const isProfit = m.net >= 0
                    const margin = m.rev ? Math.round((m.net / m.rev) * 100) : 0
                    return (
                      <tr key={m.month} style={{ borderBottom: '1px solid #F1F5F9', background: isProfit ? '#F0FDF4' : '#FEF2F2' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>{formatMonth(m.month)}</td>
                        <td style={{ padding: '12px 8px' }}>₹{fmtINR(m.rev)}</td>
                        <td style={{ padding: '12px 8px' }}>₹{fmtINR(m.exp)}</td>
                        <td style={{ padding: '12px 8px', fontWeight: 700, color: isProfit ? '#16A34A' : '#DC2626' }}>
                          {isProfit ? '' : '-'}₹{fmtINR(Math.abs(m.net))} {isProfit ? '✅' : '❌'}
                        </td>
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>{margin}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Expense Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                <CSSDonut data={plSummary.expCategories} />
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {plSummary.expCategories.map((c, i) => {
                    const colors = ['#2563EB', '#7C3AED', '#D97706', '#059669', '#64748B']
                    const p = plSummary.expenses ? Math.round((c.value / plSummary.expenses) * 100) : 0
                    return (
                      <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: colors[i % colors.length] }} />
                          <span style={{ fontWeight: 600, color: '#0F172A' }}>{c.name}</span>
                        </div>
                        <div style={{ color: '#64748B' }}>
                          ₹{fmtINR(c.value)} <span style={{ fontSize: '11px', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>{p}%</span>
                        </div>
                      </div>
                    )
                  })}
                  {plSummary.expCategories.length === 0 && <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No expenses found</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

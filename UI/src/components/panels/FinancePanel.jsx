import { useState, useRef, useEffect, useMemo } from 'react'
import { callAI } from '../../utils/api'
import {
  Upload, FileText, Loader2, AlertTriangle,
  X, CheckCircle, AlertCircle, Sparkles,
  TrendingUp, TrendingDown, DollarSign
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

export default function FinancePanel({ apiKey, financeSummary: summary, setFinanceSummary: setSummary, showToast }) {
  const fileRef = useRef()
  const [csvData, setCsvData] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)

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
    if (!apiKey) {
      setError('Please add your Gemini API key in Settings first.')
      showToast?.('API key required — go to Settings', 'warning', 'Missing API Key')
      return
    }
    setLoading(true); setSummary(null); setError(null)
    try {
      const text = await callAI(
        apiKey,
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

  const revenue    = Number(summary?.total_revenue) || 0
  const expenses   = Number(summary?.total_expenses) || 0
  const netCashFlow = revenue - expenses
  const overdueAmount = summary?.overdue_receivables?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0

  const uploadZoneStyle = {
    background: dragging ? '#EFF6FF' : 'white',
    border: `2px dashed ${dragging ? '#2563EB' : '#CBD5E1'}`,
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 32px',
    gap: '16px',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>

      {/* Upload / File Preview Section */}
      {!csvData ? (
        <div
          style={uploadZoneStyle}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onMouseEnter={e => { if (!dragging) { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.background = '#EFF6FF' }}}
          onMouseLeave={e => { if (!dragging) { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.background = 'white' }}}
          onClick={() => !loading && fileRef.current.click()}
        >
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" disabled={loading} onChange={handleFileSelect} />
          <Upload size={48} color="#94A3B8" />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }}>
              Drop your accounting CSV here
            </p>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '20px', fontFamily: "'Inter', sans-serif" }}>
              Supports exports from Tally, QuickBooks, Excel
            </p>
            <button
              onClick={e => { e.stopPropagation(); !loading && fileRef.current.click() }}
              className="btn-press"
              style={{
                padding: '8px 20px',
                border: '1.5px solid #2563EB',
                color: '#2563EB',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              Browse Files
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* File Banner */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: '10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={18} color="#16A34A" />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#15803D', fontFamily: "'Inter', sans-serif" }}>{fileName}</p>
                <p style={{ fontSize: '12px', color: '#4ADE80', fontFamily: "'Inter', sans-serif" }}>{csvData.rows.length} rows loaded</p>
              </div>
            </div>
            <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16A34A' }}>
              <X size={18} />
            </button>
          </div>

          <CSVPreview headers={csvData.headers} rows={csvData.rows} />

          {!summary && !loading && (
            <button
              onClick={generateSummary}
              className="btn-press"
              style={{
                width: '100%', height: '44px',
                borderRadius: '8px',
                background: '#2563EB',
                color: 'white',
                fontWeight: 600, fontSize: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                fontFamily: "'Inter', sans-serif",
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1D4ED8'}
              onMouseLeave={e => e.currentTarget.style.background = '#2563EB'}
            >
              <Sparkles size={17} /> Generate AI Summary
            </button>
          )}
        </div>
      )}

      {loading && <SkeletonLoader />}

      {error && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '12px',
          padding: '14px 16px',
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '10px',
        }}>
          <AlertCircle size={17} color="#DC2626" style={{ marginTop: '1px' }} />
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#DC2626', marginBottom: '2px', fontFamily: "'Inter', sans-serif" }}>Analysis Failed</p>
            <p style={{ fontSize: '13px', color: '#B91C1C', fontFamily: "'Inter', sans-serif" }}>{error}</p>
          </div>
        </div>
      )}

      {summary && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <SummaryCard id="finance-rev" icon={TrendingUp} title="Total Revenue"
              value={`₹${revenue.toLocaleString('en-IN')}`}
              trend="up" trendValue="This period"
              colors={{ bg: '#F0FDF4', text: '#16A34A' }} />
            <SummaryCard id="finance-exp" icon={TrendingDown} title="Total Expenses"
              value={`₹${expenses.toLocaleString('en-IN')}`}
              trend="down" trendValue="This period"
              colors={{ bg: '#FEF2F2', text: '#DC2626' }} />
            <SummaryCard id="finance-net" icon={DollarSign} title="Net Cash Flow"
              value={`₹${Math.abs(netCashFlow).toLocaleString('en-IN')}`}
              trend={netCashFlow >= 0 ? 'up' : 'down'} trendValue={netCashFlow >= 0 ? 'Positive' : 'Negative'}
              colors={{ bg: '#EFF6FF', text: '#2563EB' }} />
            <SummaryCard id="finance-over" icon={AlertTriangle} title="Overdue Amount"
              value={`₹${overdueAmount.toLocaleString('en-IN')}`}
              trend="neutral" trendValue="Needs action"
              colors={{ bg: '#FFFBEB', text: '#D97706' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            <TopExpenses categories={summary.top_expense_categories} />

            {summary.anomaly_alerts?.length > 0 && (
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '16px', fontFamily: "'Inter', sans-serif" }}>
                  System Alerts
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {summary.anomaly_alerts.map((alert, i) => <AlertBadge key={i} alert={alert} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

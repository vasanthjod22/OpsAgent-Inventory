import { useState, useEffect, useMemo } from 'react'
import {
  BarChart2, Calendar, Download, TrendingUp, AlertCircle,
  Package, Receipt, Users, FileText, CheckCircle, FileCheck,
  RefreshCw, Copy, Archive
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import FormattedAIResponse from '../ui/FormattedAIResponse'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

/* ─── Helpers ─────────────────────────────────────────────────── */
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtDate = (d) => {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return d }
}
const generateReportId = (type, period) => {
  const types = { sales: 'SR', inventory: 'IR', gst: 'GR', customers: 'CR' }
  const prefix = types[type] || 'RPT'
  const timestamp = Date.now().toString().slice(-6)
  const year = new Date().getFullYear()
  return `${prefix}-${year}-${timestamp}`
}

const StatCard = ({ icon: Icon, label, value, color, bg, subtext }) => (
  <div style={{ background: bg, border: `1px solid ${color}22`, borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
    <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={20} color={color} />
    </div>
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, fontWeight: 600 }}>{label}</div>
      {subtext && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{subtext}</div>}
    </div>
  </div>
)

const Btn = ({ children, onClick, variant = 'secondary', small = false, icon: Icon }) => {
  const styles = {
    primary: { background: '#2563EB', color: 'white', border: 'none' },
    secondary: { background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0' },
    ghost: { background: 'transparent', color: '#64748B', border: '1px solid #E2E8F0' },
  }
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: small ? '5px 12px' : '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: small ? 12 : 13, fontWeight: 600, fontFamily: "'Inter', sans-serif", transition: 'all 0.15s', ...styles[variant] }} onMouseEnter={e => e.currentTarget.style.opacity = '0.85'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
      {Icon && <Icon size={small ? 13 : 15} />} {children}
    </button>
  )
}

/* ─── Main ReportsPanel ───────────────────────────────────────── */
export default function ReportsPanel({ bills = [], quotations = [], inventory = [], grnHistory = [], customers = [], showToast }) {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('opsagent_reports_tab')
    if (saved) {
      localStorage.removeItem('opsagent_reports_tab')
      return saved
    }
    return 'sales'
  })
  const [period, setPeriod] = useState('this_month') // this_week, this_month, this_quarter, this_year, custom
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [reportHistory, setReportHistory] = useState([])
  const [companySettings, setCompanySettings] = useState({})

  // Load company and history
  useEffect(() => {
    try {
      const s = localStorage.getItem('opsagent_company')
      if (s) setCompanySettings(JSON.parse(s))
    } catch {}
    
    backendFetch('/reports')
      .then(res => setReportHistory(res || []))
      .catch(console.error)
  }, [])

  // Calculate Date Range
  const { start, end } = useMemo(() => {
    const now = new Date()
    let s = new Date(), e = new Date()
    
    if (period === 'this_week') {
      const day = now.getDay(), diff = now.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
      s = new Date(now.setDate(diff))
    } else if (period === 'this_month') {
      s = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (period === 'this_quarter') {
      const q = Math.floor(now.getMonth() / 3)
      s = new Date(now.getFullYear(), q * 3, 1)
    } else if (period === 'this_year') {
      s = new Date(now.getFullYear(), 0, 1)
    } else if (period === 'custom') {
      if (dateFrom) s = new Date(dateFrom)
      if (dateTo) e = new Date(dateTo)
    }
    
    // reset times
    s.setHours(0,0,0,0)
    e.setHours(23,59,59,999)
    return { start: s, end: e }
  }, [period, dateFrom, dateTo])

  // Filter Data
  const fBills = useMemo(() => bills.filter(b => { const d = new Date(b.date); return d >= start && d <= end }), [bills, start, end])
  const fQuotes = useMemo(() => quotations.filter(q => { const d = new Date(q.date); return d >= start && d <= end }), [quotations, start, end])
  const fGrn = useMemo(() => grnHistory.filter(g => { const d = new Date(g.date); return d >= start && d <= end }), [grnHistory, start, end])

  /* ─── PDF EXPORT LOGIC ───────────────────────────────────────── */
  const exportPDF = async (type) => {
    const rid = generateReportId(type, period)
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width
    
    // Header
    doc.setFillColor(15, 23, 42) // #0F172A
    doc.rect(0, 0, pageWidth, 30, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text(companySettings.name || 'OpsAgent', 14, 14)
    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    doc.text(`REPORT — ${type.toUpperCase()}`, 14, 22)
    
    doc.setFontSize(10)
    doc.text(`Report ID: ${rid}`, pageWidth - 14, 12, { align: 'right' })
    doc.text(`Period: ${fmtDate(start)} to ${fmtDate(end)}`, pageWidth - 14, 18, { align: 'right' })
    doc.text(`Generated: ${fmtDate(new Date())}`, pageWidth - 14, 24, { align: 'right' })

    // Build Content based on Type
    doc.setTextColor(15, 23, 42)
    let yPos = 40

    if (type === 'sales') {
      const revenue = fBills.reduce((s, b) => s + (b.paymentStatus === 'Paid' ? (b.grandTotal||0) : 0), 0)
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("Sales Summary", 14, yPos)
      yPos += 8
      doc.setFontSize(11)
      doc.setFont("helvetica", "normal")
      doc.text(`Total Revenue: ${fmt(revenue)}`, 14, yPos)
      doc.text(`Total Bills: ${fBills.length}`, 80, yPos)
      yPos += 12

      // Top Customers
      const custData = customers.map(c => [c.name, c.bills?.length || 0, fmt(c.totalPurchases), fmt(c.outstanding)])
      doc.autoTable({
        startY: yPos,
        head: [['Customer', 'Bills', 'Revenue', 'Outstanding']],
        body: custData.slice(0, 10),
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] }
      })
      yPos = doc.lastAutoTable.finalY + 15
    } else if (type === 'inventory') {
      const totalValue = inventory.reduce((s, i) => s + (i.qty * (i.rate||0) * (1 + (i.gst||0)/100)), 0)
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("Inventory Summary", 14, yPos)
      yPos += 8
      doc.setFontSize(11)
      doc.setFont("helvetica", "normal")
      doc.text(`Total Stock Value (Est): ${fmt(totalValue)}`, 14, yPos)
      yPos += 12

      const invData = inventory.map(i => [i.hsn, i.name, i.qty, i.qty < i.min ? 'Low' : 'OK'])
      doc.autoTable({
        startY: yPos,
        head: [['HSN', 'Item', 'Qty', 'Status']],
        body: invData,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] }
      })
      yPos = doc.lastAutoTable.finalY + 15
    } else if (type === 'gst') {
      let totCgst = 0, totSgst = 0
      fBills.forEach(b => (b.items||[]).forEach(i => {
        const base = (parseFloat(i.quantity)||0) * (parseFloat(i.rate)||0)
        totCgst += base * (parseFloat(i.cgstPercent)||0)/100
        totSgst += base * (parseFloat(i.sgstPercent)||0)/100
      }))
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("GST Summary", 14, yPos)
      yPos += 8
      doc.setFontSize(11)
      doc.setFont("helvetica", "normal")
      doc.text(`Total CGST: ${fmt(totCgst)}`, 14, yPos)
      doc.text(`Total SGST: ${fmt(totSgst)}`, 80, yPos)
      doc.text(`Total Tax: ${fmt(totCgst + totSgst)}`, 140, yPos)
      yPos += 12
      
      const billData = fBills.map(b => {
        let bCgst = 0, bSgst = 0
        ;(b.items||[]).forEach(i => {
          const base = (parseFloat(i.quantity)||0) * (parseFloat(i.rate)||0)
          bCgst += base * (parseFloat(i.cgstPercent)||0)/100
          bSgst += base * (parseFloat(i.sgstPercent)||0)/100
        })
        return [b.billNumber, fmtDate(b.date), fmt(b.grandTotal), fmt(bCgst), fmt(bSgst), fmt(bCgst + bSgst)]
      })
      doc.autoTable({
        startY: yPos,
        head: [['Bill No.', 'Date', 'Amount', 'CGST', 'SGST', 'Total Tax']],
        body: billData,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] }
      })
      yPos = doc.lastAutoTable.finalY + 15
    } else if (type === 'customers') {
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("Customers Summary", 14, yPos)
      yPos += 8
      doc.setFontSize(11)
      doc.setFont("helvetica", "normal")
      doc.text(`Total Customers: ${customers.length}`, 14, yPos)
      yPos += 12
      
      const custData = customers.map(c => [c.name, c.phone || '—', c.tags ? c.tags.join(', ') : '—', fmt(c.totalPurchases), fmt(c.outstanding)])
      doc.autoTable({
        startY: yPos,
        head: [['Name', 'Phone', 'Tags', 'Revenue', 'Outstanding']],
        body: custData,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] }
      })
      yPos = doc.lastAutoTable.finalY + 15
    }

    // Save history
    try {
      const summary = { totalBills: fBills.length, revenue: fBills.reduce((s,b)=>s+(b.grandTotal||0),0) }
      const res = await backendFetch('/reports', {
        method: 'POST',
        body: JSON.stringify({
          report_id: rid, report_type: type, period_from: start.toISOString(), period_to: end.toISOString(), summary
        })
      })
      setReportHistory(prev => [res, ...prev])
    } catch(e) { console.error('History save failed', e) }

    // Download
    const filename = `${rid}_${type}_${fmtDate(start)}.pdf`
    doc.save(filename)
    showToast(`Downloaded ${filename}`, 'success')
  }

  /* ─── AI INSIGHTS LOGIC ───────────────────────────────────────── */
  const [insight, setInsight] = useState(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [question, setQuestion] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  useEffect(() => {
    setInsight(null)
    setChatHistory([])
    setQuestion('')
  }, [activeTab])

  const getCurrentReportData = () => {
    switch(activeTab) {
      case 'sales': 
        return { 
          totalRevenue: fBills.reduce((s,b)=>s+(b.paymentStatus==='Paid'?(b.grandTotal||0):0),0), 
          outstanding: fBills.reduce((s, b) => s + ((b.paymentStatus||b.payment_status)==='Unpaid' ? (b.grandTotal||0) : 0), 0),
          totalBills: fBills.length,
          topCustomers: [...customers].sort((a,b) => b.totalPurchases - a.totalPurchases).slice(0, 5), 
          recentBills: fBills.slice(0, 10) 
        }
      case 'inventory': 
        return {
          totalValue: inventory.reduce((s, i) => s + (i.qty * (i.rate||0) * (1 + (i.gst||0)/100)), 0),
          lowStockCount: inventory.filter(i => i.qty < i.min).length,
          totalItems: inventory.length,
          topItemsByValue: [...inventory].sort((a,b) => (b.qty * (b.rate||0)) - (a.qty * (a.rate||0))).slice(0, 10),
          lowStockItems: inventory.filter(i => i.qty < i.min).slice(0, 10)
        }
      case 'gst': 
        let totCgst = 0, totSgst = 0
        fBills.forEach(b => (b.items||[]).forEach(i => {
          const base = (parseFloat(i.quantity)||0) * (parseFloat(i.rate)||0)
          totCgst += base * (parseFloat(i.cgstPercent)||0)/100
          totSgst += base * (parseFloat(i.sgstPercent)||0)/100
        }))
        return {
          totalCgst: totCgst,
          totalSgst: totSgst,
          totalTax: totCgst + totSgst,
          recentBillsWithTax: fBills.slice(0, 10).map(b => ({ billNumber: b.billNumber, total: b.grandTotal }))
        }
      case 'customers': 
        return {
          totalCustomers: customers.length,
          totalOutstanding: customers.reduce((s, c) => s + (c.outstanding || 0), 0),
          topCustomersByRevenue: [...customers].sort((a,b) => b.totalPurchases - a.totalPurchases).slice(0, 10),
          topCustomersByOutstanding: [...customers].sort((a,b) => (b.outstanding||0) - (a.outstanding||0)).slice(0, 10)
        }
      default: return []
    }
  }

  const generateInsight = async () => {
    setInsightLoading(true)
    try {
      const data = await backendFetch('/ai/report-insight', {
        method: 'POST',
        body: JSON.stringify({
          reportType: activeTab,
          reportData: getCurrentReportData()
        })
      })
      if (data.success) setInsight(data.insight)
    } catch (err) {
      console.error(err)
      setInsight(`⚠️ **Error Generating Insights**\n\n${err.message}`)
    } finally {
      setInsightLoading(false)
    }
  }

  const askQuestion = async () => {
    if (!question.trim()) return

    const userMsg = { role: 'user', content: question }
    const newHistory = [...chatHistory, userMsg]
    setChatHistory(newHistory)
    setQuestion('')
    setChatLoading(true)

    try {
      const data = await backendFetch('/ai/ask-report', {
        method: 'POST',
        body: JSON.stringify({
          reportType: activeTab,
          reportData: getCurrentReportData(),
          question: question,
          chatHistory: chatHistory
        })
      })
      if (data.success) {
        setChatHistory([...newHistory, { role: 'assistant', content: data.answer }])
      }
    } catch (err) {
      console.error(err)
      setChatHistory([...newHistory, { role: 'assistant', content: `⚠️ Error: ${err.message}` }])
    } finally {
      setChatLoading(false)
    }
  }

  const getSuggestedQuestions = (type) => {
    const questions = {
      sales: ['Who is my top customer?', 'Which month had highest revenue?', 'What is the average bill value?', 'Which items sell the most?'],
      inventory: ['Which items need reordering?', 'What is my total stock value?', 'Which items are not moving?', 'What should I reorder first?'],
      gst: ['What is my total GST liability?', 'Which GST rate is most common?', 'Am I ready for GST filing?', 'Show CGST vs SGST split'],
      customers: ['Who owes the most money?', 'Which customer is most loyal?', 'Who has not ordered recently?', 'Who pays on time?']
    }
    return questions[type] || questions.sales
  }

  const AIInsightSection = ({ reportType }) => (
    <div style={{ background: 'linear-gradient(135deg, #F0F7FF 0%, #FAF5FF 100%)', border: '1px solid #BFDBFE', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
      <div style={{ padding: '16px 20px', borderBottom: insight ? '1px solid #BFDBFE' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563EB', boxShadow: '0 0 0 3px rgba(37,99,235,0.2)', animation: 'pulse-shadow 2s infinite' }}/>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1E40AF' }}>✨ AI Insights</span>
          <span style={{ fontSize: 11, color: '#93C5FD', background: '#DBEAFE', padding: '2px 8px', borderRadius: 999, fontWeight: 500 }}>Powered by Llama 3.1</span>
        </div>
        <button onClick={generateInsight} disabled={insightLoading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: insightLoading ? '#94A3B8' : '#2563EB', color: 'white', fontSize: 12, fontWeight: 600, cursor: insightLoading ? 'not-allowed' : 'pointer' }}>
          {insightLoading ? <><div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}/>Analyzing...</> : insight ? '🔄 Refresh' : '✨ Generate Insights'}
        </button>
      </div>
      {insight && <div style={{ padding: '16px 20px' }}><FormattedAIResponse text={insight} /></div>}
      {!insight && !insightLoading && <div style={{ padding: '16px 20px', color: '#64748B', fontSize: 13 }}>Click "Generate Insights" to get AI analysis of this report data.</div>}
      <div style={{ borderTop: '1px solid #BFDBFE', padding: '16px 20px', background: 'rgba(255,255,255,0.5)' }}>
        {chatHistory.length > 0 && (
          <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {chatHistory.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: msg.role === 'user' ? '#2563EB' : 'white', color: msg.role === 'user' ? 'white' : '#374151', fontSize: 13, lineHeight: 1.5, border: msg.role === 'user' ? 'none' : '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  {msg.role === 'assistant' ? <FormattedAIResponse text={msg.content} /> : msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 16px', borderRadius: '12px 12px 12px 4px', background: 'white', border: '1px solid #E2E8F0', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#94A3B8', animation: `dotBounce 1.2s ease ${i * 0.2}s infinite` }}/>)}
                </div>
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askQuestion() } }} placeholder={`Ask about this ${activeTab} data... (e.g. "Who owes the most?")`} disabled={chatLoading} style={{ flex: 1, height: 40, padding: '0 14px', borderRadius: 10, border: '1px solid #BFDBFE', fontSize: 13, background: 'white', color: '#0F172A', outline: 'none' }} />
          <button onClick={askQuestion} disabled={!question.trim() || chatLoading} style={{ width: 40, height: 40, borderRadius: 10, border: 'none', background: !question.trim() || chatLoading ? '#E2E8F0' : '#2563EB', color: !question.trim() || chatLoading ? '#94A3B8' : 'white', cursor: !question.trim() || chatLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}>➤</button>
          {chatHistory.length > 0 && <button onClick={() => setChatHistory([])} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }} title="Clear chat">🗑</button>}
        </div>
        {chatHistory.length === 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {getSuggestedQuestions(activeTab).map(q => (
              <button key={q} onClick={() => { setQuestion(q); setTimeout(askQuestion, 100) }} style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid #BFDBFE', background: 'white', color: '#2563EB', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s ease' }}>{q}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  /* ─── SALES TAB ───────────────────────────────────────── */
  const SalesTab = () => {
    const revPaid = fBills.reduce((s, b) => s + ((b.paymentStatus||b.payment_status)==='Paid' ? (b.grandTotal||b.grand_total||0) : 0), 0)
    const outstanding = fBills.reduce((s, b) => s + ((b.paymentStatus||b.payment_status)==='Unpaid' ? (b.grandTotal||b.grand_total||0) : 0), 0)
    
    // Top customers logic...
    const topCust = [...customers].sort((a,b) => b.totalPurchases - a.totalPurchases).slice(0, 5)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 24 }}>
        <AIInsightSection reportType="sales" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn onClick={() => exportPDF('sales')} variant="primary" icon={Download}>Export Sales Report PDF</Btn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <StatCard icon={TrendingUp} label="Total Revenue (Paid)" value={fmt(revPaid)} color="#059669" bg="#F0FDF4" subtext="Current period" />
          <StatCard icon={FileText} label="Total Bills" value={fBills.length} color="#2563EB" bg="#EFF6FF" subtext={`Avg: ${fBills.length ? fmt(revPaid/fBills.length) : '₹0'} per bill`} />
          <StatCard icon={FileCheck} label="Quotations" value={fQuotes.length} color="#7C3AED" bg="#F5F3FF" subtext="Quotes sent" />
          <StatCard icon={AlertCircle} label="Outstanding" value={fmt(outstanding)} color="#DC2626" bg="#FEF2F2" subtext="Unpaid bills" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Top Customers */}
          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Top 5 Customers</h3>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ textAlign: 'left', padding: '8px 4px' }}>Customer</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px' }}>Revenue</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px' }}>Outst.</th>
                </tr>
              </thead>
              <tbody>
                {topCust.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 4px', fontWeight: 600, color: '#334155' }}>{c.name}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>{fmt(c.totalPurchases)}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', color: c.outstanding > 0 ? '#DC2626' : '#94A3B8' }}>{fmt(c.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  /* ─── INVENTORY TAB ───────────────────────────────────────── */
  const InventoryTab = () => {
    const totalValue = inventory.reduce((s, i) => s + (i.qty * (i.rate||0) * (1 + (i.gst||0)/100)), 0)
    const lowStock = inventory.filter(i => i.qty < i.min).length
    const received = fGrn.reduce((s, g) => s + (g.item_count || 0), 0)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 24 }}>
        <AIInsightSection reportType="inventory" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn onClick={() => exportPDF('inventory')} variant="primary" icon={Download}>Export Inventory PDF</Btn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <StatCard icon={Package} label="Total Stock Value" value={fmt(totalValue)} color="#2563EB" bg="#EFF6FF" />
          <StatCard icon={AlertCircle} label="Low Stock Items" value={lowStock} color="#DC2626" bg="#FEF2F2" subtext="Needs reordering" />
          <StatCard icon={Archive} label="Items Received" value={received} color="#059669" bg="#F0FDF4" />
        </div>
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Stock Movement</h3>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ textAlign: 'left', padding: '10px' }}>HSN</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>Item</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>Qty</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {inventory.slice(0, 10).map((i, idx) => (
                <tr key={idx} style={{ background: i.qty < i.min ? '#FEF2F2' : 'white', borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{i.hsn}</td>
                  <td style={{ padding: '10px' }}>{i.name}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{i.qty}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{i.qty < i.min ? 'Low ⚠️' : 'OK ✅'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  /* ─── GST TAB ───────────────────────────────────────── */
  const GstTab = () => {
    let totCgst = 0, totSgst = 0
    fBills.forEach(b => (b.items||[]).forEach(i => {
      const base = (parseFloat(i.quantity)||0) * (parseFloat(i.rate)||0)
      totCgst += base * (parseFloat(i.cgstPercent)||0)/100
      totSgst += base * (parseFloat(i.sgstPercent)||0)/100
    }))
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 24 }}>
        <AIInsightSection reportType="gst" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn onClick={() => exportPDF('gst')} variant="primary" icon={Download}>Export GST PDF</Btn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <StatCard icon={Receipt} label="Total CGST Collected" value={fmt(totCgst)} color="#2563EB" bg="#EFF6FF" />
          <StatCard icon={Receipt} label="Total SGST Collected" value={fmt(totSgst)} color="#7C3AED" bg="#F5F3FF" />
          <StatCard icon={TrendingUp} label="Total Tax Collected" value={fmt(totCgst + totSgst)} color="#059669" bg="#F0FDF4" />
        </div>
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Tax Breakdown by Bill</h3>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ textAlign: 'left', padding: '10px' }}>Bill No.</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>Date</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>Bill Amt</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>CGST</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>SGST</th>
              </tr>
            </thead>
            <tbody>
              {fBills.slice(0, 10).map((b, idx) => {
                let bc = 0, bs = 0
                ;(b.items||[]).forEach(i => {
                  const base = (parseFloat(i.quantity)||0) * (parseFloat(i.rate)||0)
                  bc += base * (parseFloat(i.cgstPercent)||0)/100
                  bs += base * (parseFloat(i.sgstPercent)||0)/100
                })
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px', fontWeight: 600, color: '#2563EB' }}>{b.billNumber}</td>
                    <td style={{ padding: '10px' }}>{fmtDate(b.date)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{fmt(b.grandTotal)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#64748B' }}>{fmt(bc)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#64748B' }}>{fmt(bs)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  /* ─── CUSTOMERS TAB ───────────────────────────────────────── */
  const CustomersTab = () => {
    const totalOut = customers.reduce((s, c) => s + (c.outstanding || 0), 0)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 24 }}>
        <AIInsightSection reportType="customers" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn onClick={() => exportPDF('customers')} variant="primary" icon={Download}>Export Customers PDF</Btn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <StatCard icon={Users} label="Total Customers" value={customers.length} color="#2563EB" bg="#EFF6FF" />
          <StatCard icon={AlertCircle} label="Total Outstanding" value={fmt(totalOut)} color="#DC2626" bg="#FEF2F2" />
        </div>
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Customer Directory</h3>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ textAlign: 'left', padding: '10px' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>Tags</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>Revenue</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>Outst.</th>
              </tr>
            </thead>
            <tbody>
              {customers.slice(0, 10).map((c, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(c.tags || []).map((t, i) => <span key={i} style={{ fontSize: 10, padding: '2px 6px', background: '#F1F5F9', borderRadius: 4 }}>{t}</span>)}
                    </div>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>{fmt(c.totalPurchases)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: c.outstanding > 0 ? '#DC2626' : '#94A3B8' }}>{fmt(c.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'sales', label: 'Sales', icon: TrendingUp },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'gst', label: 'GST', icon: Receipt },
    { id: 'customers', label: 'Customers', icon: Users },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '16px 24px', borderRadius: 14, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>Reports</h2>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Generate and export business intelligence reports</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none' }}>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="this_year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
          {period === 'custom' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#F8FAFC', padding: 4, borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '4px 8px', border: 'none', background: 'none', outline: 'none', fontSize: 12 }} />
              <span style={{ color: '#94A3B8' }}>to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '4px 8px', border: 'none', background: 'none', outline: 'none', fontSize: 12 }} />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{ flex: 1, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: activeTab === id ? '#2563EB' : '#64748B', borderBottom: activeTab === id ? '2px solid #2563EB' : '2px solid transparent', transition: 'all 0.15s' }}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
        
        <div style={{ minHeight: 400 }}>
          {activeTab === 'sales' && <SalesTab />}
          {activeTab === 'inventory' && <InventoryTab />}
          {activeTab === 'gst' && <GstTab />}
          {activeTab === 'customers' && <CustomersTab />}
        </div>
      </div>

      {/* History */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Report History</h3>
        {reportHistory.length === 0 ? <p style={{ fontSize: 13, color: '#94A3B8' }}>No reports generated yet</p> : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ textAlign: 'left', padding: '10px' }}>Report ID</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>Period</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>Generated</th>
              </tr>
            </thead>
            <tbody>
              {reportHistory.map((r, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px', fontWeight: 600, color: '#2563EB' }}>{r.report_id}</td>
                  <td style={{ padding: '10px', textTransform: 'capitalize' }}>{r.report_type}</td>
                  <td style={{ padding: '10px', color: '#64748B' }}>{fmtDate(r.period_from)} - {fmtDate(r.period_to)}</td>
                  <td style={{ padding: '10px', color: '#64748B' }}>{fmtDate(r.generated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

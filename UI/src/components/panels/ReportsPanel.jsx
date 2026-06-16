import { formatDate } from '../../utils/dateUtils';
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BarChart2, Calendar, Download, TrendingUp, AlertCircle,
  Package, Receipt, Users, FileText, CheckCircle, FileCheck,
  RefreshCw, Copy, Archive, Grid, ChevronDown, ChevronRight,
  Activity, Search, ArrowLeft, ArrowRight, DollarSign, ShoppingCart
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import { useAppStore } from '../../store/appStore'
import FormattedAIResponse from '../ui/FormattedAIResponse'

import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import SalesReport from './SalesReport'
import FinanceReport from './FinanceReport'
import InventoryReport from './InventoryReport'
import PurchaseReport from './PurchaseReport'
import CustomerReport from './CustomerReport'
import ProductReport from './ProductReport'
import BillingReport from './BillingReport'
import DemandAnalysis from './DemandAnalysis'
/* ─── Helpers ─────────────────────────────────────────────────── */
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtDate = (d) => {
  if (!d) return '—'
  try {
    return formatDate(d)
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

/* ─── INVENTORY TAB LOGIC HAS BEEN MOVED INSIDE REPORTSPANEL ─── */

/* ─── Main ReportsPanel ───────────────────────────────────────── */
export default function ReportsPanel({ showToast, refreshData }) {
  const { bills = [], quotations = [], inventory = [], grnHistory = [], customers = [] } = useAppStore();
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
  const [categories, setCategories] = useState([])
  const [activeReport, setActiveReport] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const REPORT_CARDS = [
    { id: 'sales_report', title: 'Sales Report', icon: TrendingUp, desc: 'Daily, weekly and monthly sales performance with trends', tags: ['Charts', 'Export', 'Filters'], color: '#16A34A' },
    { id: 'finance_report', title: 'Finance Report', icon: DollarSign, desc: 'Revenue, expenses, profit and loss analysis', tags: ['P&L', 'Export', 'Charts'], color: '#2563EB' },
    { id: 'inventory_report', title: 'Inventory Report', icon: Package, desc: 'Stock levels, low stock, dead stock and category analysis', tags: ['Stock', 'Categories'], color: '#7C3AED' },
    { id: 'purchase_report', title: 'Purchase Report', icon: ShoppingCart, desc: 'Purchase orders, supplier analysis and procurement trends', tags: ['POs', 'Suppliers'], color: '#EA580C' },
    { id: 'customer_report', title: 'Customer Report', icon: Users, desc: 'Customer performance, dues, and purchase history', tags: ['CRM', 'Outstanding'], color: '#0891B2' },
    { id: 'product_report', title: 'Product Report', icon: BarChart2, desc: 'Product performance, profitability and sales ranking', tags: ['Products', 'Profit'], color: '#4F46E5' },
    { id: 'billing_report', title: 'Billing Report', icon: Receipt, desc: 'Invoice summary, GST collected and payment analysis', tags: ['GST', 'Invoices'], color: '#DB2777' },
    { id: 'demand_report', title: 'Demand Analysis', icon: Activity, desc: 'Product demand trends, fast and slow moving items', tags: ['Demand', 'Trends'], color: '#D97706' },
  ]

  // Load categories for category filter
  useEffect(() => {
    backendFetch('/inventory/categories')
      .then(d => setCategories(d.categories || []))
      .catch(() => {})
  }, [])

  // Load company and history
  useEffect(() => {
    try {
      const s = localStorage.getItem('opsagent_company')
      if (s) setCompanySettings(JSON.parse(s))
    } catch {}
    
    backendFetch('/reports')
      .then(res => setReportHistory(res || []))
      .catch(console.error)

    if (refreshData) refreshData()
  }, [refreshData])

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
    const { jsPDF } = await import('jspdf')
    await import('jspdf-autotable')
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
      const totalValue = Math.round(inventory.reduce((s, i) => s + ((Number(i.qty)||0) * (Number(i.rate)||0)), 0))
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("Inventory Summary", 14, yPos)
      yPos += 8
      doc.setFontSize(11)
      doc.setFont("helvetica", "normal")
      doc.text(`Total Stock Value (Est): ${fmt(totalValue)}`, 14, yPos)
      yPos += 12

      const invData = inventory.map(i => [i.hsn, i.name, i.qty, i.qty <= i.min ? 'Low' : 'OK'])
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
          totalValue: Math.round(inventory.reduce((s, i) => s + ((Number(i.qty)||0) * (Number(i.rate)||0)), 0)),
          lowStockCount: inventory.filter(i => i.qty <= i.min).length,
          totalItems: inventory.length,
          topItemsByValue: [...inventory].sort((a,b) => (b.qty * (b.rate||0)) - (a.qty * (a.rate||0))).slice(0, 10),
          lowStockItems: inventory.filter(i => i.qty <= i.min).slice(0, 10)
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

  /* ─── INVENTORY TAB ───────────────────────────────────────── */
  const InventoryTab = () => {
    const [data, setData] = useState([])
    const [summary, setSummary] = useState({})
    const [category, setCategory] = useState('all')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [expandedRow, setExpandedRow] = useState(null)

    const fetchData = useCallback(async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          category,
          from: start.toISOString(),
          to: end.toISOString()
        })
        const result = await backendFetch(`/reports/category-inventory?${params}`)

        if (result.success) {
          setData(result.data || [])
          setSummary(result.summary || {})
        } else {
          setError(result.error || 'Failed to load')
        }
      } catch (err) {
        setError('Could not connect to server. Check if backend is running.')
        console.error('Category report error:', err)
      } finally {
        setLoading(false)
      }
    }, [category, start, end])

    useEffect(() => {
      fetchData()
    }, [fetchData])

    const getStatus = (cat) => {
      if (cat.outOfStockCount > 0) return { label: `${cat.outOfStockCount} Out of Stock`, color: '#DC2626', bg: '#FEF2F2' }
      if (cat.lowStockCount > 0) return { label: `${cat.lowStockCount} Low Stock`, color: '#EA580C', bg: '#FFF7ED' }
      if (cat.overstockCount > 0) return { label: `${cat.overstockCount} Overstock`, color: '#D97706', bg: '#FFFBEB' }
      return { label: 'All OK', color: '#16A34A', bg: '#F0FDF4' }
    }

    const maxValue = Math.max(...data.map(d => d.totalValue), 1)
    const colors = ['#2563EB','#7C3AED','#EA580C','#16A34A','#0891B2','#DB2777','#CA8A04','#9333EA','#0D9488']

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 24 }}>
        <AIInsightSection reportType="inventory" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Btn onClick={() => exportPDF('inventory')} variant="primary" icon={Download}>Export Inventory PDF</Btn>
        </div>

        {/* ── FILTER BAR ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '16px 20px', background: 'white', borderRadius: 12, border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</span>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, color: '#374151', background: 'white', minWidth: 150, cursor: 'pointer' }}>
              <option value="all">All Categories</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <button onClick={fetchData} disabled={loading} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#64748B', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>🔄 Refresh</button>
        </div>

        {/* ── LOADING/ERROR STATES ── */}
        {loading && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 16 }}><div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#2563EB', animation: 'spin 0.8s linear infinite' }}/></div>}
        {error && !loading && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div><p style={{ margin: 0, fontWeight: 600, color: '#DC2626', fontSize: 14 }}>Failed to load category data</p><p style={{ margin: '4px 0 0', color: '#EF4444', fontSize: 12 }}>{error}</p></div>
            <button onClick={fetchData} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, border: 'none', background: '#DC2626', color: 'white', fontSize: 12, cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {/* ── SUMMARY CARDS ── */}
        {!loading && !error && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Total Categories', value: summary.totalCategories || 0, icon: '🗂️', color: '#2563EB', bg: '#EFF6FF' },
                { label: 'Total Stock Value', value: fmt(summary.totalValue), icon: '💰', color: '#16A34A', bg: '#F0FDF4' },
                { label: 'Most Valuable', value: summary.mostValuableCategory?.name || '—', sub: summary.mostValuableCategory ? fmt(summary.mostValuableCategory.value) : '', icon: '⭐', color: '#7C3AED', bg: '#F5F3FF' },
                { label: 'Need Attention', value: `${summary.lowStockCategories || 0} categories`, icon: '⚠️', color: '#DC2626', bg: '#FEF2F2' }
              ].map((card, i) => (
                <div key={i} style={{ background: card.bg, border: `1px solid ${card.color}22`, borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{card.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: card.color, marginBottom: 4 }}>{card.value}</div>
                  {card.sub && <div style={{ fontSize: 11, color: card.color, opacity: 0.8, marginBottom: 4 }}>{card.sub}</div>}
                  <div style={{ fontSize: 12, color: '#64748B' }}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* ── CHARTS ── */}
            {data.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginTop: 24, marginBottom: 24 }}>
                {/* Category Stock Value Pie Chart */}
                <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: 24 }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Stock Value by Category</h3>
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data}
                          dataKey="totalValue"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          innerRadius={55}
                          paddingAngle={2}
                        >
                          {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => fmt(value)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Items vs Quantities Bar Chart */}
                <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: 24 }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Category Quantities</h3>
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                        <RechartsTooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="totalQty" name="Total Qty" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={50} />
                        <Bar dataKey="soldQty" name="Sold Qty" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={50} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ── EMPTY STATE ── */}
            {data.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', background: 'white', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
                <h3 style={{ color: '#0F172A', margin: '0 0 8px' }}>No inventory data found</h3>
              </div>
            )}

            {/* ── CATEGORY TABLE ── */}
            {data.length > 0 && (
              <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '12px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', gap: 8 }}>
                  {['Category','Items','Total Qty','Stock Value',`Sold (Period)`,'Revenue','Status'].map(h => <div key={h} style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>)}
                </div>
                {data.map((cat, idx) => {
                  const status = getStatus(cat)
                  const color = colors[idx % colors.length]
                  const isExpanded = expandedRow === cat.category
                  const barWidth = (cat.totalValue / maxValue) * 100
                  return (
                    <div key={cat.category}>
                      <div onClick={() => setExpandedRow(isExpanded ? null : cat.category)} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '14px 16px', borderBottom: '1px solid #F1F5F9', gap: 8, cursor: 'pointer', background: isExpanded ? '#F8FAFC' : 'white', transition: 'background 0.15s ease' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }}/>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{cat.category}</div>
                            <div style={{ width: 80, height: 3, background: '#F1F5F9', borderRadius: 999, marginTop: 4 }}><div style={{ width: `${barWidth}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.5s ease' }}/></div>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{cat.totalItems}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{cat.totalQty}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1D4ED8' }}>{fmt(cat.totalValue)}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{cat.soldQty}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1D4ED8' }}>{fmt(cat.revenue)}</div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: status.bg, color: status.color, whiteSpace: 'nowrap' }}>{status.label}</span>
                        </div>
                      </div>
                      
                      {/* Sub-items */}
                      {isExpanded && (
                        <div style={{ background: '#F8FAFC', padding: '12px 16px 12px 48px', borderBottom: '1px solid #E2E8F0' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 8, paddingBottom: 8, borderBottom: '1px solid #E2E8F0', marginBottom: 8 }}>
                            {['Item Name','Qty','Rate','Value','Min','Status'].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>{h}</div>)}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {cat.items.map(item => {
                              const qty = item.qty || 0; const min = item.min || 0; const max = item.max || 0; const rate = item.rate || 0;
                              let iStatus = 'OK'; let iCol = '#16A34A'
                              if (qty === 0) { iStatus = 'Out of Stock'; iCol = '#DC2626' }
                              else if (qty <= min) { iStatus = 'Low Stock'; iCol = '#EA580C' }
                              else if (max > 0 && qty > max) { iStatus = 'Overstock'; iCol = '#D97706' }
                              return (
                                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>{item.name}</div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: iCol }}>{qty} {item.unit}</div>
                                  <div style={{ fontSize: 13, color: '#64748B' }}>{fmt(rate)}</div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1D4ED8' }}>{fmt(qty * rate)}</div>
                                  <div style={{ fontSize: 13, color: '#64748B' }}>{min} {item.unit}</div>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: iCol }}>{iStatus}</div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

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
          <StatCard icon={TrendingUp} label="Total Revenue (Paid)" value={fmt(revPaid)} color="#1D4ED8" bg="#F0FDF4" subtext="Current period" />
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
                    <td style={{ padding: '8px 4px', textAlign: 'right', color: '#1D4ED8', fontWeight: 600 }}>{fmt(c.totalPurchases)}</td>
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
          <StatCard icon={TrendingUp} label="Total Tax Collected" value={fmt(totCgst + totSgst)} color="#1D4ED8" bg="#F0FDF4" />
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
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: '#1D4ED8' }}>{fmt(c.totalPurchases)}</td>
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

  const filteredCards = REPORT_CARDS.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (activeReport === 'sales_report') {
    return <SalesReport onBack={() => setActiveReport(null)} />
  }

  if (activeReport === 'finance_report') {
    return <FinanceReport onBack={() => setActiveReport(null)} />
  }

  if (activeReport === 'inventory_report') {
    return <InventoryReport onBack={() => setActiveReport(null)} />
  }

  if (activeReport === 'purchase_report') {
    return <PurchaseReport onBack={() => setActiveReport(null)} />
  }

  if (activeReport === 'customer_report') {
    return <CustomerReport onBack={() => setActiveReport(null)} />
  }

  if (activeReport === 'product_report') {
    return <ProductReport onBack={() => setActiveReport(null)} />
  }

  if (activeReport === 'billing_report') {
    return <BillingReport onBack={() => setActiveReport(null)} />
  }

  if (activeReport === 'demand_report') {
    return <DemandAnalysis onBack={() => setActiveReport(null)} />
  }

  if (activeReport) {
    const reportData = REPORT_CARDS.find(c => c.id === activeReport)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', paddingBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'white', padding: '16px 24px', borderRadius: 14, border: '1px solid #E2E8F0' }}>
          <button onClick={() => setActiveReport(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#64748B', fontSize: 14, fontWeight: 600 }}>
            <ArrowLeft size={18} /> Back to Reports
          </button>
          <div style={{ width: 1, height: 24, background: '#E2E8F0' }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>{reportData?.title}</h2>
        </div>
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: 40, textAlign: 'center', color: '#64748B' }}>
          <reportData.icon size={48} color={reportData.color} style={{ opacity: 0.2, marginBottom: 16 }} />
          <h3>{reportData.title} is under construction</h3>
          <p>This report will be implemented in the next phase.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%', paddingBottom: 40 }}>
      {/* ── HEADER & SEARCH ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '24px', borderRadius: 14, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' }}>Reports</h2>
          <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>Select a report to view detailed analytics</p>
        </div>
        <div style={{ position: 'relative', width: 300 }}>
          <Search size={18} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Search reports..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 10px 10px 38px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, outline: 'none' }}
          />
        </div>
      </div>

      {/* ── REPORTS GRID ── */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
        gap: 16 
      }}>
        {filteredCards.map(card => {
          const Icon = card.icon
          return (
            <div 
              key={card.id}
              onClick={() => setActiveReport(card.id)}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#BFDBFE'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = '#E2E8F0'
              }}
              style={{
                background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20,
                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: `${card.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={22} color={card.color} />
                </div>
                <div style={{ paddingTop: 2 }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{card.title}</h3>
                </div>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748B', lineHeight: 1.5, flex: 1 }}>{card.desc}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {card.tags.map(t => (
                  <span key={t} style={{ fontSize: 11, fontWeight: 500, color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: 4 }}>
                    {t}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2563EB', display: 'flex', alignItems: 'center', gap: 4 }}>
                View Report <ArrowRight size={14} />
              </div>
            </div>
          )
        })}
        {filteredCards.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: '#64748B', background: 'white', borderRadius: 12, border: '1px dashed #CBD5E1' }}>
            No reports found matching "{searchQuery}"
          </div>
        )}
      </div>

    </div>
  )
}

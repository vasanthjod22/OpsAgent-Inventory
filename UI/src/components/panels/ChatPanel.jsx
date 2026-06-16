import { formatDate } from '../../utils/dateUtils';
import { useState, useRef, useEffect, useCallback } from 'react'
import { 
  TrendingUp, DollarSign, FileText, Users, AlertTriangle, 
  ShoppingCart, Package, UserCheck, Sparkles, Send, 
  Settings, ArrowRight
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'

// --- Formatting & Config ---

const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'This Year', value: 'year' },
  { label: 'Custom', value: 'custom' },
]

const formatLabel = (from, to) => {
  const fmt = (d) => formatDate(d)
  return `${fmt(from)} – ${fmt(to)}`
}

const FormattedAIResponse = ({ text }) => {
  const lines = text.split('\n')
  return (
    <div style={{ fontSize: 13, lineHeight: 1.7, fontFamily: "'Inter', sans-serif" }}>
      {lines.map((line, i) => {
        // Section headers with emojis
        if (line.startsWith('📊') || line.startsWith('💡') || line.startsWith('✅') || 
            line.startsWith('🔴') || line.startsWith('🟢') || line.startsWith('📈')) {
          return (
            <div key={i} style={{ fontWeight: 600, marginTop: 12, marginBottom: 4, fontSize: 14, color: 'var(--text-primary)' }}>
              {line}
            </div>
          )
        }
        // Numbered items
        if (/^\d+\./.test(line.trim())) {
          return (
            <div key={i} style={{ paddingLeft: 16, marginBottom: 4, color: 'var(--text-secondary)' }}>
              {line}
            </div>
          )
        }
        // Bullet points
        if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
          return (
            <div key={i} style={{ paddingLeft: 16, marginBottom: 2, display: 'flex', gap: 8 }}>
              <span style={{ color: '#2563EB', fontWeight: 600 }}>•</span>
              <span style={{ color: 'var(--text-secondary)' }}>{line.replace(/^[-•]\s/, '')}</span>
            </div>
          )
        }
        // Empty lines
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />
        
        // Bold text **...**
        const boldFormatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        return (
          <div key={i} dangerouslySetInnerHTML={{ __html: boldFormatted }} style={{ marginBottom: 2, color: 'var(--text-secondary)' }} />
        )
      })}
    </div>
  )
}

const QUICK_ACTION_PROMPTS = {
  explainSales: (data, dateLabel) => `
Analyze this sales data for ${dateLabel} and explain performance in plain English:
Revenue: ₹${Number(data.revenue).toLocaleString('en-IN')}
Total Orders: ${data.totalOrders}
Top Category: ${data.topCategory}
Top Products: ${JSON.stringify(data.topProducts?.slice(0,5))}
Structure: Observation → Reason → Recommendation`,

  recommendPO: (data, dateLabel) => `
Based on inventory and sales data for ${dateLabel}, recommend purchase orders:
Low Stock Items: ${JSON.stringify(data.lowStockItems)}
Recent Sales: ${JSON.stringify(data.topProducts?.slice(0,5))}
For each item provide:
1. Item name
2. Current stock
3. Recommended order quantity
4. Urgency (High/Medium/Low)
End with: "Click 'Create Purchase Order' to act on these recommendations."`,

  analyzeHealth: (data, dateLabel) => `
Analyze overall business health for ${dateLabel}:
Revenue: ₹${Number(data.revenue).toLocaleString('en-IN')}
Profit: ₹${Number(data.profit).toLocaleString('en-IN')}
Health Score: ${data.healthScore}/100
Low Stock: ${data.lowStock} products
Customer Due: ₹${Number(data.customerDue).toLocaleString('en-IN')}
Pending Bills: ${data.pendingBills?.count}
Provide:
1. Overall assessment
2. Top 3 Strengths
3. Top 3 Weaknesses  
4. Top 5 Action Items`,

  pendingPayments: (data, dateLabel) => `
Analyze outstanding customer payments as of ${dateLabel}:
${JSON.stringify(data.outstanding?.slice(0,10))}
Provide:
1. Total amount at risk
2. Who to contact first and why
3. Recovery strategy
4. Estimated recovery timeline`,

  lowStock: (data, dateLabel) => `
Analyze low stock situation for ${dateLabel}:
${JSON.stringify(data.lowStockItems?.slice(0,15))}
For each critical item provide:
1. How urgent is the reorder
2. Recommended quantity based on min level
3. Estimated days until stockout
End with top 5 priority reorders.`,

  topCustomers: (data, dateLabel) => `
Analyze top customer data for ${dateLabel}:
${JSON.stringify(data.topCustomers?.slice(0,10))}
Provide:
1. Who are the most valuable customers
2. Which customers to focus on
3. Suggestions for customer retention
4. Any customers with outstanding dues`,

  topProducts: (data, dateLabel) => `
Analyze top selling products for ${dateLabel}:
${JSON.stringify(data.topProducts?.slice(0,10))}
Provide:
1. Which products are driving revenue
2. Category-wise performance
3. Recommendations for inventory
4. Products to promote`,

  slowMoving: (data, dateLabel) => `
Analyze slow moving products for ${dateLabel}:
Low/No Sales Items: ${JSON.stringify(data.slowMoving?.slice(0,10))}
Provide:
1. Products with poor movement
2. Reasons they might be slow
3. Strategies to clear stock
4. Whether to stop purchasing these`,

  weeklySummary: (data, dateLabel) => `
Generate a complete weekly business summary for ${dateLabel}:
Revenue: ₹${Number(data.revenue).toLocaleString('en-IN')}
Profit: ₹${Number(data.profit).toLocaleString('en-IN')}
Orders: ${data.totalOrders}
Top Product: ${data.topProducts?.[0]?.name || 'N/A'}
Top Category: ${data.topCategory}
Low Stock: ${data.lowStock} items
Customer Due: ₹${Number(data.customerDue).toLocaleString('en-IN')}
Format as a professional weekly report with:
Executive Summary, Performance Highlights, Areas of Concern, and Action Items for next week.`,

  monthlyReport: (data, dateLabel) => `
Generate a comprehensive monthly business report for ${dateLabel}:
Revenue: ₹${Number(data.revenue).toLocaleString('en-IN')}
Profit: ₹${Number(data.profit).toLocaleString('en-IN')}
Expenses: ₹${Number(data.totalExpenses || 0).toLocaleString('en-IN')}
Orders: ${data.totalOrders}
Health Score: ${data.healthScore}/100
Top Category: ${data.topCategory}
Low Stock Items: ${data.lowStock}
Customer Due: ₹${Number(data.customerDue).toLocaleString('en-IN')}
Generate a formal monthly report with sections:
1. Executive Summary
2. Financial Performance
3. Sales Analysis
4. Inventory Status
5. Customer Analysis
6. Key Recommendations
7. Goals for Next Month`
}

export default function ChatPanel({ onNavigate }) {
  // State
  const [dateRange, setDateRange] = useState({
    preset: 'custom',
    from: '2021-01-01',
    to: '2021-12-31',
    label: '01 Jan 2021 – 31 Dec 2021'
  })
  
  const [snapshotData, setSnapshotData] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiKeyMissing, setApiKeyMissing] = useState(false)
  
  const chatRef = useRef(null)

  // ─── INITIALIZATION & EFFECTS ───

  useEffect(() => {
    const key = localStorage.getItem('opsagent_groq_key')
    if (!key) {
      // Backend handles its own API key if env is set, but we show banner just in case
      // We will try fetching. If it fails due to config, we set missing.
    }
  }, [])

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await backendFetch('/ai/business-snapshot', {
        method: 'POST',
        body: JSON.stringify({ from: dateRange.from, to: dateRange.to })
      })
      if (res.success) {
        setSnapshotData({ ...res.data, healthScore: res.healthScore })
      }
    } catch (err) {
      console.error('Failed to fetch snapshot:', err)
    }
  }, [dateRange])

  useEffect(() => {
    fetchSnapshot()
  }, [fetchSnapshot])

  // ─── DATE HANDLERS ───

  const applyPreset = (preset) => {
    const now = new Date()
    let from, to, label

    switch(preset) {
      case 'today':
        from = to = now.toISOString().split('T')[0]
        label = 'Today'
        break
      case 'yesterday': {
        const y = new Date(now)
        y.setDate(now.getDate() - 1)
        from = to = y.toISOString().split('T')[0]
        label = 'Yesterday'
        break
      }
      case 'week': {
        const w = new Date(now)
        w.setDate(now.getDate() - 6)
        from = w.toISOString().split('T')[0]
        to = now.toISOString().split('T')[0]
        label = 'Last 7 Days'
        break
      }
      case 'month':
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        to = now.toISOString().split('T')[0]
        label = 'This Month'
        break
      case 'year':
        from = `${now.getFullYear()}-01-01`
        to = now.toISOString().split('T')[0]
        label = 'This Year'
        break
      case 'custom':
      default:
        from = '2021-01-01'
        to = '2021-12-31'
        label = '01 Jan 2021 – 31 Dec 2021'
    }

    setDateRange({ preset, from, to, label })
  }

  const handleCustomDateChange = (newFrom, newTo) => {
    if (!newFrom || !newTo) return;

    setDateRange(prev => ({
      ...prev,
      preset: 'custom',
      from: newFrom,
      to: newTo,
      label: formatLabel(newFrom, newTo)
    }))
  }

  // ─── AI ACTIONS ───

  const fetchContextData = async (question) => {
    const q = question.toLowerCase()
    const extra = {}

    try {
      if (q.includes('stock') || q.includes('reorder') || q.includes('inventory') || q.includes('low') || q.includes('product') || q.includes('purchase')) {
        const res = await backendFetch('/ai/context/inventory')
        if (res.success) {
          extra.inventory = res.data.inventory || []
          extra.lowStockItems = res.data.lowStock || []
        }
      }
      if (q.includes('product') || q.includes('selling') || q.includes('sales') || q.includes('revenue') || q.includes('summary') || q.includes('report') || q.includes('business')) {
        const res = await backendFetch(`/ai/context/products?from=${dateRange.from}&to=${dateRange.to}`)
        if (res.success) {
          extra.topProducts = res.data || []
        }
      }
      if (q.includes('payment') || q.includes('pending') || q.includes('due') || q.includes('owe') || q.includes('customer')) {
        const res = await backendFetch('/ai/context/outstanding')
        if (res.success) {
          extra.outstanding = res.data || []
        }
      }
    } catch (err) {
      console.error('Failed to fetch AI context:', err)
    }
    return extra
  }

  const buildAIContext = async (userQuestion, extraData = {}) => {
    const dateLabel = dateRange.label
    return `
You are OpsAgent AI, a professional business consultant for a hardware shop CRM.
IMPORTANT: Always reference the date range "${dateLabel}" naturally in your response.

BUSINESS CONTEXT (${dateLabel}):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Date Range:          ${dateLabel}
Revenue:             ₹${Number(snapshotData?.revenue || 0).toLocaleString('en-IN')}
Profit:              ₹${Number(snapshotData?.profit || 0).toLocaleString('en-IN')}
Total Orders:        ${snapshotData?.totalOrders || 0}
Pending Bills:       ${snapshotData?.pendingBills?.count || 0} bills (₹${Number(snapshotData?.pendingBills?.amount || 0).toLocaleString('en-IN')})
Customer Due:        ₹${Number(snapshotData?.customerDue || 0).toLocaleString('en-IN')}
Low Stock Items:     ${snapshotData?.lowStock || 0} products
Pending POs:         ${snapshotData?.pendingPOs || 0}
Top Category:        ${snapshotData?.topCategory || 'N/A'}
Business Health:     ${snapshotData?.healthScore || 'N/A'}/100

${extraData.inventory ? `
INVENTORY STATUS:
${extraData.inventory.slice(0,10).map(i => `- ${i.name}: ${i.qty} ${i.unit} (min: ${i.min})`).join('\n')}
` : ''}

${extraData.topProducts ? `
TOP SELLING PRODUCTS (${dateLabel}):
${extraData.topProducts.slice(0,5).map((p,i) => `${i+1}. ${p.name}: ${p.qty} units, ₹${Number(p.revenue).toLocaleString('en-IN')}`).join('\n')}
` : ''}

${extraData.outstanding ? `
OUTSTANDING PAYMENTS:
${extraData.outstanding.slice(0,5).map(o => `- ${o.customer}: ₹${Number(o.totalDue).toLocaleString('en-IN')} (${o.daysOverdue} days)`).join('\n')}
` : ''}

${extraData.lowStockItems ? `
LOW STOCK PRODUCTS:
${extraData.lowStockItems.slice(0,8).map(i => `- ${i.name}: ${i.qty}/${i.min} ${i.unit}`).join('\n')}
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

USER QUESTION: ${userQuestion}

RESPONSE FORMAT:
Always structure your response as:
📊 Observation:
[What you see in the data]
💡 Reason:
[Why this is happening]
✅ Recommendation:
[Specific action to take]

Be specific with numbers from the data. Reference the date range naturally. Be concise and professional. Maximum 200 words unless generating a report. Never generate unnecessary conversation.`
  }

  const sendMessage = async (question, quickActionKey = null) => {
    if (!question.trim() && !quickActionKey) return

    const actualQuestion = question || 'Analyzing data...'
    
    // Auto scroll to chat
    chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    const userMsg = { role: 'user', content: actualQuestion, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const extraData = await fetchContextData(quickActionKey || actualQuestion)
      
      let finalPrompt = ''
      if (quickActionKey && QUICK_ACTION_PROMPTS[quickActionKey]) {
        finalPrompt = QUICK_ACTION_PROMPTS[quickActionKey]({ ...snapshotData, ...extraData }, dateRange.label)
      } else {
        finalPrompt = await buildAIContext(actualQuestion, extraData)
      }

      const res = await backendFetch('/ai/ask', {
        method: 'POST',
        body: JSON.stringify({
          question: actualQuestion,
          context: finalPrompt,
          apiKey: localStorage.getItem('opsagent_groq_key')
        })
      })

      if (!res.success) {
        if (res.error?.includes('configured')) setApiKeyMissing(true)
        throw new Error(res.error || 'Failed to get AI response')
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.answer,
        timestamp: new Date(),
        dateRange: dateRange.label,
        quickActionKey,
        lowStockItems: extraData.lowStockItems
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I couldn't process that. Error: ${err.message}`,
        timestamp: new Date()
      }])
    } finally {
      setLoading(false)
    }
  }

  // ─── UTILS ───

  const exportMonthlyReportPDF = async (reportText, dateLabel) => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF('portrait', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, pageWidth, 25, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('OpsAgent AI', 14, 16)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(dateLabel, pageWidth-14, 16, { align: 'right' })

    doc.setTextColor(15, 23, 42)
    const lines = doc.splitTextToSize(reportText.replace(/\*/g, ''), pageWidth - 28)
    let y = 35
    lines.forEach(line => {
      if (y > 275) { doc.addPage(); y = 20 }
      if (line.match(/^\d\./)) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
      }
      doc.text(line, 14, y)
      y += 6
    })

    const pages = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i)
      doc.setFillColor(15, 23, 42)
      doc.rect(0, 285, pageWidth, 12, 'F')
      doc.setTextColor(148, 163, 184)
      doc.setFontSize(7)
      doc.text(`OpsAgent AI Business Report | ${dateLabel} | Page ${i} of ${pages}`, pageWidth/2, 292, { align: 'center' })
    }

    doc.save(`OpsAgent_Report_${dateLabel.replace(/[^a-zA-Z0-9]/g,'_')}.pdf`)
  }

  const handleCreatePOFromAI = (lowStockItems) => {
    window.dispatchEvent(new CustomEvent('createPOFromAI', { detail: { items: lowStockItems || [] } }))
    onNavigate('purchase_orders')
  }

  // ─── RENDERERS ───

  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`

  const getScoreColor = (score) => {
    if (score >= 90) return '#16A34A' // Green - Excellent
    if (score >= 70) return '#2563EB' // Blue - Good
    if (score >= 50) return '#D97706' // Amber - Average
    return '#DC2626' // Red - Needs Attention
  }

  const getScoreLabel = (score) => {
    if (score >= 90) return 'Excellent'
    if (score >= 70) return 'Good'
    if (score >= 50) return 'Average'
    return 'Needs Attention'
  }

  const getDynamicLabel = (type) => {
    switch(dateRange.preset) {
      case 'today': return type === 'revenue' ? "Today's Revenue" : "Today's Profit"
      case 'yesterday': return type === 'revenue' ? "Yesterday's Revenue" : "Yesterday's Profit"
      case 'week': return type === 'revenue' ? "Past 7 Days Revenue" : "Past 7 Days Profit"
      case 'month': return type === 'revenue' ? "This Month's Revenue" : "This Month's Profit"
      case 'year': return type === 'revenue' ? "This Year's Revenue" : "This Year's Profit"
      case 'custom':
      default: return type === 'revenue' ? "Total Revenue" : "Total Profit"
    }
  }

  const kpiCards = [
    { label: getDynamicLabel('revenue'), value: formatCurrency(snapshotData?.revenue), icon: TrendingUp, color: '#16A34A' },
    { label: getDynamicLabel('profit'), value: formatCurrency(snapshotData?.profit), icon: DollarSign, color: '#2563EB' },
    { label: 'Pending Bills', value: `${snapshotData?.pendingBills?.count || 0} (${formatCurrency(snapshotData?.pendingBills?.amount)})`, icon: FileText, color: '#D97706' },
    { label: 'Customer Due', value: formatCurrency(snapshotData?.customerDue), icon: Users, color: '#EA580C' },
    { label: 'Low Stock Products', value: snapshotData?.lowStock || 0, icon: AlertTriangle, color: '#DC2626' },
    { label: 'Pending POs', value: snapshotData?.pendingPOs || 0, icon: ShoppingCart, color: '#9333EA' },
    { label: 'Total Orders', value: snapshotData?.totalOrders || 0, icon: Package, color: '#0891B2' },
    { label: 'Total Customers', value: snapshotData?.uniqueCustomers || 0, icon: UserCheck, color: '#4F46E5' },
  ]

  const actionCards = [
    { key: 'explainSales', icon: '📊', title: 'Explain Sales Report', desc: 'Analyze revenue and sales trends' },
    { key: 'recommendPO', icon: '📦', title: 'Recommend Purchase Order', desc: 'Find products that need restocking' },
    { key: 'analyzeHealth', icon: '📈', title: 'Analyze Business Health', desc: 'Get overall business performance score' },
    { key: 'pendingPayments', icon: '💰', title: 'Show Pending Payments', desc: 'Who owes you money and how much' },
    { key: 'lowStock', icon: '📦', title: 'Find Low Stock Products', desc: 'Products below reorder level' },
    { key: 'topCustomers', icon: '👥', title: 'Top Customers', desc: 'Best customers by revenue' },
    { key: 'topProducts', icon: '🔥', title: 'Top Selling Products', desc: 'Best performing products' },
    { key: 'slowMoving', icon: '📉', title: 'Slow Moving Products', desc: 'Products with low sales velocity' },
    { key: 'weeklySummary', icon: '📅', title: 'Generate Weekly Summary', desc: "Summary of this week's performance" },
    { key: 'monthlyReport', icon: '📄', title: 'Monthly Business Report', desc: 'Comprehensive monthly analysis' },
  ]

  const suggestedQuestions = [
    "Which products should I reorder?", "Who owes me money?", "Which products are selling slowly?",
    "Summarize this period's business", "Which category had highest revenue?", "Explain this period's sales",
    "Which customers haven't bought recently?", "What should I focus on?", "Show me profit analysis",
    "Which supplier is most reliable?", "What is my best selling category?", "How is cash flow looking?"
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main)', color: 'var(--text-primary)', overflowY: 'auto', fontFamily: "'Inter', sans-serif" }}>
      
      {/* ── HEADER ── */}
      <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'rgba(248, 250, 252, 0.95)', zIndex: 50, backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={24} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>OpsAgent AI</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Your AI Business Handler</p>
          </div>
        </div>

        {/* Global Date Filter */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>📅</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Analysis Period:</span>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {DATE_PRESETS.map(p => (
              <button 
                key={p.value} 
                onClick={() => applyPreset(p.value)}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  border: '1px solid',
                  borderColor: dateRange.preset === p.value ? '#2563EB' : '#E2E8F0',
                  background: dateRange.preset === p.value ? '#2563EB' : 'transparent',
                  color: dateRange.preset === p.value ? 'white' : '#64748B',
                  transition: 'all 0.2s'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {dateRange.preset === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, background: 'var(--bg-card)', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, width: 'fit-content' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Custom:</span>
              <input 
                type="date" 
                value={dateRange.from} 
                onChange={e => handleCustomDateChange(e.target.value, dateRange.to)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 14, outline: 'none', colorScheme: 'light' }} 
              />
              <span style={{ color: 'var(--text-muted)' }}>to</span>
              <input 
                type="date" 
                value={dateRange.to} 
                onChange={e => handleCustomDateChange(dateRange.from, e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 14, outline: 'none', colorScheme: 'light' }} 
              />
            </div>
          )}

          <div style={{ fontSize: 13, color: '#38BDF8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
            ✓ Showing data for: {dateRange.label}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* ── SECTION 1: AI BUSINESS SNAPSHOT ── */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>AI Business Snapshot</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
            {kpiCards.map((k, i) => {
              const Icon = k.icon
              return (
                <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ background: `${k.color}20`, width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={22} color={k.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>{k.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{k.value}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Health Score */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 140, height: 140, borderRadius: '50%', border: `8px solid ${getScoreColor(snapshotData?.healthScore || 0)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{snapshotData?.healthScore || 0}</span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>/ 100</span>
              <span style={{ position: 'absolute', bottom: -28, fontSize: 14, fontWeight: 700, color: getScoreColor(snapshotData?.healthScore || 0), textAlign: 'center', width: '100%' }}>
                {getScoreLabel(snapshotData?.healthScore || 0)}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 250 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                🏥 Business Health Score
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                {snapshotData?.healthScore >= 70 
                  ? "Your business is performing well in this period. Maintain inventory levels and focus on timely payment collections to improve further."
                  : "Your business requires attention in this period. Focus on recovering pending payments and restocking low inventory to improve your score."}
              </p>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: AI QUICK ACTIONS ── */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>AI Quick Actions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {actionCards.map((a, i) => (
              <button 
                key={i} 
                onClick={() => sendMessage(`Executing action: ${a.title}`, a.key)}
                disabled={loading}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, textAlign: 'left',
                  cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', height: '100%'
                }}
                onMouseEnter={e => { if(!loading) e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.background = '#F8FAFC' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = 'white' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 28 }}>{a.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{a.title}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, flex: 1 }}>{a.desc}</div>
                <div style={{ fontSize: 12, color: '#38BDF8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                  → Click to analyze
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── SECTION 3: SUGGESTED QUESTIONS ── */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ask a specific question</h2>
          <div style={{ display: 'flex', overflowX: 'auto', gap: 10, paddingBottom: 12, '::-webkit-scrollbar': { height: 4 } }}>
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                disabled={loading}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 99, padding: '8px 16px',
                  fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap', cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s', flexShrink: 0
                }}
                onMouseEnter={e => { if(!loading) { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.color = '#2563EB'; e.currentTarget.style.background = '#EFF6FF' } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'white' }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* ── SECTION 4: AI CHAT INTERFACE ── */}
        <div ref={chatRef} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', height: 600 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color="#38BDF8" /> Ask OpsAgent AI
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Responses based on your CRM data for selected period</p>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {apiKeyMissing && (
              <div style={{ background: '#451A03', border: '1px solid #B45309', borderRadius: 8, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <AlertTriangle color="#F59E0B" />
                  <div>
                    <div style={{ fontWeight: 600, color: '#FCD34D', fontSize: 14 }}>Groq API Key Required</div>
                    <div style={{ color: '#FDE68A', fontSize: 13, marginTop: 2 }}>Set your key in Settings to use AI features.</div>
                  </div>
                </div>
                <button onClick={() => onNavigate('settings')} style={{ background: '#D97706', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Go to Settings →</button>
              </div>
            )}

            {messages.length === 0 && !apiKeyMissing && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 100 }}>
                <Sparkles size={32} opacity={0.3} style={{ marginBottom: 16 }} />
                <p>No messages yet. Ask a question or select a quick action above.</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    padding: '16px',
                    background: msg.role === 'user' ? '#2563EB' : 'white',
                    color: msg.role === 'user' ? 'white' : '#0F172A',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}>
                    {msg.role === 'user' ? (
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{msg.content}</div>
                    ) : (
                      <FormattedAIResponse text={msg.content} />
                    )}
                    
                    {msg.role === 'assistant' && msg.quickActionKey === 'monthlyReport' && (
                      <button 
                        onClick={() => exportMonthlyReportPDF(msg.content, msg.dateRange)}
                        style={{ marginTop: 16, background: 'var(--bg-main)', border: '1px solid #CBD5E1', padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <FileText size={16} /> Export PDF
                      </button>
                    )}

                    {msg.role === 'assistant' && msg.quickActionKey === 'recommendPO' && (
                      <button 
                        onClick={() => handleCreatePOFromAI(msg.lowStockItems)}
                        style={{ marginTop: 16, background: '#2563EB', border: 'none', padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <ShoppingCart size={16} /> Create Purchase Order →
                      </button>
                    )}
                  </div>
                  
                  {msg.role === 'assistant' && msg.dateRange && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, marginLeft: 4 }}>Based on: {msg.dateRange}</span>
                  )}
                  {msg.role === 'user' && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, marginRight: 4 }}>{msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '16px 16px 16px 4px', display: 'flex', gap: 6 }}>
                  <div className="dot-bounce-1" style={{ width: 8, height: 8, background: '#94A3B8', borderRadius: '50%' }} />
                  <div className="dot-bounce-2" style={{ width: 8, height: 8, background: '#94A3B8', borderRadius: '50%' }} />
                  <div className="dot-bounce-3" style={{ width: 8, height: 8, background: '#94A3B8', borderRadius: '50%' }} />
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: 20, borderTop: '1px solid var(--border)', background: 'var(--bg-main)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 99, display: 'flex', alignItems: 'center', padding: '6px 6px 6px 20px' }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                disabled={loading || apiKeyMissing}
                placeholder="Type your question..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14 }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading || apiKeyMissing}
                style={{
                  width: 40, height: 40, borderRadius: '50%', background: (!input.trim() || loading || apiKeyMissing) ? '#CBD5E1' : '#2563EB',
                  color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (!input.trim() || loading || apiKeyMissing) ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                <Send size={18} style={{ marginLeft: 2 }} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

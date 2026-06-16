import React, { useState, useEffect, useRef } from 'react';
import { backendFetch } from '../../utils/backend';

const API_URL = import.meta.env.PROD ? 'https://opsagent-inventory-ui-backend.onrender.com/api' : 'http://localhost:3001/api';

const getQuickQuestions = (currentPanel) => {
  const common = [
    'Summarize my business',
    'What needs attention?',
  ]

  const pageSpecific = {
    dashboard: [
      "Today's performance?",
      'What should I focus on?',
      'Any urgent alerts?',
    ],
    inventory: [
      'Which items are low on stock?',
      'What should I reorder?',
      'Show overstock items',
      'Items not moving?',
      'Total stock value?',
    ],
    billing: [
      'Which bills are unpaid?',
      'Who owes the most?',
      'Total pending amount?',
      'Recent bills summary',
    ],
    quotation: [
      'Pending quotations?',
      'Which quotes to follow up?',
      'Quotation conversion rate?',
    ],
    customers: [
      'Top customers by revenue?',
      'Who has pending payments?',
      'Inactive customers?',
      'New customers this month?',
    ],
    purchase_orders: [
      'Overdue purchase orders?',
      'What to order next?',
      'Supplier performance?',
      'Pending deliveries?',
    ],
    finance: [
      'Revenue this month?',
      'Profit analysis?',
      'Expense breakdown?',
      'Cash flow status?',
    ],
    reports: [
      'Business health score?',
      'Top selling products?',
      'Best performing category?',
    ],
    grn: [
      'Recent GRN summary?',
      'Pending approvals?',
      'Stock received this month?',
    ],
  }

  return [
    ...(pageSpecific[currentPanel] || []),
    ...common
  ].slice(0, 6)
}

const formatTime = (date) => {
  return new Date(date).toLocaleTimeString(
    'en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }
  )
}

const FormattedResponse = ({ text }) => {
  if (!text) return null

  const lines = text.split('\n')
  return (
    <div>
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />

        // Bullet points
        if (line.trim().startsWith('-') ||
            line.trim().startsWith('•')) {
          return (
            <div key={i} style={{
              display: 'flex',
              gap: 6,
              marginBottom: 3
            }}>
              <span style={{ 
                color: '#2563EB',
                flexShrink: 0 
              }}>
                •
              </span>
              <span>
                {line.replace(/^[-•]\s/, '')}
              </span>
            </div>
          )
        }

        // Bold text
        const html = line
          .replace(/\*\*(.*?)\*\*/g,
            '<strong>$1</strong>'
          )

        return (
          <div key={i}
            style={{ marginBottom: 2 }}
            dangerouslySetInnerHTML={{
              __html: html
            }}
          />
        )
      })}
    </div>
  )
}

export default function FloatingAIChat({ currentPanel }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isHover, setIsHover] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const isMobile = window.innerWidth < 640

  const widgetStyle = {
    position: 'fixed',
    width: isMobile ? 'calc(100vw - 32px)' : 380,
    height: isMobile ? '60vh' : 520,
    bottom: isMobile ? 80 : 90,
    right: isMobile ? 16 : 24,
    background: 'white',
    borderRadius: 20,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    border: '1px solid #E2E8F0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 9998,
    animation: 'chatSlideIn 0.3s ease'
  }

  const token = localStorage.getItem('opsagent_token')

  const fetchBasicSnapshot = async () => {
    try {
      const res = await fetch(
        `${API_URL}/dashboard/kpis`,
        {
          headers: { 
            Authorization: `Bearer ${token}` 
          }
        }
      )
      const data = await res.json()
      return data
    } catch {
      return {
        revenue: 0,
        pendingAmount: 0,
        lowStock: 0,
        customerDue: 0
      }
    }
  }

  const buildContext = async (question, currentPanel) => {
    let pageContext = ''

    const snapshot = await fetchBasicSnapshot()

    switch(currentPanel) {
      case 'inventory':
        const invData = await fetch(
          `${API_URL}/inventory`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).then(r => r.json()).catch(() => ({ items: [] }))

        const items = invData.items || invData.data || []
        const lowStock = items.filter(
          i => i.currentQty < i.min
        )
        const outOfStock = items.filter(
          i => i.currentQty === 0
        )
        const overstock = items.filter(
          i => i.max > 0 && i.currentQty > i.max
        )

        pageContext = `
USER IS CURRENTLY ON: Inventory Page

INVENTORY SUMMARY:
Total Items: ${items.length}
Total Stock Value: ₹${items.reduce(
  (s,i) => s + (i.totalValue || 0), 0
).toLocaleString('en-IN')}
Low Stock Items: ${lowStock.length}
Out of Stock: ${outOfStock.length}
Overstock Items: ${overstock.length}

LOW STOCK ITEMS (needs reorder):
${lowStock.slice(0,8).map(i =>
  `- ${i.name}: ${i.currentQty}/${i.min} ${i.unit} (Supplier: ${i.supplier_name || 'Unknown'})`
).join('\n')}

OUT OF STOCK:
${outOfStock.slice(0,5).map(i =>
  `- ${i.name} (${i.unit})`
).join('\n')}

TOP ITEMS BY VALUE:
${items.slice(0,5).map(i =>
  `- ${i.name}: ₹${Number(i.totalValue || 0).toLocaleString('en-IN')}`
).join('\n')}`
        break

      case 'billing':
        const billsData = await fetch(
          `${API_URL}/bills?limit=50`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).then(r => r.json()).catch(() => ({ items: [] }))

        const bills = billsData.items || billsData.data || []
        const unpaid = bills.filter(
          b => b.payment_status !== 'Paid'
        )
        const totalUnpaid = unpaid.reduce(
          (s,b) => s + (b.grand_total || 0), 0
        )

        pageContext = `
USER IS CURRENTLY ON: Billing Page

BILLING SUMMARY:
Total Bills: ${bills.length}
Unpaid Bills: ${unpaid.length}
Total Unpaid Amount: ₹${totalUnpaid.toLocaleString('en-IN')}

UNPAID BILLS:
${unpaid.slice(0,8).map(b =>
  `- ${b.bill_number}: ${b.customer_name} ₹${Number(b.grand_total).toLocaleString('en-IN')} (${b.payment_status})`
).join('\n')}`
        break

      case 'customers':
        const custData = await fetch(
          `${API_URL}/customers`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).then(r => r.json()).catch(() => ({ data: [] }))

        pageContext = `
USER IS CURRENTLY ON: Customers Page

CUSTOMER SUMMARY:
Total Customers: ${custData.customers?.length || custData.data?.length || 0}

RECENT CUSTOMERS:
${(custData.customers || custData.data || []).slice(0,5).map(c =>
  `- ${c.name}: ${c.phone || 'No phone'}`
).join('\n')}`
        break

      case 'purchase_orders':
        const poData = await fetch(
          `${API_URL}/purchase-orders`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).then(r => r.json()).catch(() => ({ items: [] }))

        const pos = poData.items || poData.data || []
        const pendingPOs = pos.filter(
          p => !['Fully Received','Cancelled']
            .includes(p.status)
        )

        pageContext = `
USER IS CURRENTLY ON: Purchase Orders Page

PO SUMMARY:
Total POs: ${pos.length}
Pending POs: ${pendingPOs.length}

PENDING PURCHASE ORDERS:
${pendingPOs.slice(0,8).map(p =>
  `- ${p.po_number}: ${p.supplier_name} ₹${Number(p.grand_total || 0).toLocaleString('en-IN')} (${p.status})`
).join('\n')}`
        break

      case 'quotation':
        const qtData = await fetch(
          `${API_URL}/quotations`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).then(r => r.json()).catch(() => ({ items: [] }))

        const qts = qtData.items || qtData.data || []
        const pendingQTs = qts.filter(
          q => ['Draft','Sent'].includes(q.status)
        )

        pageContext = `
USER IS CURRENTLY ON: Quotation Page

QUOTATION SUMMARY:
Total Quotations: ${qts.length}
Pending Follow-up: ${pendingQTs.length}

PENDING QUOTATIONS:
${pendingQTs.slice(0,5).map(q =>
  `- ${q.quotation_number || q.qt_number}: ${q.customer_name} ₹${Number(q.grand_total || 0).toLocaleString('en-IN')} (${q.status})`
).join('\n')}`
        break

      default:
        pageContext = `
USER IS CURRENTLY ON: ${currentPanel} page`
    }

    return `
You are OpsAgent AI, a professional business 
assistant for a hardware shop CRM system.

BUSINESS OVERVIEW:
Revenue: ₹${Number(snapshot.revenue || 0).toLocaleString('en-IN')}
Pending Bills: ₹${Number(snapshot.pendingAmount || 0).toLocaleString('en-IN')}
Low Stock Items: ${snapshot.lowStock || 0}
Customer Due: ₹${Number(snapshot.customerDue || 0).toLocaleString('en-IN')}

${pageContext}

USER QUESTION: ${question}

RESPONSE RULES:
- Be concise (max 150 words)
- Be specific with numbers
- Give actionable advice
- Use bullet points for lists
- If user asks about specific items/customers,
  use the data provided above
- Do NOT make up data not provided
- If data is not available say so politely
- Professional but friendly tone
`
  }

  const sendMessage = async (question) => {
    if (!question?.trim() || isTyping) return

    const userMsg = {
      role: 'user',
      content: question.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    // Focus input after send
    setTimeout(() => inputRef.current?.focus(), 100)

    try {
      // Build context
      const context = await buildContext(question.trim(), currentPanel)

      // Call backend AI route
      const response = await backendFetch('/ai/ask', {
        method: 'POST',
        body: JSON.stringify({
          question: question.trim(),
          context: context
        })
      });

      if (!response.success) {
        throw new Error(response.error || 'API Error')
      }

      const answer = response.answer

      if (!answer) throw new Error('Empty response from AI')

      const aiMsg = {
        role: 'assistant',
        content: answer,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, aiMsg])

      // If chat is closed, show unread badge
      if (!chatOpen) {
        setUnreadCount(prev => prev + 1)
      }

    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I couldn't process that right now. Please try again. (${err.message})`,
        timestamp: new Date()
      }])
    } finally {
      setIsTyping(false)
    }
  }

  // Clear unread when chat opened
  useEffect(() => {
    if (chatOpen) {
      setUnreadCount(0)
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [chatOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const quickQuestions = getQuickQuestions(currentPanel)

  return (
    <>
      <style>{`
        @keyframes chatPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.3); opacity: 0; }
        }
        @keyframes chatSlideIn {
          from { transform: translateY(20px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes typingDot {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>

      {/* Floating Button */}
      <div 
        style={{ position: 'fixed', bottom: isMobile ? 16 : 24, right: isMobile ? 16 : 24, zIndex: 9999 }}
        onMouseEnter={() => setIsHover(true)}
        onMouseLeave={() => setIsHover(false)}
      >
        <div style={{
          position: 'absolute', inset: -4, borderRadius: '50%',
          background: 'rgba(37,99,235,0.2)', animation: 'chatPulse 2s ease infinite'
        }}/>
        <button
          onClick={() => setChatOpen(true)}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
            border: 'none', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 25px rgba(37,99,235,0.4)',
            position: 'relative', transition: 'transform 0.2s ease',
            transform: isHover ? 'scale(1.1)' : 'scale(1)'
          }}
        >
          <span style={{ fontSize: 24 }}>🤖</span>
          {unreadCount > 0 && (
            <div style={{
              position: 'absolute', top: -4, right: -4, width: 18, height: 18,
              borderRadius: '50%', background: '#DC2626', color: 'white',
              fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center',
              justifyContent: 'center', border: '2px solid white'
            }}>
              {unreadCount}
            </div>
          )}
        </button>

        {isHover && !chatOpen && (
          <div style={{
            position: 'absolute', bottom: '100%', right: 0, marginBottom: 8,
            background: '#0F172A', color: 'white', padding: '6px 12px',
            borderRadius: 8, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}>
            Ask OpsAgent AI
            <div style={{
              position: 'absolute', bottom: -4, right: 20, width: 8, height: 8,
              background: '#0F172A', transform: 'rotate(45deg)'
            }}/>
          </div>
        )}
      </div>

      {/* Chat Widget */}
      {chatOpen && (
        <div style={widgetStyle}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            padding: '16px 20px', display: 'flex', alignItems: 'center',
            gap: 12, flexShrink: 0
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0
            }}>🤖</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>OpsAgent AI</div>
              <div style={{ color: '#94A3B8', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', animation: 'chatPulse 2s infinite' }}/>
                Online · Ask me anything
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6,
                color: '#94A3B8', width: 28, height: 28, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
              }}
            >×</button>
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, background: '#F8FAFC' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 16px' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🤖</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>Hi! I'm OpsAgent AI</div>
                <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
                  I know your inventory, bills, customers and business data. Ask me anything!
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {msg.role === 'assistant' && (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #2563EB, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, marginTop: 4 }}>🤖</div>
                  )}
                  <div style={{
                    maxWidth: '80%', padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user' ? '#2563EB' : 'white',
                    color: msg.role === 'user' ? 'white' : '#374151',
                    fontSize: 13, lineHeight: 1.6, border: msg.role === 'user' ? 'none' : '1px solid #E2E8F0',
                    boxShadow: msg.role === 'user' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    {msg.role === 'user' ? msg.content : <FormattedResponse text={msg.content} />}
                    <div style={{ fontSize: 10, color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : '#94A3B8', marginTop: 4, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            )}
            {isTyping && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #2563EB, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>🤖</div>
                <div style={{ background: 'white', border: '1px solid #E2E8F0', padding: '12px 16px', borderRadius: '16px 16px 16px 4px', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#94A3B8', animation: `typingDot 1.2s ease ${i * 0.2}s infinite` }}/>)}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Chips */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid #F1F5F9', background: 'white' }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  style={{
                    padding: '4px 10px', borderRadius: 999, border: '1px solid #BFDBFE',
                    background: '#EFF6FF', color: '#2563EB', fontSize: 11, fontWeight: 500,
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.target.style.background = '#DBEAFE'}
                  onMouseLeave={e => e.target.style.background = '#EFF6FF'}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input Bar */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #E2E8F0', background: 'white', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <input
              ref={inputRef} type="text" value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
              placeholder="Ask about stock, bills, customers..."
              disabled={isTyping}
              style={{ flex: 1, height: 40, padding: '0 14px', borderRadius: 20, border: '1px solid #E2E8F0', fontSize: 13, color: '#0F172A', background: '#F8FAFC', outline: 'none', transition: 'border 0.2s ease' }}
              onFocus={e => e.target.style.borderColor = '#2563EB'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isTyping}
              style={{
                width: 40, height: 40, borderRadius: '50%', border: 'none',
                background: !input.trim() || isTyping ? '#E2E8F0' : 'linear-gradient(135deg, #2563EB, #7C3AED)',
                color: !input.trim() || isTyping ? '#94A3B8' : 'white',
                cursor: !input.trim() || isTyping ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'all 0.2s ease', flexShrink: 0
              }}
            >➤</button>
          </div>
        </div>
      )}
    </>
  )
}

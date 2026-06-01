import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { callAI } from '../../utils/api'

const renderMarkdown = (text) => {
  const lines = text.split('\n')
  const result = []
  let currentTable = null

  const parseInline = (str) => {
    const parts = str.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ fontWeight: 600, color: '#0F172A' }}>{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!currentTable) currentTable = []
      if (!line.includes('---')) {
        const cells = line.split('|').slice(1, -1).map(c => c.trim())
        currentTable.push(cells)
      }
    } else {
      if (currentTable) {
        result.push(
          <div key={`table-${i}`} style={{ overflowX: 'auto', margin: '12px 0', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
            <table className="data-table">
              <tbody>
                {currentTable.map((row, rIdx) => (
                  <tr key={rIdx} style={{ borderBottom: rIdx === currentTable.length - 1 ? 'none' : '1px solid #E2E8F0', background: rIdx === 0 ? '#F8FAFC' : 'transparent' }}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} style={{ padding: '8px 12px', borderRight: cIdx === row.length - 1 ? 'none' : '1px solid #E2E8F0', fontWeight: rIdx === 0 ? 600 : 400 }}>{parseInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
        currentTable = null
      }
      
      if (line.startsWith('- ') || line.startsWith('* ')) {
        result.push(<div key={i} style={{ display: 'flex', gap: '8px', margin: '4px 0' }}><span style={{ color: '#2563EB', fontWeight: 700 }}>•</span><span>{parseInline(line.substring(2))}</span></div>)
      } else if (line.match(/^\d+\.\s/)) {
        const match = line.match(/^(\d+\.\s)(.*)/)
        result.push(<div key={i} style={{ display: 'flex', gap: '8px', margin: '6px 0' }}><span style={{ color: '#64748B', fontWeight: 600 }}>{match[1]}</span><span>{parseInline(match[2])}</span></div>)
      } else if (line.length > 0) {
        result.push(<p key={i} style={{ margin: '8px 0', lineHeight: 1.6 }}>{parseInline(line)}</p>)
      } else {
        result.push(<div key={i} style={{ height: '8px' }} />)
      }
    }
  }
  if (currentTable) {
    result.push(
      <div key="table-end" style={{ overflowX: 'auto', margin: '12px 0', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
        <table className="data-table">
          <tbody>
            {currentTable.map((row, rIdx) => (
              <tr key={rIdx} style={{ borderBottom: rIdx === currentTable.length - 1 ? 'none' : '1px solid #E2E8F0', background: rIdx === 0 ? '#F8FAFC' : 'transparent' }}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} style={{ padding: '8px 12px', borderRight: cIdx === row.length - 1 ? 'none' : '1px solid #E2E8F0', fontWeight: rIdx === 0 ? 600 : 400 }}>{parseInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  return <div style={{ fontSize: '14px', fontFamily: "'Inter', sans-serif" }}>{result}</div>
}

export default function ChatPanel({ inventory = [], financeSummary, chatMessages: messages, setChatMessages: setMessages, showToast }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (overrideText = null) => {
    const text = overrideText || input.trim()
    if (!text) return

    const userMsg = { role: 'user', content: text }
    const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    
    setMessages(prev => [...prev, { ...userMsg, time: now }])
    setInput('')
    setLoading(true)

    try {
      const conversationHistory = messages.map(m => ({ role: m.role, content: m.content })).concat(userMsg)
      const systemPrompt = `You are OpsAgent, an AI back-office manager for a small service business.
Current inventory data: ${JSON.stringify(inventory)}
Current finance data: ${JSON.stringify(financeSummary)}
Answer questions with specific numbers and practical insights. Be concise and helpful. 
IMPORTANT: When asked about "low stock", carefully check all inventory items. An item is "low stock" if its "qty" is less than its "min" threshold.`

      const groqMessages = conversationHistory.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))

      const aiReply = await callAI(null, groqMessages, systemPrompt)
      
      if (!aiReply) throw new Error("Empty response from AI")
      
      setMessages(prev => [...prev, { role: 'assistant', content: aiReply, time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}. Please check your API key in Settings.`, time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }])
    } finally {
      setLoading(false)
    }
  }

  const starters = ["What's my low stock?", "Summarize finances", "Show open GRNs"]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '1024px', margin: '0 auto', paddingBottom: '24px' }}>
      
      <div style={{ flex: 1, background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        
        {/* Messages Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', background: '#EFF6FF', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                <Sparkles size={32} color="#2563EB" />
              </div>
              <p style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginBottom: '24px', fontFamily: "'Inter', sans-serif" }}>How can I help you today?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px' }}>
                {starters.map((s, i) => (
                  <button 
                    key={i} 
                    onClick={() => sendMessage(s)} 
                    disabled={loading} 
                    className="btn-press"
                    style={{
                      padding: '8px 16px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '99px',
                      fontSize: '13px', fontWeight: 600, color: '#64748B', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                      transition: 'all 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#2563EB'; e.currentTarget.style.borderColor = '#2563EB' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = '#E2E8F0' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '75%', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  padding: '14px 20px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  background: msg.role === 'user' ? '#2563EB' : '#F1F5F9',
                  color: msg.role === 'user' ? 'white' : '#0F172A',
                  borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  border: msg.role === 'assistant' ? '1px solid #E2E8F0' : 'none',
                }}>
                  {msg.role === 'assistant' ? renderMarkdown(msg.content) : <p style={{ fontSize: '14px', fontWeight: 500, lineHeight: 1.6, fontFamily: "'Inter', sans-serif", margin: 0 }}>{msg.content}</p>}
                </div>
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#94A3B8', marginTop: '6px', padding: '0 4px', fontFamily: "'Inter', sans-serif" }}>{msg.time}</span>
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '16px 20px', borderRadius: '12px 12px 12px 4px', display: 'flex', gap: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <div className="dot-bounce-1" style={{ width: '8px', height: '8px', background: '#94A3B8', borderRadius: '50%' }} />
                <div className="dot-bounce-2" style={{ width: '8px', height: '8px', background: '#94A3B8', borderRadius: '50%' }} />
                <div className="dot-bounce-3" style={{ width: '8px', height: '8px', background: '#94A3B8', borderRadius: '50%' }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <div style={{ padding: '20px', borderTop: '1px solid #E2E8F0', background: 'white' }}>
          <div style={{
            background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '99px',
            display: 'flex', alignItems: 'center', padding: '4px 4px 4px 16px',
            transition: 'all 0.2s'
          }} className="focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage() } }}
              disabled={loading}
              placeholder="Message OpsAgent..."
              style={{ flex: 1, height: '40px', background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', fontWeight: 500, color: '#0F172A', fontFamily: "'Inter', sans-serif" }}
            />
            <button
              onClick={() => sendMessage(null)}
              disabled={!input.trim() || loading}
              className="btn-press"
              style={{
                width: '36px', height: '36px', flexShrink: 0,
                background: (!input.trim() || loading) ? '#CBD5E1' : '#2563EB',
                color: 'white', border: 'none', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: (!input.trim() || loading) ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <Send size={16} style={{ marginLeft: input.trim() ? '2px' : '0' }} />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

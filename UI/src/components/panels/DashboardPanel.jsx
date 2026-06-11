import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { DollarSign, Receipt, AlertTriangle, Package, ArrowRight, Zap, RefreshCw, Archive, FileText, Clock, TrendingUp, Users } from 'lucide-react'
import SummaryCard from '../SummaryCard'
import FormattedAIResponse from '../ui/FormattedAIResponse'
import { backendFetch } from '../../utils/backend'

export default function DashboardPanel({ inventory = [], financeSummary = null, transactions = [], grnHistory = [], quotations = [], breakdownQuotations = [], finalizedQuotations = [], bills = [], purchaseOrders = [], onNavigate }) {
  const bqPending = breakdownQuotations.filter(q => ['Draft', 'Sent'].includes(q.status)).length
  const fqPendingBill = finalizedQuotations.filter(q => q.status === 'Active').length
  const billRevenue = bills.filter(b => b.paymentStatus === 'Paid').reduce((s, b) => s + (b.grandTotal || 0), 0)
  const pendingBillsCount = bills.filter(b => b.paymentStatus !== 'Paid').length
  const pendingBillsAmount = bills.filter(b => b.paymentStatus !== 'Paid').reduce((s, b) => s + (b.paymentStatus === 'Partial' ? (b.balanceDue || 0) : (b.grandTotal || 0)), 0)
  const lowStockItems = inventory.filter(item => item.qty < item.min)
  const overstockItems = inventory.filter(item => item.qty > item.max)
  const stockAlerts = lowStockItems.length + overstockItems.length

  const totalRevenue = transactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0)
  const pendingPayables = transactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const openGrns = grnHistory.filter(grn => grn.status === 'Pending').length
  const pendingPOs = purchaseOrders.filter(po => ['Draft', 'Sent'].includes(po.status)).length

  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState(null)

  const generateExecutiveSummary = async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    setSummary(null)

    try {
      const data = await backendFetch('/ai/executive-summary', {
        method: 'POST',
        body: JSON.stringify({
          summary: {
            revenue: totalRevenue,
            pendingPayables: pendingPayables,
            pendingBillsCount: pendingBillsCount,
            pendingBillsAmount: pendingBillsAmount,
            lowStockItemsCount: lowStockItems.length,
            overstockItemsCount: overstockItems.length,
            openGrns: openGrns,
            pendingPOs: pendingPOs
          },
          inventory: inventory.slice(0, 10),
          recentBills: bills.slice(0, 10),
          recentTransactions: transactions.slice(0, 10)
        })
      })
      if (data.success) setSummary(data.insight)
      else setSummaryError(data.error)
    } catch (err) {
      setSummaryError(err.message)
    } finally {
      setSummaryLoading(false)
    }
  }

  const cards = [
    {
      id: 'card-revenue',
      icon: DollarSign,
      title: 'Bill Revenue',
      value: `₹${Number(billRevenue).toLocaleString('en-IN')}`,
      trend: billRevenue > 0 ? 'up' : 'neutral', trendValue: billRevenue > 0 ? 'Paid bills' : '₹0',
      colors: { bg: '#EFF6FF', text: '#2563EB' }
    },
    {
      id: 'card-pending-bills',
      icon: Receipt,
      title: 'Pending Bills',
      value: String(pendingBillsCount),
      trend: pendingBillsCount > 0 ? 'up' : 'neutral', trendValue: pendingBillsCount > 0 ? `₹${Number(pendingBillsAmount).toLocaleString('en-IN')}` : '₹0',
      colors: { bg: '#FEF2F2', text: '#DC2626' }
    },
    {
      id: 'card-pos',
      icon: Archive,
      title: 'Pending POs',
      value: pendingPOs.toString(),
      trend: `${purchaseOrders.length} Total`,
      positive: true,
      colors: { bg: '#F5F3FF', text: '#7C3AED' }
    },
    {
      id: 'card-inventory',
      icon: AlertTriangle,
      title: 'Stock Alerts',
      value: inventory.length === 0 ? '—' : String(stockAlerts),
      trend: stockAlerts > 0 ? 'up' : 'neutral', trendValue: stockAlerts === 0 ? '0' : String(stockAlerts),
      colors: { bg: '#FFFBEB', text: '#D97706' }
    },
    {
      id: 'card-items',
      icon: Package,
      title: 'Open GRNs',
      value: String(openGrns),
      trend: openGrns > 0 ? 'up' : 'neutral', trendValue: `${openGrns} pending`,
      colors: { bg: '#F0FDF4', text: '#16A34A' }
    },
    {
      id: 'card-quotations',
      icon: FileText,
      title: 'Total Quotations',
      value: String(quotations.length),
      trend: quotations.length > 0 ? 'up' : 'neutral', trendValue: quotations.length > 0 ? 'All time' : '0',
      colors: { bg: '#F5F3FF', text: '#7C3AED' }
    },
    {
      id: 'card-pending-bq',
      icon: Clock,
      title: 'Pending BQs',
      value: String(bqPending),
      trend: bqPending > 0 ? 'up' : 'neutral', trendValue: bqPending > 0 ? 'Awaiting' : '0',
      colors: { bg: '#FFF7ED', text: '#EA580C' }
    },
    {
      id: 'card-pending-fq',
      icon: FileText,
      title: 'Active FQs',
      value: String(fqPendingBill),
      trend: fqPendingBill > 0 ? 'up' : 'neutral', trendValue: fqPendingBill > 0 ? 'To Bill' : '0',
      colors: { bg: '#F3E8FF', text: '#7E22CE' }
    },
  ]

  const recentTransactions = transactions.slice(0, 5)
  const recentGrns = grnHistory.slice(0, 3)
  const recentInventory = inventory.slice(0, 2)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {cards.map(card => <SummaryCard key={card.id} {...card} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }} className="grid-cols-1 lg:grid-cols-3">
        {/* Transactions */}
        <div className="lg:col-span-2 glass-card hover-up" style={{ borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px', borderBottom: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', fontFamily: "'Inter', sans-serif" }}>Recent Activity</h3>
          </div>
          
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9' }}>
             <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '12px' }}>Finance Transactions</h4>
             {recentTransactions.length > 0 ? (
               <div style={{ overflowX: 'auto' }}>
                 <table className="data-table">
                   <thead><tr><th>Date</th><th>Description</th><th>Entity</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'center' }}>Status</th></tr></thead>
                   <tbody>
                     {recentTransactions.map((tx, i) => (
                       <tr key={i}>
                         <td style={{ fontSize: '13px', color: '#64748B' }}>{tx.date}</td>
                         <td style={{ fontWeight: 600, color: '#0F172A' }}>{tx.description}</td>
                         <td style={{ color: '#64748B' }}>{tx.customer}</td>
                         <td style={{ textAlign: 'right', fontWeight: 600, color: tx.type === 'Income' ? '#16A34A' : '#0F172A' }}>{tx.type === 'Income' ? '+' : '-'}₹{Math.abs(tx.amount).toLocaleString('en-IN')}</td>
                         <td style={{ textAlign: 'center' }}>
                           <span className={`badge ${tx.status === 'Completed' ? 'badge-green' : 'badge-amber'}`}>{tx.status}</span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             ) : (
                <div style={{ padding: '24px', textAlign: 'center', background: '#F8FAFC', borderRadius: '8px' }}>
                  <p style={{ fontSize: '14px', color: '#64748B' }}>Upload finance data to see activity</p>
                </div>
             )}
          </div>

          {/* Recent Bills */}
          {bills.length > 0 && (
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '12px' }}>Recent Bills</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bills.slice(0, 3).map((b, i) => {
                  const sc = { Paid: '#16A34A', Unpaid: '#DC2626', Partial: '#D97706' }
                  const sb = { Paid: '#F0FDF4', Unpaid: '#FEF2F2', Partial: '#FFFBEB' }
                  return (
                    <div key={i} className="hover-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(248,250,252,0.6)', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#2563EB' }}>{b.billNumber}</p>
                        <p style={{ fontSize: '11px', color: '#64748B' }}>{b.customerName}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>₹{Number(b.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: sb[b.paymentStatus] || '#F1F5F9', color: sc[b.paymentStatus] || '#64748B' }}>{b.paymentStatus}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent Quotations */}
          {quotations.length > 0 && (
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '12px' }}>Recent Quotations</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {quotations.slice(0, 3).map((q, i) => {
                  const statusColors = { Draft: '#64748B', Sent: '#2563EB', Approved: '#16A34A', Rejected: '#DC2626' }
                  const statusBgs = { Draft: '#F1F5F9', Sent: '#EFF6FF', Approved: '#F0FDF4', Rejected: '#FEF2F2' }
                  return (
                    <div key={i} className="hover-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(248,250,252,0.6)', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#2563EB' }}>{q.quotationNumber}</p>
                        <p style={{ fontSize: '11px', color: '#64748B' }}>{q.customerName}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>₹{Number(q.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: statusBgs[q.status] || '#F1F5F9', color: statusColors[q.status] || '#64748B' }}>{q.status}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', md: {flexDirection: 'row'} }}>
            <div style={{ flex: 1, padding: '20px 24px', borderRight: '1px solid #F1F5F9' }}>
               <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '12px' }}>Recent GRNs</h4>
               {recentGrns.length > 0 ? (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                   {recentGrns.map((grn, i) => (
                     <div key={i} className="hover-up" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(248, 250, 252, 0.6)', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                       <div>
                         <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{grn.id}</p>
                         <p style={{ fontSize: '11px', color: '#64748B' }}>{grn.supplier}</p>
                       </div>
                       <div style={{ textAlign: 'right' }}>
                         <span className={`badge ${grn.status === 'Processed' ? 'badge-green' : 'badge-amber'}`}>{grn.status}</span>
                         <p style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>{grn.itemCount || (grn.items ? grn.items.length : 0)} items</p>
                       </div>
                     </div>
                   ))}
                 </div>
               ) : (
                  <div style={{ padding: '16px', textAlign: 'center' }}><p style={{ fontSize: '13px', color: '#94A3B8' }}>No recent GRNs</p></div>
               )}
            </div>
            
            <div style={{ flex: 1, padding: '20px 24px' }}>
               <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '12px' }}>Inventory Changes</h4>
               {recentInventory.length > 0 ? (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                   {recentInventory.map((item, i) => (
                     <div key={i} className="hover-up" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(248, 250, 252, 0.6)', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                       <div>
                         <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{item.name}</p>
                         <p style={{ fontSize: '11px', color: '#64748B' }}>{item.hsn}</p>
                       </div>
                       <div style={{ textAlign: 'right' }}>
                         <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{item.qty} {item.unit}</p>
                       </div>
                     </div>
                   ))}
                 </div>
               ) : (
                  <div style={{ padding: '16px', textAlign: 'center' }}><p style={{ fontSize: '13px', color: '#94A3B8' }}>No inventory items</p></div>
               )}
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <div className="glass-card hover-up" style={{ borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color="#2563EB" />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', fontFamily: "'Inter', sans-serif" }}>Agent Insights</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {lowStockItems.slice(0, 2).map((item, i) => (
              <div key={`low-${i}`} style={{ padding: '12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#DC2626', marginBottom: '4px' }}>Low Stock Alert</p>
                <p style={{ fontSize: '13px', color: '#7F1D1D', lineHeight: 1.4 }}>Reorder <strong style={{ fontWeight: 600 }}>{item.name}</strong>. Only {item.qty} {item.unit} left (min: {item.min}).</p>
              </div>
            ))}
            {(!lowStockItems.length && !overstockItems.length) && (
              <div style={{ padding: '12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#16A34A', marginBottom: '4px' }}>System Healthy</p>
                <p style={{ fontSize: '13px', color: '#14532D', lineHeight: 1.4 }}>All inventory levels are optimal. No immediate actions required.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Reports */}
      <div className="glass-card hover-up" style={{ borderRadius: '12px', padding: '24px', marginTop: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>Quick Reports</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Sales Report', icon: TrendingUp, tab: 'sales' },
            { label: 'Stock Report', icon: Package, tab: 'inventory' },
            { label: 'GST Report', icon: Receipt, tab: 'gst' },
            { label: 'Customer Report', icon: Users, tab: 'customers' },
            { label: '🗂️ Category Report', icon: null, tab: 'category' },
          ].map(({ label, icon: Icon, tab }, i) => (
            <button
              key={i}
              onClick={() => {
                localStorage.setItem('opsagent_reports_tab', tab)
                onNavigate('reports')
              }}
              className="btn-press"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px', background: tab === 'category' ? '#EDE9FE' : '#F8FAFC',
                border: tab === 'category' ? '1px solid #C4B5FD' : '1px solid #E2E8F0',
                borderRadius: '8px', color: tab === 'category' ? '#7C3AED' : '#334155',
                fontWeight: 600, fontSize: '13px', cursor: 'pointer'
              }}
              onMouseEnter={e => e.currentTarget.style.background = tab === 'category' ? '#DDD6FE' : '#EFF6FF'}
              onMouseLeave={e => e.currentTarget.style.background = tab === 'category' ? '#EDE9FE' : '#F8FAFC'}
            >
              {Icon ? <Icon size={16} color={tab === 'category' ? '#7C3AED' : '#2563EB'} /> : null} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Health Widget */}
      {inventory.length > 0 && (() => {
        const catMap = {}
        inventory.forEach(item => {
          const cat = item.category || 'Uncategorized'
          if (!catMap[cat]) catMap[cat] = 0
          catMap[cat] += (Number(item.qty) || 0) * (Number(item.rate) || 0)
        })
        const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
        const COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626']
        
        const chartData = sorted.map(([name, value]) => ({ name, value }))

        return (
          <div className="glass-card hover-up" style={{ borderRadius: '12px', padding: '20px 24px', marginTop: '0', cursor: 'pointer' }} onClick={() => { localStorage.setItem('opsagent_reports_tab', 'category'); onNavigate('reports') }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>🗂️ Inventory by Category</h3>
              <span style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>View full report <ArrowRight size={11} /></span>
            </div>
            
            <div style={{ height: 160, width: '100%', marginBottom: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip 
                    cursor={{ fill: '#F1F5F9' }}
                    formatter={(value) => ['₹' + Math.round(value).toLocaleString('en-IN'), 'Value']}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            
          </div>
        )
      })()}

      <div style={{
        background: 'white',
        borderRadius: 16,
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        marginTop: 24
      }}>
        
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: 'white'
            }}>
              ✨ AI Executive Summary
            </h3>
            <p style={{
              margin: '4px 0 0',
              fontSize: 12,
              color: '#94A3B8'
            }}>
              AI-powered analysis of your business performance
            </p>
          </div>

          <button
            onClick={generateExecutiveSummary}
            disabled={summaryLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: summaryLoading ? '#374151' : 'linear-gradient(135deg, #2563EB, #7C3AED)',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: summaryLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: summaryLoading ? 'none' : '0 4px 15px rgba(37,99,235,0.4)'
            }}
          >
            {summaryLoading ? (
              <>
                <div style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite'
                }}/>
                Analyzing...
              </>
            ) : (
              <>
                ✨ Generate Summary
              </>
            )}
          </button>
        </div>

        {/* Content area */}
        <div style={{ padding: 24 }}>
          
          {/* Default state */}
          {!summary && !summaryLoading && !summaryError && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
              <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
                Click "Generate Summary" to get an AI-powered analysis of your current business performance
              </p>
            </div>
          )}

          {/* Loading state */}
          {summaryLoading && (
            <div style={{ padding: '16px 0' }}>
              {[
                'Reading your sales data...',
                'Analyzing inventory levels...',
                'Identifying key trends...',
                'Preparing insights...'
              ].map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 0',
                    animation: `fadeIn 0.5s ease ${i * 0.3}s both`
                  }}
                >
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: '2px solid #2563EB',
                    borderTopColor: 'transparent',
                    animation: 'spin 0.8s linear infinite'
                  }}/>
                  <span style={{ fontSize: 13, color: '#64748B' }}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {summaryError && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: 8,
              padding: 16,
              color: '#DC2626',
              fontSize: 13
            }}>
              ⚠️ {summaryError}
            </div>
          )}

          {/* Summary result */}
          {summary && !summaryLoading && (
            <div style={{ animation: 'fadeInUp 0.5s ease' }}>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: '#374151' }}>
                <FormattedAIResponse text={summary} />
              </div>

              {/* Regenerate button */}
              <div style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: '1px solid #F1F5F9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>
                  Generated just now by Llama 3.1 via Groq
                </span>
                <button
                  onClick={generateExecutiveSummary}
                  style={{
                    background: 'none',
                    border: '1px solid #E2E8F0',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    color: '#64748B',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

import { DollarSign, Receipt, AlertTriangle, Package, ArrowRight, Zap, RefreshCw, Archive, FileText, Clock, TrendingUp, Users } from 'lucide-react'
import SummaryCard from '../SummaryCard'

export default function DashboardPanel({ inventory = [], financeSummary = null, transactions = [], grnHistory = [], quotations = [], bills = [], purchaseOrders = [], onNavigate }) {
  const pendingApproval = quotations.filter(q => q.status === 'Sent').length
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
      id: 'card-pending-approval',
      icon: Clock,
      title: 'Pending Approval',
      value: String(pendingApproval),
      trend: pendingApproval > 0 ? 'up' : 'neutral', trendValue: pendingApproval > 0 ? 'Awaiting' : '0',
      colors: { bg: '#FFF7ED', text: '#EA580C' }
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
                padding: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0',
                borderRadius: '8px', color: '#334155', fontWeight: 600, fontSize: '13px', cursor: 'pointer'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
              onMouseLeave={e => e.currentTarget.style.background = '#F8FAFC'}
            >
              <Icon size={16} color="#2563EB" /> {label}
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}

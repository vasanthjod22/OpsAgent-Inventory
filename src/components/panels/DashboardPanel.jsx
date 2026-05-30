import { DollarSign, Receipt, AlertTriangle, Package, ArrowRight, Zap, RefreshCw, Archive } from 'lucide-react'
import SummaryCard from '../SummaryCard'

export default function DashboardPanel({ inventory = [], financeSummary = null, transactions = [], grnHistory = [] }) {
  const lowStockItems = inventory.filter(item => item.qty < item.min)
  const overstockItems = inventory.filter(item => item.qty > item.max)
  const stockAlerts = lowStockItems.length + overstockItems.length

  const totalRevenue = transactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0)
  const pendingPayables = transactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const openGrns = grnHistory.filter(grn => grn.status === 'Pending').length

  const cards = [
    {
      id: 'card-revenue',
      icon: DollarSign,
      title: 'Total Revenue',
      value: `₹${Number(totalRevenue).toLocaleString('en-IN')}`,
      trend: totalRevenue > 0 ? 'up' : 'neutral', trendValue: totalRevenue > 0 ? 'Current' : '',
      colors: { bg: '#EFF6FF', text: '#2563EB' }
    },
    {
      id: 'card-payables',
      icon: Receipt,
      title: 'Total Expenses',
      value: `₹${Number(pendingPayables).toLocaleString('en-IN')}`,
      trend: pendingPayables > 0 ? 'up' : 'neutral', trendValue: pendingPayables > 0 ? 'Current' : '',
      colors: { bg: '#FEF2F2', text: '#DC2626' }
    },
    {
      id: 'card-stock',
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
                         <p style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>{grn.items} items</p>
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
                         <p style={{ fontSize: '11px', color: '#64748B' }}>{item.sku}</p>
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
    </div>
  )
}

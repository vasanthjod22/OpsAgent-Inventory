import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Package, Search } from 'lucide-react'
import SummaryCard from '../SummaryCard'

export default function DemandsPanel({ bills = [] }) {
  const [searchTerm, setSearchTerm] = useState('')

  // Calculate demand from bills
  const { sortedItems, totalSold } = useMemo(() => {
    const counts = {}
    let total = 0
    
    bills.forEach(bill => {
      if (Array.isArray(bill.items)) {
        bill.items.forEach(item => {
          const name = item.description?.trim()
          const qty = Number(item.quantity) || 0
          if (name && qty > 0) {
            counts[name] = (counts[name] || 0) + qty
            total += qty
          }
        })
      }
    })

    const sorted = Object.entries(counts)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)

    return { sortedItems: sorted, totalSold: total }
  }, [bills])

  const maxSold = sortedItems.length > 0 ? sortedItems[0] : null
  const minSold = sortedItems.length > 0 ? sortedItems[sortedItems.length - 1] : null

  const filteredItems = sortedItems.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const top5 = sortedItems.slice(0, 5)
  const bottom5 = sortedItems.slice(-5).reverse()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
      
      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <SummaryCard id="demand-max" icon={TrendingUp} title="Max Sold Product"
          value={maxSold ? maxSold.name : 'N/A'}
          trend="up" trendValue={maxSold ? `${maxSold.qty} units sold` : ''}
          colors={{ bg: '#F0FDF4', text: '#16A34A' }} 
        />
        <SummaryCard id="demand-min" icon={TrendingDown} title="Min Sold Product"
          value={minSold ? minSold.name : 'N/A'}
          trend="down" trendValue={minSold ? `${minSold.qty} units sold` : ''}
          colors={{ bg: '#FEF2F2', text: '#DC2626' }} 
        />
        <SummaryCard id="demand-total" icon={Package} title="Total Products Sold"
          value={totalSold.toLocaleString('en-IN')}
          trend="neutral" trendValue="Across all bills"
          colors={{ bg: '#EFF6FF', text: '#2563EB' }} 
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Top 5 Products */}
        <div className="glass-card hover-up" style={{ borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '20px', fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="#16A34A" />
            Top 5 High Demand Products
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {top5.length > 0 ? top5.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ width: '20px', fontSize: '12px', fontWeight: 700, color: '#94A3B8' }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: '14px', color: '#0F172A', fontWeight: 500 }}>
                  {item.name}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#16A34A', background: '#F0FDF4', padding: '4px 8px', borderRadius: '6px' }}>
                  {item.qty} units
                </span>
              </div>
            )) : (
              <div style={{ color: '#94A3B8', fontSize: '13px' }}>No sales data available.</div>
            )}
          </div>
        </div>

        {/* Bottom 5 Products */}
        <div className="glass-card hover-up" style={{ borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '20px', fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingDown size={18} color="#DC2626" />
            Lowest Demand Products (Bottom 5)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {bottom5.length > 0 ? bottom5.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ width: '20px', fontSize: '12px', fontWeight: 700, color: '#94A3B8' }}>#{sortedItems.length - i}</span>
                <span style={{ flex: 1, fontSize: '14px', color: '#0F172A', fontWeight: 500 }}>
                  {item.name}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#DC2626', background: '#FEF2F2', padding: '4px 8px', borderRadius: '6px' }}>
                  {item.qty} units
                </span>
              </div>
            )) : (
              <div style={{ color: '#94A3B8', fontSize: '13px' }}>No sales data available.</div>
            )}
          </div>
        </div>
      </div>

      {/* Full Demand List */}
      <div className="glass-card" style={{ borderRadius: '12px', padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', fontFamily: "'Inter', sans-serif" }}>
            All Product Demands
          </h3>
          <div style={{ 
            display: 'flex', alignItems: 'center', background: '#F8FAFC', 
            border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 12px', width: '240px' 
          }}>
            <Search size={14} color="#94A3B8" />
            <input 
              type="text" 
              placeholder="Search product..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', marginLeft: '8px', width: '100%' }}
            />
          </div>
        </div>
        
        <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
              <tr>
                <th>Rank</th>
                <th>Product Description</th>
                <th style={{ textAlign: 'right' }}>Total Units Sold</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length > 0 ? filteredItems.map((item, i) => (
                <tr key={i}>
                  <td style={{ width: '60px', color: '#64748B', fontWeight: 600 }}>#{sortedItems.findIndex(x => x.name === item.name) + 1}</td>
                  <td style={{ fontWeight: 500, color: '#0F172A' }}>{item.name}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#2563EB' }}>
                    {item.qty.toLocaleString('en-IN')}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

import { useState } from 'react'
import { Search, Plus, X, Package, Trash2, Edit2, AlertTriangle, AlertCircle, Filter } from 'lucide-react'

export default function InventoryPanel({ inventory = [], setInventory, showToast }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({ sku: '', name: '', category: 'Raw Materials', qty: '', unit: '', min: '', max: '' })

  const categories = ['Raw Materials', 'Finished Goods', 'Packaging', 'Consumables']

  const getStatus = (item) => {
    if (item.qty < item.min) return 'Low Stock'
    if (item.qty > item.max) return 'Overstock'
    return 'OK'
  }

  const handleDelete = (sku) => {
    setInventory(prev => prev.filter(i => i.sku !== sku))
    showToast?.(`Item ${sku} deleted`, 'success')
  }

  const enriched = inventory.map(item => ({ ...item, status: getStatus(item) }))
  const filtered = enriched.filter(item => {
    if (filter !== 'All' && item.status !== filter) return false
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !item.sku.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleAdd = () => {
    if (!newItem.sku || !newItem.name) return showToast?.('SKU and Name are required', 'error')
    setInventory(prev => [{ ...newItem, qty: Number(newItem.qty) || 0, min: Number(newItem.min) || 0, max: Number(newItem.max) || 0 }, ...prev])
    setAdding(false)
    setNewItem({ sku: '', name: '', category: 'Raw Materials', qty: '', unit: '', min: '', max: '' })
    showToast?.('Item added successfully', 'success')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', fontFamily: "'Inter', sans-serif" }}>Inventory</h2>
          <span className="badge badge-gray">{enriched.length} items</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} className="input-base" style={{ paddingLeft: '36px' }} />
          </div>
          <button onClick={() => setAdding(true)} className="btn-press" style={{ height: '40px', padding: '0 16px', background: '#2563EB', color: 'white', borderRadius: '8px', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}><Plus size={16} /> Add Item</button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="glass-card hover-up" style={{ padding: '16px', background: 'rgba(239, 246, 255, 0.6)', border: '1px solid #BFDBFE', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', background: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={16} color="#2563EB" /></div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E3A8A' }}>Total SKUs</span>
          </div>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#1E3A8A' }}>{enriched.length}</span>
        </div>
        <div className="glass-card hover-up" style={{ padding: '16px', background: 'rgba(254, 242, 242, 0.6)', border: '1px solid #FECACA', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', background: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={16} color="#DC2626" /></div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#7F1D1D' }}>Low Stock</span>
          </div>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#7F1D1D' }}>{enriched.filter(i => i.status === 'Low Stock').length}</span>
        </div>
        <div className="glass-card hover-up" style={{ padding: '16px', background: 'rgba(255, 251, 235, 0.6)', border: '1px solid #FDE68A', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', background: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={16} color="#D97706" /></div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#78350F' }}>Overstock</span>
          </div>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#78350F' }}>{enriched.filter(i => i.status === 'Overstock').length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card hover-up" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>SKU</th><th>Item Name</th><th>Category</th><th>Current Qty</th><th>Min/Max</th><th style={{ textAlign: 'center' }}>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {filtered.map(item => {
                const pct = Math.min((item.qty / (item.max || 1)) * 100, 100)
                const isLow = item.status === 'Low Stock'
                return (
                  <tr key={item.sku} style={{ borderLeft: isLow ? '3px solid #DC2626' : '3px solid transparent' }}>
                    <td style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>{item.sku}</td>
                    <td style={{ fontWeight: 600, color: '#0F172A' }}>{item.name}</td>
                    <td style={{ color: '#64748B' }}>{item.category}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: '#0F172A' }}>{item.qty} <span style={{ fontWeight: 400, color: '#94A3B8' }}>{item.unit}</span></span>
                        <div style={{ width: '100px', height: '4px', background: '#F1F5F9', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: isLow ? '#DC2626' : item.status === 'Overstock' ? '#D97706' : '#16A34A', borderRadius: '99px' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ color: '#94A3B8', fontSize: '13px' }}>{item.min} / {item.max}</td>
                    <td style={{ textAlign: 'center' }}><span className={`badge ${isLow ? 'badge-red' : item.status === 'Overstock' ? 'badge-amber' : 'badge-green'}`}>{item.status}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => handleDelete(item.sku)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: '4px' }} onMouseEnter={e => e.currentTarget.style.color = '#DC2626'} onMouseLeave={e => e.currentTarget.style.color = '#CBD5E1'}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: '64px 0', textAlign: 'center', color: '#94A3B8' }}>No items found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {adding && (
        <div className="modal-in" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>Add New Item</h3>
              <button onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Item Name</label>
                <input type="text" className="input-base" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="e.g. Hydraulic Filter" autoFocus />
              </div>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>SKU / Code</label><input type="text" className="input-base" value={newItem.sku} onChange={e => setNewItem({...newItem, sku: e.target.value})} /></div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Category</label>
                <select className="input-base" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
              </div>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Current Qty</label><input type="number" className="input-base" value={newItem.qty} onChange={e => setNewItem({...newItem, qty: e.target.value})} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Unit</label><input type="text" className="input-base" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Min Level</label><input type="number" className="input-base" value={newItem.min} onChange={e => setNewItem({...newItem, min: e.target.value})} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Max Level</label><input type="number" className="input-base" value={newItem.max} onChange={e => setNewItem({...newItem, max: e.target.value})} /></div>
            </div>
            <div style={{ padding: '16px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setAdding(false)} className="btn-press" style={{ padding: '0 16px', height: '40px', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'white', fontWeight: 600, fontSize: '13px', color: '#64748B', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAdd} className="btn-press" style={{ padding: '0 16px', height: '40px', borderRadius: '8px', border: 'none', background: '#2563EB', fontWeight: 600, fontSize: '13px', color: 'white', cursor: 'pointer' }}>Add Item</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

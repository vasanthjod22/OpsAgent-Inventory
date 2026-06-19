import React, { useState } from 'react';
import { Pencil, AlertTriangle, Trash2, Info } from 'lucide-react';
import { ActionBtn, ColHeader } from './InventoryShared';
import useMediaQuery from '../../../hooks/useMediaQuery';
import { ValuationBreakdownModal } from './ValuationPanel';

export default function InventoryTable({
  items,
  pagination,
  search,
  getValue,
  handleFieldChange,
  saveFieldToBackend,
  grnHistory,
  handleEditClick,
  handleDamage,
  handleDelete,
  formatQty
}) {
  const [valuationItem, setValuationItem] = useState(null);

  const formatDate = (d) => {
    if (!d) return '—'
    const date = new Date(d)
    return isNaN(date) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const getStatus = (cq, min, max) => {
    if (cq === 0) return { label: 'Out of Stock', color: '#4F46E5', bg: '#EEF2FF' }
    if (cq < min) return { label: 'Low Stock', color: '#EA580C', bg: '#FFF7ED' }
    if (max > 0 && cq > max) return { label: 'Overstock', color: '#D97706', bg: '#FEF3C7' }
    return { label: 'OK', color: '#16A34A', bg: '#F0FDF4' }
  }

  const inputStyle = { width: '100%', padding: '4px 6px', border: '1px solid transparent', borderRadius: 4, outlineColor: '#2563EB', fontSize: 13, background: 'transparent' }
  const inputFocusStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }

  const isMobile = useMediaQuery('(max-width: 768px)')

  const displayedItems = (!search && items.length > pagination.itemsPerPage) 
    ? items.slice((pagination.currentPage - 1) * pagination.itemsPerPage, pagination.currentPage * pagination.itemsPerPage) 
    : items;

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 16px', background: 'var(--bg-main)' }}>
        {displayedItems.map((item, index) => {
          const currentQty = item.qty || 0;
          const totalValue = currentQty * (item.purchase_rate || item.rate || 0);
          const statBadge = getStatus(currentQty, item.min || 0, item.max || 0);

          return (
            <div key={item.id} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.hsn || item.sku} &bull; {item.category}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: statBadge.color, background: statBadge.bg, padding: '4px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                  {statBadge.label}
                </span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--bg-main)', padding: 10, borderRadius: 8, border: '1px solid #F1F5F9' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Current Stock</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#10B981', marginTop: 2 }}>{formatQty(currentQty)} {item.unit}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Purchase Rate</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>₹{Number(getValue(item, 'purchase_rate') || getValue(item, 'rate') || 0).toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Value</div>
                  <div 
                    onClick={() => setValuationItem(item)}
                    style={{ fontSize: 14, fontWeight: 700, color: '#059669', marginTop: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    title="Click for Valuation Breakdown"
                  >
                    ₹{totalValue.toFixed(2)}
                    <Info size={14} color="#059669" />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Sold</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#3B82F6', marginTop: 2 }}>{formatQty(Math.max(0, (item.total_qty ?? item.qty) - currentQty))}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4, borderTop: '1px solid #F1F5F9' }}>
                <ActionBtn color="#2563EB" hover="#1D4ED8" icon={<Pencil size={14} />} title="Edit Item" onClick={() => handleEditClick(item)} />
                <ActionBtn color="#EA580C" hover="#C2410C" icon={<AlertTriangle size={14} />} title="Mark Damaged" onClick={() => handleDamage(item)} />
                <ActionBtn color="#DC2626" hover="#B91C1C" icon={<Trash2 size={14} />} title="Delete Item" onClick={() => handleDelete(item)} />
              </div>
            </div>
          )
        })}
        {valuationItem && (
          <ValuationBreakdownModal item={valuationItem} onClose={() => setValuationItem(null)} />
        )}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%', borderTop: '1px solid var(--border)', paddingBottom: 16 }}>
      <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid #E2E8F0' }}>
            <th style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--bg-main)', width: 50, padding: '12px 8px' }}><ColHeader label="#" /></th>
            <th style={{ width: 100, padding: '12px 8px' }}><ColHeader label="HSN/SKU" tooltip="HSN Code / Stock Keeping Unit" /></th>
            <th style={{ width: 200, padding: '12px 8px' }}><ColHeader label="Item Name" /></th>
            <th style={{ width: 120, padding: '12px 8px' }}><ColHeader label="Category" /></th>
            <th style={{ width: 90, padding: '12px 8px' }}><ColHeader label="Total Qty" tooltip="Opening stock / Total quantity" /></th>
            <th style={{ width: 80, padding: '12px 8px' }}><ColHeader label="Current Qty" tooltip="Current stock available" /></th>
            <th style={{ width: 80, padding: '12px 8px' }}><ColHeader label="Sold Qty" tooltip="Total sold from bills" /></th>
            <th style={{ width: 80, padding: '12px 8px' }}><ColHeader label="Damaged" tooltip="Written off / damaged units" /></th>
            <th style={{ width: 70, padding: '12px 8px' }}><ColHeader label="Unit" /></th>
            <th style={{ width: 80, padding: '12px 8px' }}><ColHeader label="Min" tooltip="Minimum stock / reorder point" /></th>
            <th style={{ width: 80, padding: '12px 8px' }}><ColHeader label="Max" /></th>
            <th style={{ width: 90, padding: '12px 8px' }}><ColHeader label="Reorder Qty" tooltip="Quantity to order when stock hits Min" /></th>
            <th style={{ width: 110, padding: '12px 8px' }}><ColHeader label="Purchase Rate" tooltip="Cost price per unit" /></th>
            <th style={{ width: 70, padding: '12px 8px' }}><ColHeader label="CGST %" /></th>
            <th style={{ width: 70, padding: '12px 8px' }}><ColHeader label="SGST %" /></th>
            <th style={{ width: 80, padding: '12px 8px' }}><ColHeader label="GST %" tooltip="Total GST (CGST + SGST)" /></th>
            <th style={{ width: 110, padding: '12px 8px' }}><ColHeader label="Total Value" tooltip="Current Qty × Purchase Rate" /></th>
            <th style={{ width: 130, padding: '12px 8px' }}><ColHeader label="Supplier" /></th>
            <th style={{ width: 100, padding: '12px 8px' }}><ColHeader label="Date Added" /></th>
            <th style={{ width: 100, padding: '12px 8px' }}><ColHeader label="Last Restock" /></th>
            <th style={{ width: 110, padding: '12px 8px' }}><ColHeader label="Status" /></th>
            <th style={{ position: 'sticky', right: 0, zIndex: 2, background: 'var(--bg-main)', width: 110, padding: '12px 8px', boxShadow: '-2px 0 4px rgba(0,0,0,0.05)' }}><ColHeader label="Actions" /></th>
          </tr>
        </thead>
        <tbody>
          {displayedItems.map((item, index) => {
            const currentQty = item.qty || 0
            const totalValue = currentQty * (item.purchase_rate || item.rate || 0)
            const statBadge = getStatus(currentQty, item.min || 0, item.max || 0)

            return (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', ':hover': { background: 'var(--bg-main)' } }}>
                <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-card)', fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, padding: '12px 8px' }}>
                  {(pagination.currentPage - 1) * pagination.itemsPerPage + index + 1}
                </td>
                <td style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, padding: '12px 8px' }}>{item.hsn || item.sku}</td>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)', padding: '12px 8px' }}>{item.name}</td>
                <td style={{ color: 'var(--text-primary)', padding: '12px 8px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 99, background: 'var(--bg-main)', fontSize: 12 }}>{item.category}</span>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-muted)', padding: '12px 8px' }}>{formatQty(item.total_qty ?? item.qty)}</td>
                <td style={{ padding: '12px 8px' }}>
                  <span style={{ fontWeight: 700, color: '#10B981', fontSize: 14 }}>{formatQty(currentQty)}</span>
                </td>
                <td style={{ fontWeight: 600, color: '#3B82F6', padding: '12px 8px' }}>{formatQty(Math.max(0, (item.total_qty ?? item.qty) - currentQty))}</td>
                <td style={{ fontWeight: 600, color: '#EF4444', padding: '12px 8px' }}>{formatQty(item.damaged_qty)}</td>
                <td style={{ color: 'var(--text-muted)', padding: '12px 8px' }}>{item.unit}</td>
                <td style={{ padding: '4px 8px' }}>
                  <input type="number"
                    value={getValue(item, 'min')}
                    onChange={e => handleFieldChange(item.id, 'min', e.target.value)}
                    onBlur={() => saveFieldToBackend(item, 'min')}
                    onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                    onMouseLeave={e => { if(document.activeElement !== e.target) Object.assign(e.target.style, inputStyle) }}
                    style={inputStyle}
                  />
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <input type="number"
                    value={getValue(item, 'max')}
                    onChange={e => handleFieldChange(item.id, 'max', e.target.value)}
                    onBlur={() => saveFieldToBackend(item, 'max')}
                    onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                    onMouseLeave={e => { if(document.activeElement !== e.target) Object.assign(e.target.style, inputStyle) }}
                    style={inputStyle}
                  />
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <input type="number"
                    value={getValue(item, 'reorder_qty')}
                    onChange={e => handleFieldChange(item.id, 'reorder_qty', e.target.value)}
                    onBlur={() => saveFieldToBackend(item, 'reorder_qty')}
                    onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                    onMouseLeave={e => { if(document.activeElement !== e.target) Object.assign(e.target.style, inputStyle) }}
                    style={inputStyle}
                  />
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13, flexShrink: 0 }}>₹</span>
                    <input type="number"
                      value={getValue(item, 'purchase_rate') || getValue(item, 'rate')}
                      onChange={e => handleFieldChange(item.id, 'purchase_rate', e.target.value)}
                      onBlur={() => saveFieldToBackend(item, 'purchase_rate')}
                      onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                      onMouseLeave={e => { if(document.activeElement !== e.target) Object.assign(e.target.style, inputStyle) }}
                      style={{ ...inputStyle, width: '70px', padding: '4px 4px', flexShrink: 0 }}
                    />
                    {(() => {
                      let priceHist = [];
                      grnHistory.forEach(g => {
                        const match = g.items?.find(it => (it.description || '').toLowerCase() === (item.name || '').toLowerCase());
                        if (match && match.unit_price) priceHist.push(Number(match.unit_price));
                      });
                      let curRate = Number(getValue(item, 'purchase_rate') || getValue(item, 'rate')) || 0;
                      let prevRate = priceHist.find(p => p !== curRate) || (priceHist.length > 1 ? priceHist[1] : null);
                      if (prevRate && curRate) {
                        if (curRate > prevRate) return <span style={{ color: '#10B981', fontWeight: 'bold', flexShrink: 0 }} title={`Up from ₹${prevRate} in older GRN`}>↑</span>;
                        if (curRate < prevRate) return <span style={{ color: '#EF4444', fontWeight: 'bold', flexShrink: 0 }} title={`Down from ₹${prevRate} in older GRN`}>↓</span>;
                      }
                      return null;
                    })()}
                  </div>
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <input type="number"
                    value={getValue(item, 'cgst_percent')}
                    onChange={e => handleFieldChange(item.id, 'cgst_percent', e.target.value)}
                    onBlur={() => saveFieldToBackend(item, 'cgst_percent')}
                    onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                    onMouseLeave={e => { if(document.activeElement !== e.target) Object.assign(e.target.style, inputStyle) }}
                    style={{ ...inputStyle, width: 50 }}
                  />
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <input type="number"
                    value={getValue(item, 'sgst_percent')}
                    onChange={e => handleFieldChange(item.id, 'sgst_percent', e.target.value)}
                    onBlur={() => saveFieldToBackend(item, 'sgst_percent')}
                    onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                    onMouseLeave={e => { if(document.activeElement !== e.target) Object.assign(e.target.style, inputStyle) }}
                    style={{ ...inputStyle, width: 50 }}
                  />
                </td>
                <td style={{ color: 'var(--text-primary)', padding: '12px 8px', fontWeight: 600 }}>
                  {Number(item.cgst_percent || 0) + Number(item.sgst_percent || 0)}%
                </td>
                <td 
                  onClick={() => setValuationItem(item)}
                  style={{ color: '#059669', padding: '12px 8px', fontWeight: 700, cursor: 'pointer' }}
                  title="Click for Valuation Breakdown"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    ₹{totalValue.toFixed(2)}
                    <Info size={14} color="#059669" />
                  </div>
                </td>
                <td style={{ color: 'var(--text-muted)', padding: '12px 8px' }}>{item.supplier_name || '—'}</td>
                <td style={{ color: 'var(--text-muted)', padding: '12px 8px', fontSize: 12 }}>
                  {item.date_added ? formatDate(item.date_added) : '—'}
                </td>
                <td style={{ color: 'var(--text-muted)', padding: '12px 8px', fontSize: 12 }}>
                  {item.last_restocked ? formatDate(item.last_restocked) : '—'}
                </td>
                <td style={{ padding: '12px 8px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: statBadge.color, background: statBadge.bg, padding: '4px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                    {statBadge.label}
                  </span>
                </td>
                <td style={{ position: 'sticky', right: 0, zIndex: 1, background: 'var(--bg-card)', padding: '12px 8px', boxShadow: '-2px 0 4px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <ActionBtn color="#2563EB" hover="#1D4ED8" icon={<Pencil size={14} />} title="Edit Item" onClick={() => handleEditClick(item)} />
                    <ActionBtn color="#EA580C" hover="#C2410C" icon={<AlertTriangle size={14} />} title="Mark Damaged" onClick={() => handleDamage(item)} />
                    <ActionBtn color="#DC2626" hover="#B91C1C" icon={<Trash2 size={14} />} title="Delete Item" onClick={() => handleDelete(item)} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {valuationItem && (
        <ValuationBreakdownModal item={valuationItem} onClose={() => setValuationItem(null)} />
      )}
    </div>
  );
}

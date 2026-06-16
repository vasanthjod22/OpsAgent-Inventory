import React from 'react';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { ActionBtn } from './InventoryShared';
import useMediaQuery from '../../../hooks/useMediaQuery';

export default function GRNHistoryTable({
  grnHistory,
  grnData,
  expandedGrnId,
  setExpandedGrnId,
  handleDeleteGrn
}) {
  if (grnHistory.length === 0 || grnData) return null;

  const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return isNaN(date) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    return (
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: 16 }}>
        <h4 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 12px 0' }}>Recent Goods Receipts (GRN)</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grnHistory.map((g) => (
            <div key={g.id} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 12, background: expandedGrnId === g.id ? '#F8FAFC' : 'white' }}>
              <div 
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setExpandedGrnId(expandedGrnId === g.id ? null : g.id)}
              >
                <div>
                  <div style={{ fontSize: 13, color: '#64748B', fontWeight: 500, marginBottom: 2 }}>{formatDate(g.date || g.created_at)}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{g.supplier}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                    {g.items?.length || 0} items
                  </span>
                  {expandedGrnId === g.id ? <ChevronDown size={16} color="#64748B" /> : <ChevronRight size={16} color="#64748B" />}
                </div>
              </div>

              {expandedGrnId === g.id && (
                <div style={{ marginTop: 12, borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(g.items || []).map((it, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: 8, borderRadius: 6, border: '1px solid #F1F5F9' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{it.description}</div>
                          <div style={{ fontSize: 12, color: '#64748B' }}>{it.quantity} {it.unit}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#10B981' }}>₹{it.unit_price || 0}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <ActionBtn icon={<Trash2 size={16} />} color="#EF4444" hover="#DC2626" title="Delete GRN" onClick={(e) => { e.stopPropagation(); handleDeleteGrn(g); }} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: 24 }}>
      <h4 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 16px 0' }}>Recent Goods Receipts (GRN)</h4>
      <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead><tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Date</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Supplier</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Items Received</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Actions</th>
          </tr></thead>
          <tbody>
            {grnHistory.map((g) => (
              <React.Fragment key={g.id}>
                <tr 
                  onClick={() => setExpandedGrnId(expandedGrnId === g.id ? null : g.id)}
                  style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer', background: expandedGrnId === g.id ? '#FAFBFC' : 'transparent' }}
                >
                  <td style={{ padding: '12px 16px', color: '#0F172A', fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ transform: expandedGrnId === g.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block', color: '#94A3B8' }}>▶</span>
                      {formatDate(g.date || g.created_at)}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1E293B' }}>{g.supplier}</td>
                  <td style={{ padding: '12px 16px', color: '#64748B' }}><span style={{ background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>{g.items?.length || 0} items</span></td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <ActionBtn icon={<Trash2 size={16} />} color="#EF4444" hover="#DC2626" title="Delete GRN" onClick={(e) => { e.stopPropagation(); handleDeleteGrn(g); }} />
                  </td>
                </tr>
                {expandedGrnId === g.id && (
                  <tr>
                    <td colSpan="4" style={{ padding: 0, borderBottom: '1px solid #E2E8F0' }}>
                      <div style={{ background: '#F8FAFC', padding: '16px 40px' }}>
                        <table style={{ width: '100%', fontSize: 13, textAlign: 'left', borderCollapse: 'collapse', background: 'white', borderRadius: 8, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                          <thead>
                            <tr style={{ background: '#F1F5F9' }}>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Item</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Qty</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(g.items || []).map((it, i) => {
                              return (
                                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{it.description}</td>
                                  <td style={{ padding: '8px 12px' }}>{it.quantity} {it.unit}</td>
                                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>₹{it.unit_price || 0}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

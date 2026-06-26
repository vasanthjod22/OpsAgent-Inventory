import React, { useMemo } from 'react';
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

  // ── Group GRNs by supplier + date ──────────────────────────────────────────
  // Multiple uploads on the same day for the same supplier are treated as one GRN
  const groupedGrns = useMemo(() => {
    const map = new Map();
    grnHistory.forEach(grn => {
      const date = grn.date || grn.created_at?.split('T')[0] || 'Unknown';
      const key = `${grn.supplier}::${date}`;
      if (!map.has(key)) {
        map.set(key, {
          // Use the first GRN's id as the group key for expand/collapse
          id: grn.id,
          // Keep all original GRN ids so delete still works per-GRN
          grns: [],
          supplier: grn.supplier,
          date,
          items: [],
        });
      }
      const group = map.get(key);
      group.grns.push(grn);
      group.items = group.items.concat(grn.items || []);
    });
    // Return as array sorted newest-first
    return Array.from(map.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [grnHistory]);

  // Compute a display total from raw GRN items (GST-inclusive)
  const calcTotal = (group) => {
    let total = 0;
    group.items.forEach(it => {
      if (it.total_amount) {
        total += Number(it.total_amount);
      } else {
        total += (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
      }
    });
    return total;
  };

  if (isMobile) {
    return (
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: 16 }}>
        <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>Recent Goods Receipts (GRN)</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groupedGrns.map((group) => (
            <div key={group.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: expandedGrnId === group.id ? '#F8FAFC' : 'white' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setExpandedGrnId(expandedGrnId === group.id ? null : group.id)}
              >
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 2 }}>{formatDate(group.date)}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{group.supplier}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                    {group.items.length} items
                  </span>
                  {group.grns.length > 1 && (
                    <span style={{ background: '#F0FDF4', color: '#16A34A', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                      {group.grns.length} uploads
                    </span>
                  )}
                  {expandedGrnId === group.id ? <ChevronDown size={16} color="#64748B" /> : <ChevronRight size={16} color="#64748B" />}
                </div>
              </div>

              {expandedGrnId === group.id && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {group.items.map((it, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: 8, borderRadius: 6, border: '1px solid #F1F5F9' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{it.description}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{it.quantity} {it.unit}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#10B981' }}>₹{it.unit_price || 0}</div>
                      </div>
                    ))}
                  </div>
                  {/* Delete all GRNs in this group */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
                    {group.grns.map(g => (
                      <ActionBtn key={g.id} icon={<Trash2 size={16} />} color="#EF4444" hover="#DC2626" title={`Delete GRN ${g.id}`} onClick={(e) => { e.stopPropagation(); handleDeleteGrn(g); }} />
                    ))}
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
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: 24 }}>
      <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0' }}>Recent Goods Receipts (GRN)</h4>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead><tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Date</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Supplier</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Items Received</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Total (GST Inc)</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
          </tr></thead>
          <tbody>
            {groupedGrns.map((group) => (
              <React.Fragment key={group.id}>
                <tr
                  onClick={() => setExpandedGrnId(expandedGrnId === group.id ? null : group.id)}
                  style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer', background: expandedGrnId === group.id ? '#FAFBFC' : 'transparent' }}
                >
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ transform: expandedGrnId === group.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block', color: '#94A3B8' }}>▶</span>
                      {formatDate(group.date)}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {group.supplier}
                    {group.grns.length > 1 && (
                      <span style={{ marginLeft: 8, background: '#F0FDF4', color: '#16A34A', padding: '2px 6px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                        {group.grns.length} uploads
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                    <span style={{ background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>{group.items.length} items</span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>
                    ₹{calcTotal(group).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      {group.grns.map(g => (
                        <ActionBtn key={g.id} icon={<Trash2 size={16} />} color="#EF4444" hover="#DC2626" title={`Delete GRN`} onClick={(e) => { e.stopPropagation(); handleDeleteGrn(g); }} />
                      ))}
                    </div>
                  </td>
                </tr>
                {expandedGrnId === group.id && (
                  <tr>
                    <td colSpan="5" style={{ padding: 0, borderBottom: '1px solid var(--border)' }}>
                      <div style={{ background: 'var(--bg-main)', padding: '16px 40px' }}>
                        <table style={{ width: '100%', fontSize: 13, textAlign: 'left', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-main)' }}>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Item</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Qty</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Rate</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((it, i) => {
                              const lineTotal = it.total_amount || ((Number(it.quantity) || 0) * (Number(it.unit_price) || 0));
                              return (
                                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{it.description}</td>
                                  <td style={{ padding: '8px 12px' }}>{it.quantity} {it.unit}</td>
                                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>₹{it.unit_price || 0}</td>
                                  <td style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right', color: '#10B981' }}>
                                    ₹{Number(lineTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: 'var(--bg-main)', borderTop: '2px solid var(--border)' }}>
                              <td colSpan="3" style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Grand Total (GST Inc)</td>
                              <td style={{ padding: '10px 12px', fontWeight: 700, color: '#10B981', textAlign: 'right' }}>
                                ₹{calcTotal(group).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tfoot>
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

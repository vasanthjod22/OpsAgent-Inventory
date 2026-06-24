import React, { useState } from 'react';
import {
  TrendingUp, RefreshCw, X, ChevronDown, ChevronUp,
  BarChart2, CheckCircle, AlertTriangle, Loader2, Info
} from 'lucide-react';
import { backendFetch } from '../../../utils/backend';

/* ─── Valuation Breakdown Modal ─────────────────────────────────────────────── */
export function ValuationBreakdownModal({ item, onClose }) {
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);

  React.useEffect(() => {
    if (!item) return;
    setLoading(true);
    setError(null);
    backendFetch(`/inventory/${item.id}/valuation-breakdown`)
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [item?.id]);

  if (!item) return null;

  const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtQty = n => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 20
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 760,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        border: '1px solid var(--border)'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10,
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <BarChart2 size={18} color="white" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Valuation Breakdown
              </h3>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                {item.name}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4, borderRadius: 6,
            display: 'flex', alignItems: 'center'
          }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <div>Loading valuation history...</div>
            </div>
          )}

          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10,
              padding: 16, color: '#DC2626', fontSize: 14
            }}>
              ⚠️ {error}
            </div>
          )}

          {data && !loading && (
            <>
              {/* Current Snapshot */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24
              }}>
                {[
                  { label: 'Current Qty', value: fmtQty(data.item.qty), color: '#2563EB', bg: '#EFF6FF' },
                  { label: 'Avg Cost (WAC)', value: fmt(data.item.avg_rate), color: '#7C3AED', bg: '#F5F3FF' },
                  { label: 'Total Value', value: fmt(data.item.total_value), color: '#059669', bg: '#ECFDF5' }
                ].map(card => (
                  <div key={card.label} style={{
                    background: card.bg, borderRadius: 12, padding: '16px 20px',
                    border: `1px solid ${card.color}22`
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: card.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {card.label}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: card.color, marginTop: 6 }}>
                      {card.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* WAC Formula Explainer */}
              <div style={{
                background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10,
                padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start',
                marginBottom: 24
              }}>
                <Info size={16} color="#D97706" style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>
                  <strong>Weighted Average Cost</strong> is recalculated on every GRN:
                  <code style={{ display: 'block', background: '#FEF3C7', borderRadius: 6, padding: '6px 10px', marginTop: 6, fontFamily: 'monospace', fontSize: 12 }}>
                    new_avg = (old_qty × old_avg + new_qty × new_price) ÷ total_qty
                  </code>
                </div>
              </div>

              {/* Purchase History Table */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  GRN Purchase History
                </h4>
                {data.purchase_history.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)',
                    border: '1px dashed var(--border)', borderRadius: 10
                  }}>
                    <BarChart2 size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                    <div>No GRN purchase history found for this item.</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Items added manually won't show history here.</div>
                  </div>
                ) : (
                  <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#0F172A', color: 'white' }}>
                          {['Date', 'Reference', 'Qty In', 'Price', 'Lot Value', 'Running Qty', 'Running Avg'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.purchase_history.map((row, i) => (
                          <tr key={i} style={{
                            borderBottom: '1px solid var(--border)',
                            background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-main)'
                          }}>
                            <td style={{ padding: '10px 14px', fontWeight: 500 }}>{row.date}</td>
                            <td style={{ padding: '10px 14px', color: '#6366F1', fontFamily: 'monospace', fontSize: 12 }}>{row.reference}</td>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#059669' }}>+{fmtQty(row.qty_in)}</td>
                            <td style={{ padding: '10px 14px' }}>{fmt(row.rate)}</td>
                            <td style={{ padding: '10px 14px', color: '#7C3AED' }}>{fmt(row.value)}</td>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>{fmtQty(row.running_qty)}</td>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#2563EB' }}>
                              {fmt(row.running_avg)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Valuation Dashboard Section ───────────────────────────────────────────── */
export default function ValuationPanel({ showToast }) {
  const [expanded, setExpanded]     = useState(false);
  const [valuation, setValuation]   = useState(null);
  const [loading, setLoading]       = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);
  const [error, setError]           = useState(null);

  const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const loadValuation = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await backendFetch('/grn/valuation');
      setValuation(d);
    } catch (e) {
      setError(e.message);
      showToast?.(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExpand = () => {
    if (!expanded && !valuation) loadValuation();
    setExpanded(v => !v);
  };

  const handleReconcile = async () => {
    if (!window.confirm(
      'This will replay all GRN history and correct any wrong stock valuations. Continue?'
    )) return;

    setReconciling(true);
    setReconcileResult(null);
    try {
      const result = await backendFetch('/grn/reconcile-valuations', { method: 'POST' });
      setReconcileResult(result);
      showToast?.(`✅ ${result.message}`, 'success');
      // Reload valuation after reconcile
      loadValuation();
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12,
      border: '1px solid var(--border)', overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      {/* Header – always visible */}
      <button
        onClick={handleExpand}
        style={{
          width: '100%', padding: '18px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <TrendingUp size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Inventory Valuation
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Live stock value using Weighted Average Cost — click to expand
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: 24 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <button
              onClick={loadValuation}
              disabled={loading}
              style={{
                height: 36, padding: '0 16px', borderRadius: 8,
                background: 'var(--bg-main)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontWeight: 600, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
              }}
            >
              {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
              {loading ? 'Loading...' : 'Refresh'}
            </button>

            <button
              onClick={handleReconcile}
              disabled={reconciling}
              style={{
                height: 36, padding: '0 16px', borderRadius: 8,
                background: reconciling ? '#EDE9FE' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                border: 'none', color: 'white', fontWeight: 600, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: reconciling ? 'not-allowed' : 'pointer',
                boxShadow: reconciling ? 'none' : '0 2px 8px rgba(99,102,241,0.35)'
              }}
            >
              {reconciling
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Fixing Valuations...</>
                : <><RefreshCw size={14} /> Fix Historical Valuations</>
              }
            </button>
          </div>

          {/* Reconcile Result */}
          {reconcileResult && (
            <div style={{
              background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 10,
              padding: '14px 18px', marginBottom: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <CheckCircle size={16} color="#059669" />
                <strong style={{ color: '#065F46', fontSize: 14 }}>{reconcileResult.message}</strong>
              </div>
              {reconcileResult.results?.filter(r => r.changed).length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ fontSize: 12, width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#059669' }}>
                        {['Item', 'Old Rate', 'Corrected Rate', 'Qty', 'Old Value', 'New Value'].map(h => (
                          <th key={h} style={{ padding: '4px 10px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reconcileResult.results.filter(r => r.changed).map((r, i) => (
                        <tr key={i}>
                          <td style={{ padding: '4px 10px', fontWeight: 600 }}>{r.item}</td>
                          <td style={{ padding: '4px 10px', color: '#DC2626' }}>₹{r.old_rate}</td>
                          <td style={{ padding: '4px 10px', color: '#059669', fontWeight: 700 }}>₹{r.corrected_rate}</td>
                          <td style={{ padding: '4px 10px' }}>{r.current_qty}</td>
                          <td style={{ padding: '4px 10px', color: '#DC2626' }}>₹{r.old_value}</td>
                          <td style={{ padding: '4px 10px', color: '#059669', fontWeight: 700 }}>₹{r.new_value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10,
              padding: '12px 16px', color: '#DC2626', fontSize: 13, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && !valuation && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{
                  height: 44, background: 'var(--bg-main)', borderRadius: 8,
                  animation: 'pulse 1.5s ease-in-out infinite'
                }} />
              ))}
            </div>
          )}

          {/* Valuation Data */}
          {valuation && !loading && (
            <>
              {/* Total Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
                borderRadius: 12, padding: '20px 24px', marginBottom: 20,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: 12
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#C4B5FD', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Total Inventory Value
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'white', marginTop: 4 }}>
                    {fmt(valuation.total)}
                  </div>
                  <div style={{ fontSize: 12, color: '#A5B4FC', marginTop: 4 }}>
                    Calculated live as: qty × weighted_avg_cost per item
                  </div>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 20px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 12, color: '#C4B5FD' }}>Items tracked</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>
                    {valuation.breakdown?.length || 0}
                  </div>
                </div>
              </div>

              {/* Per-item breakdown table */}
              {valuation.breakdown?.length > 0 && (
                <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        {['Item', 'Category', 'Qty', 'Avg Cost (WAC)', 'Total Value', '% of Total'].map(h => (
                          <th key={h} style={{
                            padding: '10px 14px', fontWeight: 700,
                            color: 'var(--text-muted)', textAlign: h === 'Item' || h === 'Category' ? 'left' : 'right',
                            borderBottom: '1px solid var(--border)', fontSize: 12, textTransform: 'uppercase',
                            letterSpacing: '0.04em'
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...valuation.breakdown]
                        .sort((a, b) => b.value - a.value)
                        .map((row, i) => {
                          const pct = valuation.total > 0 ? (row.value / valuation.total * 100).toFixed(1) : '0.0';
                          const barWidth = Math.min(100, parseFloat(pct));
                          return (
                            <tr key={i} style={{
                              borderBottom: '1px solid var(--border)',
                              background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-main)'
                            }}>
                              <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)', maxWidth: 180 }}>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {row.name}
                                </div>
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <span style={{
                                  background: '#EFF6FF', color: '#2563EB', padding: '2px 8px',
                                  borderRadius: 99, fontSize: 11, fontWeight: 600
                                }}>
                                  {row.category || 'General'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500 }}>
                                {Number(row.qty).toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', color: '#7C3AED', fontWeight: 600 }}>
                                {fmt(row.rate)}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                                {fmt(row.value)}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                                  <div style={{
                                    width: 60, height: 6, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden'
                                  }}>
                                    <div style={{
                                      width: `${barWidth}%`, height: '100%',
                                      background: 'linear-gradient(90deg, #6366F1, #8B5CF6)', borderRadius: 99
                                    }} />
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6366F1', minWidth: 36 }}>{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const GST_INCLUSIVE_SUPPLIERS = [
  'JOHNSON ENTERPRISES',
  'JOHNSON PIPES',
  'STAYBRIIT TRADING CORPORATION',
];

const GST_ALREADY_INCLUDED_IN_RATE_SUPPLIERS = [
  "KHUMAR'S CERAMICS",
  'M/S.SHANTHINI POLYMERS',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeSupplierName = (name) => {
  if (!name) return 'Unknown Supplier';
  const up = name.toUpperCase().trim();
  if (up.includes('STAYBR')) return 'STAYBRIIT TRADING CORPORATION';
  if (up.includes('JHONON') || up.includes('JHONSSON') || up.includes('JOHNSON')) {
    return up.includes('PIPE') ? 'JOHNSON PIPES' : 'JOHNSON ENTERPRISES';
  }
  if (up.includes('KUMAR STEEL')) return 'KUMAR STEELS';
  return name.trim();
};

const isGstInclusiveSupplier = (supplierName) => {
  const n = normalizeSupplierName(supplierName);
  return GST_INCLUSIVE_SUPPLIERS.includes(n);
};

const isRateAlreadyGstIncluded = (supplierName) => {
  const n = normalizeSupplierName(supplierName);
  return GST_ALREADY_INCLUDED_IN_RATE_SUPPLIERS.includes(n);
};

const normalizeDate = (rawDate) => {
  if (!rawDate) return 'Unknown';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) return rawDate;
  if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
    const d = new Date(rawDate);
    if (isNaN(d)) return String(rawDate);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
  if (rawDate.includes('T')) {
    const d = new Date(rawDate);
    if (isNaN(d)) return String(rawDate);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
  return String(rawDate);
};

const parseDateDDMMYYYY = (dateStr) => {
  if (!dateStr || dateStr === 'Unknown') return new Date(0);
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  }
  return new Date(dateStr);
};

const formatCurrency = (amount) =>
  Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── Apply supplier formula to a single GRN item line ─────────────────────────
// Returns { amountExclGST, amountInclGST }
const applyFormulaToItem = (item, supplierName) => {
  const normalizedSupplier = normalizeSupplierName(supplierName);
  const totalAmt = Number(item.total_amount) || (Number(item.quantity || 0) * Number(item.unit_price || 0));
  const gstRate = 0.18; // default 18%

  if (isGstInclusiveSupplier(normalizedSupplier)) {
    // Amount in total_amount is ALREADY inclusive of GST
    const amountInclGST = totalAmt;
    const amountExclGST = totalAmt / (1 + gstRate);
    return { amountExclGST, amountInclGST };
  } else if (isRateAlreadyGstIncluded(normalizedSupplier)) {
    // Rate stored is already GST-inclusive (formula: divide by 1.18 to get excl)
    const amountInclGST = totalAmt;
    const amountExclGST = totalAmt / (1 + gstRate);
    return { amountExclGST, amountInclGST };
  } else {
    // Standard: amount is exclusive, multiply to get inclusive
    const amountExclGST = totalAmt;
    const amountInclGST = totalAmt * (1 + gstRate);
    return { amountExclGST, amountInclGST };
  }
};

// ─── Group GRN history by date + supplier ─────────────────────────────────────
const groupGRNByDateAndSupplier = (grnHistory, allItems = []) => {
  const groups = {};

  grnHistory.forEach((grn) => {
    const rawDate = grn.date || grn.grn_date || grn.created_at;
    const date = normalizeDate(rawDate);
    const supplierRaw = (grn.supplier_name || grn.supplier || 'Unknown').trim();
    const supplierKey = normalizeSupplierName(supplierRaw).toUpperCase();
    const supplierDisplay = normalizeSupplierName(supplierRaw);
    const key = `${date}__${supplierKey}`;

    if (!groups[key]) {
      groups[key] = {
        key,
        date,
        supplier: supplierDisplay,
        totalAmountExclGST: 0,
        totalAmountInclGST: 0,
        grnCount: 0,
        grnRefs: [],
        items: [],
      };
    }

    // Process every item in this GRN
    (grn.items || []).forEach((item) => {
      const { amountExclGST, amountInclGST } = applyFormulaToItem(item, supplierDisplay);
      groups[key].totalAmountExclGST += amountExclGST;
      groups[key].totalAmountInclGST += amountInclGST;
      groups[key].items.push({ ...item, _grnRef: grn.id || grn.grn_number, _supplier: supplierDisplay });
    });

    groups[key].grnCount += 1;
    groups[key].grnRefs.push(String(grn.grn_number || grn.id || ''));
  });

  // Also include manual items that don't have a GRN
  allItems.forEach((i) => {
    const pseudoStock = Number(i.qty) > 0 ? Number(i.qty) : (Number(i.opening_stock) || 0);
    if (pseudoStock > 0) {
      const supplierRaw = (i.supplier_name || 'Unknown').trim();
      const supplierDisplay = normalizeSupplierName(supplierRaw);
      const supplierKey = supplierDisplay.toUpperCase();
      const rawDate = i.date_added ? i.date_added.split('T')[0] : 'Unknown';
      const date = normalizeDate(rawDate);
      
      // Fix double counting: check if there's already a GRN for this supplier on this date
      const hasGrnOnSameDate = grnHistory.some((g) => {
        const gSupplier = normalizeSupplierName(g.supplier || g.supplier_name);
        const gDate = normalizeDate(g.date || g.grn_date || g.created_at);
        return gSupplier === supplierDisplay && gDate === date;
      });
      if (hasGrnOnSameDate) return;

      const key = `${date}__${supplierKey}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          date,
          supplier: supplierDisplay,
          totalAmountExclGST: 0,
          totalAmountInclGST: 0,
          grnCount: 0,
          grnRefs: [],
          items: [],
        };
      }

      // Convert manual item to a "pseudo GRN item" for formula
      const totalAmt = pseudoStock * (Number(i.purchase_rate) || Number(i.rate) || 0);
      
      const itemCgst = Number(i.cgst_percent) || 0;
      const itemSgst = Number(i.sgst_percent) || 0;
      const gstMult = 1 + (itemCgst + itemSgst) / 100;
      
      let amountExclGST = totalAmt;
      let amountInclGST = totalAmt;
      
      if (isGstInclusiveSupplier(supplierDisplay)) {
        amountExclGST = totalAmt / gstMult;
      } else if (isRateAlreadyGstIncluded(supplierDisplay)) {
        amountExclGST = totalAmt / gstMult;
      } else {
        amountInclGST = totalAmt * gstMult;
      }

      groups[key].totalAmountExclGST += amountExclGST;
      groups[key].totalAmountInclGST += amountInclGST;
      groups[key].items.push({
        description: i.name,
        total_amount: isRateAlreadyGstIncluded(supplierDisplay) || isGstInclusiveSupplier(supplierDisplay) ? totalAmt : amountInclGST,
        _grnRef: 'Manual Entry',
        _supplier: supplierDisplay
      });
      groups[key].grnCount += 1; // treat as a separate manual entry
    }
  });

  return Object.values(groups).sort((a, b) => parseDateDDMMYYYY(a.date) - parseDateDDMMYYYY(b.date));
};

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function PurchaseBreakdownModal({ grnHistory, allItems, clickedCard, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showMergedOnly, setShowMergedOnly] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const groupedData = useMemo(() => groupGRNByDateAndSupplier(grnHistory || [], allItems || []), [grnHistory, allItems]);

  const filteredData = useMemo(() => {
    return groupedData.filter((row) => {
      const matchesSearch =
        !searchTerm ||
        row.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.date.includes(searchTerm);
      const matchesMerged = !showMergedOnly || row.grnCount > 1;
      return matchesSearch && matchesMerged;
    });
  }, [groupedData, searchTerm, showMergedOnly]);

  const grandTotalExclGST = filteredData.reduce((s, r) => s + r.totalAmountExclGST, 0);
  const grandTotalInclGST = filteredData.reduce((s, r) => s + r.totalAmountInclGST, 0);
  const totalGRNCount = filteredData.reduce((s, r) => s + r.grnCount, 0);

  const toggleRow = (key) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Supplier', 'GRN Count', 'Amount (Excl GST)', 'Amount (Incl GST)'];
    const rows = filteredData.map((r) => [
      r.date,
      `"${r.supplier}"`,
      r.grnCount,
      r.totalAmountExclGST.toFixed(2),
      r.totalAmountInclGST.toFixed(2),
    ]);
    const grandRow = ['GRAND TOTAL', '', totalGRNCount, grandTotalExclGST.toFixed(2), grandTotalInclGST.toFixed(2)];
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(',')), grandRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GRN_Breakdown_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isExcl = clickedCard === 'exclusive';

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: 'white',
        borderRadius: 16,
        width: '100%',
        maxWidth: 900,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
      }}>

        {/* ── Header ── */}
        <div style={{
          background: '#0F172A',
          padding: '20px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ color: 'white', margin: 0, fontSize: 18, fontWeight: 700 }}>
              Purchase Breakdown
            </h2>
            <p style={{ color: '#94A3B8', margin: '4px 0 0', fontSize: 12 }}>
              Grouped by Date + Supplier · Same date = amounts combined
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
              color: 'white', width: 32, height: 32, cursor: 'pointer', fontSize: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Summary strip ── */}
        <div style={{
          display: 'flex', background: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0', flexShrink: 0, flexWrap: 'wrap',
        }}>
          <div style={{
            padding: '14px 24px', borderRight: '1px solid #E2E8F0',
            background: isExcl ? '#F0FDF4' : undefined,
            outline: isExcl ? '2px solid #16A34A' : undefined,
          }}>
            <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total (Excl GST) {isExcl && <span style={{ color: '#16A34A', marginLeft: 4 }}>← Selected</span>}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#16A34A' }}>
              ₹{formatCurrency(grandTotalExclGST)}
            </div>
          </div>
          <div style={{
            padding: '14px 24px', borderRight: '1px solid #E2E8F0',
            background: !isExcl ? '#F0F9FF' : undefined,
            outline: !isExcl ? '2px solid #0891B2' : undefined,
          }}>
            <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total (Incl GST) {!isExcl && <span style={{ color: '#0891B2', marginLeft: 4 }}>← Selected</span>}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0891B2' }}>
              ₹{formatCurrency(grandTotalInclGST)}
            </div>
          </div>
          <div style={{ padding: '14px 24px' }}>
            <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entries</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#374151' }}>
              {filteredData.length}
              <span style={{ fontSize: 12, fontWeight: 400, color: '#94A3B8', marginLeft: 6 }}>
                ({totalGRNCount} GRNs)
              </span>
            </div>
          </div>
        </div>

        {/* ── Search / filter bar ── */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap',
          background: '#FAFBFC',
        }}>
          <input
            type="text"
            placeholder="Search supplier or date (DD/MM/YYYY)…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1, minWidth: 180, height: 36, padding: '0 12px',
              borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none',
            }}
          />
          <button
            onClick={() => setShowMergedOnly((p) => !p)}
            style={{
              padding: '0 14px', height: 36, borderRadius: 8, border: '1px solid',
              borderColor: showMergedOnly ? '#D97706' : '#E2E8F0',
              background: showMergedOnly ? '#FEF3C7' : 'white',
              color: showMergedOnly ? '#D97706' : '#64748B',
              fontSize: 12, cursor: 'pointer',
              fontWeight: showMergedOnly ? 600 : 400, whiteSpace: 'nowrap',
            }}
          >
            {showMergedOnly ? '✓ Merged only' : 'Show merged only'}
          </button>
          <button
            onClick={exportToCSV}
            style={{
              padding: '0 14px', height: 36, borderRadius: 8,
              border: '1px solid #E2E8F0', background: 'white',
              color: '#64748B', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            ⬇ Export CSV
          </button>
        </div>

        {/* ── Scrollable table ── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 2 }}>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Date</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: '#374151' }}>Supplier</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: '#374151', textAlign: 'center' }}>GRNs</th>
                <th style={{
                  padding: '10px 16px', fontWeight: 600, textAlign: 'right',
                  color: isExcl ? '#16A34A' : '#374151',
                  background: isExcl ? '#F0FDF4' : undefined,
                }}>
                  Excl GST {isExcl && <span style={{ fontSize: 10, background: '#DCFCE7', color: '#16A34A', padding: '1px 5px', borderRadius: 999, marginLeft: 4 }}>Selected</span>}
                </th>
                <th style={{
                  padding: '10px 16px', fontWeight: 600, textAlign: 'right',
                  color: !isExcl ? '#0891B2' : '#374151',
                  background: !isExcl ? '#F0F9FF' : undefined,
                }}>
                  Incl GST {!isExcl && <span style={{ fontSize: 10, background: '#CFFAFE', color: '#0891B2', padding: '1px 5px', borderRadius: 999, marginLeft: 4 }}>Selected</span>}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
                    No entries found
                  </td>
                </tr>
              )}
              {filteredData.map((row) => {
                const isSpecial = isGstInclusiveSupplier(row.supplier);
                const isExpanded = expandedRows.has(row.key);

                return (
                  <React.Fragment key={row.key}>
                    {/* Main row */}
                    <tr
                      style={{
                        borderBottom: isExpanded ? 'none' : '1px solid #F1F5F9',
                        background: isExpanded ? '#FAFBFC' : 'white',
                        transition: 'background 0.15s',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: '#374151', whiteSpace: 'nowrap' }}>
                        {row.date}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontWeight: isSpecial ? 600 : 400,
                          color: isSpecial ? '#2563EB' : '#374151',
                        }}>
                          {row.supplier}
                        </span>
                        {isSpecial && (
                          <span style={{
                            marginLeft: 6, fontSize: 10,
                            background: '#DBEAFE', color: '#2563EB',
                            padding: '1px 6px', borderRadius: 999, fontWeight: 400,
                          }}>
                            Tax-inclusive formula
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          title={row.grnCount > 1 ? `Merged GRNs: ${row.grnRefs.join(', ')}` : undefined}
                          style={{
                            background: row.grnCount > 1 ? '#FEF3C7' : '#F1F5F9',
                            color: row.grnCount > 1 ? '#D97706' : '#64748B',
                            padding: '2px 8px', borderRadius: 999, fontSize: 12,
                            fontWeight: row.grnCount > 1 ? 600 : 400,
                            cursor: row.grnCount > 1 ? 'pointer' : 'default',
                          }}
                          onClick={() => row.grnCount > 1 && toggleRow(row.key)}
                        >
                          {row.grnCount > 1 ? `${row.grnCount} merged ` : '1 GRN'}
                          {row.grnCount > 1 && (
                            <span style={{ fontSize: 10 }}>{isExpanded ? '▲' : '▼'}</span>
                          )}
                        </span>
                      </td>
                      <td style={{
                        padding: '12px 16px', textAlign: 'right',
                        fontWeight: 600, color: '#16A34A', fontFamily: 'monospace',
                        background: isExcl ? '#FAFFFE' : undefined,
                      }}>
                        ₹{formatCurrency(row.totalAmountExclGST)}
                      </td>
                      <td style={{
                        padding: '12px 16px', textAlign: 'right',
                        fontWeight: 600, color: '#0891B2', fontFamily: 'monospace',
                        background: !isExcl ? '#F0FDFF' : undefined,
                      }}>
                        ₹{formatCurrency(row.totalAmountInclGST)}
                      </td>
                    </tr>

                    {/* Expanded sub-rows for merged GRNs */}
                    {isExpanded && row.items.map((item, j) => {
                      const { amountExclGST, amountInclGST } = applyFormulaToItem(item, row.supplier);
                      return (
                        <tr key={j} style={{ background: '#F8FAFC', borderBottom: j === row.items.length - 1 ? '2px solid #E2E8F0' : '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 16px 8px 32px', fontSize: 12, color: '#64748B' }}>
                            {item._grnRef ? `GRN #${item._grnRef}` : `Entry ${j + 1}`}
                          </td>
                          <td style={{ padding: '8px 16px', fontSize: 12, color: '#374151' }}>
                            {item.description || '—'}
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>—</td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: 12, color: '#16A34A', fontFamily: 'monospace' }}>
                            ₹{formatCurrency(amountExclGST)}
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: 12, color: '#0891B2', fontFamily: 'monospace' }}>
                            ₹{formatCurrency(amountInclGST)}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#0F172A', color: 'white' }}>
                <td colSpan={3} style={{ padding: '14px 16px', fontWeight: 700, fontSize: 14 }}>
                  GRAND TOTAL
                  <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.5, fontWeight: 400 }}>
                    ({filteredData.length} entries, {totalGRNCount} GRNs)
                  </span>
                </td>
                <td style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right', fontSize: 15, color: '#86EFAC', fontFamily: 'monospace' }}>
                  ₹{formatCurrency(grandTotalExclGST)}
                </td>
                <td style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right', fontSize: 15, color: '#67E8F9', fontFamily: 'monospace' }}>
                  ₹{formatCurrency(grandTotalInclGST)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

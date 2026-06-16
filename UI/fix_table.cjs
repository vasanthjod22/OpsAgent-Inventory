const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/panels/InventoryPanel.jsx');
let content = fs.readFileSync(file, 'utf8');

// I will find the map function for the table body and just rewrite the <tr> ... </tr> block manually.
// Actually, it's easier to just use string replace for the whole <tr> block of the items table.
// Let's find the start of the <tbody> loop:
const startMarker = `                    return (\n                      <tr key={item.id} style={{ borderBottom: '1px solid #E2E8F0', ':hover': { background: '#F8FAFC' } }}>`;
const endMarker = `                        {/* 18. GST % */}`;

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const newTrBlock = `                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #E2E8F0', ':hover': { background: '#F8FAFC' } }}>
                        {/* 1. S.No */}
                        <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'white', fontSize: 13, color: '#64748B', fontWeight: 500, padding: '12px 8px' }}>
                          {(pagination.currentPage - 1) * pagination.itemsPerPage + index + 1}
                        </td>
                        {/* 2. HSN/SKU */}
                        <td style={{ fontSize: 13, color: '#0F172A', fontWeight: 600, padding: '12px 8px' }}>{item.hsn || item.sku}</td>
                        {/* 3. Item Name */}
                        <td style={{ fontWeight: 600, color: '#0F172A', padding: '12px 8px' }}>{item.name}</td>
                        {/* 4. Category */}
                        <td style={{ color: '#0F172A', padding: '12px 8px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 99, background: '#F1F5F9', fontSize: 12 }}>{item.category}</span>
                        </td>
                        {/* 5. Total Qty */}
                        <td style={{ fontWeight: 600, color: '#475569', padding: '12px 8px' }}>{formatQty(item.total_qty ?? item.qty)}</td>
                        {/* 6. Current Qty */}
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{ fontWeight: 700, color: '#10B981', fontSize: 14 }}>{formatQty(currentQty)}</span>
                        </td>
                        {/* 7. Sold Qty */}
                        <td style={{ fontWeight: 600, color: '#3B82F6', padding: '12px 8px' }}>{formatQty(Math.max(0, (item.total_qty ?? item.qty) - currentQty))}</td>
                        {/* 8. Damaged */}
                        <td style={{ fontWeight: 600, color: '#EF4444', padding: '12px 8px' }}>{formatQty(item.damaged_qty)}</td>
                        {/* 10. Unit */}
                        <td style={{ color: '#64748B', padding: '12px 8px' }}>{item.unit}</td>
                        {/* 11. Min */}
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
                        {/* 12. Max */}
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
                        {/* 13. Reorder Qty */}
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
                        {/* 14. Purchase Rate */}
                        <td style={{ padding: '4px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ color: '#64748B', fontSize: 13 }}>₹</span>
                            <input type="number"
                              value={getValue(item, 'purchase_rate') || getValue(item, 'rate')}
                              onChange={e => handleFieldChange(item.id, 'purchase_rate', e.target.value)}
                              onBlur={() => saveFieldToBackend(item, 'purchase_rate')}
                              onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                              onMouseLeave={e => { if(document.activeElement !== e.target) Object.assign(e.target.style, inputStyle) }}
                              style={inputStyle}
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
                                if (curRate > prevRate) return <span style={{ color: '#10B981', marginLeft: 6, fontWeight: 'bold' }} title={\`Up from ₹\${prevRate} in older GRN\`}>↑</span>;
                                if (curRate < prevRate) return <span style={{ color: '#EF4444', marginLeft: 6, fontWeight: 'bold' }} title={\`Down from ₹\${prevRate} in older GRN\`}>↓</span>;
                              }
                              return null;
                            })()}
                          </div>
                        </td>
                        {/* 16. CGST % */}
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
                        {/* 17. SGST % */}
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
`;

  content = content.substring(0, startIndex) + newTrBlock + content.substring(endIndex);
  fs.writeFileSync(file, content);
  console.log("Successfully replaced TR block");
} else {
  console.log("Could not find markers.");
}

import re
import sys

filepath = "d:/Inventory/UI/src/components/panels/BillingPanel.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Fix Table Rows
old_table_row = """                      <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                        <div style={{ paddingTop: '8px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', fontSize: '13px' }}>
                          {item.amount ? `₹${fmtINR(item.amount)}` : '-'}
                        </div>
                        <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '4px' }}>
                          {(parseFloat(item.cgstPercent)||0) + (parseFloat(item.sgstPercent)||0) > 0 ? `+ ${parseFloat(item.cgstPercent||0) + parseFloat(item.sgstPercent||0)}% GST` : 'Qty × Rate'}
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                        <button onClick={() => deleteItem(item.id)} title="Delete row\""""

new_table_row = """                      <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                        <div style={{ paddingTop: '8px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', fontSize: '13px' }}>
                          {item.amount ? `₹${fmtINR(item.amount)}` : '-'}
                        </div>
                        <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '4px' }}>Qty × Rate</div>
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                        <div style={{ paddingTop: '8px', fontWeight: 700, color: '#16A34A', whiteSpace: 'nowrap', fontSize: '13px' }}>
                          {item.taxInclAmount ? `₹${fmtINR(item.taxInclAmount)}` : '-'}
                        </div>
                        <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '4px' }}>
                          {(parseFloat(item.cgstPercent)||0) + (parseFloat(item.sgstPercent)||0) > 0 ? `+ ${parseFloat(item.cgstPercent||0) + parseFloat(item.sgstPercent||0)}% GST` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                        <button onClick={() => deleteItem(item.id)} title="Delete row\""""

content = content.replace(old_table_row, new_table_row)

# 2. Add igst state
old_discount_state = "const [discount, setDiscount] = useState('')"
new_discount_state = """const [discount, setDiscount] = useState('')
  const [igst, setIgst] = useState('')"""
content = content.replace(old_discount_state, new_discount_state)

# 3. Update rawGrandTotal and remove totalIGST automatic calculation
old_totals = """    const totalIGST = totalCGST + totalSGST
    const subtotal = (items || []).reduce((s, i) => s + (i.amount || 0), 0)
    const discountVal = Number(discount || 0)
    
    // Calculate raw grand total before roundoff
    const rawGrandTotal = subtotal - discountVal"""

new_totals = """    const subtotal = (items || []).reduce((s, i) => s + (i.amount || 0), 0)
    const discountVal = Number(discount || 0)
    const igstVal = Number(igst || 0)
    
    // Calculate raw grand total before roundoff
    const rawGrandTotal = subtotal + totalCGST + totalSGST + igstVal - discountVal"""
content = content.replace(old_totals, new_totals)

# 4. Update UI for IGST input
old_igst_ui = """                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748B' }}>
                  <span>IGST</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(totalIGST)}</span>
                </div>"""

new_igst_ui = """                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748B' }}>
                  <span>IGST</span>
                  <input type="number" min="0" value={igst} onChange={e => setIgst(e.target.value)}
                    style={{ width: '100px', padding: '4px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '12px', outline: 'none', textAlign: 'right' }}
                    placeholder="0.00" />
                </div>"""
content = content.replace(old_igst_ui, new_igst_ui)

# 5. Store/Restore igst in buildBillData and editBill
old_build_bill = "items: items.filter(i => i.description),"
new_build_bill = "items: items.filter(i => i.description).map((item, idx) => idx === 0 ? { ...item, _globalIgst: igst } : item),"
content = content.replace(old_build_bill, new_build_bill)

old_reset = """    setDiscount('')
    setPaymentStatus('Unpaid')"""
new_reset = """    setDiscount('')
    setIgst('')
    setPaymentStatus('Unpaid')"""
content = content.replace(old_reset, new_reset)

old_edit_bill = """    setDiscount(b.discount ? String(b.discount) : '')
    setPaymentStatus(b.paymentStatus || 'Unpaid')"""
new_edit_bill = """    setDiscount(b.discount ? String(b.discount) : '')
    setIgst(b.items && b.items[0] && b.items[0]._globalIgst ? String(b.items[0]._globalIgst) : '')
    setPaymentStatus(b.paymentStatus || 'Unpaid')"""
content = content.replace(old_edit_bill, new_edit_bill)

# 6. PDF updates
old_pdf_tax_words = "doc.text('Tax Amount (in words)  :  INR ' + amtWords(totCGST+totSGST), mg, y); y+=5"
new_pdf_tax_words = "doc.text('Tax Amount (in words)  :  INR ' + amtWords(totCGST+totSGST+Number(bill.items?.[0]?._globalIgst||0)), mg, y); y+=5"
content = content.replace(old_pdf_tax_words, new_pdf_tax_words)

# PDF IGST row in total table
old_pdf_totals_row = "const tv = ['Total', fmtINR(totTax), '', fmtINR(totCGST), '', fmtINR(totSGST), fmtINR(totCGST+totSGST)]"
new_pdf_totals_row = """const manualIgst = Number(bill.items?.[0]?._globalIgst || 0)
    const tv = ['Total', fmtINR(totTax), '', fmtINR(totCGST), '', fmtINR(totSGST), fmtINR(totCGST+totSGST+manualIgst)]"""
content = content.replace(old_pdf_totals_row, new_pdf_totals_row)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated BillingPanel.jsx successfully")

import re

filepath = "d:/Inventory/UI/src/components/panels/BillingPanel.jsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update the calculations block
calc_old = """  // Derived totals
  const subtotal = (items || []).reduce((s, i) => s + (i.amount || 0), 0)
  const discountVal = Number(discount || 0)
  const grandTotal = subtotal - discountVal
  const balanceDue = grandTotal - Number(amountPaid || 0)"""

calc_new = """  // Derived totals
  const totalCGST = (items || []).reduce((s, i) => {
    const q = parseFloat(i.quantity) || 0
    const r = parseFloat(i.rate) || 0
    const c = parseFloat(i.cgstPercent) || 0
    return s + ((q * r) * c / 100)
  }, 0)

  const totalSGST = (items || []).reduce((s, i) => {
    const q = parseFloat(i.quantity) || 0
    const r = parseFloat(i.rate) || 0
    const sp = parseFloat(i.sgstPercent) || 0
    return s + ((q * r) * sp / 100)
  }, 0)

  const totalIGST = totalCGST + totalSGST
  const subtotal = (items || []).reduce((s, i) => s + (i.amount || 0), 0)
  const discountVal = Number(discount || 0)
  
  // Calculate raw grand total before roundoff
  const rawGrandTotal = subtotal - discountVal
  
  // Calculate rounded grand total and roundoff amount
  const grandTotal = Math.round(rawGrandTotal)
  const roundoffAmount = grandTotal - rawGrandTotal
  
  const balanceDue = grandTotal - Number(amountPaid || 0)"""

content = content.replace(calc_old, calc_new)

# 2. Update the UI block for the summary section
ui_old = """              <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748B' }}>
                  <span>Subtotal</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748B' }}>
                  <span>Discount</span>
                  <input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)}
                    style={{ width: '100px', padding: '4px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '12px', outline: 'none', textAlign: 'right' }}
                    placeholder="0.00" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0F172A', borderRadius: '9px', padding: '10px 14px' }}>
                  <span style={{ fontWeight: 800, color: 'white', fontSize: '14px' }}>Grand Total</span>
                  <span style={{ fontWeight: 800, color: '#60A5FA', fontSize: '16px' }}>₹{fmtINR(grandTotal)}</span>
                </div>
              </div>"""

ui_new = """              <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748B' }}>
                  <span>Subtotal</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748B' }}>
                  <span>CGST</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(totalCGST)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748B' }}>
                  <span>SGST</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(totalSGST)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748B' }}>
                  <span>IGST</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(totalIGST)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748B' }}>
                  <span>Discount</span>
                  <input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)}
                    style={{ width: '100px', padding: '4px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '12px', outline: 'none', textAlign: 'right' }}
                    placeholder="0.00" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748B' }}>
                  <span>Round Off</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>{roundoffAmount > 0 ? '+' : ''}{fmtINR(roundoffAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0F172A', borderRadius: '9px', padding: '10px 14px' }}>
                  <span style={{ fontWeight: 800, color: 'white', fontSize: '14px' }}>Grand Total</span>
                  <span style={{ fontWeight: 800, color: '#60A5FA', fontSize: '16px' }}>₹{fmtINR(grandTotal)}</span>
                </div>
              </div>"""

content = content.replace(ui_old, ui_new)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated BillingPanel calculations and UI!")

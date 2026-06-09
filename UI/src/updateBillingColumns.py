import sys
import re

filepath = "d:/Inventory/UI/src/components/panels/BillingPanel.jsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update calcAmount to only return tax-excluded amount (and rename to calcBaseAmount, but let's keep name for simplicity and add calcTaxInclAmount)
old_calc_amount = """const calcAmount = (quantity, rate, cgst, sgst) => {
  const q = parseFloat(quantity) || 0
  const r = parseFloat(rate) || 0
  const c = parseFloat(cgst) || 0
  const s = parseFloat(sgst) || 0
  const base = q * r
  return base + (base * (c + s) / 100)
}"""

new_calc_amount = """const calcAmount = (quantity, rate) => {
  const q = parseFloat(quantity) || 0
  const r = parseFloat(rate) || 0
  return q * r
}

const calcTaxInclAmount = (quantity, rate, cgst, sgst) => {
  const q = parseFloat(quantity) || 0
  const r = parseFloat(rate) || 0
  const c = parseFloat(cgst) || 0
  const s = parseFloat(sgst) || 0
  const base = q * r
  return base + (base * (c + s) / 100)
}"""

content = content.replace(old_calc_amount, new_calc_amount)

# 2. Update updateItem
old_update_item = """  const updateItem = (id, field, value) => {
    setItems(prev => (prev || []).map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      updated.amount = calcAmount(
        field === 'quantity' ? value : item.quantity,
        field === 'rate' ? value : item.rate,
        field === 'cgstPercent' ? value : item.cgstPercent,
        field === 'sgstPercent' ? value : item.sgstPercent
      )
      return updated
    }))
  }"""

new_update_item = """  const updateItem = (id, field, value) => {
    setItems(prev => (prev || []).map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      updated.amount = calcAmount(
        field === 'quantity' ? value : item.quantity,
        field === 'rate' ? value : item.rate
      )
      updated.taxInclAmount = calcTaxInclAmount(
        field === 'quantity' ? value : item.quantity,
        field === 'rate' ? value : item.rate,
        field === 'cgstPercent' ? value : item.cgstPercent,
        field === 'sgstPercent' ? value : item.sgstPercent
      )
      return updated
    }))
  }"""

content = content.replace(old_update_item, new_update_item)

# 3. Update table headers
old_headers = """['#', '30px'], ['Product', '200px'], ['Desp', '80px'], ['HSN', '70px'], ['Feet', '60px'], ['Qty', '70px'], ['Unit', '70px'], ['Rate', '80px'], ['CGST %', '60px'], ['SGST %', '60px'], ['Amount', '90px'], ['', '36px']"""
new_headers = """['#', '30px'], ['Product', '200px'], ['Desp', '80px'], ['HSN', '70px'], ['Feet', '60px'], ['Qty', '70px'], ['Unit', '70px'], ['Rate', '80px'], ['CGST %', '60px'], ['SGST %', '60px'], ['Amount', '90px'], ['Amount(Tax Incl)', '110px'], ['', '36px']"""

content = content.replace(old_headers, new_headers)

# 4. Update table row rendering
old_row = """                      <div style={{ paddingTop: '8px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', fontSize: '13px' }}>
                        {item.amount ? `₹${fmtINR(item.amount)}` : '-'}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>Qty × Rate</div>
                    </td>
                    <td style={{ padding: '6px 8px' }}>"""

new_row = """                      <div style={{ paddingTop: '8px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', fontSize: '13px' }}>
                        {item.amount ? `₹${fmtINR(item.amount)}` : '-'}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>Qty × Rate</div>
                    </td>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>
                      <div style={{ paddingTop: '8px', fontWeight: 700, color: '#16A34A', whiteSpace: 'nowrap', fontSize: '13px' }}>
                        {item.taxInclAmount ? `₹${fmtINR(item.taxInclAmount)}` : '-'}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>+ Taxes</div>
                    </td>
                    <td style={{ padding: '6px 8px' }}>"""

content = content.replace(old_row, new_row)

# 5. Fix rawGrandTotal calculation to include taxes (because subtotal is now tax-exclusive)
old_raw_grand = """const discountVal = Number(discount || 0)
    
    // Calculate raw grand total before roundoff
    const rawGrandTotal = subtotal - discountVal"""

new_raw_grand = """const discountVal = Number(discount || 0)
    
    // Calculate raw grand total before roundoff
    const rawGrandTotal = subtotal + totalCGST + totalSGST - discountVal"""

content = content.replace(old_raw_grand, new_raw_grand)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated BillingPanel.jsx successfully")

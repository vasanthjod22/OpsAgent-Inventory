import sys

filepath = "d:/Inventory/UI/src/components/panels/BillingPanel.jsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Fix handleGenerate
old_gen = """  const handleGenerate = () => {
    if (!customerName.trim()) return showToast?.('Customer name is required', 'error')
    if (items.filter(i => i.description).length === 0) return showToast?.('Add at least one line item', 'error')

    const bill = buildBillData()

    // Check for inventory items to deduct
    const invItems = items.filter(i => i.inventoryId && Number(i.quantity) > 0)
    if (invItems.length > 0) {
      setStockModal({ bill, items: invItems })
    } else {
      saveBill(bill, true)
    }
  }"""

new_gen = """  const handleGenerate = () => {
    if (!customerName.trim()) return showToast?.('Customer name is required', 'error')
    if (items.filter(i => i.description).length === 0) return showToast?.('Add at least one line item', 'error')

    const bill = buildBillData()

    // Check for inventory items to deduct
    const invItems = items.filter(i => i.inventoryId && Number(i.quantity) > 0)
    if (invItems.length > 0) {
      setStockModal({ bill, items: invItems, downloadPDF: false })
    } else {
      saveBill(bill, false)
    }
  }"""

if old_gen in content:
    content = content.replace(old_gen, new_gen)
else:
    print("Could not find handleGenerate block")

# 2. Fix handleStockUpdate
old_update = """    const handleStockUpdate = async (matchedItems) => {
      const updated = [...inventory]
      matchedItems.forEach(m => {
        const idx = updated.findIndex(i => i.hsn === m.hsn)
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], qty: Math.max(0, updated[idx].qty - m.billedQty) }
          if (updated[idx].qty < updated[idx].min) {
            showToast?.(`⚠️ ${m.name} is now below minimum stock level!`, 'warning', 'Low Stock')
          }
        }
      })
      setInventory(updated)
      const billData = { ...stockModal.bill, updateInventory: true }
      await saveBill(billData, true)
      setStockModal(null)
      showToast?.('Bill generated and stock updated!', 'success', 'Stock Updated')
    }"""

new_update = """    const handleStockUpdate = async (matchedItems) => {
      const updated = [...inventory]
      matchedItems.forEach(m => {
        const idx = updated.findIndex(i => i.hsn === m.hsn)
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], qty: Math.max(0, updated[idx].qty - m.billedQty) }
          if (updated[idx].qty < updated[idx].min) {
            showToast?.(`⚠️ ${m.name} is now below minimum stock level!`, 'warning', 'Low Stock')
          }
        }
      })
      setInventory(updated)
      const billData = { ...stockModal.bill, updateInventory: true }
      await saveBill(billData, stockModal.downloadPDF || false)
      setStockModal(null)
      showToast?.('Bill generated and stock updated!', 'success', 'Stock Updated')
    }"""

if old_update in content:
    content = content.replace(old_update, new_update)
else:
    print("Could not find handleStockUpdate block")


# 3. Fix handleSkipStock
old_skip = """    const handleSkipStock = () => {
      saveBill(stockModal.bill, true)
      setStockModal(null)
    }"""

new_skip = """    const handleSkipStock = () => {
      saveBill(stockModal.bill, stockModal.downloadPDF || false)
      setStockModal(null)
    }"""

if old_skip in content:
    content = content.replace(old_skip, new_skip)
else:
    print("Could not find handleSkipStock block")


# 4. Fix amtWords recursion on NaN
old_amt = """    const amtWords = (amt) => {
      const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
        'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
      const tensW = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
      const nW = (n) => {
        if (n === 0) return ''
        if (n < 20) return ones[n]
        if (n < 100) return tensW[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '')
        if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+nW(n%100) : '')
        if (n < 100000) return nW(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+nW(n%1000) : '')
        if (n < 10000000) return nW(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+nW(n%100000) : '')
        return nW(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+nW(n%10000000) : '')
      }
      const rs = Math.floor(amt)
      const ps = Math.round((amt - rs) * 100)
      let res = nW(rs) + ' Rupees'
      if (ps > 0) res += ' and ' + nW(ps) + ' Paise'
      return res + ' Only'
    }"""

new_amt = """    const amtWords = (amt) => {
      if (isNaN(amt) || amt === null || amt === undefined) return '';
      const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
        'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
      const tensW = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
      const nW = (n) => {
        if (n === 0) return ''
        if (n < 20) return ones[n]
        if (n < 100) return tensW[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '')
        if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+nW(n%100) : '')
        if (n < 100000) return nW(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+nW(n%1000) : '')
        if (n < 10000000) return nW(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+nW(n%100000) : '')
        return nW(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+nW(n%10000000) : '')
      }
      const rs = Math.floor(amt)
      const ps = Math.round((amt - rs) * 100)
      let res = nW(rs) + ' Rupees'
      if (ps > 0) res += ' and ' + nW(ps) + ' Paise'
      return res + ' Only'
    }"""

if old_amt in content:
    content = content.replace(old_amt, new_amt)
else:
    print("Could not find amtWords block")


with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("BillingPanel fixed")

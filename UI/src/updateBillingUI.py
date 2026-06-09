import sys

filepath = "d:/Inventory/UI/src/components/panels/BillingPanel.jsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add editBillId state and onEditBill handler to BillingPanelBase
state_old = """  function BillingPanelBase({ inventory, company, setInventory, onNavigate }) {
    const showToast = (msg, type) => {
      const e = new CustomEvent('toast', { detail: { msg, type } })
      window.dispatchEvent(e)
    }
  
    const [bills, setBills] = useState([])
    const [billDate, setBillDate] = useState(todayISO())"""

state_new = """  function BillingPanelBase({ inventory, company, setInventory, onNavigate }) {
    const showToast = (msg, type) => {
      const e = new CustomEvent('toast', { detail: { msg, type } })
      window.dispatchEvent(e)
    }
  
    const [bills, setBills] = useState([])
    const [editBillId, setEditBillId] = useState(null)
    const [billDate, setBillDate] = useState(todayISO())"""

if state_old in content:
    content = content.replace(state_old, state_new)
else:
    print("Could not find state block")
    sys.exit(1)

# 2. Modify saveBill to handle PUT
saveBill_old = """    const saveBill = async (billData, downloadPDF = false) => {
      try {
        const savedBill = await backendFetch('/bills', { method: 'POST', body: JSON.stringify(billData) })
        setBills(prev => [savedBill, ...prev])
        showToast?.('Bill saved to history', 'success', 'Billing')
        
        if (downloadPDF) {
          generateBillPDF(savedBill, company)
        }
        
        // Reset form
        setBillDate(todayISO())
        setCustomerName('')
        setCustomerPhone('')
        setCustomerAddress('')
        setItems([makeItem()])
        setDiscount('')
        setPaymentStatus('Unpaid')
        setAmountPaid('')
        setNotes('')
        setIncludeTerms(false)
        setTerms('')
      } catch (err) {
        showToast?.('Failed to save bill', 'error', 'Billing')
        console.error(err)
      }
    }"""

saveBill_new = """    const saveBill = async (billData, downloadPDF = false) => {
      try {
        const method = editBillId ? 'PUT' : 'POST'
        const url = editBillId ? `/bills/${editBillId}` : '/bills'
        const savedBill = await backendFetch(url, { method, body: JSON.stringify(billData) })
        
        if (editBillId) {
          setBills(prev => prev.map(b => b.id === editBillId ? savedBill : b))
          showToast?.('Bill updated successfully', 'success', 'Billing')
          setEditBillId(null)
        } else {
          setBills(prev => [savedBill, ...prev])
          showToast?.('Bill saved to history', 'success', 'Billing')
        }
        
        if (downloadPDF) {
          generateBillPDF(savedBill, company)
        }
        
        // Reset form
        setBillDate(todayISO())
        setCustomerName('')
        setCustomerPhone('')
        setCustomerAddress('')
        setItems([makeItem()])
        setDiscount('')
        setPaymentStatus('Unpaid')
        setAmountPaid('')
        setNotes('')
        setIncludeTerms(false)
        setTerms('')
      } catch (err) {
        showToast?.('Failed to save bill', 'error', 'Billing')
        console.error(err)
      }
    }"""

if saveBill_old in content:
    content = content.replace(saveBill_old, saveBill_new)
else:
    print("Could not find saveBill block")
    sys.exit(1)

# 3. Change "Generate Bill & Download PDF" to "Generate Bill" and handle false
gen_old = """          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
            <button onClick={handleGenerate}
              style={{ height: '44px', padding: '0 28px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #16A34A, #15803D)', color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}>
              <Download size={16} /> Generate Bill & Download PDF
            </button>
          </div>"""

gen_new = """          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
            {editBillId && (
              <button onClick={() => {
                setEditBillId(null)
                setBillDate(todayISO())
                setCustomerName('')
                setCustomerPhone('')
                setCustomerAddress('')
                setItems([makeItem()])
                setDiscount('')
                setPaymentStatus('Unpaid')
                setAmountPaid('')
                setNotes('')
                setIncludeTerms(false)
                setTerms('')
              }} style={{ height: '44px', padding: '0 28px', borderRadius: '10px', border: '1px solid #E2E8F0', background: 'white', color: '#64748B', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Cancel Edit</button>
            )}
            <button onClick={() => {
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
            }}
              style={{ height: '44px', padding: '0 28px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #16A34A, #15803D)', color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}>
              {editBillId ? 'Save Edited Bill' : 'Generate Bill'}
            </button>
          </div>"""

if gen_old in content:
    content = content.replace(gen_old, gen_new)
else:
    print("Could not find Generate button block")
    sys.exit(1)

# Fix handleGenerate usages inside handleStockUpdate
hs_old = """    const handleStockUpdate = async (matchedItems) => {
      const updated = [...inventory]
      matchedItems.forEach(m => {
        const idx = updated.findIndex(i => i.hsn === m.hsn)
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], qty: Math.max(0, updated[idx].qty - m.billedQty) }
        }
      })
      setInventory(updated)
      saveBill({ ...stockModal.bill, inventoryUpdated: true }, true)
      setStockModal(null)
    }
  
    const handleSkipStock = () => {
      saveBill(stockModal.bill, true)
      setStockModal(null)
    }"""

hs_new = """    const handleStockUpdate = async (matchedItems) => {
      const updated = [...inventory]
      matchedItems.forEach(m => {
        const idx = updated.findIndex(i => i.hsn === m.hsn)
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], qty: Math.max(0, updated[idx].qty - m.billedQty) }
        }
      })
      setInventory(updated)
      saveBill({ ...stockModal.bill, inventoryUpdated: true }, stockModal.downloadPDF || false)
      setStockModal(null)
    }
  
    const handleSkipStock = () => {
      saveBill(stockModal.bill, stockModal.downloadPDF || false)
      setStockModal(null)
    }"""

if hs_old in content:
    content = content.replace(hs_old, hs_new)
else:
    print("Could not find handleStockUpdate block")

# 4. Pass handleEditBill to BillHistory
edit_fn = """        {/* Bill History */}
        <BillHistory bills={bills} setBills={setBills} inventory={inventory} setInventory={setInventory} company={company} showToast={showToast} 
          onEditBill={(b) => {
            setEditBillId(b.id)
            setCustomerName(b.customerName || '')
            setCustomerPhone(b.customerPhone || '')
            setCustomerAddress(b.customerAddress || '')
            setItems(b.items && b.items.length > 0 ? b.items : [makeItem()])
            setDiscount(b.discount || '')
            setPaymentStatus(b.paymentStatus || 'Unpaid')
            setAmountPaid(b.amountPaid || '')
            setNotes(b.notes || '')
            setIncludeTerms(b.includeTerms || false)
            setTerms(b.terms || '')
            setBillDate(b.date || todayISO())
            window.scrollTo({ top: 0, behavior: 'smooth' })
            showToast?.('Editing bill...', 'info')
          }}
        />"""

bh_old = """        {/* Bill History */}
        <BillHistory bills={bills} setBills={setBills} inventory={inventory} setInventory={setInventory} company={company} showToast={showToast} />"""

if bh_old in content:
    content = content.replace(bh_old, edit_fn)
else:
    print("Could not find BillHistory render block")
    sys.exit(1)

# 5. Update BillHistory declaration and Edit button
bh_decl_old = """function BillHistory({ bills, setBills, inventory, setInventory, company, showToast }) {"""
bh_decl_new = """function BillHistory({ bills, setBills, inventory, setInventory, company, showToast, onEditBill }) {"""

if bh_decl_old in content:
    content = content.replace(bh_decl_old, bh_decl_new)
else:
    print("Could not find BillHistory declaration")
    sys.exit(1)

bh_btn_old = """                      <button onClick={() => setEditStatusId(editStatusId === b.id ? null : b.id)} title="Change status"
                        style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#7C3AED'; e.currentTarget.style.borderColor = '#C4B5FD' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = '#E2E8F0' }}>
                        <Edit2 size={14} />
                      </button>"""

bh_btn_new = """                      <button onClick={() => onEditBill(b)} title="Edit Bill"
                        style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#7C3AED'; e.currentTarget.style.borderColor = '#C4B5FD' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = '#E2E8F0' }}>
                        <Edit2 size={14} />
                      </button>"""

if bh_btn_old in content:
    content = content.replace(bh_btn_old, bh_btn_new)
else:
    print("Could not find Edit button in BillHistory")
    sys.exit(1)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated BillingPanel.jsx UI!")

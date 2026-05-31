import { useState, useEffect, useRef, useCallback } from 'react'
import jsPDF from 'jspdf'
import {
  Plus, Trash2, Download, Eye, X, Receipt, Search,
  CheckCircle, AlertTriangle, ChevronDown, Building2,
  User, Hash, DollarSign, FileText, Clock, Edit2,
} from 'lucide-react'

/* ─── Helpers ─────────────────────────────────────────────── */
const todayISO = () => new Date().toISOString().split('T')[0]
const fmtDate = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
const fmtINR = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtINR0 = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const generateBillNumber = () => {
  try {
    const existing = JSON.parse(localStorage.getItem('opsagent_bills') || '[]')
    const next = existing.length + 1
    const padded = String(next).padStart(4, '0')
    return `BILL-${new Date().getFullYear()}-${padded}`
  } catch {
    return `BILL-${new Date().getFullYear()}-0001`
  }
}

const generateBillFilename = (customerName) => {
  const clean = (customerName || 'Customer')
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 25)
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${clean}_BILL_${dd}${mm}${yyyy}.pdf`
}

const UNIT_OPTIONS = ['Nos', 'Sqft', 'Sqmt', 'Kg', 'Gram', 'Metre', 'Litre', 'Set', 'Box', 'Bag', 'Ltrs', 'Rmt']
const GST_OPTIONS = [0, 5, 12, 18, 28]
const STATUS_COLORS = { Paid: '#16A34A', Unpaid: '#DC2626', Partial: '#D97706' }
const STATUS_BG = { Paid: '#F0FDF4', Unpaid: '#FEF2F2', Partial: '#FFFBEB' }
const STATUS_BORDER = { Paid: '#BBF7D0', Unpaid: '#FECACA', Partial: '#FDE68A' }

const makeItem = () => ({
  id: Date.now() + Math.random(),
  sno: 1,
  description: '',
  hsnCode: '',
  nos: '',
  qty: '',
  unit: 'Nos',
  rate: '',
  amount: 0,
  inventorySku: null,
})

const recalcSno = (items) => items.map((item, i) => ({ ...item, sno: i + 1 }))

const calcAmount = (nos, qty, rate) => {
  const n = parseFloat(nos) || 0
  const q = parseFloat(qty) || 0
  const r = parseFloat(rate) || 0
  if (!nos && !qty) return 0
  if (nos && !qty) return n * r
  if (!nos && qty) return q * r
  if (nos && qty) return n * r
}

/* ─── PDF Generator ───────────────────────────────────────── */
const generateBillPDF = (bill, company) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const mg = 15
  let y = 20

  // Header background
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, 42, 'F')

  // Company name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(255, 255, 255)
  doc.text((company.name || 'Company Name').substring(0, 35), mg, 13)

  // Company details
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 195, 210)
  doc.text(company.address || '', mg, 20)
  doc.text(`Ph: ${company.phone || ''}  |  GSTIN: ${company.gstin || ''}`, mg, 26)
  const bankLine = company.bankName
    ? `Bank: ${company.bankName}  |  A/C: ${company.accountNumber || ''}  |  IFSC: ${company.ifsc || ''}`
    : (company.bankDetails || '')
  if (bankLine) doc.text(bankLine.substring(0, 70), mg, 32)

  // TAX INVOICE label
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(96, 165, 250)
  doc.text('TAX INVOICE', W - mg, 13, { align: 'right' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 195, 210)
  doc.text(`Bill No: ${bill.billNumber}`, W - mg, 21, { align: 'right' })
  doc.text(`Date: ${fmtDate(bill.date)}`, W - mg, 27, { align: 'right' })

  y = 52

  // Bill To box
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(mg, y, (W - mg * 2) / 2 - 5, 36, 3, 3, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text('BILL TO', mg + 5, y + 7)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text((bill.customerName || '').substring(0, 30), mg + 5, y + 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  if (bill.customerPhone) doc.text(`Ph: ${bill.customerPhone}`, mg + 5, y + 21)
  if (bill.customerAddress) doc.text(bill.customerAddress.substring(0, 40), mg + 5, y + 27)

  y += 44

  // Line items table header
  doc.setFillColor(15, 23, 42)
  doc.rect(mg, y, W - mg * 2, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(255, 255, 255)
  const cols = { sno: mg + 3, desc: mg + 12, hsn: mg + 60, nos: mg + 78, qty: mg + 95, unit: mg + 115, rate: mg + 135, amt: W - mg - 2 }
  doc.text('#', cols.sno, y + 5.5)
  doc.text('Description', cols.desc, y + 5.5)
  doc.text('HSN', cols.hsn, y + 5.5)
  doc.text('Nos', cols.nos, y + 5.5)
  doc.text('Qty', cols.qty, y + 5.5)
  doc.text('Unit', cols.unit, y + 5.5)
  doc.text('Rate', cols.rate, y + 5.5)
  doc.text('Amount', cols.amt, y + 5.5, { align: 'right' })
  y += 8

  // Rows
  bill.items.forEach((item, idx) => {
    const rowH = 8
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252)
    doc.rect(mg, y, W - mg * 2, rowH, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(15, 23, 42)
    doc.text(String(item.sno), cols.sno, y + 5.5)
    doc.text((item.description || '').substring(0, 25), cols.desc, y + 5.5)
    doc.setTextColor(100, 116, 139)
    doc.text(item.hsnCode || '-', cols.hsn, y + 5.5)
    doc.setTextColor(15, 23, 42)
    doc.text(item.nos ? String(item.nos) : '-', cols.nos, y + 5.5)
    doc.text(item.qty ? String(item.qty) : '-', cols.qty, y + 5.5)
    doc.text(item.unit || '', cols.unit, y + 5.5)
    doc.text(fmtINR(item.rate), cols.rate, y + 5.5)
    doc.setFont('helvetica', 'bold')
    doc.text(fmtINR(item.amount), cols.amt, y + 5.5, { align: 'right' })
    y += rowH

    if (y > H - 70) {
      doc.addPage()
      y = 20
    }
  })

  // Totals divider line
  doc.setDrawColor(226, 232, 240)
  doc.line(mg, y, W - mg, y)
  y += 6

  // Totals right-side block
  const totX = W - mg - 60
  const totRight = W - mg
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text('Subtotal:', totX, y)
  doc.setTextColor(15, 23, 42)
  doc.text(`Rs. ${fmtINR(bill.subtotal)}`, totRight, y, { align: 'right' })
  y += 6

  if (bill.gstPercent > 0) {
    doc.setTextColor(100, 116, 139)
    doc.text(`GST (${bill.gstPercent}%):`, totX, y)
    doc.setTextColor(15, 23, 42)
    doc.text(`Rs. ${fmtINR(bill.gstAmount)}`, totRight, y, { align: 'right' })
    y += 6
  }
  if (bill.discount > 0) {
    doc.setTextColor(100, 116, 139)
    doc.text('Discount:', totX, y)
    doc.setTextColor(220, 38, 38)
    doc.text(`-Rs. ${fmtINR(bill.discount)}`, totRight, y, { align: 'right' })
    y += 6
  }

  doc.setDrawColor(200, 210, 220)
  doc.line(totX, y, totRight, y)
  y += 4

  doc.setFillColor(15, 23, 42)
  doc.roundedRect(totX - 4, y - 1, totRight - totX + 6, 9, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(255, 255, 255)
  doc.text('GRAND TOTAL', totX, y + 6)
  doc.text(`Rs. ${fmtINR(bill.grandTotal)}`, totRight, y + 6, { align: 'right' })
  y += 12

  // Payment status box (left side)
  const psY = y - 12
  const psColor = bill.paymentStatus === 'Paid' ? [22, 163, 74] : bill.paymentStatus === 'Partial' ? [217, 119, 6] : [220, 38, 38]
  doc.setFillColor(...psColor)
  doc.roundedRect(mg, psY - 1, 52, bill.paymentStatus === 'Partial' ? 16 : 10, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  const psLabel = bill.paymentStatus === 'Paid' ? '✓  PAID' : bill.paymentStatus === 'Partial' ? 'PARTIAL PAYMENT' : 'PAYMENT DUE'
  doc.text(psLabel, mg + 4, psY + 6)
  if (bill.paymentStatus === 'Partial') {
    doc.setFontSize(7.5)
    doc.text(`Paid: Rs.${fmtINR(bill.amountPaid)}  |  Bal: Rs.${fmtINR(bill.balanceDue)}`, mg + 4, psY + 12)
  }

  y += 8

  // Notes
  if (bill.notes) {
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('Notes:', mg, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(15, 23, 42)
    const noteLines = doc.splitTextToSize(bill.notes, W - mg * 2)
    doc.text(noteLines.slice(0, 3), mg, y + 5)
    y += 5 + noteLines.slice(0, 3).length * 4
  }

  // Terms
  if (bill.includeTerms && bill.terms) {
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('Terms & Conditions:', mg, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(71, 85, 105)
    const tLines = doc.splitTextToSize(bill.terms, W - mg * 2)
    doc.text(tLines.slice(0, 6), mg, y)
    y += tLines.slice(0, 6).length * 4
  }

  // Footer
  doc.setFillColor(15, 23, 42)
  doc.rect(0, H - 14, W, 14, 'F')
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text('This is a computer generated invoice', W / 2, H - 8, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text(`${company.name || ''}  |  ${bill.billNumber}  |  OpsAgent`, W / 2, H - 3, { align: 'center' })

  doc.save(generateBillFilename(bill.customerName))
}

/* ─── Stock Update Confirm Modal ──────────────────────────── */
function StockModal({ items, inventory, onSkip, onConfirm }) {
  const matchedItems = items.filter(it => {
    if (!it.inventorySku) return false
    const inv = inventory.find(i => i.sku === it.inventorySku)
    return inv && Number(it.nos) > 0
  }).map(it => {
    const inv = inventory.find(i => i.sku === it.inventorySku)
    return {
      name: it.description,
      sku: it.inventorySku,
      billedQty: Number(it.nos),
      currentStock: inv.qty,
      afterStock: inv.qty - Number(it.nos),
      unit: inv.unit,
      min: inv.min,
    }
  })

  if (matchedItems.length === 0) { onSkip(); return null }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '16px', maxWidth: '560px', width: '100%', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', background: '#FAFBFC' }}>
          <div style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A' }}>Update Inventory?</div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>The following items will be deducted from stock:</div>
        </div>
        <div style={{ padding: '16px 24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0F172A' }}>
                {['Item', 'Billed Qty', 'Current Stock', 'After'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', color: 'white', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matchedItems.map((m, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: m.afterStock < m.min ? '#FFF7ED' : 'white' }}>
                  <td style={{ padding: '9px 10px', fontWeight: 600, color: '#0F172A' }}>{m.name}</td>
                  <td style={{ padding: '9px 10px', color: '#64748B' }}>{m.billedQty} {m.unit}</td>
                  <td style={{ padding: '9px 10px', color: '#64748B' }}>{m.currentStock} {m.unit}</td>
                  <td style={{ padding: '9px 10px', fontWeight: 700, color: m.afterStock < 0 ? '#DC2626' : m.afterStock < m.min ? '#D97706' : '#16A34A' }}>{m.afterStock} {m.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {matchedItems.some(m => m.afterStock < m.min) && (
            <div style={{ marginTop: '10px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#92400E' }}>
              ⚠ Some items will fall below minimum stock after this update.
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onSkip} style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer', color: '#64748B' }}>
            Skip
          </button>
          <button onClick={() => onConfirm(matchedItems)} style={{ height: '38px', padding: '0 18px', borderRadius: '8px', border: 'none', background: '#2563EB', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
            Update Stock
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Inventory Autocomplete ─────────────────────────────── */
function DescriptionInput({ value, onChange, inventory, onSelectItem, inputRef }) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)

  const suggestions = query.length > 0
    ? inventory.filter(i => i.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : []

  const handleChange = (v) => {
    setQuery(v)
    onChange(v)
    setOpen(true)
  }

  const handleSelect = (item) => {
    setQuery(item.name)
    onChange(item.name)
    onSelectItem(item)
    setOpen(false)
  }

  useEffect(() => { setQuery(value) }, [value])

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        ref={inputRef}
        style={{ width: '100%', padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }}
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Item description..."
      />
      {open && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, marginTop: '2px', overflow: 'hidden' }}>
          {suggestions.map(item => (
            <button key={item.sku} onMouseDown={() => handleSelect(item)}
              style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', fontSize: '13px' }}
              onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <div>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{item.name}</span>
                <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '6px' }}>{item.sku}</span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, background: '#EFF6FF', color: '#2563EB', padding: '2px 7px', borderRadius: '99px' }}>{item.qty} {item.unit}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const getQtyLabel = (unit) => {
  const map = { Nos: 'Qty', Sqft: 'Sqft', Sqmt: 'Sqmt', Kg: 'Weight (Kg)', Gram: 'Weight (g)', Metre: 'Length (m)', Litre: 'Volume (L)', Set: 'Qty', Box: 'Qty', Bag: 'Qty' }
  return map[unit] || 'Qty'
}

/* ─── Line Items Table ───────────────────────────────────── */
function LineItemsTable({ items, setItems, inventory }) {
  const newRowRef = useRef(null)

  const addItem = () => {
    const newItem = { ...makeItem(), sno: items.length + 1 }
    setItems(prev => [...prev, newItem])
    setTimeout(() => newRowRef.current?.focus(), 50)
  }

  const deleteItem = (id) => {
    if (items.length <= 1) return
    setItems(prev => recalcSno(prev.filter(i => i.id !== id)))
  }

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      updated.amount = calcAmount(
        field === 'nos' ? value : item.nos,
        field === 'qty' ? value : item.qty,
        field === 'rate' ? value : item.rate
      )
      return updated
    }))
  }

  const selectInventoryItem = (id, invItem) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      return { ...item, unit: invItem.unit || item.unit, inventorySku: invItem.sku }
    }))
  }

  const inp = { padding: '7px 8px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: "'Inter', sans-serif", background: 'white', width: '100%', boxSizing: 'border-box' }

  return (
    <div>
      <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '850px' }}>
          <thead>
            <tr style={{ background: '#0F172A' }}>
              {[['#', '40px'], ['Description', '1fr'], ['HSN', '90px'], ['Nos', '80px'], ['Qty', '80px'], ['Unit', '90px'], ['Rate', '100px'], ['Amount', '110px'], ['', '36px']].map(([h, w]) => (
                <th key={h} style={{ padding: '9px 10px', textAlign: 'left', color: 'white', fontSize: '12px', fontWeight: 600, width: w, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const invItem = item.inventorySku ? inventory.find(i => i.sku === item.inventorySku) : null
              const overStock = invItem && Number(item.qty || item.nos) > invItem.qty
              return (
                <div key={item.id} style={{ display: 'contents' }}>
                  <tr style={{ borderBottom: '1px solid #F1F5F9', background: idx % 2 === 0 ? 'white' : '#FAFBFC' }}>
                    <td style={{ padding: '6px 8px', color: '#94A3B8', fontSize: '13px', fontWeight: 600, textAlign: 'center', width: '40px', verticalAlign: 'top' }}>
                      <div style={{ paddingTop: '8px' }}>{item.sno}</div>
                    </td>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>
                      <DescriptionInput
                        inputRef={idx === items.length - 1 ? newRowRef : undefined}
                        value={item.description}
                        onChange={v => updateItem(item.id, 'description', v)}
                        inventory={inventory}
                        onSelectItem={inv => selectInventoryItem(item.id, inv)}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>
                      <input style={inp} value={item.hsnCode} onChange={e => updateItem(item.id, 'hsnCode', e.target.value)} placeholder="Optional" />
                    </td>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>
                      <input style={inp} type="number" min="0" step="0.01" value={item.nos} onChange={e => updateItem(item.id, 'nos', e.target.value)} placeholder="Optional" />
                      <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '4px', textAlign: 'center' }}>Nos</div>
                    </td>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>
                      <input style={inp} type="number" min="0" step="0.01" value={item.qty} onChange={e => updateItem(item.id, 'qty', e.target.value)} placeholder="Qty" />
                      <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '4px', textAlign: 'center' }}>{getQtyLabel(item.unit)}</div>
                    </td>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>
                      <select style={inp} value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)}>
                        {UNIT_OPTIONS.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>
                      <input style={inp} type="number" min="0" step="0.01" value={item.rate} onChange={e => updateItem(item.id, 'rate', e.target.value)} placeholder={`Per ${item.unit}`} />
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', verticalAlign: 'top' }}>
                      <div style={{ paddingTop: '8px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', fontSize: '13px' }}>
                        {item.amount ? `₹${fmtINR(item.amount)}` : '-'}
                      </div>
                      <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '4px' }}>
                        {!item.nos && !item.qty ? '-' : item.nos && !item.qty ? 'Nos × Rate' : !item.nos && item.qty ? 'Qty × Rate' : 'Nos × Rate'}
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                      <button onClick={() => deleteItem(item.id)} title="Delete row"
                        style={{ marginTop: '5px', background: 'none', border: 'none', cursor: items.length <= 1 ? 'not-allowed' : 'pointer', color: items.length <= 1 ? '#E2E8F0' : '#FECACA', padding: '4px' }}
                        onMouseEnter={e => { if (items.length > 1) e.currentTarget.style.color = '#DC2626' }}
                        onMouseLeave={e => { if (items.length > 1) e.currentTarget.style.color = '#FECACA' }}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                  {overStock && (
                    <tr style={{ background: '#FFFBEB' }}>
                      <td colSpan={9} style={{ padding: '3px 12px 5px', fontSize: '11px', color: '#92400E' }}>
                        ⚠ Only {invItem.qty} {invItem.unit} in stock
                      </td>
                    </tr>
                  )}
                </div>
              )
            })}
          </tbody>
        </table>
      </div>

      <button onClick={addItem}
        style={{ marginTop: '10px', height: '36px', padding: '0 16px', borderRadius: '8px', background: 'white', color: '#2563EB', border: '1.5px solid #93C5FD', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}>
        <Plus size={15} /> Add Item
      </button>
    </div>
  )
}

/* ─── Bill History Table ─────────────────────────────────── */
function BillHistory({ bills, setBills, inventory, setInventory, company, showToast }) {
  const [search, setSearch] = useState('')
  const [editStatusId, setEditStatusId] = useState(null)

  const filtered = bills.filter(b =>
    !search || b.customerName?.toLowerCase().includes(search.toLowerCase()) || b.billNumber?.toLowerCase().includes(search.toLowerCase())
  )

  const totalRevenue = bills.filter(b => b.paymentStatus === 'Paid').reduce((s, b) => s + b.grandTotal, 0)
  const pendingAmount = bills.filter(b => b.paymentStatus !== 'Paid').reduce((s, b) => s + (b.paymentStatus === 'Partial' ? (b.balanceDue || 0) : b.grandTotal), 0)

  const updateStatus = (id, status) => {
    setBills(prev => prev.map(b => b.id === id ? { ...b, paymentStatus: status } : b))
    setEditStatusId(null)
    showToast?.(`Payment status updated to ${status}`, 'success')
  }

  const deleteBill = (id) => {
    if (!window.confirm('Delete this bill from history?')) return
    setBills(prev => prev.filter(b => b.id !== id))
    showToast?.('Bill deleted', 'info')
  }

  const redownload = (b) => {
    generateBillPDF(b, company)
    showToast?.('Bill PDF re-downloaded', 'success')
  }

  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: '#FAFBFC' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={17} color="#16A34A" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Bill History</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '1px' }}>{bills.length} bills total</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#16A34A' }}>₹{fmtINR0(totalRevenue)}</div>
            <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Revenue</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#DC2626' }}>₹{fmtINR0(pendingAmount)}</div>
            <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Pending</div>
          </div>
          <div style={{ position: 'relative', width: '200px' }}>
            <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bills..." style={{ width: '100%', paddingLeft: '30px', paddingRight: '10px', height: '34px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Bill No', 'Customer', 'Date', 'Amount', 'Status', 'Actions'].map((h, i) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: i >= 3 ? 'center' : 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
                {bills.length === 0 ? 'No bills yet. Generate your first bill!' : 'No bills match your search.'}
              </td></tr>
            )}
            {filtered.map((b, i) => (
              <tr key={b.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2563EB' }}>{b.billNumber}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>{b.customerName}</div>
                </td>
                <td style={{ padding: '12px 16px', color: '#64748B' }}>{fmtDate(b.date)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#0F172A' }}>₹{fmtINR0(b.grandTotal)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', position: 'relative' }}>
                  {editStatusId === b.id ? (
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {['Paid', 'Unpaid', 'Partial'].map(s => (
                        <button key={s} onClick={() => updateStatus(b.id, s)}
                          style={{ padding: '3px 8px', borderRadius: '6px', border: `1px solid ${STATUS_BORDER[s]}`, background: STATUS_BG[s], color: STATUS_COLORS[s], fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}>
                          {s}
                        </button>
                      ))}
                      <button onClick={() => setEditStatusId(null)} style={{ padding: '3px 6px', borderRadius: '6px', border: '1px solid #E2E8F0', background: 'white', color: '#64748B', fontSize: '11px', cursor: 'pointer' }}>✕</button>
                    </div>
                  ) : (
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '99px', background: STATUS_BG[b.paymentStatus], color: STATUS_COLORS[b.paymentStatus], fontSize: '11px', fontWeight: 700, border: `1px solid ${STATUS_BORDER[b.paymentStatus]}` }}>
                      {b.paymentStatus}
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                    <button onClick={() => redownload(b)} title="Re-download PDF"
                      style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#2563EB'; e.currentTarget.style.borderColor = '#93C5FD' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = '#E2E8F0' }}>
                      <Download size={14} />
                    </button>
                    <button onClick={() => setEditStatusId(editStatusId === b.id ? null : b.id)} title="Change status"
                      style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#7C3AED'; e.currentTarget.style.borderColor = '#C4B5FD' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = '#E2E8F0' }}>
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteBill(b.id)} title="Delete"
                      style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Main BillingPanel ──────────────────────────────────── */
export default function BillingPanel({ inventory = [], setInventory, showToast, onNavigate }) {
  const company = (() => { try { return JSON.parse(localStorage.getItem('opsagent_company') || '{}') } catch { return {} } })()

  const [bills, setBills] = useState(() => {
    try { return JSON.parse(localStorage.getItem('opsagent_bills') || '[]') } catch { return [] }
  })

  // Persist bills
  useEffect(() => {
    localStorage.setItem('opsagent_bills', JSON.stringify(bills))
  }, [bills])

  const [billNumber] = useState(() => generateBillNumber())
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [items, setItems] = useState([makeItem()])
  const [gstPercent, setGstPercent] = useState(18)
  const [discount, setDiscount] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('Unpaid')
  const [amountPaid, setAmountPaid] = useState('')
  const [notes, setNotes] = useState('')
  const [includeTerms, setIncludeTerms] = useState(false)
  const [terms, setTerms] = useState('')
  const [stockModal, setStockModal] = useState(null)

  // Derived totals
  const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0)
  const gstAmount = subtotal * (gstPercent || 0) / 100
  const discountVal = Number(discount || 0)
  const grandTotal = subtotal + gstAmount - discountVal
  const balanceDue = grandTotal - Number(amountPaid || 0)

  const inp = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', color: '#0F172A', outline: 'none', background: 'white', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }
  const readOnly = { ...inp, background: '#F8FAFC', color: '#64748B', cursor: 'default' }
  const Lbl = ({ children }) => (
    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>{children}</label>
  )

  const buildBillData = () => ({
    id: Date.now(),
    billNumber,
    customerName,
    customerPhone,
    customerAddress,
    items: items.filter(i => i.description),
    subtotal,
    gstPercent,
    gstAmount,
    discount: discountVal,
    grandTotal,
    paymentStatus,
    amountPaid: paymentStatus === 'Partial' ? Number(amountPaid || 0) : null,
    balanceDue: paymentStatus === 'Partial' ? balanceDue : null,
    notes,
    includeTerms,
    terms,
    date: todayISO(),
    inventoryUpdated: false,
  })

  const handleGenerate = () => {
    if (!customerName.trim()) return showToast?.('Customer name is required', 'error')
    if (items.filter(i => i.description).length === 0) return showToast?.('Add at least one line item', 'error')

    const bill = buildBillData()
    generateBillPDF(bill, company)
    showToast?.(`${generateBillFilename(customerName)} downloaded!`, 'success', 'Bill Generated')

    // Check for inventory items to deduct
    const invItems = items.filter(i => i.inventorySku && Number(i.nos) > 0)
    if (invItems.length > 0) {
      setStockModal({ bill, items: invItems })
    } else {
      saveBill(bill)
    }
  }

  const saveBill = (bill) => {
    setBills(prev => [bill, ...prev])
    showToast?.('Bill saved to history', 'success', 'Billing')
  }

  const handleStockUpdate = (matchedItems) => {
    const updated = [...inventory]
    matchedItems.forEach(m => {
      const idx = updated.findIndex(i => i.sku === m.sku)
      if (idx !== -1) {
        updated[idx] = { ...updated[idx], qty: Math.max(0, updated[idx].qty - m.billedQty) }
        if (updated[idx].qty < updated[idx].min) {
          showToast?.(`⚠ ${m.name} is now below minimum stock level!`, 'warning', 'Low Stock')
        }
      }
    })
    setInventory(updated)
    const bill = { ...stockModal.bill, inventoryUpdated: true }
    saveBill(bill)
    setStockModal(null)
    showToast?.('Bill generated and stock updated!', 'success', 'Stock Updated')
  }

  const handleSkipStock = () => {
    saveBill(stockModal.bill)
    setStockModal(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '60px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: 0, fontFamily: "'Inter', sans-serif" }}>Billing</h2>
          <p style={{ fontSize: '14px', color: '#64748B', marginTop: '4px' }}>Create tax invoices and manage payment history</p>
        </div>
      </div>

      {/* Bill Form Card */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {/* Form Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '10px', background: '#FAFBFC' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Receipt size={17} color="#2563EB" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Create New Bill</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>Bill Number: <span style={{ fontWeight: 700, color: '#2563EB' }}>{billNumber}</span></div>
          </div>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Customer + Company row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Customer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>Bill To (Customer)</div>
              <div><Lbl>Customer Name *</Lbl><input style={inp} value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer / Company Name" /></div>
              <div><Lbl>Phone</Lbl><input style={inp} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+91 98765 43210" /></div>
              <div><Lbl>Address</Lbl><textarea style={{ ...inp, resize: 'vertical', minHeight: '64px' }} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Customer address..." rows={2} /></div>
            </div>

            {/* Company (read-only) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Bill From (Company)
                {!company.name && (
                  <button onClick={() => onNavigate?.('settings')} style={{ fontSize: '11px', color: '#D97706', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>⚠ Set up in Settings →</button>
                )}
              </div>
              <div><Lbl>Company Name</Lbl><input style={readOnly} value={company.name || '—'} readOnly /></div>
              <div>
                <Lbl>GSTIN</Lbl>
                <input style={readOnly} value={company.gstin || '—'} readOnly />
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Saved from Company Profile · <button onClick={() => onNavigate?.('settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563EB', fontSize: '11px', padding: 0 }}>Update in Settings →</button></div>
              </div>
              <div><Lbl>Bill Date</Lbl><input style={readOnly} value={fmtDate(todayISO())} readOnly /></div>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '12px' }}>Line Items</div>
            <LineItemsTable items={items} setItems={setItems} inventory={inventory} />
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748B' }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748B' }}>
                <span>GST</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select value={gstPercent} onChange={e => setGstPercent(Number(e.target.value))}
                    style={{ border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '12px', padding: '3px 6px', outline: 'none', background: 'white' }}>
                    {GST_OPTIONS.map(g => <option key={g}>{g}</option>)}
                  </select>
                  <span style={{ fontSize: '12px' }}>%</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(gstAmount)}</span>
                </div>
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
            </div>
          </div>

          {/* Payment Status */}
          <div>
            <Lbl>Payment Status</Lbl>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['Paid', 'Unpaid', 'Partial'].map(s => (
                <button key={s} onClick={() => setPaymentStatus(s)}
                  style={{ height: '36px', padding: '0 18px', borderRadius: '8px', border: `1.5px solid ${paymentStatus === s ? STATUS_COLORS[s] : '#E2E8F0'}`, background: paymentStatus === s ? STATUS_BG[s] : 'white', color: paymentStatus === s ? STATUS_COLORS[s] : '#64748B', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s' }}>
                  {s}
                </button>
              ))}
            </div>
            {paymentStatus === 'Partial' && (
              <div style={{ marginTop: '10px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <Lbl>Amount Paid</Lbl>
                  <input type="number" min="0" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} style={{ ...inp, width: '160px' }} placeholder="0.00" />
                </div>
                <div style={{ paddingTop: '18px' }}>
                  <div style={{ fontSize: '13px', color: '#64748B' }}>Balance Due</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#DC2626' }}>₹{fmtINR(Math.max(0, balanceDue))}</div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Lbl>Notes (optional)</Lbl>
            <textarea style={{ ...inp, resize: 'vertical', minHeight: '72px' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Payment terms, delivery notes..." rows={3} />
          </div>

          {/* Terms toggle */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={includeTerms} onChange={e => setIncludeTerms(e.target.checked)} style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Include Terms & Conditions</span>
            </label>
            {includeTerms && (
              <textarea style={{ ...inp, marginTop: '10px', resize: 'vertical', minHeight: '90px' }} value={terms} onChange={e => setTerms(e.target.value)} placeholder="Enter terms and conditions..." rows={4} />
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
            <button onClick={handleGenerate}
              style={{ height: '44px', padding: '0 28px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #16A34A, #15803D)', color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}>
              <Download size={16} /> Generate Bill & Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Bill History */}
      <BillHistory bills={bills} setBills={setBills} inventory={inventory} setInventory={setInventory} company={company} showToast={showToast} />

      {/* Modals */}
      {stockModal && (
        <StockModal items={stockModal.items} inventory={inventory} onSkip={handleSkipStock} onConfirm={handleStockUpdate} />
      )}
    </div>
  )
}

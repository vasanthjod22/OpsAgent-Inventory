import { useState, useEffect, useCallback } from 'react'
import jsPDF from 'jspdf'
import {
  Plus, Trash2, Download, Sparkles, Eye, X,
  FileText, ChevronDown, Building2, User, Hash,
  Calendar, List, DollarSign, FileCheck, Clock,
  CheckCircle, Send, XCircle, RefreshCw, RotateCcw,
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
const today = () => new Date().toISOString().split('T')[0]
const plusDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}
const generateQuotationNumber = () => {
  try {
    const existing = JSON.parse(localStorage.getItem('opsagent_quotations') || '[]')
    const nextNumber = existing.length + 1
    const padded = String(nextNumber).padStart(4, '0')
    const year = new Date().getFullYear()
    return `QT-${year}-${padded}`
  } catch {
    return `QT-${new Date().getFullYear()}-0001`
  }
}
const generateFilename = (customerName, date) => {
  const cleanName = (customerName || 'Customer')
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 30)
  const d = new Date(date)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${cleanName}_${dd}${mm}${yyyy}.pdf`
}
const fmtINR = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const DEFAULT_TERMS = ''

const UNIT_OPTIONS = ['Nos', 'Days', 'Hours', 'Kg', 'Ltrs', 'Set', 'Sqft', 'Rmt', 'Month']
const GST_OPTIONS = [0, 5, 12, 18, 28]
const STATUS_META = {
  Draft:    { color: '#64748B', bg: '#F1F5F9', label: 'Draft' },
  Sent:     { color: '#2563EB', bg: '#EFF6FF', label: 'Sent' },
  Approved: { color: '#16A34A', bg: '#F0FDF4', label: 'Approved' },
  Rejected: { color: '#DC2626', bg: '#FEF2F2', label: 'Rejected' },
}

const emptyItem = () => ({ id: Date.now() + Math.random(), description: '', quantity: 1, unit: 'Nos', rate: '' })

/* ─── PDF Generator ─────────────────────────────────────────────────────────── */
const generatePDF = (formData) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  let y = 20

  // Header bg
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, pageWidth, 38, 'F')

  // Company name
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.companyName || 'Company Name', margin, 14)

  // Company details
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 210, 220)
  const addrLines = doc.splitTextToSize(formData.companyAddress || '', pageWidth / 2 - margin)
  doc.text(addrLines[0] || '', margin, 21)
  doc.text(`Ph: ${formData.companyPhone || ''}  |  GSTIN: ${formData.gstin || ''}`, margin, 27)
  const bankLine = formData.bankName
    ? `Bank: ${formData.bankName}  |  A/C: ${formData.accountNumber || ''}  |  IFSC: ${formData.ifsc || ''}`
    : (formData.bankDetails ? formData.bankDetails.split('\n')[0] : '')
  if (bankLine) {
    doc.text(bankLine.substring(0, 70), margin, 33)
  }

  // Quotation label
  doc.setTextColor(96, 165, 250)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('QUOTATION', pageWidth - margin, 14, { align: 'right' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 210, 220)
  doc.text(`Ref: ${formData.quotationNumber}`, pageWidth - margin, 22, { align: 'right' })

  y = 48

  // Bill-to box
  const boxH = formData.customerPhone ? 30 : 26
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 3, 3, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 3, 3, 'S')

  doc.setTextColor(100, 116, 139)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('BILL TO', margin + 5, y + 7)

  doc.setTextColor(15, 23, 42)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.customerName || 'Customer Name', margin + 5, y + 14)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  const custAddrLines = doc.splitTextToSize(formData.customerAddress || '', pageWidth - margin * 2 - 10)
  doc.text(custAddrLines[0] || '', margin + 5, y + 20)
  if (formData.customerPhone) {
    doc.text(`Ph: ${formData.customerPhone}`, margin + 5, y + 26)
  }

  y += boxH + 6

  // Table header
  doc.setFillColor(15, 23, 42)
  doc.rect(margin, y, pageWidth - margin * 2, 8, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')

  const cols = {
    no:   margin + 2,
    desc: margin + 10,
    qty:  margin + 95,
    unit: margin + 110,
    rate: margin + 130,
    amt:  margin + 155,
  }

  doc.text('#',           cols.no,   y + 5.5)
  doc.text('Description', cols.desc, y + 5.5)
  doc.text('Qty',         cols.qty,  y + 5.5)
  doc.text('Unit',        cols.unit, y + 5.5)
  doc.text('Rate',        cols.rate, y + 5.5)
  doc.text('Amount',      cols.amt,  y + 5.5)
  y += 8

  // Check if we need page break logic (simple single page for now)
  const validItems = formData.items.filter(i => i.description)
  validItems.forEach((item, index) => {
    const amount = Number(item.quantity || 0) * Number(item.rate || 0)
    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252)
      doc.rect(margin, y, pageWidth - margin * 2, 8, 'F')
    }
    doc.setDrawColor(226, 232, 240)
    doc.rect(margin, y, pageWidth - margin * 2, 8, 'S')

    doc.setTextColor(15, 23, 42)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(String(index + 1), cols.no, y + 5.5)
    doc.text(String(item.description || '').substring(0, 48), cols.desc, y + 5.5)
    doc.text(String(item.quantity || ''), cols.qty, y + 5.5)
    doc.text(String(item.unit || ''), cols.unit, y + 5.5)
    doc.text(fmtINR(item.rate).split('.')[0], cols.rate, y + 5.5)
    doc.text(fmtINR(amount).split('.')[0], cols.amt, y + 5.5)
    y += 8
  })

  y += 5

  // Totals box
  const subtotal = validItems.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.rate || 0), 0)
  const gstAmount = subtotal * (formData.gstPercent || 0) / 100
  const discount = Number(formData.discount || 0)
  const grandTotal = subtotal + gstAmount - discount

  const totalsX = pageWidth - margin - 72
  const totalsWidth = 72

  doc.setFillColor(248, 250, 252)
  doc.roundedRect(totalsX, y, totalsWidth, discount > 0 ? 42 : 35, 2, 2, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(totalsX, y, totalsWidth, discount > 0 ? 42 : 35, 2, 2, 'S')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)

  const totalsRows = [
    ['Subtotal', subtotal],
    [`GST @ ${formData.gstPercent || 0}%`, gstAmount],
    ...(discount > 0 ? [['Discount', -discount]] : []),
  ]

  totalsRows.forEach((row, i) => {
    const ty = y + 7 + i * 8
    doc.text(String(row[0]), totalsX + 4, ty)
    doc.text(`Rs. ${fmtINR(Math.abs(Number(row[1]))).split('.')[0]}`, totalsX + totalsWidth - 4, ty, { align: 'right' })
  })

  const gtY = y + (discount > 0 ? 34 : 27)
  doc.setFillColor(15, 23, 42)
  doc.roundedRect(totalsX, gtY, totalsWidth, 9, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('TOTAL', totalsX + 4, gtY + 6)
  doc.text(`Rs. ${fmtINR(grandTotal).split('.')[0]}`, totalsX + totalsWidth - 4, gtY + 6, { align: 'right' })

  y += (discount > 0 ? 42 : 35) + 10

  // Terms
  if (formData.terms) {
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Terms & Conditions', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    const termLines = doc.splitTextToSize(formData.terms, pageWidth - margin * 2)
    doc.text(termLines, margin, y)
    y += termLines.length * 4 + 6
  }

  // Notes
  if (formData.notes) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text('Notes', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    const noteLines = doc.splitTextToSize(formData.notes, pageWidth - margin * 2)
    doc.text(noteLines, margin, y)
  }

  // Footer
  doc.setFillColor(15, 23, 42)
  doc.rect(0, pageHeight - 12, pageWidth, 12, 'F')
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `${formData.companyName || ''}  |  ${formData.quotationNumber}  |  Generated by OpsAgent`,
    pageWidth / 2, pageHeight - 4, { align: 'center' }
  )

  doc.save(generateFilename(formData.customerName, formData.date))
}

/* ─── Section Heading ───────────────────────────────────────────────────────── */
const SectionHead = ({ icon: Icon, title, color = '#2563EB' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #E2E8F0' }}>
    <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={14} color={color} />
    </div>
    <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{title}</span>
  </div>
)

/* ─── Input helpers ─────────────────────────────────────────────────────────── */
const Label = ({ children }) => (
  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>
    {children}
  </label>
)

const inp = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1px solid #E2E8F0', fontSize: '13px', color: '#0F172A',
  outline: 'none', background: 'white', fontFamily: "'Inter', sans-serif",
  boxSizing: 'border-box',
}

/* ─── Live Preview Modal ────────────────────────────────────────────────────── */
function PreviewModal({ formData, onClose }) {
  const subtotal = formData.items.filter(i => i.description).reduce((s, i) => s + Number(i.quantity || 0) * Number(i.rate || 0), 0)
  const gstAmount = subtotal * (formData.gstPercent || 0) / 100
  const discount = Number(formData.discount || 0)
  const grandTotal = subtotal + gstAmount - discount

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '24px 16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '700px', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', position: 'relative' }}>
        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <X size={16} color="white" />
        </button>

        {/* Header */}
        <div style={{ background: '#0F172A', padding: '24px 28px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>{formData.companyName || 'Company Name'}</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', lineHeight: 1.6 }}>{formData.companyAddress}</div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>Ph: {formData.companyPhone} &nbsp;|&nbsp; GSTIN: {formData.gstin}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#60A5FA', letterSpacing: '2px' }}>QUOTATION</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '6px' }}>Ref: {formData.quotationNumber}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Bill To */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px 18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>Bill To</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{formData.customerName || '—'}</div>
            <div style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>{formData.customerAddress}</div>
            {formData.customerPhone && <div style={{ fontSize: '13px', color: '#64748B' }}>Ph: {formData.customerPhone}</div>}
          </div>

          {/* Items */}
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#0F172A' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: 'white', borderRadius: '6px 0 0 0', width: '24px' }}>#</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: 'white' }}>Description</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: 'white', width: '50px' }}>Qty</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: 'white', width: '50px' }}>Unit</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: 'white', width: '70px' }}>Rate</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: 'white', borderRadius: '0 6px 0 0', width: '80px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {formData.items.filter(i => i.description).map((item, idx) => {
                  const amt = Number(item.quantity || 0) * Number(item.rate || 0)
                  return (
                    <tr key={item.id} style={{ background: idx % 2 === 0 ? '#F8FAFC' : 'white', borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '9px 10px', color: '#64748B' }}>{idx + 1}</td>
                      <td style={{ padding: '9px 10px', color: '#0F172A', fontWeight: 500 }}>{item.description}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: '#64748B' }}>{item.quantity}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: '#64748B' }}>{item.unit}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: '#64748B' }}>₹{fmtINR(item.rate)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(amt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '260px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
              {[['Subtotal', subtotal], [`GST @ ${formData.gstPercent || 0}%`, gstAmount], ...(discount > 0 ? [['Discount', -discount]] : [])].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #E2E8F0', fontSize: '13px', color: '#64748B' }}>
                  <span>{k}</span><span>₹{fmtINR(Math.abs(Number(v)))}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#0F172A', fontSize: '14px', fontWeight: 700, color: 'white' }}>
                <span>GRAND TOTAL</span><span>₹{fmtINR(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Terms */}
          {formData.terms && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FEF08A', borderRadius: '8px', padding: '14px 18px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', marginBottom: '8px' }}>Terms & Conditions</div>
              <div style={{ fontSize: '12px', color: '#78350F', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{formData.terms}</div>
            </div>
          )}

          {/* Notes */}
          {formData.notes && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '14px 18px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: '6px' }}>Notes</div>
              <div style={{ fontSize: '12px', color: '#14532D', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{formData.notes}</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: 'center', paddingTop: '8px', borderTop: '1px solid #E2E8F0', fontSize: '11px', color: '#94A3B8' }}>
            {formData.companyName} &nbsp;|&nbsp; {formData.quotationNumber} &nbsp;|&nbsp; Generated by OpsAgent
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Status Badge ──────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.Draft
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '99px', background: m.bg, color: m.color, fontSize: '11px', fontWeight: 700 }}>
      {status}
    </span>
  )
}

/* ─── Main QuotationPanel ──────────────────────────────────────────────── */
export default function QuotationPanel({ apiKey, showToast, onNavigate }) {
  const [company, setCompany] = useState({})
  const [quotations, setQuotations] = useState([])

  const [form, setForm] = useState({
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    gstin: '',
    bankDetails: '',
    customerName: '',
    customerAddress: '',
    customerPhone: '',
    quotationNumber: 'Auto-generated on save',
    date: today(),
    validUntil: plusDays(10),
    items: [emptyItem()],
    gstPercent: 18,
    discount: '',
    terms: DEFAULT_TERMS,
    notes: '',
  })

  const [showPreview, setShowPreview] = useState(false)
  const [tab, setTab] = useState('form') // 'form' | 'history'
  const [bannerDismissed, setBannerDismissed] = useState(false)

  useEffect(() => {
    backendFetch('/quotations').then(setQuotations).catch(console.error)
    backendFetch('/company').then(c => {
      setCompany(c)
      setForm(prev => ({
        ...prev,
        companyName: c.name || '',
        companyAddress: c.address || '',
        companyPhone: c.phone || '',
        gstin: c.gstin || '',
        bankDetails: c.bankDetails || '',
        bankName: c.bankName || '',
        accountNumber: c.accountNumber || '',
        ifsc: c.ifsc || ''
      }))
    }).catch(console.error)
  }, [])



  /* ── Derived totals ── */
  const validItems = form.items.filter(i => i.description)
  const subtotal = validItems.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.rate || 0), 0)
  const gstAmount = subtotal * (form.gstPercent || 0) / 100
  const discount = Number(form.discount || 0)
  const grandTotal = subtotal + gstAmount - discount

  /* ── Form helpers ── */
  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const setItem = (id, key, val) => setForm(prev => ({
    ...prev,
    items: prev.items.map(it => it.id === id ? { ...it, [key]: val } : it)
  }))

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, emptyItem()] }))

  const removeItem = (id) => {
    if (form.items.length === 1) return
    setForm(prev => ({ ...prev, items: prev.items.filter(it => it.id !== id) }))
  }

  const resetForm = () => {
    const c = company
    setForm({
      companyName: c.name || '',
      companyAddress: c.address || '',
      companyPhone: c.phone || '',
      gstin: c.gstin || '',
      bankDetails: c.bankDetails || '',
      customerName: '',
      customerAddress: '',
      customerPhone: '',
      quotationNumber: generateQuotationNumber(),
      date: today(),
      validUntil: plusDays(10),
      items: [emptyItem()],
      gstPercent: 18,
      discount: '',
      terms: DEFAULT_TERMS,
      notes: '',
    })
  }

  /* ── Download PDF ── */
  const handleDownload = async () => {
    if (!form.customerName.trim()) {
      showToast?.('Please enter customer name before downloading', 'warning', 'Missing Info')
      return
    }

    try {
      const savedQuotation = await backendFetch('/quotations', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          subtotal,
          discount,
          grandTotal
        })
      })
      setQuotations(prev => [savedQuotation, ...prev])
      generatePDF({ ...form, quotationNumber: savedQuotation.quotationNumber })
      showToast?.(`Downloaded ${generateFilename(form.customerName, form.date)}`, 'success', 'PDF Generated')
    } catch(err) {
      showToast?.(err.message, 'error')
    }
  }

  /* ── Status change in history ── */
  const changeStatus = async (id, status) => {
    setQuotations(prev => prev.map(q => q.id === id ? { ...q, status } : q))
    try {
      await backendFetch(`/quotations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
    } catch(err) { console.error(err) }
  }

  const deleteQuotation = async (id) => {
    if (!window.confirm('Delete this quotation from history?')) return
    setQuotations(prev => prev.filter(q => q.id !== id))
    showToast?.('Quotation deleted', 'info', 'Deleted')
    try {
      await backendFetch(`/quotations/${id}`, { method: 'DELETE' })
    } catch(err) { console.error(err) }
  }

  const redownload = (q) => {
    generatePDF({ ...q, ...company, companyName: company.name, companyAddress: company.address, companyPhone: company.phone })
    showToast?.(`Re-downloaded ${generateFilename(q.customerName, q.date)}`, 'success', 'PDF Downloaded')
  }

  const loadFromHistory = (q) => {
    setForm(prev => ({ ...prev, ...q, quotationNumber: q.quotationNumber }))
    setTab('form')
    showToast?.('Quotation loaded into form', 'info', 'Loaded')
  }

  /* ──────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', paddingBottom: '60px' }}>
      {/* Company profile not set banner */}
      {!company.name && !bannerDismissed && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400E' }}>Company profile not set up yet.</div>
              <div style={{ fontSize: '12px', color: '#78350F', marginTop: '2px' }}>Add your company details in Settings so they auto-fill in every quotation.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={() => { if (typeof onNavigate === 'function') onNavigate('settings') }}
              style={{ height: '32px', padding: '0 14px', borderRadius: '7px', background: '#D97706', color: 'white', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
            >
              Go to Settings →
            </button>
            <button onClick={() => setBannerDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400E', padding: '4px', fontSize: '16px', lineHeight: 1 }}>✕</button>
          </div>
        </div>
      )}

      {/* Header */}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: 0, fontFamily: "'Inter', sans-serif" }}>
            Quotation Generator
          </h2>
          <p style={{ fontSize: '14px', color: '#64748B', marginTop: '4px' }}>
            Create professional quotations and export as PDF
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setTab(tab === 'form' ? 'history' : 'form')}
            className="btn-press"
            style={{ height: '38px', padding: '0 16px', borderRadius: '8px', background: tab === 'history' ? '#0F172A' : 'white', color: tab === 'history' ? 'white' : '#0F172A', border: '1px solid #E2E8F0', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <List size={15} />{tab === 'history' ? 'Back to Form' : `History (${quotations.length})`}
          </button>
          <button
            onClick={resetForm}
            className="btn-press"
            style={{ height: '38px', padding: '0 16px', borderRadius: '8px', background: 'white', color: '#64748B', border: '1px solid #E2E8F0', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RotateCcw size={14} />New
          </button>
        </div>
      </div>

      {tab === 'history' ? (
        /* ────── HISTORY TAB ────── */
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={18} color="#2563EB" />
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Quotation History</span>
          </div>
          {quotations.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <FileText size={40} color="#CBD5E1" style={{ marginBottom: '12px' }} />
              <p style={{ color: '#94A3B8', fontSize: '14px' }}>No quotations yet. Generate your first one!</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {['QT Number', 'Customer', 'Date', 'Amount', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#64748B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((q, i) => (
                    <tr key={q.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2563EB' }}>{q.quotationNumber}</td>
                      <td style={{ padding: '12px 16px', color: '#0F172A', fontWeight: 600 }}>{q.customerName}</td>
                      <td style={{ padding: '12px 16px', color: '#64748B' }}>{fmtDate(q.date)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0F172A' }}>₹{fmtINR(q.grandTotal)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <select
                          value={q.status}
                          onChange={e => changeStatus(q.id, e.target.value)}
                          style={{ ...inp, width: 'auto', padding: '4px 8px', fontSize: '11px', fontWeight: 700, background: STATUS_META[q.status]?.bg, color: STATUS_META[q.status]?.color, border: 'none', borderRadius: '99px', cursor: 'pointer' }}
                        >
                          {Object.keys(STATUS_META).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => redownload(q)} title="Download PDF" className="btn-press" style={{ width: '30px', height: '30px', borderRadius: '7px', background: '#F0FDF4', border: '1px solid #BBF7D0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Download size={14} color="#16A34A" />
                          </button>
                          <button onClick={() => loadFromHistory(q)} title="Load into form" className="btn-press" style={{ width: '30px', height: '30px', borderRadius: '7px', background: '#EFF6FF', border: '1px solid #BFDBFE', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={14} color="#2563EB" />
                          </button>
                          <button onClick={() => deleteQuotation(q.id)} title="Delete" className="btn-press" style={{ width: '30px', height: '30px', borderRadius: '7px', background: '#FEF2F2', border: '1px solid #FECACA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trash2 size={14} color="#DC2626" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ────── FORM + PREVIEW ────── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }} className="quotation-grid">
          {/* ── LEFT: FORM ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Company Details */}
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <SectionHead icon={Building2} title="Company Details" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Label>Company Name</Label>
                  <input style={inp} value={form.companyName} onChange={e => setField('companyName', e.target.value)} placeholder="Your Company Name" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Label>Address</Label>
                  <textarea style={{ ...inp, resize: 'vertical', minHeight: '56px' }} value={form.companyAddress} onChange={e => setField('companyAddress', e.target.value)} placeholder="123 Main St, City" rows={2} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <input style={inp} value={form.companyPhone} onChange={e => setField('companyPhone', e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <Label>GSTIN</Label>
                  <input style={inp} value={form.gstin} onChange={e => setField('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Label>Bank Details (optional)</Label>
                  <textarea style={{ ...inp, resize: 'vertical', minHeight: '48px' }} value={form.bankDetails} onChange={e => setField('bankDetails', e.target.value)} placeholder="Bank: HDFC | A/C: 1234567890 | IFSC: HDFC0001234" rows={2} />
                </div>
              </div>
            </div>

            {/* Customer Details */}
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <SectionHead icon={User} title="Customer Details" color="#7C3AED" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <Label>Customer Name *</Label>
                  <input style={{ ...inp, borderColor: !form.customerName ? '#FECACA' : '#E2E8F0' }} value={form.customerName} onChange={e => setField('customerName', e.target.value)} placeholder="Rajan Builders" />
                </div>
                <div>
                  <Label>Customer Phone</Label>
                  <input style={inp} value={form.customerPhone} onChange={e => setField('customerPhone', e.target.value)} placeholder="+91 99887 76655" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Label>Customer Address</Label>
                  <textarea style={{ ...inp, resize: 'vertical', minHeight: '56px' }} value={form.customerAddress} onChange={e => setField('customerAddress', e.target.value)} placeholder="456 Avenue, City" rows={2} />
                </div>
              </div>
            </div>

            {/* Quotation Details */}
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <SectionHead icon={Hash} title="Quotation Details" color="#D97706" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
                <div>
                  <Label>Quotation #</Label>
                  <input style={inp} value={form.quotationNumber} onChange={e => setField('quotationNumber', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <SectionHead icon={List} title="Line Items" color="#16A34A" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 90px 90px 36px', gap: '6px', padding: '0 2px' }}>
                  {['Description', 'Qty', 'Unit', 'Rate (₹)', 'Amount', ''].map(h => (
                    <div key={h} style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{h}</div>
                  ))}
                </div>

                {form.items.map((item) => {
                  const amount = Number(item.quantity || 0) * Number(item.rate || 0)
                  return (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 90px 90px 36px', gap: '6px', alignItems: 'center' }}>
                      <input style={inp} value={item.description} onChange={e => setItem(item.id, 'description', e.target.value)} placeholder="Service/Item description" />
                      <input type="number" style={{ ...inp, textAlign: 'center' }} value={item.quantity} min="0" onChange={e => setItem(item.id, 'quantity', e.target.value)} />
                      <select style={inp} value={item.unit} onChange={e => setItem(item.id, 'unit', e.target.value)}>
                        {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input type="number" style={{ ...inp, textAlign: 'right' }} value={item.rate} min="0" onChange={e => setItem(item.id, 'rate', e.target.value)} placeholder="0" />
                      <div style={{ ...inp, background: '#F8FAFC', color: '#16A34A', fontWeight: 700, textAlign: 'right', cursor: 'default' }}>
                        {amount > 0 ? fmtINR(amount) : '—'}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={form.items.length === 1}
                        className="btn-press"
                        style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: form.items.length === 1 ? '#F8FAFC' : '#FEF2F2', border: `1px solid ${form.items.length === 1 ? '#E2E8F0' : '#FECACA'}`, cursor: form.items.length === 1 ? 'not-allowed' : 'pointer' }}
                      >
                        <Trash2 size={14} color={form.items.length === 1 ? '#CBD5E1' : '#DC2626'} />
                      </button>
                    </div>
                  )
                })}

                <button
                  onClick={addItem}
                  className="btn-press"
                  style={{ marginTop: '6px', height: '38px', padding: '0 16px', borderRadius: '8px', background: 'white', color: '#2563EB', border: '1px dashed #93C5FD', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}
                >
                  <Plus size={15} /> Add Item
                </button>
              </div>
            </div>

            {/* Totals */}
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <SectionHead icon={DollarSign} title="Totals" color="#2563EB" />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>Subtotal</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(subtotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: '#64748B', flexShrink: 0 }}>GST %</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <select style={{ ...inp, width: 'auto', padding: '6px 10px', fontSize: '13px' }} value={form.gstPercent} onChange={e => setField('gstPercent', Number(e.target.value))}>
                        {GST_OPTIONS.map(g => <option key={g} value={g}>{g}%</option>)}
                      </select>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748B', minWidth: '90px', textAlign: 'right' }}>₹{fmtINR(gstAmount)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: '#64748B', flexShrink: 0 }}>Discount</span>
                    <input type="number" style={{ ...inp, width: '120px', textAlign: 'right' }} value={form.discount} min="0" onChange={e => setField('discount', e.target.value)} placeholder="0" />
                  </div>
                  <div style={{ borderTop: '2px solid #0F172A', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>Grand Total</span>
                    <span style={{ fontSize: '22px', fontWeight: 800, color: '#2563EB' }}>₹{fmtINR(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <SectionHead icon={FileCheck} title="Terms & Conditions (optional)" color="#7C3AED" />
              <textarea
                style={{ ...inp, resize: 'vertical', minHeight: '120px', lineHeight: 1.7 }}
                value={form.terms}
                onChange={e => setField('terms', e.target.value)}
                placeholder="Enter any terms and conditions here..."
                rows={6}
              />
            </div>

            {/* Notes */}
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <SectionHead icon={FileText} title="Additional Notes (optional)" color="#64748B" />
              <textarea
                style={{ ...inp, resize: 'vertical', minHeight: '72px' }}
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                placeholder="Any additional information for the customer..."
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end', paddingBottom: '16px' }}>
              <button
                onClick={() => setShowPreview(true)}
                className="btn-press"
                style={{ height: '44px', padding: '0 22px', borderRadius: '10px', background: 'white', color: '#2563EB', border: '2px solid #2563EB', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Eye size={16} /> Preview
              </button>
              <button
                onClick={handleDownload}
                className="btn-press"
                style={{ height: '44px', padding: '0 22px', borderRadius: '10px', background: 'linear-gradient(135deg,#16A34A,#15803D)', color: 'white', border: 'none', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}
              >
                <Download size={16} /> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && <PreviewModal formData={form} onClose={() => setShowPreview(false)} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 1024px) {
          .quotation-grid { grid-template-columns: 1fr !important; }
        }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        select option { background: white; color: #0F172A; }
      `}</style>
    </div>
  )
}

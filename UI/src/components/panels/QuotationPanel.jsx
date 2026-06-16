import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Edit2, Download, Search, Plus, X, FileText, CheckCircle } from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import AutocompleteInput from '../AutocompleteInput'
import { useAppStore } from '../../store/appStore'

// ─── UTILS ─────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0]
const fmtINR = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (iso) => {
  if (!iso) return ''
  const dateStr = iso.includes('T') ? iso.split('T')[0] : iso;
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

let UNIT_OPTIONS = ['Nos', 'Kg', 'Sqft', 'Metre', 'Litre', 'Set']

const generateFilename = (prefix, customerName, date) => {
  const cleanName = (customerName || 'Customer').trim().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
  const d = new Date(date || new Date())
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${cleanName}_${prefix}_${dd}${mm}${yyyy}.pdf`
}

const emptyItem = () => ({
  id: Date.now() + Math.random(),
  description: '',
  hsn: '',
  qty: 1,
  unit: 'Nos',
  rate: 0
})

const DEFAULT_TERMS = `1. This quotation is valid for the specified period only.
2. Prices are subject to change after the validity date.
3. 50% advance payment required to confirm the order.
4. Balance payment before delivery.
5. GST extra as applicable.`

// ─── HELPERS ────────────────────────────────────────────────────────────────

const numToWords = (num) => {
  const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  const inWords = (n) => {
    if (n === 0) return ''
    if (n < 20) return a[n] + ' '
    if (n < 100) return b[Math.floor(n/10)] + (n%10 ? ' ' + a[n%10] : '') + ' '
    if (n < 1000) return a[Math.floor(n/100)] + ' Hundred ' + inWords(n%100)
    if (n < 100000) return inWords(Math.floor(n/1000)) + 'Thousand ' + inWords(n%1000)
    if (n < 10000000) return inWords(Math.floor(n/100000)) + 'Lakh ' + inWords(n%100000)
    return inWords(Math.floor(n/10000000)) + 'Crore ' + inWords(n%10000000)
  }
  const intPart = Math.floor(Math.abs(num))
  const decPart = Math.round((Math.abs(num) - intPart) * 100)
  let words = inWords(intPart).trim()
  if (decPart > 0) words += ' and ' + inWords(decPart).trim() + ' Paise'
  return 'Rupees ' + words + ' Only'
}

// ─── PDF GENERATION ────────────────────────────────────────────────────────

const generatePDF = async (qt, company, isFinalized = false, copyType = 'original') => {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  let y = 20

  // Watermark for draft
  if (!isFinalized && qt.status === 'Draft') {
    doc.setTextColor(241, 245, 249)
    doc.setFontSize(100)
    doc.setFont('helvetica', 'bold')
    doc.text('DRAFT', pageWidth/2, pageHeight/2 + 20, { align: 'center', angle: 45 })
  }

  // Header bg
  doc.setFillColor(isFinalized ? 15 : 30, isFinalized ? 23 : 58, isFinalized ? 42 : 138)
  doc.rect(0, 0, pageWidth, 40, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(company?.companyName || 'Company Name', margin, 15)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(226, 232, 240)
  doc.text((company?.companyAddress || '').split('\n')[0] || '', margin, 22)
  doc.text(`Ph: ${company?.companyPhone || ''}  |  GSTIN: ${company?.gstin || ''}`, margin, 28)

  if (isFinalized) {
    doc.setFillColor(220, 38, 38)
    doc.roundedRect(pageWidth - margin - 35, 8, 35, 7, 1.5, 1.5, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('🔒 PRICE LOCKED', pageWidth - margin - 17.5, 12.5, { align: 'center' })
  }

  doc.setTextColor(186, 230, 253)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(isFinalized ? 'FINALIZED QUOTATION' : 'BREAKDOWN QUOTATION', pageWidth - margin, 22, { align: 'right' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(241, 245, 249)
  doc.text(`Ref: ${isFinalized ? qt.fq_number : qt.qt_number}`, pageWidth - margin, 29, { align: 'right' })
  doc.text(`Date: ${fmtDate(isFinalized ? qt.finalized_at : qt.created_at)}`, pageWidth - margin, 35, { align: 'right' })

  y = 50

  // Customer & Details Row
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, y, pageWidth - margin*2, 35, 2, 2, 'FD')

  doc.setTextColor(100, 116, 139)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('CUSTOMER', margin + 5, y + 7)
  
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(11)
  doc.text(qt.customer_name || 'N/A', margin + 5, y + 14)
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  if(qt.customer_phone) doc.text(`Ph: ${qt.customer_phone}`, margin + 5, y + 21)
  if(qt.customer_email) doc.text(`Email: ${qt.customer_email}`, margin + 5, y + 27)

  // Details col
  const detailsX = pageWidth/2 + 10
  if (!isFinalized && qt.validity_date) {
    const isExp = new Date(qt.validity_date) < new Date()
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('VALIDITY', detailsX, y + 7)
    doc.setTextColor(isExp ? 220 : 15, isExp ? 38 : 23, isExp ? 38 : 42)
    doc.setFontSize(10)
    doc.text(isExp ? `Expired on ${fmtDate(qt.validity_date)}` : `Valid Until: ${fmtDate(qt.validity_date)}`, detailsX, y + 14)
  } else if (!isFinalized) {
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('VALIDITY', detailsX, y + 7)
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(10)
    doc.text('Open', detailsX, y + 14)
  }

  if (isFinalized) {
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('ORIGINAL REFERENCE', detailsX, y + 7)
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(10)
    doc.text(qt.original_qt_number || 'N/A', detailsX, y + 14)
  }

  if (qt.project_name) {
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('PROJECT / REFERENCE', detailsX, y + 22)
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(10)
    doc.text(qt.project_name, detailsX, y + 29)
  }

  y += 45

  // Table
  const cols = { no: margin + 3, desc: margin + 12, qty: margin + 95, unit: margin + 115, rate: margin + 135, amt: margin + 160 }
  
  doc.setFillColor(isFinalized ? 15 : 30, isFinalized ? 23 : 58, isFinalized ? 42 : 138)
  doc.rect(margin, y, pageWidth - margin*2, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('#', cols.no, y + 5.5)
  doc.text('Description', cols.desc, y + 5.5)
  doc.text('Qty', cols.qty, y + 5.5)
  doc.text('Unit', cols.unit, y + 5.5)
  doc.text('Rate', cols.rate, y + 5.5)
  doc.text('Amount', cols.amt, y + 5.5)
  y += 8

  doc.setFont('helvetica', 'normal')
  qt.items.forEach((item, idx) => {
    if(idx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(margin, y, pageWidth - margin*2, 8, 'F') }
    doc.setDrawColor(226, 232, 240)
    doc.rect(margin, y, pageWidth - margin*2, 8, 'S')
    doc.setTextColor(15, 23, 42)
    doc.text(String(idx + 1), cols.no, y + 5.5)
    doc.text(String(item.description).substring(0, 50), cols.desc, y + 5.5)
    doc.text(String(item.qty), cols.qty, y + 5.5)
    doc.text(String(item.unit), cols.unit, y + 5.5)
    doc.text(fmtINR(item.rate), cols.rate, y + 5.5)
    doc.text(fmtINR(item.qty * item.rate), cols.amt, y + 5.5)
    y += 8
  })

  y += 6

  // Totals
  const totalsW = 70
  const totalsX = pageWidth - margin - totalsW
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(totalsX, y, totalsW, 30, 2, 2, 'FD')
  
  let ty = y + 8
  doc.setTextColor(100, 116, 139)
  doc.text('Subtotal:', totalsX + 5, ty)
  doc.setTextColor(15, 23, 42)
  doc.text(`Rs. ${fmtINR(qt.subtotal)}`, totalsX + totalsW - 5, ty, { align: 'right' })
  
  ty += 7
  doc.setTextColor(100, 116, 139)
  doc.text('Discount:', totalsX + 5, ty)
  doc.setTextColor(15, 23, 42)
  doc.text(`-Rs. ${fmtINR(qt.discount)}`, totalsX + totalsW - 5, ty, { align: 'right' })

  ty += 9
  doc.setFillColor(isFinalized ? 15 : 30, isFinalized ? 23 : 58, isFinalized ? 42 : 138)
  doc.roundedRect(totalsX, ty - 6, totalsW, 9, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('GRAND TOTAL', totalsX + 5, ty)
  doc.text(`Rs. ${fmtINR(qt.grand_total)}`, totalsX + totalsW - 5, ty, { align: 'right' })

  y += 35

  // Terms & Notes
  if (qt.notes) {
    doc.setTextColor(71, 85, 105)
    doc.setFont('helvetica', 'italic')
    doc.text(`Note: ${qt.notes}`, margin, y)
    y += 8
  }

  if (qt.include_terms && qt.terms) {
    y += 4
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.text('Terms & Conditions:', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    const splitTerms = doc.splitTextToSize(qt.terms, pageWidth - margin*2)
    doc.text(splitTerms, margin, y)
  }

  // Footer
  doc.setFillColor(241, 245, 249)
  doc.rect(0, pageHeight - 12, pageWidth, 12, 'F')
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  const footerText = isFinalized 
    ? "This is a finalized quotation. Price is confirmed and locked."
    : "This is a breakdown quotation subject to customer approval."
  doc.text(`${company?.companyName || ''} | ${isFinalized ? qt.fq_number : qt.qt_number} | ${footerText}`, pageWidth/2, pageHeight - 4, { align: 'center' })

  doc.save(generateFilename(isFinalized ? 'FQ' : 'QT', qt.customer_name, isFinalized ? qt.finalized_at : qt.created_at))
}



// ─── COPY SELECTOR MODAL ──────────────────────────────────────────────────

const CopySelectorModal = ({ qt, company, isFinalized, onClose }) => {
  const [copy, setCopy] = React.useState('original')

  const handleDownload = () => {
    if (copy === 'original')   generatePDF(qt, company, isFinalized, 'original')
    if (copy === 'triplicate') generatePDF(qt, company, isFinalized, 'triplicate')
    onClose()
  }

  const opts = [
    { id: 'original',   icon: '📄', label: 'Original',   sub: 'For Customer / Recipient',          color: '#16A34A' },
    { id: 'triplicate', icon: '📁', label: 'Triplicate', sub: 'For Owner / Supplier (your records)', color: '#7C3AED' },
  ]

  const inp = { width: '100%', padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 12.5, outline: 'none', boxSizing: 'border-box', background: 'white' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 18, width: 500, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 28px 56px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>🖨️ Select Print Copy</div>
            <div style={{ fontSize: 12, color: '#1E293B', marginTop: 3 }}>Choose which copy to download</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}><X size={18} /></button>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {opts.map(opt => (
            <div key={opt.id} onClick={() => setCopy(opt.id)} style={{ border: `2px solid ${copy === opt.id ? opt.color : '#E2E8F0'}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', background: copy === opt.id ? opt.color + '0F' : 'white', transition: 'all 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 26 }}>{opt.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: '#1E293B', marginTop: 1 }}>{opt.sub}</div>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2.5px solid ${copy === opt.id ? opt.color : '#CBD5E1'}`, background: copy === opt.id ? opt.color : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {copy === opt.id && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'white' }} />}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} style={{ height: 42, padding: '0 22px', borderRadius: 9, border: '1px solid #E2E8F0', background: 'white', color: '#1E293B', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleDownload} style={{ height: 42, padding: '0 26px', borderRadius: 9, border: 'none', background: '#2563EB', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Download size={16} /> Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── COMPONENTS ────────────────────────────────────────────────────────────


const ValidityDatePicker = ({ value, onChange }) => {
  const isExpired = value && new Date(value) < new Date(new Date().toDateString())
  const daysLeft = value ? Math.ceil((new Date(value) - new Date(new Date().toDateString())) / (1000 * 60 * 60 * 24)) : null

  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
        Valid Until
        <span style={{ color: '#334155', fontWeight: 400, marginLeft: 4, fontSize: 11 }}>(Optional)</span>
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="date"
          value={value || ''}
          min={today()}
          onChange={e => onChange(e.target.value || null)}
          style={{
            height: 40, padding: '0 12px', borderRadius: 8,
            border: `1px solid ${isExpired ? '#FCA5A5' : '#E2E8F0'}`,
            fontSize: 13, color: '#0F172A', flex: 1, outline: 'none'
          }}
        />
        {value && (
          <button
            onClick={() => onChange(null)}
            style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', color: '#334155', cursor: 'pointer', fontSize: 16 }}
            title="Clear date"
          >×</button>
        )}
      </div>
      {value && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: isExpired ? '#DC2626' : daysLeft <= 3 ? '#D97706' : '#16A34A' }}>
          {isExpired ? '⚠️ This date has passed' : daysLeft === 0 ? '⚠️ Expires today' : daysLeft <= 3 ? `⏰ Expires in ${daysLeft} days` : `✓ Valid for ${daysLeft} days`}
        </p>
      )}
      {!value && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#334155' }}>Leave empty for open validity</p>}
    </div>
  )
}

const TermsToggle = ({ include, onToggle, terms, onTermsChange }) => (
  <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
    <div
      onClick={onToggle}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', background: include ? '#F0FDF4' : '#F8FAFC', transition: 'background 0.2s ease' }}
    >
      <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${include ? '#16A34A' : '#CBD5E1'}`, background: include ? '#16A34A' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s ease' }}>
        {include && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</span>}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Include Terms & Conditions</div>
        <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>{include ? 'Terms will appear in PDF' : 'Click to add terms to quotation'}</div>
      </div>
    </div>
    {include && (
      <div style={{ padding: 16 }}>
        <textarea
          value={terms}
          onChange={e => onTermsChange(e.target.value)}
          rows={5}
          style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, color: '#374151', lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#334155' }}>These terms will be printed at the bottom of your quotation PDF</p>
      </div>
    )}
  </div>
)

// ─── MAIN PANEL ────────────────────────────────────────────────────────────

export default function QuotationPanel({ onNavigate }) {
  const { inventory = [] } = useAppStore();
  const [activeTab, setActiveTab] = useState('create') // 'create', 'history', 'finalized'
  const [company, setCompany] = useState(null)
  const [bqs, setBqs] = useState([])
  const [fqs, setFqs] = useState([])
  const [searchBQ, setSearchBQ] = useState('')
  const [filterBQ, setFilterBQ] = useState('All')
  const [searchFQ, setSearchFQ] = useState('')
  const [filterFQ, setFilterFQ] = useState('All')
  
  const [showToast, setShowToast] = useState('')
  const [expandedRows, setExpandedRows] = useState({})

  // Modals
  const [reviewModal, setReviewModal] = useState(null) // holds the BQ being converted
  const [billModal, setBillModal] = useState(null)     // holds the FQ being billed
  const [copyModal, setCopyModal] = useState(null)     // { qt, isFinalized } for copy selector

  // Create Form State
  const initialForm = {
    id: null,
    customerName: '', customerPhone: '', customerEmail: '', customerAddress: '',
    projectName: '', validityDate: null,
    items: [emptyItem()], discount: 0,
    includeTerms: false, terms: DEFAULT_TERMS, notes: ''
  }
  const [form, setForm] = useState(initialForm)

  const loadData = useCallback(async () => {
    try {
      const c = await backendFetch('/company')
      if(c.success) setCompany(c.company)
      const b = await backendFetch('/quotations/breakdown')
      if(Array.isArray(b)) setBqs(b)
      const f = await backendFetch('/quotations/finalized')
      if(Array.isArray(f)) setFqs(f)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const toast = (msg) => {
    setShowToast(msg)
    setTimeout(() => setShowToast(''), 3000)
  }

  // Derived Form Totals
  const subtotal = form.items.reduce((acc, i) => acc + (Number(i.qty)||0)*(Number(i.rate)||0), 0)
  const grandTotal = subtotal - (Number(form.discount)||0)

  // ─── CREATE FLOW ───────────────────────────────────────────────────────────
  const handleSaveDraft = async () => await saveQuotation(false)
  const handleSavePDF = async () => await saveQuotation(true)

  const saveQuotation = async (downloadPdf = false) => {
    if (!form.customerName.trim()) return alert("Customer Name is required")
    
    const payload = {
      customer_name: form.customerName,
      customer_phone: form.customerPhone,
      customer_email: form.customerEmail,
      customer_address: form.customerAddress,
      project_name: form.projectName,
      validity_date: form.validityDate,
      items: form.items,
      subtotal,
      discount: Number(form.discount)||0,
      grand_total: grandTotal,
      include_terms: form.includeTerms,
      terms: form.terms,
      notes: form.notes,
      status: 'Draft'
    }

    try {
      let savedData;
      if (form.id) {
        const resData = await backendFetch(`/quotations/breakdown/${form.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        savedData = resData.data || resData
      } else {
        const resData = await backendFetch('/quotations/breakdown', { method: 'POST', body: JSON.stringify(payload) })
        savedData = resData.data || resData
      }
      toast("Quotation saved!")
      setForm(initialForm)
      await loadData()
      if (downloadPdf) setCopyModal({ qt: savedData, isFinalized: false })
      if (!form.id) setActiveTab('history')
    } catch(e) {
      alert("Error saving quotation: " + e.message)
    }
  }

  const editBQ = (bq) => {
    document.getElementById('main-scroll-area')?.scrollTo({ top: 0, behavior: 'smooth' })
    setForm({
      id: bq.id,
      customerName: bq.customer_name || '', customerPhone: bq.customer_phone || '',
      customerEmail: bq.customer_email || '', customerAddress: bq.customer_address || '',
      projectName: bq.project_name || '', validityDate: bq.validity_date,
      items: bq.items || [emptyItem()], discount: bq.discount || 0,
      includeTerms: bq.include_terms || false, terms: bq.terms || DEFAULT_TERMS, notes: bq.notes || ''
    })
    setActiveTab('create')
  }

  const updateBQStatus = async (id, status) => {
    try {
      await backendFetch(`/quotations/breakdown/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      loadData()
      toast(`Marked as ${status}`)
    } catch(e) { alert(e.message) }
  }

  const deleteBQ = async (id) => {
    if(!window.confirm("Delete this breakdown quotation?")) return
    try {
      await backendFetch(`/quotations/breakdown/${id}`, { method: 'DELETE' })
      loadData()
    } catch(e) { alert(e.message) }
  }

  // ─── CONVERT BQ -> FQ ──────────────────────────────────────────────────────
  const finalizeQuotation = async () => {
    try {
      const payload = {
        items: reviewModal.items,
        discount: Number(reviewModal.discount)||0,
        subtotal: reviewModal.items.reduce((s,i) => s + (Number(i.qty)||0)*(Number(i.rate)||0), 0),
        get grand_total() { return this.subtotal - this.discount }
      }
      const data = await backendFetch(`/quotations/breakdown/${reviewModal.id}/finalize`, {
        method: 'POST', body: JSON.stringify(payload)
      })
      toast(`Quotation finalized as ${data.fq_number} ✅`)
      setReviewModal(null)
      loadData()
      setActiveTab('finalized')
    } catch(e) { alert(e.message) }
  }

  // ─── CONVERT FQ -> BILL ────────────────────────────────────────────────────
  const convertToBill = async () => {
    try {
      const data = await backendFetch(`/quotations/finalized/${billModal.id}/bill-data`)
      const billPayload = {
        ...data,
        date: billModal.date,
        dueDate: billModal.dueDate,
        paymentTerms: billModal.paymentTerms,
        isPartial: billModal.isPartial,
        partialPercent: billModal.partialPercent
      }
      localStorage.setItem('opsagent_billing_prefill', JSON.stringify(billPayload))
      setBillModal(null)
      onNavigate('billing')
    } catch(e) { alert(e.message) }
  }

  // ─── RENDERERS ─────────────────────────────────────────────────────────────
  
  const renderCreate = () => (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 60 }}>
      {/* CUSTOMER DETAILS */}
      <div style={{ background: 'white', borderRadius: 12, padding: 24, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 16 }}>CUSTOMER DETAILS</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', display: 'block', marginBottom: 6 }}>Customer Name *</label>
            <input value={form.customerName} onChange={e=>setForm({...form, customerName:e.target.value})} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none' }} placeholder="E.g. Rajan Builders" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', display: 'block', marginBottom: 6 }}>Customer Phone</label>
            <input value={form.customerPhone} onChange={e=>setForm({...form, customerPhone:e.target.value})} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none' }} placeholder="+91..." />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', display: 'block', marginBottom: 6 }}>Customer Email</label>
            <input value={form.customerEmail} onChange={e=>setForm({...form, customerEmail:e.target.value})} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none' }} placeholder="customer@email.com" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', display: 'block', marginBottom: 6 }}>Customer Address</label>
            <input value={form.customerAddress} onChange={e=>setForm({...form, customerAddress:e.target.value})} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none' }} placeholder="Billing address" />
          </div>
        </div>
      </div>

      {/* QUOTATION DETAILS */}
      <div style={{ background: 'white', borderRadius: 12, padding: 24, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 16 }}>QUOTATION DETAILS</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', display: 'block', marginBottom: 6 }}>QT Number</label>
            <input value={form.id ? 'Will remain same' : 'Auto Generated'} disabled style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#F8FAFC', color: '#38BDF8', fontWeight: 600 }} />
          </div>
          <ValidityDatePicker value={form.validityDate} onChange={v => setForm({...form, validityDate: v})} />
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', display: 'block', marginBottom: 6 }}>Reference / Project</label>
            <input value={form.projectName} onChange={e=>setForm({...form, projectName:e.target.value})} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none' }} placeholder="Project or site name" />
          </div>
        </div>
      </div>

      {/* LINE ITEMS */}
      <div style={{ background: 'white', borderRadius: 12, padding: 24, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 16 }}>LINE ITEMS</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 80px 80px 100px 120px 120px 40px', gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #E2E8F0' }}>
          {['#', 'Description', 'HSN', 'Qty', 'Unit', 'Rate', 'Amount', ''].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#1E293B', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>

        {form.items.map((item, i) => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 80px 80px 100px 120px 120px 40px', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>{i+1}</div>
            <AutocompleteInput
              value={item.description}
              onChange={v => { const n = [...form.items]; n[i].description = v; setForm({...form, items: n}) }}
              inventory={inventory}
              placeholder="Search inventory..."
              onSelect={inv => {
                const n = [...form.items]
                n[i].description = inv.name
                n[i].hsn = inv.hsn || ''
                if(inv.unit) n[i].unit = inv.unit
                if(inv.rate) n[i].rate = inv.rate
                setForm({...form, items: n})
              }}
            />
            <input value={item.hsn} onChange={e=>{ const n=[...form.items]; n[i].hsn=e.target.value; setForm({...form,items:n}) }} style={{ width:'100%', padding:'8px 10px', border:'1px solid #E2E8F0', borderRadius:6, fontSize:13 }} placeholder="HSN" />
            <input type="number" value={item.qty} onChange={e=>{ const n=[...form.items]; n[i].qty=e.target.value; setForm({...form,items:n}) }} style={{ width:'100%', padding:'8px 10px', border:'1px solid #E2E8F0', borderRadius:6, fontSize:13 }} min="0" step="any" />
            <select value={item.unit} onChange={e=>{ const n=[...form.items]; n[i].unit=e.target.value; setForm({...form,items:n}) }} style={{ width:'100%', padding:'8px 10px', border:'1px solid #E2E8F0', borderRadius:6, fontSize:13, background:'white' }}>
              {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input type="number" value={item.rate} onChange={e=>{ const n=[...form.items]; n[i].rate=e.target.value; setForm({...form,items:n}) }} style={{ width:'100%', padding:'8px 10px', border:'1px solid #E2E8F0', borderRadius:6, fontSize:13 }} min="0" />
            <div style={{ padding:'8px 10px', border:'1px solid transparent', background:'#F8FAFC', borderRadius:6, fontSize:13, fontWeight:700, color:'#0F172A' }}>
              ₹{fmtINR((Number(item.qty)||0) * (Number(item.rate)||0))}
            </div>
            <button onClick={() => { if(form.items.length>1) { const n=form.items.filter((_,idx)=>idx!==i); setForm({...form,items:n}) } }} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: form.items.length>1?'pointer':'not-allowed', opacity: form.items.length>1?1:0.5, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <X size={16} />
            </button>
          </div>
        ))}

        <button onClick={() => setForm({...form, items: [...form.items, emptyItem()]})} style={{ marginTop: 8, height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #BFDBFE', background: 'white', color: '#2563EB', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Add Item
        </button>

        {/* TOTALS */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: '#1E293B' }}>Subtotal</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>₹{fmtINR(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 14, color: '#1E293B' }}>Discount</span>
              <input type="number" value={form.discount} onChange={e=>setForm({...form, discount: e.target.value})} style={{ width: 100, padding: '6px 10px', border: '1px solid #E2E8F0', borderRadius: 6, textAlign: 'right', fontSize: 13 }} placeholder="0" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, borderTop: '2px solid #E2E8F0' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Grand Total</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#2563EB' }}>₹{fmtINR(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TERMS & NOTES */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <TermsToggle include={form.includeTerms} onToggle={() => setForm({...form, includeTerms: !form.includeTerms})} terms={form.terms} onTermsChange={v => setForm({...form, terms: v})} />
        <div style={{ background: 'white', borderRadius: 12, padding: 24, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 12 }}>Notes</h3>
          <textarea value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} rows={5} placeholder="Additional notes for customer..." style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', resize: 'vertical', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* ACTIONS */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 16 }}>
        <button onClick={handleSaveDraft} style={{ height: 44, padding: '0 24px', borderRadius: 8, border: '1px solid #BFDBFE', background: 'white', color: '#2563EB', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Save as Draft
        </button>
        <button onClick={handleSavePDF} style={{ height: 44, padding: '0 24px', borderRadius: 8, border: 'none', background: '#2563EB', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Download size={16} /> Save & Download PDF
        </button>
      </div>
    </div>
  )

  const renderBQHistory = () => {
    let filtered = bqs
    if(searchBQ) {
      const s = searchBQ.toLowerCase()
      filtered = filtered.filter(q => q.customer_name?.toLowerCase().includes(s) || q.qt_number.toLowerCase().includes(s))
    }
    if(filterBQ !== 'All') filtered = filtered.filter(q => q.status === filterBQ)

    return (
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>Breakdown Quotations</h2>
            <div style={{ padding: '4px 10px', background: '#F1F5F9', borderRadius: 12, fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{filtered.length}</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ position: 'relative', width: 260 }}>
              <Search size={16} color="#334155" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input value={searchBQ} onChange={e=>setSearchBQ(e.target.value)} placeholder="Search customer or QT..." style={{ width: '100%', height: 40, paddingLeft: 36, paddingRight: 12, borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <select value={filterBQ} onChange={e=>setFilterBQ(e.target.value)} style={{ height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', background: 'white' }}>
              <option value="All">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Rejected</option>
              <option value="Converted">Converted</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 13, color: '#1E293B', fontWeight: 600, marginBottom: 4 }}>Total Breakdowns</div>
            <div style={{ fontSize: 24, color: '#2563EB', fontWeight: 800 }}>{bqs.length}</div>
          </div>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 13, color: '#1E293B', fontWeight: 600, marginBottom: 4 }}>Pending (Draft + Sent)</div>
            <div style={{ fontSize: 24, color: '#D97706', fontWeight: 800 }}>{bqs.filter(q => q.status==='Draft' || q.status==='Sent').length}</div>
          </div>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 13, color: '#1E293B', fontWeight: 600, marginBottom: 4 }}>Accepted</div>
            <div style={{ fontSize: 24, color: '#16A34A', fontWeight: 800 }}>{bqs.filter(q => q.status==='Accepted').length}</div>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '12px 16px', fontSize: 12, color: '#1E293B', fontWeight: 600 }}>QT No</th>
                <th style={{ padding: '12px 16px', fontSize: 12, color: '#1E293B', fontWeight: 600 }}>Customer</th>
                <th style={{ padding: '12px 16px', fontSize: 12, color: '#1E293B', fontWeight: 600 }}>Created</th>
                <th style={{ padding: '12px 16px', fontSize: 12, color: '#1E293B', fontWeight: 600 }}>Valid Until</th>
                <th style={{ padding: '12px 16px', fontSize: 12, color: '#1E293B', fontWeight: 600 }}>Amount</th>
                <th style={{ padding: '12px 16px', fontSize: 12, color: '#1E293B', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', fontSize: 12, color: '#1E293B', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => {
                const isExp = q.validity_date && new Date(q.validity_date) < new Date(new Date().toDateString())
                const days = q.validity_date ? Math.ceil((new Date(q.validity_date) - new Date(new Date().toDateString())) / 86400000) : null
                const expColor = isExp ? '#DC2626' : (days !== null && days <= 3) ? '#D97706' : '#1E293B'

                const sColors = {
                  'Draft': { bg: '#F1F5F9', color: '#1E293B' },
                  'Sent': { bg: '#DBEAFE', color: '#1D4ED8' },
                  'Accepted': { bg: '#DCFCE7', color: '#15803D' },
                  'Rejected': { bg: '#FEE2E2', color: '#B91C1C' },
                  'Converted': { bg: '#F3E8FF', color: '#7E22CE' }
                }
                const sc = sColors[q.status] || sColors['Draft']

                return (
                  <React.Fragment key={q.id}>
                    <tr onClick={() => setExpandedRows({...expandedRows, [q.id]: !expandedRows[q.id]})} style={{ borderBottom: '1px solid #E2E8F0', cursor: 'pointer', background: expandedRows[q.id] ? '#FAFBFC' : 'white' }}>
                      <td style={{ padding: '16px', fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{q.qt_number}</td>
                      <td style={{ padding: '16px', fontSize: 13, color: '#334155', fontWeight: 500 }}>{q.customer_name}</td>
                      <td style={{ padding: '16px', fontSize: 13, color: '#1E293B' }}>{fmtDate(q.created_at)}</td>
                      <td style={{ padding: '16px', fontSize: 13 }}>
                        {q.validity_date ? (
                          <div style={{ color: expColor, fontWeight: isExp ? 600 : 400 }}>
                            {fmtDate(q.validity_date)} {isExp ? '(Expired)' : days <= 3 ? '(Expiring)' : ''}
                          </div>
                        ) : (
                          <div style={{ padding: '2px 8px', background: '#F1F5F9', color: '#1E293B', borderRadius: 4, display: 'inline-block', fontSize: 11, fontWeight: 600 }}>Open</div>
                        )}
                      </td>
                      <td style={{ padding: '16px', fontSize: 13, fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(q.grand_total)}</td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ padding: '4px 10px', background: sc.bg, color: sc.color, borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                          {q.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button onClick={() => editBQ(q)} style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: '#EFF6FF', color: '#2563EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Edit"><Edit2 size={16} /></button>
                          <button onClick={() => setCopyModal({ qt: q, isFinalized: false })} style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: '#EFF6FF', color: '#2563EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Download PDF"><Download size={16} /></button>
                          
                          <select value="" onChange={e => {
                            const val = e.target.value
                            if(val === 'accept') updateBQStatus(q.id, 'Accepted')
                            if(val === 'reject') updateBQStatus(q.id, 'Rejected')
                            if(val === 'sent') updateBQStatus(q.id, 'Sent')
                            if(val === 'convert') setReviewModal(q)
                            if(val === 'delete') deleteBQ(q.id)
                          }} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', color: '#1E293B', cursor: 'pointer', outline: 'none' }}>
                            <option value="" disabled>⋮</option>
                            <option value="sent">Mark as Sent</option>
                            <option value="accept">Mark as Accepted</option>
                            <option value="reject">Mark as Rejected</option>
                            {q.status === 'Accepted' && <option value="convert">Convert to Finalized</option>}
                            <option value="delete">Delete</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                    {expandedRows[q.id] && (
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        <td colSpan={7} style={{ padding: '16px 32px' }}>
                          <div style={{ maxWidth: 600 }}>
                            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 12, textTransform: 'uppercase' }}>Line Items</h4>
                            {q.items.map((item, i) => (
                              <div key={i} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 60px 80px 100px', gap: 8, padding: '6px 0', borderBottom: '1px solid #E2E8F0', fontSize: 13, color: '#334155' }}>
                                <div>{i+1}</div>
                                <div>{item.description}</div>
                                <div>{item.qty} {item.unit}</div>
                                <div>₹{fmtINR(item.rate)}</div>
                                <div style={{ fontWeight: 600, textAlign: 'right' }}>₹{fmtINR((item.qty||0)*(item.rate||0))}</div>
                              </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, fontSize: 13 }}>
                              <div style={{ width: 240 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1E293B', marginBottom: 4 }}>
                                  <span>Subtotal</span><span>₹{fmtINR(q.subtotal)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1E293B', marginBottom: 8 }}>
                                  <span>Discount</span><span>-₹{fmtINR(q.discount)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#0F172A', borderTop: '1px solid #CBD5E1', paddingTop: 4 }}>
                                  <span>Grand Total</span><span>₹{fmtINR(q.grand_total)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#334155' }}>No breakdown quotations found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderFQList = () => {
    let filtered = fqs
    if(searchFQ) {
      const s = searchFQ.toLowerCase()
      filtered = filtered.filter(q => q.customer_name?.toLowerCase().includes(s) || q.fq_number.toLowerCase().includes(s))
    }
    if(filterFQ !== 'All') filtered = filtered.filter(q => q.status === filterFQ)

    return (
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>Finalized Quotations</h2>
            <div style={{ padding: '4px 10px', background: '#F1F5F9', borderRadius: 12, fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{filtered.length}</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ position: 'relative', width: 260 }}>
              <Search size={16} color="#334155" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input value={searchFQ} onChange={e=>setSearchFQ(e.target.value)} placeholder="Search customer or FQ..." style={{ width: '100%', height: 40, paddingLeft: 36, paddingRight: 12, borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <select value={filterFQ} onChange={e=>setFilterFQ(e.target.value)} style={{ height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', background: 'white' }}>
              <option value="All">All Status</option>
              <option value="Active">Active (Pending Bill)</option>
              <option value="Converted to Bill">Converted to Bill</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 13, color: '#1E293B', fontWeight: 600, marginBottom: 4 }}>Total Finalized</div>
            <div style={{ fontSize: 24, color: '#2563EB', fontWeight: 800 }}>{fqs.length}</div>
          </div>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 13, color: '#1E293B', fontWeight: 600, marginBottom: 4 }}>Pending Bill</div>
            <div style={{ fontSize: 24, color: '#D97706', fontWeight: 800 }}>{fqs.filter(q => q.status==='Active').length}</div>
          </div>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 13, color: '#1E293B', fontWeight: 600, marginBottom: 4 }}>Converted to Bill</div>
            <div style={{ fontSize: 24, color: '#16A34A', fontWeight: 800 }}>{fqs.filter(q => q.status==='Converted to Bill').length}</div>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '12px 16px', fontSize: 12, color: '#1E293B', fontWeight: 600 }}>FQ No</th>
                <th style={{ padding: '12px 16px', fontSize: 12, color: '#1E293B', fontWeight: 600 }}>Original QT</th>
                <th style={{ padding: '12px 16px', fontSize: 12, color: '#1E293B', fontWeight: 600 }}>Customer</th>
                <th style={{ padding: '12px 16px', fontSize: 12, color: '#1E293B', fontWeight: 600 }}>Finalized On</th>
                <th style={{ padding: '12px 16px', fontSize: 12, color: '#1E293B', fontWeight: 600 }}>Amount</th>
                <th style={{ padding: '12px 16px', fontSize: 12, color: '#1E293B', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', fontSize: 12, color: '#1E293B', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => {
                const sColors = {
                  'Active': { bg: '#DCFCE7', color: '#15803D' },
                  'Converted to Bill': { bg: '#DBEAFE', color: '#1D4ED8' },
                  'Cancelled': { bg: '#FEE2E2', color: '#B91C1C' }
                }
                const sc = sColors[q.status] || sColors['Active']

                return (
                  <tr key={q.id} style={{ borderBottom: '1px solid #E2E8F0', background: 'white' }}>
                    <td style={{ padding: '16px', fontSize: 13, fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Lock size={12} color="#334155" /> {q.fq_number}
                    </td>
                    <td style={{ padding: '16px', fontSize: 13, color: '#1E293B' }}>{q.original_qt_number}</td>
                    <td style={{ padding: '16px', fontSize: 13, color: '#334155', fontWeight: 500 }}>{q.customer_name}</td>
                    <td style={{ padding: '16px', fontSize: 13, color: '#1E293B' }}>{fmtDate(q.finalized_at)}</td>
                    <td style={{ padding: '16px', fontSize: 13, fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(q.grand_total)}</td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ padding: '4px 10px', background: sc.bg, color: sc.color, borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                        {q.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setCopyModal({ qt: q, isFinalized: true })} style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: '#EFF6FF', color: '#2563EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Download PDF"><Download size={16} /></button>
                        {q.status === 'Active' && (
                          <button onClick={() => setBillModal({...q, date: today(), dueDate: '', paymentTerms: 'Immediate', isPartial: false, partialPercent: ''})} style={{ height: 32, padding: '0 12px', borderRadius: 6, border: 'none', background: '#16A34A', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                            <Receipt size={14} /> Convert to Bill
                          </button>
                        )}
                        <select onChange={async (e) => {
                          const v = e.target.value; e.target.value=""
                          if(v==='cancel') {
                            await backendFetch(`/quotations/finalized/${q.id}/status`, {method:'PATCH', body:JSON.stringify({status:'Cancelled'})}); loadData()
                          }
                          if(v==='delete') {
                            if(window.confirm('Delete FQ?')) { await backendFetch(`/quotations/finalized/${q.id}`, {method:'DELETE'}); loadData() }
                          }
                        }} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', color: '#1E293B', cursor: 'pointer', outline: 'none' }}>
                          <option value="" disabled selected>⋮</option>
                          <option value="cancel">Cancel</option>
                          <option value="delete">Delete</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#334155' }}>No finalized quotations found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ─── MAIN RETURN ─────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, background: '#F8FAFC', minHeight: '100vh', fontFamily: "'Inter', sans-serif", position: 'relative' }}>
      
      {/* Toast */}
      {showToast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#2563EB', color: 'white', padding: '12px 24px', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 1000, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={20} /> {showToast}
        </div>
      )}

      {/* TABS */}
      <div style={{ maxWidth: 1100, margin: '0 auto 32px', display: 'flex', gap: 8, borderBottom: '2px solid #E2E8F0', paddingBottom: 8 }}>
        <button onClick={()=>setActiveTab('create')} style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: activeTab==='create' ? '2px solid #2563EB' : '2px solid transparent', color: activeTab==='create' ? '#2563EB' : '#1E293B', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: -10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Create Quotation
        </button>
        <button onClick={()=>setActiveTab('history')} style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: activeTab==='history' ? '2px solid #2563EB' : '2px solid transparent', color: activeTab==='history' ? '#2563EB' : '#1E293B', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: -10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={16} /> Breakdown History
        </button>
        <button onClick={()=>setActiveTab('finalized')} style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: activeTab==='finalized' ? '2px solid #2563EB' : '2px solid transparent', color: activeTab==='finalized' ? '#2563EB' : '#1E293B', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: -10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileCheck size={16} /> Finalized Quotations
        </button>
      </div>

      {activeTab === 'create' && renderCreate()}
      {activeTab === 'history' && renderBQHistory()}
      {activeTab === 'finalized' && renderFQList()}

      {/* COPY SELECTOR MODAL */}
      {copyModal && (
        <CopySelectorModal
          qt={copyModal.qt}
          company={company}
          isFinalized={copyModal.isFinalized}
          onClose={() => setCopyModal(null)}
        />
      )}

      {/* REVIEW MODAL (BQ -> FQ) */}
      {reviewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div style={{ background: 'white', width: 600, borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0F172A' }}>Convert to Finalized Quotation</h3>
              <button onClick={() => setReviewModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#1E293B" /></button>
            </div>
            <div style={{ padding: 24, maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ background: '#F8FAFC', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: '#1E293B' }}>Customer: <strong style={{ color: '#0F172A' }}>{reviewModal.customer_name}</strong></div>
                <div style={{ fontSize: 13, color: '#1E293B' }}>Original QT: <strong style={{ color: '#0F172A' }}>{reviewModal.qt_number}</strong></div>
              </div>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', marginBottom: 12 }}>Line Items (Editable)</h4>
              <div style={{ display: 'grid', gap: 8 }}>
                {reviewModal.items.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 60px 80px 90px', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: '#334155' }}>{i+1}</div>
                    <input value={item.description} onChange={e=>{ const m={...reviewModal}; m.items[i].description=e.target.value; setReviewModal(m) }} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 13 }} />
                    <input type="number" value={item.qty} onChange={e=>{ const m={...reviewModal}; m.items[i].qty=e.target.value; setReviewModal(m) }} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 13 }} />
                    <input type="number" value={item.rate} onChange={e=>{ const m={...reviewModal}; m.items[i].rate=e.target.value; setReviewModal(m) }} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 13 }} />
                    <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>₹{fmtINR((item.qty||0)*(item.rate||0))}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: 250 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: '#1E293B' }}>Discount:</span>
                    <input type="number" value={reviewModal.discount} onChange={e=>setReviewModal({...reviewModal, discount: e.target.value})} style={{ width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', textAlign: 'right' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Grand Total:</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#2563EB' }}>
                      ₹{fmtINR(reviewModal.items.reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.rate)||0), 0) - (Number(reviewModal.discount)||0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button onClick={() => setReviewModal(null)} style={{ padding: '8px 16px', borderRadius: 8, background: 'white', border: '1px solid #E2E8F0', color: '#1E293B', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={finalizeQuotation} style={{ padding: '8px 16px', borderRadius: 8, background: '#2563EB', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Confirm & Finalize →</button>
            </div>
          </div>
        </div>
      )}

      {/* BILL MODAL (FQ -> Bill) */}
      {billModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div style={{ background: 'white', width: 400, borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}><Receipt size={20} color="#16A34A" /> Create Bill</h3>
              <button onClick={() => setBillModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#1E293B" /></button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: 12, borderRadius: 8, marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: '#16A34A', fontWeight: 600 }}>Finalized QT: {billModal.fq_number}</div>
                <div style={{ fontSize: 14, color: '#15803D', fontWeight: 700 }}>{billModal.customer_name} — ₹{fmtINR(billModal.grand_total)}</div>
              </div>
              
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', display: 'block', marginBottom: 6 }}>Bill Date</label>
                  <input type="date" value={billModal.date} onChange={e=>setBillModal({...billModal, date: e.target.value})} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', display: 'block', marginBottom: 6 }}>Payment Terms</label>
                  <select value={billModal.paymentTerms} onChange={e=>setBillModal({...billModal, paymentTerms: e.target.value})} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none', background: 'white', boxSizing: 'border-box' }}>
                    <option value="Immediate">Immediate</option>
                    <option value="7 Days">7 Days</option>
                    <option value="15 Days">15 Days</option>
                    <option value="30 Days">30 Days</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', display: 'block', marginBottom: 6 }}>Payment Due Date</label>
                  <input type="date" value={billModal.dueDate} onChange={e=>setBillModal({...billModal, dueDate: e.target.value})} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button onClick={() => setBillModal(null)} style={{ padding: '8px 16px', borderRadius: 8, background: 'white', border: '1px solid #E2E8F0', color: '#1E293B', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={convertToBill} style={{ padding: '8px 16px', borderRadius: 8, background: '#16A34A', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Create Bill →</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import jsPDF from 'jspdf'
import {
  Plus, Trash2, Download, Eye, X, Receipt, Search,
  CheckCircle, AlertTriangle, ChevronDown, Building2,
  User, Hash, DollarSign, FileText, Clock, Edit2,
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'

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
  desp: '',
  hsnCode: '',
  feet: '',
  quantity: '',
  unit: 'Nos',
  rate: '',
  cgstPercent: '',
  sgstPercent: '',
  amount: 0,
  inventorySku: null,
})

const recalcSno = (items) => items.map((item, i) => ({ ...item, sno: i + 1 }))

const calcAmount = (quantity, rate, cgst, sgst) => {
  const q = parseFloat(quantity) || 0
  const r = parseFloat(rate) || 0
  const c = parseFloat(cgst) || 0
  const s = parseFloat(sgst) || 0
  const base = q * r
  return base + (base * (c + s) / 100)
}

/* ─── PDF Generator ───────────────────────────────────────── */
const generateBillPDF = (bill, company) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const mg = 10
  const pageW = W - mg * 2

  // ── Helpers ──────────────────────────────────────────────────
  const amtWords = (amt) => {
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
    const rupees = Math.floor(amt)
    const paise = Math.round((amt - rupees) * 100)
    let s = 'INR ' + (nW(rupees) || 'Zero')
    if (paise > 0) s += ' and ' + nW(paise) + ' Paise'
    return s + ' Only'
  }

  let totalPages = 1

  const drawHeader = (startY, isFirstPage) => {
    let y = startY

    if (isFirstPage) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(0, 0, 0)
      doc.text('Tax Invoice', W / 2, y + 10, { align: 'center' })
      doc.setFontSize(9)
      doc.text('e-Invoice', W - mg - 15, y + 5, { align: 'center' })

      // e-Invoice QR Placeholder
      doc.setDrawColor(0); doc.setLineWidth(0.2); doc.setLineDashPattern([1, 1], 0)
      doc.rect(W - mg - 30, y + 7, 30, 30)
      doc.setLineDashPattern([], 0)

      // IRN Details
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(0,0,0)
      doc.text('IRN', mg, y+18)
      doc.text('Ack No.', mg, y+22)
      doc.text('Ack Date', mg, y+26)
      doc.setFont('helvetica', 'normal')
      doc.text(': 65cab76d7facad2d94f4d778d483795688625521dda36...', mg+15, y+18)
      doc.text(': 152314046200747', mg+15, y+22)
      doc.text(': ' + fmtDate(bill.date), mg+15, y+26)

      y += 40
    } else {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(`Tax Invoice (Page ${totalPages})`, W / 2, y + 5, { align: 'center' })
      y += 10
    }

    // Outer box
    const headerH = 72
    const halfW = pageW / 2
    doc.setDrawColor(0); doc.setLineWidth(0.3)
    doc.rect(mg, y, pageW, headerH)
    doc.line(mg + halfW, y, mg + halfW, y + headerH)

    // LEFT — Company info
    let ly = y + 4
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0,0,0)
    doc.text((company.name || 'Company Name').toUpperCase(), mg + 2, ly); ly += 5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
    const addrL = doc.splitTextToSize(company.address || '', halfW - 5)
    doc.text(addrL.slice(0,3), mg + 2, ly); ly += addrL.slice(0,3).length * 3.7
    if (company.phone) { doc.text('Phone: ' + company.phone, mg+2, ly); ly += 4 }
    if (company.gstin) {
      doc.setFont('helvetica','bold'); doc.text('GSTIN/UIN: ' + company.gstin, mg+2, ly)
      doc.setFont('helvetica','normal'); ly += 4
    }
    doc.text('State Name : Tamil Nadu, Code : 33', mg+2, ly); ly += 4
    if (company.email) {
      doc.text('E-Mail : ' + company.email, mg+2, ly)
    }

    // RIGHT — Invoice meta grid (2 columns, 8 rows)
    const mX = mg + halfW
    const mW = halfW
    const metaRows = [
      ['Invoice No.', bill.billNumber, 'Dated', fmtDate(bill.date)],
      ['Delivery Note', '', 'Mode/Terms of Payment', ''],
      ['Reference No. & Date.', '', 'Other References', ''],
      ["Buyer's Order No.", '', 'Dated', ''],
      ['Dispatch Doc No.', '', 'Delivery Note Date', ''],
      ['Dispatched through', '', 'Destination', ''],
      ['Bill of Lading/LR-RR No.', '', 'Motor Vehicle No.', ''],
      ['Terms of Delivery', '', null, null],
    ]
    const mRowH = headerH / metaRows.length
    const halfM = mW / 2
    metaRows.forEach((row, ri) => {
      const ry = y + ri * mRowH
      doc.setDrawColor(0); doc.setLineWidth(0.15)
      if (ri > 0) doc.line(mX, ry, mX + mW, ry)
      if (row[2] !== null) doc.line(mX + halfM, ry, mX + halfM, ry + mRowH)
      
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(70,70,70)
      doc.text(row[0], mX+1.5, ry+3.5)
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(0,0,0)
      if (row[1]) doc.text(row[1], mX+1.5, ry+mRowH-1.5)
      
      if (row[2] !== null) {
        doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(70,70,70)
        doc.text(row[2], mX+halfM+1.5, ry+3.5)
        doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(0,0,0)
        if (row[3]) doc.text(row[3], mX+halfM+1.5, ry+mRowH-1.5)
      }
    })
    y += headerH

    // ── CONSIGNEE / BUYER
    const partyH = 34
    doc.setDrawColor(0); doc.setLineWidth(0.3)
    doc.rect(mg, y, halfW, partyH)
    doc.rect(mg + halfW, y, halfW, partyH)

    const drawParty = (sx, sw, label) => {
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(0,0,0)
      doc.text(label, sx+2, y+4)
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(0,0,0)
      doc.text((bill.customerName||'').substring(0,34), sx+2, y+9)
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(0,0,0)
      if (bill.customerAddress) {
        const al = doc.splitTextToSize(bill.customerAddress, sw-5)
        doc.text(al.slice(0,3), sx+2, y+13)
      }
      if (bill.customerPhone) {
        doc.text('Ph: ' + bill.customerPhone, sx+2, y+23)
      }
      doc.setFont('helvetica','bold')
      doc.text('GSTIN/UIN        : ', sx+2, y+27)
      doc.setFont('helvetica','normal')
      doc.text('State Name       : Tamil Nadu, Code : 33', sx+2, y+31)
    }
    drawParty(mg, halfW, 'Consignee (Ship to)')
    drawParty(mg+halfW, halfW, 'Buyer (Bill to)')
    y += partyH

    return y
  }

  let y = drawHeader(mg, true)

  // ── ITEMS TABLE ──────────────────────────────────────────────
  const iCols = [
    { lbl:'S No', w:8 }, { lbl:'Product', w:54 }, { lbl:'Desp', w:16 },
    { lbl:'HSN', w:14 }, { lbl:'Feet', w:12 },
    { lbl:'Quantity', w:22 }, { lbl:'Rate', w:16 }, { lbl:'GST', w:12 }, { lbl:'Net Amt', w:26 },
  ]
  const tW = iCols.reduce((s,c) => s+c.w, 0)
  const iHdrH = 8

  const drawItemsHeader = (cy) => {
    doc.setFillColor(255,255,255)
    doc.rect(mg, cy, tW, iHdrH, 'F')
    doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(mg, cy, tW, iHdrH)
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(0,0,0)
    let cx = mg
    iCols.forEach(c => {
      doc.line(cx, cy, cx, cy+iHdrH)
      doc.text(c.lbl, cx+c.w/2, cy+5.5, { align:'center' })
      cx += c.w
    })
    doc.line(cx, cy, cx, cy+iHdrH)
    return cy + iHdrH
  }

  y = drawItemsHeader(y)

  const rowH = 7
  const validItems = bill.items.filter(i => i.description)

  const drawItemRow = (item, isPad) => {
    if (y + rowH > H - 100 && !isPad) { // Give space for footer
      totalPages++
      doc.addPage()
      y = drawHeader(mg, false)
      y = drawItemsHeader(y)
    } else if (y + rowH > H - 70 && isPad) {
      return // Don't draw pad row if too close to bottom
    }

    doc.setDrawColor(0); doc.setLineWidth(0.2); doc.rect(mg, y, tW, rowH)
    let cx = mg
    if (!isPad) {
      const cP = parseFloat(item.cgstPercent) || 0
      const sP = parseFloat(item.sgstPercent) || 0
      const totalGST = cP + sP

      const vals = [
        item.sno, item.description, item.desp||'',
        item.hsnCode||'', item.feet||'',
        item.quantity ? fmtINR(item.quantity)+' '+(item.unit||'Nos') : '',
        fmtINR(item.rate),
        totalGST > 0 ? String(totalGST) : '0',
        fmtINR(item.amount),
      ]
      vals.forEach((v, ci) => {
        doc.line(cx, y, cx, y+rowH)
        doc.setFont('helvetica', ci===1 ? 'bold' : 'normal')
        doc.setFontSize(7.5); doc.setTextColor(0,0,0)
        const al = (ci <= 2 || ci === 3 || ci === 4) ? 'left' : 'right'
        const tx = al==='right' ? cx+iCols[ci].w-1.5 : cx+1.5
        if (v!==undefined && v!==null && v!=='') doc.text(String(v), tx, y+5, { align:al })
        cx += iCols[ci].w
      })
    } else {
      iCols.forEach(c => { doc.line(cx,y,cx,y+rowH); cx+=c.w })
    }
    doc.line(cx, y, cx, y+rowH); y += rowH
  }

  validItems.forEach((item) => drawItemRow(item, false))

  // Pad with blank rows to make it look full
  const padRows = Math.max(0, 15 - validItems.length)
  for (let r=0; r<padRows; r++) drawItemRow(null, true)

  // Grand total row
  const gtH = 8
  doc.setFillColor(255,255,255); doc.rect(mg,y,tW,gtH,'F')
  doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(mg,y,tW,gtH)
  let cx=mg
  iCols.forEach((c,ci) => {
    doc.line(cx,y,cx,y+gtH)
    if (ci===8) {
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(0,0,0)
      doc.text(fmtINR(bill.grandTotal), cx+c.w-1.5, y+5.5, { align:'right' })
    }
    cx+=c.w
  })
  doc.line(cx,y,cx,y+gtH); y+=gtH

  // Amount in words row
  const wH = 8
  doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(mg,y,tW,wH)
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(0,0,0)
  doc.text('Total Amount (In Words):  ' + amtWords(bill.grandTotal), mg+2, y+5.5)
  y+=wH

  doc.setFont('helvetica','italic'); doc.setFontSize(7.5); doc.setTextColor(0,0,0)
  doc.text('E. & O.E', mg+tW-2, y+4, { align:'right' }); y+=6

  // ── GST SUMMARY TABLE ────────────────────────────────────────
  const hsnMap = {}
  validItems.forEach(item => {
    const h = item.hsnCode || 'N/A'
    const cP = parseFloat(item.cgstPercent)||0
    const sP = parseFloat(item.sgstPercent)||0
    const base = (parseFloat(item.quantity)||0) * (parseFloat(item.rate)||0)
    const cTax = base * cP / 100
    const sTax = base * sP / 100
    if (!hsnMap[h]) hsnMap[h] = { taxable:0, cRate:cP, sRate:sP, cgst:0, sgst:0 }
    hsnMap[h].taxable += base; hsnMap[h].cgst += cTax; hsnMap[h].sgst += sTax
  })

  const gC = [
    { lbl:'HSN/SAC', w:30 }, { lbl:'Taxable\nValue', w:26 },
    { lbl:'Rate', w:14 }, { lbl:'Amount', w:22 },
    { lbl:'Rate', w:14 }, { lbl:'Amount', w:22 },
    { lbl:'Total\nTax Amount', w:26 },
  ]
  const gW = gC.reduce((s,c)=>s+c.w,0)
  const gX = mg + (tW-gW)/2
  const gRH = 8

  // Top header group for CGST/SGST
  doc.setDrawColor(0); doc.setLineWidth(0.2)
  doc.rect(gX, y, gW, 5)
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(0,0,0)
  doc.text('Central Tax', gX + gC[0].w + gC[1].w + (gC[2].w+gC[3].w)/2, y+3.5, { align:'center' })
  doc.text('State Tax', gX + gC[0].w + gC[1].w + gC[2].w + gC[3].w + (gC[4].w+gC[5].w)/2, y+3.5, { align:'center' })
  doc.line(gX + gC[0].w + gC[1].w, y, gX + gC[0].w + gC[1].w, y+5)
  doc.line(gX + gC[0].w + gC[1].w + gC[2].w + gC[3].w, y, gX + gC[0].w + gC[1].w + gC[2].w + gC[3].w, y+5)
  doc.line(gX + gC[0].w + gC[1].w + gC[2].w + gC[3].w + gC[4].w + gC[5].w, y, gX + gC[0].w + gC[1].w + gC[2].w + gC[3].w + gC[4].w + gC[5].w, y+5)
  y += 5

  // GST header
  doc.rect(gX,y,gW,gRH)
  cx=gX
  gC.forEach(c => {
    doc.line(cx,y-5,cx,y+gRH)
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(0,0,0)
    const lines = c.lbl.split('\n')
    lines.forEach((l,li) => doc.text(l, cx+c.w/2, y+3.5 + (li*3), { align:'center' }))
    cx+=c.w
  })
  doc.line(cx,y-5,cx,y+gRH); y+=gRH

  let totTax=0, totCGST=0, totSGST=0
  Object.entries(hsnMap).forEach(([hsn,d]) => {
    totTax+=d.taxable; totCGST+=d.cgst; totSGST+=d.sgst
    const rv = [hsn, fmtINR(d.taxable), d.cRate+'%', fmtINR(d.cgst), d.sRate+'%', fmtINR(d.sgst), fmtINR(d.cgst+d.sgst)]
    doc.setDrawColor(0); doc.setLineWidth(0.2); doc.rect(gX,y,gW,gRH)
    cx=gX
    gC.forEach((c,ci) => {
      doc.line(cx,y,cx,y+gRH)
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(0,0,0)
      const al = ci===0 ? 'left' : 'right'
      doc.text(rv[ci], al==='right'?cx+c.w-1.5:cx+1.5, y+5, { align:al })
      cx+=c.w
    })
    doc.line(cx,y,cx,y+gRH); y+=gRH
  })

  // Totals row
  const tv = ['Total', fmtINR(totTax), '', fmtINR(totCGST), '', fmtINR(totSGST), fmtINR(totCGST+totSGST)]
  doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(gX,y,gW,gRH)
  cx=gX
  gC.forEach((c,ci) => {
    doc.line(cx,y,cx,y+gRH)
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(0,0,0)
    const al=ci===0?'center':'right'
    if(tv[ci]) doc.text(tv[ci], al==='right'?cx+c.w-1.5:cx+c.w/2, y+5, { align:al })
    cx+=c.w
  })
  doc.line(cx,y,cx,y+gRH); y+=gRH+3

  // Tax in words + PAN
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(0,0,0)
  doc.text('Tax Amount (in words)  :  INR ' + amtWords(totCGST+totSGST), mg, y); y+=5
  if (company.gstin) {
    doc.text("Company's PAN          :  " + company.gstin.substring(2,12), mg, y); y+=5
  }

  // ── DECLARATION + SIGNATORY ──────────────────────────────────
  const declH=22, sigW=75, declW=tW-sigW
  doc.setDrawColor(0); doc.setLineWidth(0.3)
  doc.rect(mg,y,declW,declH)
  doc.rect(mg+declW,y,sigW,declH)
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(0,0,0)
  doc.text('Declaration', mg+2, y+4)
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(0,0,0)
  const declTxt = 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.'
  doc.text(doc.splitTextToSize(declTxt, declW-4), mg+2, y+9)
  
  doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(0,0,0)
  doc.text('for '+(company.name||'').toUpperCase(), mg+declW+sigW/2, y+6, { align:'center' })
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5)
  doc.text('Authorised Signatory', mg+declW+sigW/2, y+declH-3, { align:'center' })
  y+=declH+4

  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(0,0,0)
  doc.text('This is a Computer Generated Invoice', W/2, y, { align:'center' })

  doc.save(generateBillFilename(bill.customerName))
}


/* ─── Stock Update Confirm Modal ──────────────────────────── */

function StockModal({ items, inventory, onSkip, onConfirm }) {
  const matchedItems = items.filter(it => {
    if (!it.inventorySku) return false
    const inv = inventory.find(i => i.sku === it.inventorySku)
    return inv && Number(it.quantity) > 0
  }).map(it => {
    const inv = inventory.find(i => i.sku === it.inventorySku)
    return {
      name: it.description,
      sku: it.inventorySku,
      billedQty: Number(it.quantity),
      currentStock: inv.qty,
      afterStock: inv.qty - Number(it.quantity),
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

const getRateLabel = (unit) => {
  const simple = ['Set', 'Box', 'Bag']
  return simple.includes(unit) ? 'Rate / Unit' : `Rate / ${unit}`
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
        field === 'quantity' ? value : item.quantity,
        field === 'rate' ? value : item.rate,
        field === 'cgstPercent' ? value : item.cgstPercent,
        field === 'sgstPercent' ? value : item.sgstPercent
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
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '880px' }}>
          <thead>
            <tr style={{ background: '#0F172A' }}>
              {[['#', '30px'], ['Product', '200px'], ['Desp', '80px'], ['HSN', '70px'], ['Feet', '60px'], ['Qty', '70px'], ['Unit', '70px'], ['Rate', '80px'], ['CGST %', '60px'], ['SGST %', '60px'], ['Amount', '90px'], ['', '36px']].map(([h, w]) => (
                <th key={h} style={{ padding: '9px 8px', textAlign: 'left', color: 'white', fontSize: '11px', fontWeight: 600, width: w, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const invItem = item.inventorySku ? inventory.find(i => i.sku === item.inventorySku) : null
              const overStock = invItem && Number(item.quantity) > invItem.qty
              return (
                <div key={item.id} style={{ display: 'contents' }}>
                  <tr style={{ borderBottom: '1px solid #F1F5F9', background: idx % 2 === 0 ? 'white' : '#FAFBFC' }}>
                    <td style={{ padding: '6px 6px', color: '#94A3B8', fontSize: '12px', fontWeight: 600, textAlign: 'center', width: '30px', verticalAlign: 'top' }}>
                      <div style={{ paddingTop: '8px' }}>{item.sno}</div>
                    </td>
                    <td style={{ padding: '6px 6px', verticalAlign: 'top' }}>
                      <DescriptionInput
                        inputRef={idx === items.length - 1 ? newRowRef : undefined}
                        value={item.description}
                        onChange={v => updateItem(item.id, 'description', v)}
                        inventory={inventory}
                        onSelectItem={inv => selectInventoryItem(item.id, inv)}
                      />
                    </td>
                    <td style={{ padding: '6px 6px', verticalAlign: 'top' }}>
                      <input style={inp} value={item.desp} onChange={e => updateItem(item.id, 'desp', e.target.value)} placeholder="e.g. 2.00 Mt" />
                    </td>
                    <td style={{ padding: '6px 6px', verticalAlign: 'top' }}>
                      <input style={inp} value={item.hsnCode} onChange={e => updateItem(item.id, 'hsnCode', e.target.value)} placeholder="0001" />
                    </td>
                    <td style={{ padding: '6px 6px', verticalAlign: 'top' }}>
                      <input style={inp} value={item.feet} onChange={e => updateItem(item.id, 'feet', e.target.value)} placeholder="" />
                    </td>
                    <td style={{ padding: '6px 6px', verticalAlign: 'top' }}>
                      <div>
                        <input style={{ ...inp, border: overStock ? '1px solid #EF4444' : inp.border }} type="number" min="0" step="any" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', e.target.value)} placeholder="0" />
                        {overStock && <div style={{ color: '#EF4444', fontSize: '10px', marginTop: '2px', fontWeight: 600 }}>Stock: {invItem.qty}</div>}
                      </div>
                    </td>
                    <td style={{ padding: '6px 6px', verticalAlign: 'top' }}>
                      <select style={{ ...inp, cursor: 'pointer', background: '#F8FAFC' }} value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)}>
                        {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 6px', verticalAlign: 'top' }}>
                      <input style={inp} type="number" min="0" step="0.01" value={item.rate} onChange={e => updateItem(item.id, 'rate', e.target.value)} placeholder="0.00" />
                    </td>
                    <td style={{ padding: '6px 6px', verticalAlign: 'top' }}>
                      <input style={inp} type="number" min="0" max="100" step="0.01" value={item.cgstPercent} onChange={e => updateItem(item.id, 'cgstPercent', e.target.value)} placeholder="0" />
                    </td>
                    <td style={{ padding: '6px 6px', verticalAlign: 'top' }}>
                      <input style={inp} type="number" min="0" max="100" step="0.01" value={item.sgstPercent} onChange={e => updateItem(item.id, 'sgstPercent', e.target.value)} placeholder="0" />
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                      <div style={{ paddingTop: '8px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', fontSize: '13px' }}>
                        {item.amount ? `₹${fmtINR(item.amount)}` : '-'}
                      </div>
                      <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '4px' }}>
                        {(parseFloat(item.cgstPercent)||0) + (parseFloat(item.sgstPercent)||0) > 0 ? `+ ${parseFloat(item.cgstPercent||0) + parseFloat(item.sgstPercent||0)}% GST` : 'Qty × Rate'}
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
                      <td colSpan={8} style={{ padding: '3px 12px 5px', fontSize: '11px', color: '#92400E' }}>
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

  const updateStatus = async (id, status) => {
    setBills(prev => prev.map(b => b.id === id ? { ...b, paymentStatus: status } : b))
    setEditStatusId(null)
    showToast?.(`Payment status updated to ${status}`, 'success')
    try {
      await backendFetch(`/bills/${id}/status`, { method: 'PATCH', body: JSON.stringify({ paymentStatus: status }) })
    } catch(err) { console.error(err) }
  }

  const deleteBill = async (id) => {
    if (!window.confirm('Delete this bill from history?')) return
    setBills(prev => prev.filter(b => b.id !== id))
    showToast?.('Bill deleted', 'info')
    try {
      await backendFetch(`/bills/${id}`, { method: 'DELETE' })
    } catch(err) { console.error(err) }
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
  const [company, setCompany] = useState({})
  const [bills, setBills] = useState([])

  useEffect(() => {
    backendFetch('/bills').then(setBills).catch(console.error)
    backendFetch('/company').then(setCompany).catch(console.error)
  }, [])

  const billNumber = bills.length 
    ? `BILL-${new Date().getFullYear()}-${String(bills.length + 1).padStart(4, '0')}`
    : `BILL-${new Date().getFullYear()}-0001`
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [items, setItems] = useState([makeItem()])
  const [discount, setDiscount] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('Unpaid')
  const [amountPaid, setAmountPaid] = useState('')
  const [notes, setNotes] = useState('')
  const [includeTerms, setIncludeTerms] = useState(false)
  const [terms, setTerms] = useState('')
  const [stockModal, setStockModal] = useState(null)

  // Derived totals
  const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0)
  const discountVal = Number(discount || 0)
  const grandTotal = subtotal - discountVal
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
    const invItems = items.filter(i => i.inventorySku && Number(i.quantity) > 0)
    if (invItems.length > 0) {
      setStockModal({ bill, items: invItems })
    } else {
      saveBill(bill)
    }
  }

  const saveBill = async (billData) => {
    try {
      const savedBill = await backendFetch('/bills', { method: 'POST', body: JSON.stringify(billData) })
      setBills(prev => [savedBill, ...prev])
      showToast?.('Bill saved to history', 'success', 'Billing')
    } catch (err) {
      showToast?.(err.message, 'error')
    }
  }

  const handleStockUpdate = async (matchedItems) => {
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
    const billData = { ...stockModal.bill, updateInventory: true }
    await saveBill(billData)
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

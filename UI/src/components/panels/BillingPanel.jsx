import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import Swal from 'sweetalert2'
import useMediaQuery from '../../hooks/useMediaQuery'
import { Skeleton } from '../ui/Skeleton'
import {
  Plus, Trash2, Download, Eye, X, Receipt, Search,
  CheckCircle, AlertTriangle, ChevronDown, Building2,
  User, Hash, DollarSign, FileText, Clock, Edit2,
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import AutocompleteInput from '../AutocompleteInput'
import { BillProcessingModal } from '../ui/BillProcessingModal'
import DateRangePicker, { getDateRange } from '../ui/DateRangePicker'
import { useAppStore } from '../../store/appStore'
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



const generateBillFilename = (customerName, billNumber, dateStr) => {
  const clean = (customerName || 'Customer')
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 25)
  const yyyy = dateStr ? dateStr.split('-')[0] : new Date().getFullYear()
  
  let formattedDate = dateStr || new Date().toISOString().split('T')[0]
  if (formattedDate.includes('-')) {
    const parts = formattedDate.split('-')
    if (parts.length === 3) {
      formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`
    }
  }

  let no = '0001'
  if (billNumber && billNumber.includes('-')) {
    const parts = billNumber.split('-')
    no = parts[parts.length - 1]
  }
  return `${clean}_${yyyy}_${formattedDate}_${no}.pdf`
}

let UNIT_OPTIONS = ['Nos', 'Sqft', 'Sqmt', 'Kg', 'Gram', 'Metre', 'Litre', 'Set', 'Box', 'Bag', 'Ltrs', 'Rmt']
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
  taxInclAmount: 0,
  inventoryId: null,
})

const recalcSno = (items) => (items || []).map((item, i) => ({ ...item, sno: i + 1 }))

const calcAmount = (quantity, rate) => {
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
}

/* ─── PDF Generator ───────────────────────────────────────── */
const generateBillPDF = async (bill, company) => {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const mg = 10
  const pageW = W - mg * 2

  // ── Helpers ──────────────────────────────────────────────────
  const amtWords = (amt) => {
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
  const manualIgst = Number(bill.items?.[0]?._globalIgst || 0)
    const tv = ['Total', fmtINR(totTax), '', fmtINR(totCGST), '', fmtINR(totSGST), fmtINR(totCGST+totSGST+manualIgst)]
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
  doc.text('Tax Amount (in words)  :  ' + amtWords(totCGST+totSGST+Number(bill.items?.[0]?._globalIgst||0)), mg, y); y+=5
  if (company.gstin) {
    doc.text("Company's PAN          :  " + company.gstin.substring(2,12), mg, y); y+=5
  }
  if (company.bankName || company.accountNumber || company.ifsc) {
    const bankDetails = [
      company.bankName,
      company.accountNumber ? `A/c No: ${company.accountNumber}` : null,
      company.ifsc ? `IFSC: ${company.ifsc}` : null
    ].filter(Boolean).join(' | ')
    doc.text("Bank Details           :  " + bankDetails, mg, y); y+=5
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

  doc.save(generateBillFilename(bill.customerName, bill.billNumber, bill.date))
}

// ─── TRANSPORT PDF (Tax Invoice — Duplicate for Transporter) ───────────────
const generateTransportPDF = async (bill, company, transport) => {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const m = 8
  const lw = pw - m * 2
  let y = m

  const amtWords = (amt) => {
    if (isNaN(amt) || amt === null || amt === undefined) return '';
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
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

  const td = transport || {}
  const coName  = company?.name  || ''
  const coAddr  = company?.address || ''
  const coPhone = company?.phone || ''
  const coEmail = company?.email || ''
  const coGstin = company?.gstin || ''
  const coState = company?.state || 'Tamil Nadu'

  // Header Table
  doc.setDrawColor(80, 80, 80); doc.setLineWidth(0.4); doc.rect(m, y, lw, 38)
  const logoColW = 42; doc.line(m + lw - logoColW, y, m + lw - logoColW, y + 38)
  const rowH = [9, 7, 7, 7, 8]; let ry = y
  rowH.forEach((h, i) => { ry += h; if (i < rowH.length - 1) doc.line(m, ry, m + lw - logoColW, ry) })

  doc.setFillColor(60, 80, 120); doc.rect(m, y, lw - logoColW, rowH[0], 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
  doc.text('Company/Seller Name:', m + 3, y + 5.5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(coName, m + 45, y + 5.5)

  if (company?.logo_base64) {
    try {
      const ld = company.logo_base64
      const ext = ld.includes('image/png') ? 'PNG' : ld.includes('image/jpeg') ? 'JPEG' : 'PNG'
      doc.addImage(ld, ext, m + lw - logoColW + 3, y + 3, logoColW - 6, 32)
    } catch(e) {}
  } else {
    doc.setTextColor(150, 150, 150); doc.setFontSize(14); doc.setFont('helvetica', 'bold')
    doc.text('LOGO', m + lw - logoColW + logoColW/2, y + 20, { align: 'center' })
  }

  let ry2 = y + rowH[0]
  doc.setFillColor(220, 230, 248); doc.rect(m, ry2, lw - logoColW, rowH[1], 'F')
  doc.setTextColor(30, 30, 30); doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text('Address :', m + 3, ry2 + 4.5)
  doc.setFont('helvetica', 'normal'); doc.text(coAddr.split('\n')[0] || '', m + 22, ry2 + 4.5)

  ry2 += rowH[1]
  doc.setFillColor(255, 255, 255); doc.rect(m, ry2, lw - logoColW, rowH[2], 'F')
  doc.setFont('helvetica', 'bold'); doc.text('Phone No.:', m + 3, ry2 + 4.5)
  doc.setFont('helvetica', 'normal'); doc.text(coPhone, m + 24, ry2 + 4.5)
  doc.text('Email ID:', m + 60, ry2 + 4.5, { align: 'left' }); doc.text(coEmail, m + 78, ry2 + 4.5)

  ry2 += rowH[2]
  doc.setFillColor(220, 230, 248); doc.rect(m, ry2, lw - logoColW, rowH[3], 'F')
  doc.setFont('helvetica', 'bold'); doc.text('GSTIN:', m + 3, ry2 + 4.5)
  doc.setFont('helvetica', 'normal'); doc.text(coGstin, m + 17, ry2 + 4.5)

  ry2 += rowH[3]
  doc.setFillColor(255, 255, 255); doc.rect(m, ry2, lw - logoColW, rowH[4], 'F')
  doc.setFont('helvetica', 'bold'); doc.text('State:', m + 3, ry2 + 5)
  doc.setFont('helvetica', 'normal'); doc.text(coState, m + 14, ry2 + 5)

  y += 40
  doc.setFillColor(30, 30, 80); doc.rect(m, y, lw, 9, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text('Tax Invoice', pw / 2, y + 6.5, { align: 'center' }); y += 11

  const half = lw / 2
  doc.setFillColor(60, 80, 120); doc.rect(m, y, half, 7, 'F'); doc.rect(m + half, y, half, 7, 'F')
  doc.setDrawColor(80, 80, 80); doc.rect(m, y, lw, 7)
  doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
  doc.text('Bill To:', m + 3, y + 5); doc.text('Shipping To:', m + half + 3, y + 5); y += 7

  const billBoxH = 22
  doc.setFillColor(255, 255, 255); doc.setDrawColor(80, 80, 80); doc.rect(m, y, half, billBoxH)
  doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
  doc.text('Name:', m + 3, y + 6); doc.setFont('helvetica', 'normal'); doc.text(bill.customerName || '', m + 18, y + 6)
  doc.setFont('helvetica', 'bold'); doc.text('Address:', m + 3, y + 12)
  doc.setFont('helvetica', 'normal'); const addrLines = doc.splitTextToSize(bill.customerAddress || '', half - 25)
  doc.text(addrLines, m + 22, y + 12)

  const shippBoxH = 8
  doc.rect(m + half, y, half, shippBoxH)
  doc.setFont('helvetica', 'bold'); doc.text('Name:', m + half + 3, y + 5.5)
  doc.setFont('helvetica', 'normal'); doc.text(bill.customerName || '', m + half + 18, y + 5.5)

  const transY = y + shippBoxH
  doc.setFillColor(60, 80, 120); doc.rect(m + half, transY, half, 7, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
  doc.text('Transportation Details :', m + half + 3, transY + 5)

  const tfields = [
    ['Driver Name:', td.driverName || ''], ['Contact No.:', td.contactNo || ''],
    ['Driver Mobile No.:', td.driverMobile || ''], ['GSTIN No.:', td.transportGstin || ''],
    ['Vehicle Number:', td.vehicleNumber || ''], ['State:', td.transportState || ''],
  ]
  const trowH = 5.5
  doc.setFillColor(255, 255, 255); doc.rect(m + half, transY + 7, half, tfields.length * trowH + 1)
  doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  tfields.forEach(([label, val], i) => {
    const ty = transY + 7 + (i + 1) * trowH - 1
    doc.setFont('helvetica', 'bold'); doc.text(label, m + half + 2, ty)
    doc.setFont('helvetica', 'normal'); doc.text(val, m + half + 35, ty)
  })

  const invY = transY + 7 + tfields.length * trowH + 2
  doc.setFillColor(220, 230, 248); doc.rect(m + half, invY, half, 8, 'FD')
  doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text('Invoice No.:', m + half + 2, invY + 5); doc.setFont('helvetica', 'normal'); doc.text(bill.billNumber || '', m + half + 25, invY + 5)
  doc.setFont('helvetica', 'bold'); doc.text('Date:', m + half + 2 + half/2 - 3, invY + 5)
  doc.setFont('helvetica', 'normal'); doc.text(fmtDate(bill.date || bill.createdAt), m + half + 2 + half/2 + 8, invY + 5)

  y = Math.max(y + billBoxH, invY + 10) + 2

  const cw = { no:8, name:42, hsn:18, qty:12, unit:14, price:20, disc:14, gst:14, amt:lw-142 }
  const thdH = 8
  doc.setFillColor(60, 80, 120); doc.rect(m, y, lw, thdH, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
  let cx = m
  const thCols = [['#', cw.no], ['Item name', cw.name], ['HSN', cw.hsn], ['QTY', cw.qty], ['Unit', cw.unit], ['Price/Unit', cw.price], ['Disc', cw.disc], ['GST', cw.gst], ['Amount', cw.amt]]
  thCols.forEach(([h, w]) => { doc.text(h, cx + w/2, y + 5.5, { align: 'center' }); cx += w })
  y += thdH

  let totalQty = 0, totalDisc = 0, totalBaseAmt = 0, totalSgstAmt = 0, totalCgstAmt = 0
  const items = bill.items || []
  items.forEach((item, idx) => {
    const rowH2 = 7
    const qty = Number(item.quantity) || 0
    const rate = Number(item.rate) || 0
    const baseAmt = qty * rate
    const cgstRate = Number(item.cgstPercent) || 0
    const sgstRate = Number(item.sgstPercent) || 0
    
    const disc = 0
    const afterDisc = baseAmt - disc
    const cgstAmt = afterDisc * cgstRate / 100
    const sgstAmt = afterDisc * sgstRate / 100
    const finalAmt = afterDisc + cgstAmt + sgstAmt

    totalQty += qty; totalDisc += disc; totalBaseAmt += baseAmt; totalSgstAmt += sgstAmt; totalCgstAmt += cgstAmt

    doc.setFillColor(idx % 2 === 0 ? 245 : 255, idx % 2 === 0 ? 247 : 255, idx % 2 === 0 ? 252 : 255)
    doc.rect(m, y, lw, rowH2, 'F'); doc.setDrawColor(200, 208, 220); doc.rect(m, y, lw, rowH2)
    doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)

    let cx2 = m
    const row = [
      [String(idx + 1), cw.no],
      [String(item.description || '').substring(0, 22), cw.name],
      [String(item.hsnCode || ''), cw.hsn],
      [String(qty), cw.qty],
      [String(item.unit || ''), cw.unit],
      [fmtINR(rate), cw.price],
      [fmtINR(disc), cw.disc],
      [`${sgstRate + cgstRate}%`, cw.gst],
      [fmtINR(finalAmt), cw.amt],
    ]
    row.forEach(([val, w]) => { doc.text(val, cx2 + w/2, y + 4.5, { align: 'center' }); cx2 += w })
    y += rowH2
  })

  totalDisc = Number(bill.discount) || 0
  const subtotalAfterDisc = totalBaseAmt - totalDisc
  const packFee = Number(td.packagingFee || 0)
  const delFee  = Number(td.deliveryFee || 0)
  const manualIgst = Number(bill.items?.[0]?._globalIgst || 0)
  
  const grandTotal = subtotalAfterDisc + totalSgstAmt + totalCgstAmt + manualIgst + packFee + delFee

  doc.setFillColor(200, 215, 240); doc.rect(m, y, lw, 8, 'FD')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(20, 20, 20)
  let cx3 = m
  const totRow = [
    ['Total', cw.no], ['', cw.name], ['', cw.hsn], [String(totalQty), cw.qty], ['', cw.unit], ['', cw.price],
    [fmtINR(totalDisc), cw.disc], [fmtINR(totalSgstAmt + totalCgstAmt + manualIgst), cw.gst], [fmtINR(grandTotal - packFee - delFee), cw.amt],
  ]
  totRow.forEach(([val, w]) => { doc.text(val, cx3 + w/2, y + 5, { align: 'center' }); cx3 += w })
  y += 10

  const summW = 68; const summX = m + lw - summW; const leftSectW = lw - summW - 2
  const summRows = [
    ['Sub Total:', fmtINR(subtotalAfterDisc)],
    ['Packaging Fee', fmtINR(packFee)],
    ['Delivery Fee', fmtINR(delFee)],
    ['Discount:', fmtINR(totalDisc)],
    [`SGST`, fmtINR(totalSgstAmt)],
    [`CGST`, fmtINR(totalCgstAmt)],
    manualIgst > 0 ? ['IGST', fmtINR(manualIgst)] : null,
    ['Total', fmtINR(grandTotal)],
    ['Received', fmtINR(0)],
    ['Balance', fmtINR(grandTotal)],
  ].filter(Boolean)
  
  const sRowH = 6.5; const summTotalH = summRows.length * sRowH

  doc.setDrawColor(80, 80, 80); doc.rect(summX, y, summW, summTotalH)
  summRows.forEach(([label, val], i) => {
    const isTotal = label === 'Total'
    const sy = y + i * sRowH
    if (isTotal) { doc.setFillColor(60, 80, 120); doc.rect(summX, sy, summW, sRowH, 'F') }
    else if (i % 2 === 1) { doc.setFillColor(220, 230, 248); doc.rect(summX, sy, summW, sRowH, 'F') }
    doc.setDrawColor(180, 190, 210); doc.line(summX, sy, summX + summW, sy)
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal'); doc.setFontSize(8)
    doc.setTextColor(isTotal ? 255 : 30, isTotal ? 255 : 30, isTotal ? 255 : 30)
    doc.text(label, summX + 3, sy + 4.5); doc.text(val, summX + summW - 3, sy + 4.5, { align: 'right' })
  })

  doc.setDrawColor(80, 80, 80); doc.rect(m, y, leftSectW, summTotalH)
  doc.setFillColor(220, 230, 248); doc.rect(m, y, leftSectW, sRowH, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(30, 30, 30)
  doc.text('Amount in words:', m + 3, y + 4.5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  const wordLines = doc.splitTextToSize(amtWords(grandTotal), leftSectW - 6)
  doc.text(wordLines, m + 3, y + sRowH + 5)

  y += summTotalH + 4

  const termsH = 20
  doc.setDrawColor(80, 80, 80); doc.rect(m, y, lw - summW - 2, termsH); doc.rect(summX, y, summW, termsH)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(30, 30, 30)
  doc.text('Terms & Conditions:', m + 3, y + 5)
  if (bill.includeTerms && bill.terms) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    doc.text(doc.splitTextToSize(bill.terms, leftSectW - 6), m + 3, y + 11)
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(30, 30, 30)
  doc.text('Company seal and Sign', summX + summW / 2, y + termsH - 4, { align: 'center' })

  doc.setFillColor(234, 88, 12); doc.rect(0, ph - 7, pw, 7, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'bold')
  doc.text('DUPLICATE FOR TRANSPORTER', m, ph - 2)
  doc.setFont('helvetica', 'normal')
  doc.text(`${coName}  |  ${bill.billNumber}  |  Tax Invoice`, pw / 2, ph - 2, { align: 'center' })

  const clean = (bill.customerName || 'Customer').trim().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 25)
  doc.save(`TRANSPORT_BILL_${clean}_${bill.billNumber}.pdf`)
}

/* ─── Transport Bill Modal ──────────────────────────── */
const TransportBillModal = ({ bill, company, onClose, onSave }) => {
  const [transport, setTransport] = React.useState({
    driverName: '', contactNo: '', driverMobile: '', transportGstin: '',
    vehicleNumber: '', transportState: '', packagingFee: '', deliveryFee: '',
    ...(bill.transportDetails || {})
  })
  const setT = (k, v) => setTransport(prev => ({ ...prev, [k]: v }))

  const handleSave = () => {
    onSave(bill.id, transport)
    generateTransportPDF(bill, company, transport)
    onClose()
  }

  const inp = { width: '100%', padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 18, width: 500, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 28px 56px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFF7ED' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#9A3412', display: 'flex', alignItems: 'center', gap: 8 }}>🚛 Transport Bill</div>
            <div style={{ fontSize: 12, color: '#C2410C', marginTop: 3 }}>For Bill: {bill.billNumber}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #FDBA74', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9A3412' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transportation Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              ['driverName',      'Driver Name',       'e.g. Ramu'],
              ['contactNo',       'Contact No.',       '+91 98765...'],
              ['driverMobile',    'Driver Mobile No.', '+91 91234...'],
              ['transportGstin',  'GSTIN No.',         '33AABCK...'],
              ['vehicleNumber',   'Vehicle Number',    'TN01AB1234'],
              ['transportState',  'State',             'Tamil Nadu'],
              ['packagingFee',    'Packaging Fee (₹)', '0'],
              ['deliveryFee',     'Delivery Fee (₹)',  '0'],
            ].map(([key, label, ph]) => (
              <div key={key}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', display: 'block', marginBottom: 4 }}>{label}</label>
                <input
                  type={key.includes('Fee') ? 'number' : 'text'}
                  style={inp}
                  value={transport[key]}
                  onChange={e => setT(key, e.target.value)}
                  placeholder={ph}
                  min={key.includes('Fee') ? '0' : undefined}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', gap: 12, background: '#FAFBFC' }}>
          <button onClick={onClose} style={{ height: 42, padding: '0 22px', borderRadius: 9, border: '1px solid #E2E8F0', background: 'white', color: '#1E293B', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} style={{ height: 42, padding: '0 26px', borderRadius: 9, border: 'none', background: '#EA580C', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            Save & Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Stock Update Confirm Modal ──────────────────────────── */

function StockModal({ items, inventory, onSkip, onConfirm }) {
  const matchedItems = items.filter(it => {
    if (!it.inventoryId) return false
    const inv = inventory.find(i => i.id === it.inventoryId)
    return inv && Number(it.quantity) > 0
  }).map(it => {
    const inv = inventory.find(i => i.id === it.inventoryId)
    return {
      name: it.description,
      hsn: inv.hsn,
      billedQty: parseFloat(Number(it.quantity).toFixed(6)),
      currentStock: parseFloat(Number(inv.qty).toFixed(6)),
      afterStock: parseFloat((inv.qty - Number(it.quantity)).toFixed(6)),
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
          <div style={{ fontSize: '12px', color: '#1E293B', marginTop: '4px' }}>The following items will be deducted from stock:</div>
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
              {(matchedItems || []).map((m, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: m.afterStock < m.min ? '#FFF7ED' : 'white' }}>
                  <td style={{ padding: '9px 10px', fontWeight: 600, color: '#0F172A' }}>{m.name}</td>
                  <td style={{ padding: '9px 10px', color: '#1E293B' }}>{m.billedQty} {m.unit}</td>
                  <td style={{ padding: '9px 10px', color: '#1E293B' }}>{m.currentStock} {m.unit}</td>
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
          <button onClick={onSkip} style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer', color: '#1E293B' }}>
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

/* ─── Line Items Table ───────────────────────────────────── */
function LineItemsTable({ items, setItems, inventory }) {
  const newRowRef = useRef(null)
  const isMobile = useMediaQuery('(max-width: 768px)')

  const addItem = () => {
    const newItem = { ...makeItem(), sno: items.length + 1 }
    setItems(prev => [...prev, newItem])
    setTimeout(() => newRowRef.current?.focus(), 50)
  }

  const deleteItem = (id) => {
    if (items.length <= 1) return
    Swal.fire({
      title: 'Are you sure you want to delete this item?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#F1F5F9',
      confirmButtonText: 'Yes, Delete it',
      cancelButtonText: '<span style="color: #0F172A; font-weight: 600;">Cancel</span>',
      iconColor: '#FBBF24',
      customClass: {
        confirmButton: 'swal2-confirm-btn',
        cancelButton: 'swal2-cancel-btn'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        setItems(prev => recalcSno(prev.filter(i => i.id !== id)))
      }
    })
  }

  const updateItem = (id, field, value) => {
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
  }

  const selectInventoryItem = (id, invItem) => {
    setItems(prev => (prev || []).map(item => {
      if (item.id !== id) return item
      
      const cgst = invItem.cgst_percent !== undefined && invItem.cgst_percent !== null ? invItem.cgst_percent : item.cgstPercent
      const sgst = invItem.sgst_percent !== undefined && invItem.sgst_percent !== null ? invItem.sgst_percent : item.sgstPercent
      
      return { 
        ...item, 
        unit: invItem.unit || item.unit, 
        hsnCode: invItem.hsn || item.hsnCode, 
        cgstPercent: cgst,
        sgstPercent: sgst,
        inventoryId: invItem.id 
      }
    }))
  }

  const cellInp = {
    padding: '5px 6px',
    border: '1px solid #D1D5DB',
    borderRadius: '5px',
    fontSize: '12px',
    outline: 'none',
    fontFamily: "'Inter', sans-serif",
    background: 'white',
    width: '100%',
    boxSizing: 'border-box',
    color: '#0F172A',
    transition: 'border-color 0.15s',
  }

  const COLS = [
    ['SNO',             '40px',  'center'],
    ['Product Name',    '190px', 'left'],
    ['Desp',            '80px',  'left'],
    ['HSN',             '68px',  'left'],
    ['Feet',            '55px',  'center'],
    ['Qty',             '60px',  'center'],
    ['Unit',            '65px',  'center'],
    ['Rate',            '76px',  'right'],
    ['CGST %',          '58px',  'center'],
    ['SGST %',          '58px',  'center'],
    ['Amount',          '86px',  'right'],
    ['Amt (Tax Incl.)', '100px', 'right'],
    ['',                '34px',  'center'],
  ]

  return (
    <div>
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((item, idx) => {
            const invItem = item.inventoryId ? inventory.find(i => i.id === item.inventoryId) : null
            const overStock = invItem && Number(item.quantity) > invItem.qty
            return (
              <div key={item.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>Item {item.sno}</span>
                  <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', color: items.length <= 1 ? '#CBD5E1' : '#EF4444', cursor: items.length <= 1 ? 'not-allowed' : 'pointer' }}><Trash2 size={16} /></button>
                </div>
                
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Product Name</label>
                  <AutocompleteInput
                    inputRef={idx === items.length - 1 ? newRowRef : undefined}
                    value={item.description}
                    onChange={v => updateItem(item.id, 'description', v)}
                    inventory={inventory}
                    placeholder="Search or type product..."
                    onSelect={inv => {
                      updateItem(item.id, 'description', inv.name)
                      selectInventoryItem(item.id, inv)
                      setTimeout(() => {
                        document.getElementById(`mob-qty-${item.id}`)?.focus()
                      }, 50)
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Qty</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input id={`mob-qty-${item.id}`} type="number" min="0" step="any" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', e.target.value)} style={{ ...cellInp, flex: 1, border: overStock ? '1px solid #EF4444' : '1px solid #D1D5DB' }} placeholder="0" />
                      <input list="unit-options" value={item.unit} onChange={e => {
                        const val = e.target.value; updateItem(item.id, 'unit', val);
                        if (val && !UNIT_OPTIONS.includes(val)) UNIT_OPTIONS.push(val);
                      }} style={{ ...cellInp, width: '60px' }} />
                    </div>
                    {overStock && <div style={{ color: '#EF4444', fontSize: '10px', marginTop: '2px', fontWeight: 600 }}>Stock: {parseFloat(Number(invItem.qty).toFixed(4))}</div>}
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Rate (₹)</label>
                    <input type="number" min="0" step="0.01" value={item.rate} onChange={e => updateItem(item.id, 'rate', e.target.value)} style={cellInp} placeholder="0.00" />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #F1F5F9', marginTop: '4px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Tax Incl. Amount</span>
                    <span style={{ fontSize: '10px', color: '#94A3B8' }}>{parseFloat(item.cgstPercent||0) + parseFloat(item.sgstPercent||0)}% GST</span>
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: item.taxInclAmount > 0 ? '#10B981' : '#94A3B8' }}>
                    {item.taxInclAmount ? `₹${fmtINR(item.taxInclAmount)}` : '—'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
      <div style={{ border: '1.5px solid #CBD5E1', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '960px', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#1E293B' }}>
                {COLS.map(([h, w, align]) => (
                  <th key={h} style={{
                    padding: '9px 6px',
                    textAlign: align,
                    color: '#F1F5F9',
                    fontSize: '11px',
                    fontWeight: 700,
                    width: w,
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.03em',
                    borderRight: '1px solid rgba(255,255,255,0.1)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {(items || []).map((item, idx) => {
                const invItem = item.inventoryId ? inventory.find(i => i.id === item.inventoryId) : null
                const overStock = invItem && Number(item.quantity) > invItem.qty
                const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'

                return (
                  <React.Fragment key={item.id}>
                    <tr style={{ borderBottom: '1px solid #E2E8F0', background: rowBg }}>
                      <td style={{ padding: '7px 4px', textAlign: 'center', color: '#1E293B', fontWeight: 700, fontSize: '12px', borderRight: '1px solid #E2E8F0', verticalAlign: 'middle' }}>
                        {item.sno}
                      </td>

                      <td style={{ padding: '5px 5px', borderRight: '1px solid #E2E8F0', verticalAlign: 'top' }}>
                        <AutocompleteInput
                          inputRef={idx === items.length - 1 ? newRowRef : undefined}
                          value={item.description}
                          onChange={v => updateItem(item.id, 'description', v)}
                          inventory={inventory}
                          placeholder="Search or type product..."
                          onSelect={inv => {
                            updateItem(item.id, 'description', inv.name)
                            selectInventoryItem(item.id, inv)
                            setTimeout(() => {
                              document.getElementById(`qty-${item.id}`)?.focus()
                            }, 50)
                          }}
                        />
                      </td>

                      <td style={{ padding: '5px 5px', borderRight: '1px solid #E2E8F0', verticalAlign: 'top' }}>
                        <input
                          style={cellInp}
                          value={item.desp}
                          onChange={e => updateItem(item.id, 'desp', e.target.value)}
                          placeholder="—"
                          onFocus={e => e.target.style.borderColor = '#93C5FD'}
                          onBlur={e => e.target.style.borderColor = '#D1D5DB'}
                        />
                      </td>

                      <td style={{ padding: '5px 5px', borderRight: '1px solid #E2E8F0', verticalAlign: 'top' }}>
                        <input
                          style={{ ...cellInp, background: invItem ? '#F0FDF4' : 'white', fontWeight: invItem ? 600 : 400 }}
                          value={item.hsnCode}
                          onChange={e => updateItem(item.id, 'hsnCode', e.target.value)}
                          placeholder="0000"
                          onFocus={e => e.target.style.borderColor = '#93C5FD'}
                          onBlur={e => e.target.style.borderColor = '#D1D5DB'}
                        />
                      </td>

                      <td style={{ padding: '5px 5px', borderRight: '1px solid #E2E8F0', verticalAlign: 'top' }}>
                        <input
                          style={{ ...cellInp, textAlign: 'center' }}
                          value={item.feet}
                          onChange={e => updateItem(item.id, 'feet', e.target.value)}
                          placeholder="—"
                          onFocus={e => e.target.style.borderColor = '#93C5FD'}
                          onBlur={e => e.target.style.borderColor = '#D1D5DB'}
                        />
                      </td>

                      <td style={{ padding: '5px 5px', borderRight: '1px solid #E2E8F0', verticalAlign: 'top' }}>
                        <input
                          id={`qty-${item.id}`}
                          style={{ ...cellInp, textAlign: 'center', border: overStock ? '1.5px solid #EF4444' : '1px solid #D1D5DB' }}
                          type="number"
                          min="0"
                          step="any"
                          value={item.quantity}
                          onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                          placeholder="0"
                          onFocus={e => e.target.style.borderColor = '#93C5FD'}
                          onBlur={e => e.target.style.borderColor = overStock ? '#EF4444' : '#D1D5DB'}
                        />
                        {overStock && <div style={{ color: '#EF4444', fontSize: '9px', marginTop: '2px', fontWeight: 700, textAlign: 'center' }}>Stock: {parseFloat(Number(invItem.qty).toFixed(4))}</div>}
                      </td>

                      <td style={{ padding: '5px 5px', borderRight: '1px solid #E2E8F0', verticalAlign: 'top' }}>
                        <input
                          list="unit-options"
                          style={{ ...cellInp, textAlign: 'center', background: invItem ? '#F0FDF4' : '#F8FAFC', fontWeight: invItem ? 600 : 400 }}
                          value={item.unit}
                          onChange={e => {
                            const val = e.target.value;
                            updateItem(item.id, 'unit', val);
                            if (val && !UNIT_OPTIONS.includes(val)) UNIT_OPTIONS.push(val);
                          }}
                          onFocus={e => e.target.style.borderColor = '#93C5FD'}
                          onBlur={e => e.target.style.borderColor = '#D1D5DB'}
                        />
                        <datalist id="unit-options">
                          {UNIT_OPTIONS.map(u => <option key={u} value={u} />)}
                        </datalist>
                      </td>

                      <td style={{ padding: '5px 5px', borderRight: '1px solid #E2E8F0', verticalAlign: 'top' }}>
                        <input
                          style={{ ...cellInp, textAlign: 'right', background: invItem && item.rate ? '#F0FDF4' : 'white' }}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={e => updateItem(item.id, 'rate', e.target.value)}
                          placeholder="0.00"
                          onFocus={e => e.target.style.borderColor = '#93C5FD'}
                          onBlur={e => e.target.style.borderColor = '#D1D5DB'}
                        />
                      </td>

                      <td style={{ padding: '5px 5px', borderRight: '1px solid #E2E8F0', verticalAlign: 'top' }}>
                        <input
                          style={{ ...cellInp, textAlign: 'center' }}
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.cgstPercent}
                          onChange={e => updateItem(item.id, 'cgstPercent', e.target.value)}
                          placeholder="0"
                          onFocus={e => e.target.style.borderColor = '#93C5FD'}
                          onBlur={e => e.target.style.borderColor = '#D1D5DB'}
                        />
                      </td>

                      <td style={{ padding: '5px 5px', borderRight: '1px solid #E2E8F0', verticalAlign: 'top' }}>
                        <input
                          style={{ ...cellInp, textAlign: 'center' }}
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.sgstPercent}
                          onChange={e => updateItem(item.id, 'sgstPercent', e.target.value)}
                          placeholder="0"
                          onFocus={e => e.target.style.borderColor = '#93C5FD'}
                          onBlur={e => e.target.style.borderColor = '#D1D5DB'}
                        />
                      </td>

                      <td style={{ padding: '7px 8px', textAlign: 'right', borderRight: '1px solid #E2E8F0', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', fontSize: '12px' }}>
                          {item.amount ? `₹${fmtINR(item.amount)}` : <span style={{ color: '#CBD5E1' }}>—</span>}
                        </div>
                        {item.amount > 0 && <div style={{ fontSize: '9px', color: '#334155', marginTop: '2px' }}>Qty × Rate</div>}
                      </td>

                      <td style={{ padding: '7px 8px', textAlign: 'right', borderRight: '1px solid #E2E8F0', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 700, color: item.taxInclAmount > 0 ? '#16A34A' : '#CBD5E1', whiteSpace: 'nowrap', fontSize: '12px' }}>
                          {item.taxInclAmount ? `₹${fmtINR(item.taxInclAmount)}` : '—'}
                        </div>
                        {item.taxInclAmount > 0 && (
                          <div style={{ fontSize: '9px', color: '#334155', marginTop: '2px' }}>
                            {(parseFloat(item.cgstPercent)||0) + (parseFloat(item.sgstPercent)||0) > 0
                              ? `+${parseFloat(item.cgstPercent||0) + parseFloat(item.sgstPercent||0)}% GST`
                              : 'No GST'}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '5px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <button
                          onClick={() => deleteItem(item.id)}
                          title="Delete row"
                          style={{
                            background: items.length <= 1 ? 'transparent' : '#FEF2F2',
                            border: items.length <= 1 ? 'none' : '1px solid #FECACA',
                            borderRadius: '6px',
                            cursor: items.length <= 1 ? 'not-allowed' : 'pointer',
                            color: items.length <= 1 ? '#E2E8F0' : '#DC2626',
                            padding: '4px 5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={e => { if (items.length > 1) { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = 'white' } }}
                          onMouseLeave={e => { if (items.length > 1) { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626' } }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>

                    {overStock && (
                      <tr style={{ background: '#FFFBEB' }}>
                        <td colSpan={13} style={{ padding: '3px 12px 4px', fontSize: '11px', color: '#92400E', fontWeight: 600 }}>
                          Only {parseFloat(Number(invItem.qty).toFixed(4))} {invItem.unit} in stock
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}

              {items.length === 0 && (
                <tr>
                  <td colSpan={13} style={{ padding: '28px', textAlign: 'center', color: '#334155', fontSize: '13px' }}>
                    No items added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <button onClick={addItem} style={{ marginTop: '12px', height: '38px', padding: '0 20px', borderRadius: '8px', background: 'white', color: '#2563EB', border: '1.5px dashed #93C5FD', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Plus size={15} /> Add Item
      </button>
    </div>
  )
}

/* ─── Bill History Table ─────────────────────────────────── */
function BillHistory({ bills, refetchBills, inventory, company, showToast, onGenerateTransport }) {
  const [search, setSearch] = useState('')
  const [editStatusId, setEditStatusId] = useState(null)
  const isMobile = useMediaQuery('(max-width: 768px)')
  
  const [dateFilter, setDateFilter] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All Categories')
  
  const categories = ['All Categories', ...new Set((inventory || []).map(i => i.category).filter(Boolean))]

  const filtered = bills.filter(b => {
    if (search && !b.customerName?.toLowerCase().includes(search.toLowerCase()) && !b.billNumber?.toLowerCase().includes(search.toLowerCase())) return false;
    
    if (dateFilter !== 'all') {
       let range;
       if (dateFilter === 'custom') {
         range = { from: customFrom ? new Date(customFrom).toISOString() : null, to: customTo ? new Date(customTo).toISOString() : null }
       } else {
         range = getDateRange(dateFilter)
       }
       if (range.from && new Date(b.date || b.created_at) < new Date(range.from.substring(0, 10))) return false;
       if (range.to && new Date(b.date || b.created_at) > new Date(range.to.substring(0, 10))) return false;
    }

    if (categoryFilter !== 'All Categories') {
      const hasCategory = (b.items || []).some(item => {
        const invItem = inventory?.find(i => i.id === item.inventoryId || (i.sku && i.sku === item.inventorySku) || i.name?.toLowerCase().trim() === item.description?.toLowerCase().trim());
        return invItem && invItem.category === categoryFilter;
      });
      if (!hasCategory) return false;
    }

    return true;
  })

  const totalRevenue = bills.filter(b => b.paymentStatus === 'Paid').reduce((s, b) => s + b.grandTotal, 0)
  const pendingAmount = bills.filter(b => b.paymentStatus !== 'Paid').reduce((s, b) => s + (b.paymentStatus === 'Partial' ? (b.balanceDue || 0) : b.grandTotal), 0)

  const updateStatus = async (id, status) => {
    setEditStatusId(null)
    showToast?.(`Updating payment status to ${status}...`, 'info')
    try {
      await backendFetch(`/bills/${id}/status`, { method: 'PATCH', body: JSON.stringify({ paymentStatus: status }) })
      refetchBills?.()
      showToast?.(`Payment status updated`, 'success')
    } catch(err) { console.error(err); showToast?.('Failed to update status', 'error') }
  }

  const deleteBill = async (id) => {
    Swal.fire({
      title: 'Are you sure you want to delete this bill?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#E2E8F0',
      confirmButtonText: 'Yes, Delete it',
      cancelButtonText: '<span style="color: #0F172A; font-weight: 600;">Cancel</span>'
    }).then(async (result) => {
      if (result.isConfirmed) {
        showToast?.('Deleting bill...', 'info')
        try {
          await backendFetch(`/bills/${id}`, { method: 'DELETE' })
          refetchBills?.()
          showToast?.('Bill deleted successfully', 'success')
        } catch(err) { console.error(err); showToast?.('Failed to delete bill', 'error') }
      }
    })
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
            <div style={{ fontSize: '12px', color: '#1E293B', marginTop: '1px' }}>{bills.length} bills total</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <DateRangePicker 
            value={dateFilter} onChange={setDateFilter}
            customFrom={customFrom} customTo={customTo}
            onCustomChange={(type, val) => type === 'from' ? setCustomFrom(val) : setCustomTo(val)}
          />
          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '12px', outline: 'none', background: 'white' }}
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#16A34A' }}>₹{fmtINR0(totalRevenue)}</div>
            <div style={{ fontSize: '10px', color: '#1E293B', textTransform: 'uppercase', fontWeight: 600 }}>Revenue</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#DC2626' }}>₹{fmtINR0(pendingAmount)}</div>
            <div style={{ fontSize: '10px', color: '#1E293B', textTransform: 'uppercase', fontWeight: 600 }}>Pending</div>
          </div>
          <div style={{ position: 'relative', width: '200px' }}>
            <Search size={14} color="#334155" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bills..." style={{ width: '100%', paddingLeft: '30px', paddingRight: '10px', height: '34px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
      </div>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#F8FAFC' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748B', background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              {bills.length === 0 ? 'No bills yet. Generate your first bill!' : 'No bills match your search.'}
            </div>
          )}
          {filtered.map(b => (
            <div key={b.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{b.customerName}</div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{b.billNumber} &bull; {fmtDate(b.date)}</div>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#16A34A' }}>₹{fmtINR(b.grandTotal)}</div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFBFC', padding: '8px 12px', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Status:</span>
                {editStatusId === b.id ? (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {['Paid', 'Unpaid', 'Partial'].map(s => (
                      <button key={s} onClick={() => updateStatus(b.id, s)}
                        style={{ padding: '3px 8px', borderRadius: '6px', border: `1px solid ${STATUS_BORDER[s]}`, background: STATUS_BG[s], color: STATUS_COLORS[s], fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}>
                        {s}
                      </button>
                    ))}
                    <button onClick={() => setEditStatusId(null)} style={{ padding: '3px 6px', borderRadius: '6px', border: '1px solid #E2E8F0', background: 'white', color: '#1E293B', fontSize: '11px', cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '99px', background: STATUS_BG[b.paymentStatus], color: STATUS_COLORS[b.paymentStatus], fontSize: '11px', fontWeight: 700, border: `1px solid ${STATUS_BORDER[b.paymentStatus]}` }}>
                    {b.paymentStatus}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
                <button onClick={() => redownload(b)} title="Re-download PDF"
                  style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#1E293B', fontSize: '12px', fontWeight: 600 }}>
                  <Download size={14} /> PDF
                </button>
                <button onClick={() => setEditStatusId(editStatusId === b.id ? null : b.id)} title="Change status"
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E293B' }}>
                  <Edit2 size={14} />
                </button>
                <button onClick={() => deleteBill(b.id)} title="Delete"
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                  <Trash2 size={14} />
                </button>
                <button onClick={() => onGenerateTransport?.(b)} title="Generate Transport Bill"
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C' }}>
                  🚛
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Bill No', 'Customer', 'Date', 'Amount', 'Status', 'Actions'].map((h, i) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: i >= 3 ? 'center' : 'left', fontSize: '11px', fontWeight: 700, color: '#1E293B', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#334155' }}>
                {bills.length === 0 ? 'No bills yet. Generate your first bill!' : 'No bills match your search.'}
              </td></tr>
            )}
            {(filtered || []).map((b, i) => (
              <tr key={b.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2563EB' }}>{b.billNumber}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>{b.customerName}</div>
                </td>
                <td style={{ padding: '12px 16px', color: '#1E293B' }}>{fmtDate(b.date)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#0F172A' }}>₹{fmtINR(b.grandTotal)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', position: 'relative' }}>
                  {editStatusId === b.id ? (
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {['Paid', 'Unpaid', 'Partial'].map(s => (
                        <button key={s} onClick={() => updateStatus(b.id, s)}
                          style={{ padding: '3px 8px', borderRadius: '6px', border: `1px solid ${STATUS_BORDER[s]}`, background: STATUS_BG[s], color: STATUS_COLORS[s], fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}>
                          {s}
                        </button>
                      ))}
                      <button onClick={() => setEditStatusId(null)} style={{ padding: '3px 6px', borderRadius: '6px', border: '1px solid #E2E8F0', background: 'white', color: '#1E293B', fontSize: '11px', cursor: 'pointer' }}>✕</button>
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
                      style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E293B' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#2563EB'; e.currentTarget.style.borderColor = '#93C5FD' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#1E293B'; e.currentTarget.style.borderColor = '#E2E8F0' }}>
                      <Download size={14} />
                    </button>
                    <button onClick={() => setEditStatusId(editStatusId === b.id ? null : b.id)} title="Change status"
                      style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E293B' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#7C3AED'; e.currentTarget.style.borderColor = '#C4B5FD' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#1E293B'; e.currentTarget.style.borderColor = '#E2E8F0' }}>
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteBill(b.id)} title="Delete"
                      style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                      <Trash2 size={14} />
                    </button>
                    <button onClick={() => onGenerateTransport?.(b)} title="Generate Transport Bill"
                      style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#C2410C'; e.currentTarget.style.borderColor = '#FDBA74' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#EA580C'; e.currentTarget.style.borderColor = '#E2E8F0' }}>
                      🚛
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
  )
}

/* ─── Transport Bill History Table ─────────────────────────────────── */
function TransportBillHistory({ bills, company, showToast }) {
  const [search, setSearch] = useState('')
  const transportBills = (bills || []).filter(b => b.transportDetails != null)
  const isMobile = useMediaQuery('(max-width: 768px)')

  const filtered = transportBills.filter(b =>
    !search || b.customerName?.toLowerCase().includes(search.toLowerCase()) || b.billNumber?.toLowerCase().includes(search.toLowerCase())
  )

  const redownload = (b) => {
    generateTransportPDF(b, company, b.transportDetails)
    showToast?.('Transport Bill PDF downloaded', 'success')
  }

  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: '#FAFBFC' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '18px' }}>🚛</span>
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Transport Bills History</div>
            <div style={{ fontSize: '12px', color: '#1E293B', marginTop: '1px' }}>{transportBills.length} transport bills</div>
          </div>
        </div>
        <div style={{ position: 'relative', width: '250px' }}>
          <Search size={14} color="#334155" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transport bills..." style={{ width: '100%', paddingLeft: '30px', paddingRight: '10px', height: '34px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#F8FAFC' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748B', background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              {transportBills.length === 0 ? 'No transport bills yet. Generate one from the Bill History.' : 'No transport bills match your search.'}
            </div>
          )}
          {filtered.map((b) => (
            <div key={b.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{b.customerName}</div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{b.billNumber}</div>
                </div>
                <button onClick={() => redownload(b)} title="Download PDF"
                  style={{ height: '32px', width: '32px', borderRadius: '8px', border: '1px solid #FDBA74', background: '#FFF7ED', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C' }}>
                  <Download size={14} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#FAFBFC', padding: '10px', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>Driver:</span>
                  <span style={{ color: '#0F172A', fontWeight: 500 }}>{b.transportDetails?.driverName || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>Vehicle:</span>
                  <span style={{ color: '#0F172A', fontWeight: 500 }}>{b.transportDetails?.vehicleNumber || '—'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Bill No', 'Customer', 'Driver Name', 'Vehicle', 'Action'].map((h, i) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: i === 4 ? 'center' : 'left', fontSize: '11px', fontWeight: 700, color: '#1E293B', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#334155' }}>
                {transportBills.length === 0 ? 'No transport bills yet. Generate one from the Bill History.' : 'No transport bills match your search.'}
              </td></tr>
            )}
            {filtered.map((b, i) => (
              <tr key={b.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#EA580C' }}>{b.billNumber}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>{b.customerName}</td>
                <td style={{ padding: '12px 16px', color: '#0F172A' }}>{b.transportDetails?.driverName || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#0F172A' }}>{b.transportDetails?.vehicleNumber || '—'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <button onClick={() => redownload(b)} title="Download PDF"
                    style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#C2410C'; e.currentTarget.style.borderColor = '#FDBA74' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#EA580C'; e.currentTarget.style.borderColor = '#E2E8F0' }}>
                    <Download size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}

/* ─── Main BillingPanel ──────────────────────────────────── */
function BillingPanelBase({ showToast, onNavigate }) {
  const { inventory = [], setInventory } = useAppStore();
  const [activeTab, setActiveTab] = useState('Create Bill')
  const [transportModalBill, setTransportModalBill] = useState(null)
  
  // React Query Fetching
  const { data: bills = [], isLoading: isBillsLoading, refetch: refetchBills } = useQuery({
    queryKey: ['bills'],
    queryFn: async () => {
      const res = await backendFetch('/bills')
      return res.bills || res || []
    },
    refetchInterval: 60000
  })

  const { data: company = {}, isLoading: isCompanyLoading } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const res = await backendFetch('/company')
      return res.company || res || {}
    },
    refetchInterval: 60000
  })

  const isLoading = isBillsLoading || isCompanyLoading

  const setBills = (updater) => {
    // Optimistic or manual cache updates can go here, but since we rely on DB,
    // we just refetch after mutation. Or if local update is needed, handle appropriately.
    // However, existing code uses `setBills` to eagerly update state before refetching.
    // For now we'll rely on the parent or keep it local for immediate UI.
  }

  const [editBillId, setEditBillId] = useState(null)
  const [showProcessing, setShowProcessing] = useState(false)
  const [billResult, setBillResult] = useState(null)

  const [billDate, setBillDate] = useState(todayISO())
  const billYear = billDate ? new Date(billDate).getFullYear() : new Date().getFullYear()
  const billNumber = bills.length 
    ? `BILL-${billYear}-${String(bills.length + 1).padStart(4, '0')}`
    : `BILL-${billYear}-0001`
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [items, setItems] = useState([makeItem()])
  const [discount, setDiscount] = useState('')
  const [igst, setIgst] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('Unpaid')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [notes, setNotes] = useState('')
  const [includeTerms, setIncludeTerms] = useState(false)
  const [terms, setTerms] = useState('')
  
  // FQ Link logic
  const [linkedFQId, setLinkedFQId] = useState(null)
  const [linkedFQNumber, setLinkedFQNumber] = useState(null)

  useEffect(() => {
    const loadPrefill = () => {
      const qStr = localStorage.getItem('opsagent_billing_prefill') || localStorage.getItem('opsagent_convert_quotation')
      if (qStr) {
        try {
          const q = JSON.parse(qStr)
          setCustomerName(q.customerName || '')
          setCustomerPhone(q.customerPhone || '')
          setCustomerAddress(q.customerAddress || '')
          setDiscount(q.discount || '')

          if (q.linkedFQId) {
            setLinkedFQId(q.linkedFQId)
            setLinkedFQNumber(q.linkedFQNumber)
            setPaymentStatus(q.paymentTerms === 'Immediate' ? 'Unpaid' : 'Unpaid') // Or handle custom terms
          }

          if (q.items) {
             const allItems = q.items.filter(i => i.description)
             if (allItems.length > 0) {
               setItems(allItems.map(i => ({
                 id: Date.now() + Math.random(),
                 description: i.description,
                 hsn: i.hsn || '',
                 quantity: i.quantity || i.qty || 1,
                 unit: i.unit || 'Nos',
                 rate: i.rate || 0,
                 cgstPercent: i.cgstPercent || i.cgst || 0,
                 sgstPercent: i.sgstPercent || i.sgst || 0
               })))
             }
          }
          showToast?.(q.linkedFQId ? `Loaded data from FQ: ${q.linkedFQNumber}` : 'Loaded data for bill', 'info')
        } catch(e) {
          console.error('Failed to parse prefill:', e)
        }
        localStorage.removeItem('opsagent_billing_prefill')
        localStorage.removeItem('opsagent_convert_quotation')
      }
    }
    loadPrefill()
  }, [showToast])

  // Derived totals
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

  const igstVal = Number(igst || 0)
  const sumTaxInclAmount = (items || []).reduce((s, i) => s + (i.taxInclAmount || 0), 0)
  const subtotal = (items || []).reduce((s, i) => s + (i.amount || 0), 0)
  const discountVal = Number(discount || 0)
  
  // Calculate raw grand total before roundoff
  const rawGrandTotal = sumTaxInclAmount + igstVal - discountVal
  
  // Calculate rounded grand total and roundoff amount
  const grandTotal = Math.round(rawGrandTotal)
  const roundoffAmount = grandTotal - rawGrandTotal
  
  const balanceDue = grandTotal - Number(amountPaid || 0)

  const inp = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', color: '#0F172A', outline: 'none', background: 'white', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }
  const readOnly = { ...inp, background: '#F8FAFC', color: '#1E293B', cursor: 'default' }
  const Lbl = ({ children }) => (
    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', marginBottom: '6px' }}>{children}</label>
  )

  const buildBillData = () => ({
    id: Date.now(),
    billNumber: 'Auto-generated',
    customerName,
    customerPhone,
    customerAddress,
    items: items.filter(i => i.description).map((item, idx) => idx === 0 ? { ...item, _globalIgst: igst } : item),
    subtotal,
    discount: discountVal,
    grandTotal,
    paymentStatus,
    paymentMethod,
    amountPaid: paymentStatus === 'Partial' ? Number(amountPaid || 0) : null,
    balanceDue: paymentStatus === 'Partial' ? balanceDue : null,
    notes,
    includeTerms,
    terms,
    date: billDate,
    inventoryUpdated: false,
  })

  const resetForm = () => {
    setBillDate(todayISO())
    setCustomerName('')
    setCustomerPhone('')
    setCustomerAddress('')
    setItems([makeItem()])
    setDiscount('')
    setIgst('')
    setPaymentStatus('Unpaid')
    setPaymentMethod('Cash')
    setAmountPaid('')
    setNotes('')
    setIncludeTerms(false)
    setTerms('')
  }

  const saveBill = async (billData, downloadPDF = false) => {
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
        
        // FQ Update
        if (linkedFQId) {
          try {
            await backendFetch(`/quotations/finalized/${linkedFQId}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ status: 'Converted to Bill', bill_number: billData.billNumber })
            })
            setLinkedFQId(null)
            setLinkedFQNumber(null)
          } catch(fqe) {
            console.error('Failed to update FQ status', fqe)
          }
        }
      }
      
      if (downloadPDF) {
        generateBillPDF(savedBill, company)
        showToast?.(`${generateBillFilename(savedBill.customerName, savedBill.billNumber, savedBill.date)} downloaded!`, 'success', 'Bill Generated')
      }
      
      resetForm()
    } catch (err) {
      showToast?.(err.message, 'error')
    }
  }

  const handleGenerate = async () => {
    if (!customerName.trim()) return showToast?.('Customer name is required', 'error')
    if (items.filter(i => i.description).length === 0) return showToast?.('Add at least one line item', 'error')

    const bill = buildBillData()

    setShowProcessing(true)
    document.getElementById('main-scroll-area')?.scrollTo({ top: 0, behavior: 'smooth' })

    try {
      // Check for inventory items to deduct
      const invItems = items.filter(i => i.inventoryId && Number(i.quantity) > 0)
      let updatedInvItems = []
      
      if (invItems.length > 0) {
        bill.updateInventory = true

        // Update local inventory state immediately
        const updated = [...inventory]
        invItems.forEach(m => {
          const idx = updated.findIndex(i => i.id === m.inventoryId)
          if (idx !== -1) {
            const oldQty = updated[idx].qty
            const newQty = Math.max(0, oldQty - Number(m.quantity))
            
            updatedInvItems.push({
              id: updated[idx].id,
              name: m.description,
              oldQty: oldQty,
              newQty: newQty,
              min: updated[idx].min,
              unit: updated[idx].unit || m.unit || 'Nos'
            })
            
            updated[idx] = { ...updated[idx], qty: newQty }
          }
        })
        setInventory(updated)
      }

      // Pass false to prevent automatic download
      await saveBill(bill, false)
      
      setBillResult({
        billNumber: billNumber,
        customerName: customerName,
        itemCount: items.filter(i => i.description).length,
        grandTotal: subtotal + totalCGST + totalSGST + Number(igst || 0) - Number(discount || 0),
        updatedItems: updatedInvItems
      })

    } catch (err) {
      setShowProcessing(false)
      showToast?.('Bill generation failed: ' + err.message, 'error')
    }
  }

  const handleProcessingComplete = () => {
    setShowProcessing(false)
    const res = billResult
    setBillResult(null)
    
    // the form was already reset by saveBill(bill, false) if it wasn't an edit!
    if (res) {
      showToast?.(`Bill generated!`, 'success')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '60px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: 0, fontFamily: "'Inter', sans-serif" }}>Billing</h2>
          <p style={{ fontSize: '14px', color: '#1E293B', marginTop: '4px' }}>Create tax invoices and manage payment history</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
        {['Create Bill', 'Transport Bills History'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab ? '#EFF6FF' : 'transparent',
              color: activeTab === tab ? '#2563EB' : '#1E293B',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {linkedFQNumber && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileText size={20} color="#16A34A" />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#15803D' }}>Pre-filled from Finalized Quotation</div>
              <div style={{ fontSize: '13px', color: '#16A34A', marginTop: '2px' }}>FQ: {linkedFQNumber} | Total: ₹{fmtINR(grandTotal)}</div>
            </div>
          </div>
          <button onClick={() => { setLinkedFQId(null); setLinkedFQNumber(null) }} style={{ background: 'white', border: '1px solid #BBF7D0', padding: '6px 12px', borderRadius: '6px', color: '#15803D', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            Clear Pre-fill ✕
          </button>
        </div>
      )}

      {/* Bill Form Card */}
      {isLoading ? (
        <div style={{ padding: '24px', background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <Skeleton className="h-10 w-1/3 mb-6" />
          <Skeleton className="h-64 w-full mb-4" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : activeTab === 'Create Bill' && (
      <>
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {/* Form Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '10px', background: '#FAFBFC' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Receipt size={17} color="#2563EB" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Create New Bill</div>
            <div style={{ fontSize: '12px', color: '#1E293B' }}>Bill Number: <span style={{ fontWeight: 700, color: '#2563EB' }}>{billNumber}</span></div>
          </div>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Customer + Company row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Customer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>Bill To (Customer)</div>
              <div><Lbl>Customer Name *</Lbl><input style={inp} value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer / Company Name" /></div>
              <div><Lbl>Phone (Optional)</Lbl><input style={inp} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+91 98765 43210" /></div>
              <div><Lbl>Address (Optional)</Lbl><textarea style={{ ...inp, resize: 'vertical', minHeight: '64px' }} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Customer address..." rows={2} /></div>
            </div>

            {/* Company (read-only) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Bill From (Company)
                {!company?.name && (
                  <button onClick={() => onNavigate?.('settings')} style={{ fontSize: '11px', color: '#D97706', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>⚠ Set up in Settings →</button>
                )}
              </div>
              <div><Lbl>Company Name</Lbl><input style={readOnly} value={company?.name || '—'} readOnly /></div>
              <div>
                <Lbl>GSTIN</Lbl>
                <input style={readOnly} value={company?.gstin || '—'} readOnly />
                <div style={{ fontSize: '11px', color: '#334155', marginTop: '4px' }}>Saved from Company Profile · <button onClick={() => onNavigate?.('settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563EB', fontSize: '11px', padding: 0 }}>Update in Settings →</button></div>
              </div>
              <div><Lbl>Bill Date</Lbl><input type="date" className="input-base" style={{ padding: '8px 12px', height: '36px' }} value={billDate} onChange={e => setBillDate(e.target.value)} /></div>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', marginBottom: '12px' }}>Line Items</div>
            <LineItemsTable items={items} setItems={setItems} inventory={inventory} />
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, paddingRight: '24px' }}>
              {(company.bankName || company.accountNumber || company.ifsc) && (
                <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', maxWidth: '300px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', marginBottom: '8px' }}>Bank Details</div>
                  {company.bankName && <div style={{ fontSize: '13px', color: '#0F172A', marginBottom: '4px' }}>{company.bankName}</div>}
                  {company.accountNumber && <div style={{ fontSize: '13px', color: '#0F172A', marginBottom: '4px' }}><span style={{ color: '#1E293B' }}>A/c No:</span> {company.accountNumber}</div>}
                  {company.ifsc && <div style={{ fontSize: '13px', color: '#0F172A' }}><span style={{ color: '#1E293B' }}>IFSC Code:</span> {company.ifsc}</div>}
                </div>
              )}
            </div>
            <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#1E293B' }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#1E293B' }}>
                <span>CGST</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(totalCGST)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#1E293B' }}>
                <span>SGST</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(totalSGST)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#1E293B' }}>
                <span>IGST</span>
                <input type="number" min="0" value={igst} onChange={e => setIgst(e.target.value)}
                  style={{ width: '100px', padding: '4px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '12px', outline: 'none', textAlign: 'right' }}
                  placeholder="0.00" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#1E293B' }}>
                <span>Discount</span>
                <input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)}
                  style={{ width: '100px', padding: '4px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '12px', outline: 'none', textAlign: 'right' }}
                  placeholder="0.00" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#1E293B' }}>
                <span>Round Off</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{roundoffAmount > 0 ? '+' : ''}{fmtINR(roundoffAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0F172A', borderRadius: '9px', padding: '10px 14px' }}>
                <span style={{ fontWeight: 800, color: 'white', fontSize: '14px' }}>Grand Total</span>
                <span style={{ fontWeight: 800, color: '#38BDF8', fontSize: '16px' }}>₹{fmtINR(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Payment Status & Method */}
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div>
              <Lbl>Payment Status</Lbl>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Paid', 'Unpaid', 'Partial'].map(s => (
                  <button key={s} onClick={() => setPaymentStatus(s)}
                    style={{ height: '36px', padding: '0 18px', borderRadius: '8px', border: `1.5px solid ${paymentStatus === s ? STATUS_COLORS[s] : '#E2E8F0'}`, background: paymentStatus === s ? STATUS_BG[s] : 'white', color: paymentStatus === s ? STATUS_COLORS[s] : '#1E293B', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            
            {paymentStatus !== 'Unpaid' && (
              <div>
                <Lbl>Payment Method</Lbl>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', outline: 'none', background: 'white', color: '#0F172A', fontWeight: 600, minWidth: '160px' }}>
                  <option value="Cash">💵 Cash</option>
                  <option value="UPI">📱 UPI (GPay, PhonePe)</option>
                  <option value="Bank Transfer">🏦 Bank Transfer</option>
                  <option value="Card">💳 Credit / Debit Card</option>
                </select>
              </div>
            )}
          </div>
          <div>
            {paymentStatus === 'Partial' && (
              <div style={{ marginTop: '10px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <Lbl>Amount Paid</Lbl>
                  <input type="number" min="0" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} style={{ ...inp, width: '160px' }} placeholder="0.00" />
                </div>
                <div style={{ paddingTop: '18px' }}>
                  <div style={{ fontSize: '13px', color: '#1E293B' }}>Balance Due</div>
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
            {editBillId && (
              <button onClick={() => {
                setEditBillId(null)
                resetForm()
              }} style={{ height: '44px', padding: '0 28px', borderRadius: '10px', border: '1px solid #E2E8F0', background: 'white', color: '#1E293B', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Cancel Edit</button>
            )}
            <button onClick={handleGenerate}
              style={{ height: '44px', padding: '0 28px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #16A34A, #15803D)', color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}>
              {editBillId ? 'Save Edited Bill' : 'Generate Bill'}
            </button>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Bill History */}
      {activeTab === 'Bill History' && (
        <BillHistory 
          bills={bills} 
          refetchBills={refetchBills} 
          inventory={inventory} 
          company={company} 
          showToast={showToast} 
          onGenerateTransport={(b) => setTransportModalBill(b)}
        />
      )}

      {activeTab === 'Transport Bills' && (
        <TransportBillHistory bills={bills} company={company} showToast={showToast} />
      )}

        <BillProcessingModal
          isOpen={showProcessing}
          onComplete={handleProcessingComplete}
          billNumber={billResult?.billNumber}
          customerName={billResult?.customerName}
          itemCount={billResult?.itemCount}
          grandTotal={billResult?.grandTotal}
          updatedItems={billResult?.updatedItems}
        />
  
        {/* Modals */}
        {transportModalBill && (
          <TransportBillModal
            bill={transportModalBill}
            company={company}
            onClose={() => setTransportModalBill(null)}
            onSave={async (id, td) => {
              try {
                const res = await backendFetch(`/bills/${id}/transport`, {
                  method: 'PATCH',
                  body: JSON.stringify({ transportDetails: td })
                })
                setBills(prev => prev.map(b => b.id === id ? res : b))
                showToast?.('Transport details saved', 'success')
              } catch(e) {
                showToast?.(e.message, 'error')
              }
            }}
          />
        )}
      </div>
  )
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Panel Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ color: '#EF4444', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            Something went wrong
          </div>
          <div style={{ color: '#6B7280', fontSize: '14px', marginBottom: '16px' }}>
            {this.state.error?.message}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ padding: '8px 16px', background: '#2563EB', color: 'white', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', border: 'none' }}
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function BillingPanel(props) {
  return (
    <ErrorBoundary>
      <BillingPanelBase {...props} />
    </ErrorBoundary>
  )
}

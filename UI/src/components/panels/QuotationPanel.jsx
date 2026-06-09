import React, { useState, useEffect, useCallback, useRef } from 'react'
import jsPDF from 'jspdf'
import {
  Plus, Trash2, Download, Sparkles, Eye, X,
  FileText, ChevronDown, Building2, User, Hash,
  Calendar, List, DollarSign, FileCheck, Clock,
  CheckCircle, Send, XCircle, RefreshCw, RotateCcw,
  Package, Search, Edit2, Layers, Tag, Info, ArrowRight,
  MessageSquare,
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import AutocompleteInput from '../AutocompleteInput'

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const today = () => new Date().toISOString().split('T')[0]
const plusDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}
const generateFilename = (customerName, date) => {
  const cleanName = (customerName || 'Customer').trim().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 30)
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

const UNIT_OPTIONS = ['Nos', 'Days', 'Hours', 'Kg', 'Ltrs', 'Set', 'Sqft', 'Rmt', 'Month', 'Box', 'Bag']
const GST_OPTIONS = [0, 5, 12, 18, 28]
const STATUS_META = {
  Draft:    { color: '#64748B', bg: '#F1F5F9', label: 'Draft' },
  Sent:     { color: '#2563EB', bg: '#EFF6FF', label: 'Sent' },
  Approved: { color: '#16A34A', bg: '#F0FDF4', label: 'Approved' },
  Rejected: { color: '#DC2626', bg: '#FEF2F2', label: 'Rejected' },
}

const emptyItem = () => ({
  id: Date.now() + Math.random(),
  description: '',
  quantity: 1,
  unit: 'Nos',
  rate: '',
  isOptional: false,
  note: '',
})

const emptySection = (name = 'New Section') => ({
  id: Date.now() + Math.random(),
  name,
  items: [emptyItem()],
})

const FIXED_TERMS = `1. This is a fixed price quotation. Price will not change during validity period.
2. Any additional requirements beyond the scope above will be quoted separately.
3. 50% advance required to confirm order.
4. Balance payment before delivery.
5. Price subject to change after validity period.`

/* ─── PDF: Breakdown ──────────────────────────────────────────────────────── */
const generateBreakdownPDF = (formData) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  let y = 20

  // Header bg
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, pageWidth, 38, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.companyName || 'Company Name', margin, 14)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 210, 220)
  doc.text((formData.companyAddress || '').split('\n')[0] || '', margin, 21)
  doc.text(`Ph: ${formData.companyPhone || ''}  |  GSTIN: ${formData.gstin || ''}`, margin, 27)
  if (formData.bankDetails) doc.text(formData.bankDetails.split('\n')[0].substring(0, 70), margin, 33)

  doc.setTextColor(96, 165, 250)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('BREAKDOWN QUOTATION', pageWidth - margin, 14, { align: 'right' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 210, 220)
  doc.text(`Ref: ${formData.quotationNumber}`, pageWidth - margin, 22, { align: 'right' })
  if (formData.projectName) doc.text(`Project: ${formData.projectName}`, pageWidth - margin, 29, { align: 'right' })

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
  doc.text((formData.customerAddress || '').split('\n')[0] || '', margin + 5, y + 20)
  if (formData.customerPhone) doc.text(`Ph: ${formData.customerPhone}`, margin + 5, y + 26)

  y += boxH + 8

  const cols = { no: margin + 2, desc: margin + 10, qty: margin + 105, unit: margin + 120, rate: margin + 140, amt: margin + 160 }

  // Draw items per section
  const sections = formData.sections || []
  const allItems = sections.flatMap(s => s.items || [])
  const requiredItems = allItems.filter(i => i.description && !i.isOptional)
  const optionalItems = allItems.filter(i => i.description && i.isOptional)

  // Table header
  const drawTableHeader = () => {
    doc.setFillColor(15, 23, 42)
    doc.rect(margin, y, pageWidth - margin * 2, 8, 'F')
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
  }

  drawTableHeader()

  let globalIdx = 0
  sections.forEach(section => {
    // Section header row
    if (section.name) {
      doc.setFillColor(241, 245, 249)
      doc.rect(margin, y, pageWidth - margin * 2, 7, 'F')
      doc.setTextColor(71, 85, 105)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(`── ${section.name.toUpperCase()} ──`, cols.desc, y + 5)
      y += 7
    }
    ;(section.items || []).filter(i => i.description && !i.isOptional).forEach((item) => {
      const amount = Number(item.quantity || 0) * Number(item.rate || 0)
      globalIdx++
      if (globalIdx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(margin, y, pageWidth - margin * 2, 8, 'F') }
      doc.setDrawColor(226, 232, 240)
      doc.rect(margin, y, pageWidth - margin * 2, 8, 'S')
      doc.setTextColor(15, 23, 42)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(String(globalIdx), cols.no, y + 5.5)
      doc.text(String(item.description).substring(0, 52), cols.desc, y + 5.5)
      doc.text(String(item.quantity || ''), cols.qty, y + 5.5)
      doc.text(String(item.unit || ''), cols.unit, y + 5.5)
      doc.text(fmtINR(item.rate).split('.')[0], cols.rate, y + 5.5)
      doc.text(fmtINR(amount).split('.')[0], cols.amt, y + 5.5)
      y += 8
    })
  })

  // Optional items section
  if (optionalItems.length > 0) {
    y += 4
    doc.setFillColor(255, 251, 235)
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F')
    doc.setTextColor(180, 83, 9)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('OPTIONAL ITEMS (not included in total)', cols.desc, y + 5)
    y += 7

    let optIdx = 0
    optionalItems.forEach(item => {
      optIdx++
      const amount = Number(item.quantity || 0) * Number(item.rate || 0)
      doc.setFillColor(255, 253, 247)
      doc.rect(margin, y, pageWidth - margin * 2, 8, 'F')
      doc.setDrawColor(253, 230, 138)
      doc.rect(margin, y, pageWidth - margin * 2, 8, 'S')
      doc.setTextColor(120, 53, 15)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.text(String(optIdx), cols.no, y + 5.5)
      doc.text(`${String(item.description).substring(0, 45)} (Optional)`, cols.desc, y + 5.5)
      doc.text(String(item.quantity || ''), cols.qty, y + 5.5)
      doc.text(String(item.unit || ''), cols.unit, y + 5.5)
      doc.text(fmtINR(item.rate).split('.')[0], cols.rate, y + 5.5)
      doc.text(fmtINR(amount).split('.')[0], cols.amt, y + 5.5)
      y += 8
    })
  }

  y += 5

  // Totals
  const subtotal = requiredItems.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.rate || 0), 0)
  const discount = Number(formData.discount || 0)
  const grandTotal = subtotal - discount
  const optTotal = optionalItems.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.rate || 0), 0)

  const totalsX = pageWidth - margin - 72
  const totalsWidth = 72
  const rowCount = 1 + (discount > 0 ? 1 : 0)
  const boxHeight = rowCount * 8 + 14

  doc.setFillColor(248, 250, 252)
  doc.roundedRect(totalsX, y, totalsWidth, boxHeight, 2, 2, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(totalsX, y, totalsWidth, boxHeight, 2, 2, 'S')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)

  let ty = y + 7
  doc.text('Subtotal (Required)', totalsX + 4, ty)
  doc.text(`Rs. ${fmtINR(subtotal).split('.')[0]}`, totalsX + totalsWidth - 4, ty, { align: 'right' })
  if (discount > 0) {
    ty += 8
    doc.text('Discount', totalsX + 4, ty)
    doc.text(`-Rs. ${fmtINR(discount).split('.')[0]}`, totalsX + totalsWidth - 4, ty, { align: 'right' })
  }

  const gtY = y + boxHeight - 9
  doc.setFillColor(15, 23, 42)
  doc.roundedRect(totalsX, gtY, totalsWidth, 9, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('GRAND TOTAL', totalsX + 4, gtY + 6)
  doc.text(`Rs. ${fmtINR(grandTotal).split('.')[0]}`, totalsX + totalsWidth - 4, gtY + 6, { align: 'right' })

  if (optTotal > 0) {
    y += boxHeight + 4
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(180, 83, 9)
    doc.text(`Optional items (Rs. ${fmtINR(optTotal).split('.')[0]}) not included in grand total`, margin, y)
    y += 8
  } else {
    y += boxHeight + 8
  }

  // Terms
  if (formData.terms) {
    doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.text('Terms & Conditions', margin, y); y += 5
    doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105)
    const tl = doc.splitTextToSize(formData.terms, pageWidth - margin * 2)
    doc.text(tl, margin, y); y += tl.length * 4 + 6
  }

  // Footer
  doc.setFillColor(15, 23, 42)
  doc.rect(0, pageHeight - 14, pageWidth, 14, 'F')
  doc.setTextColor(148, 163, 184); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
  doc.text(`${formData.companyName || ''}  |  ${formData.quotationNumber}  |  This is a Breakdown Quotation — All items are individually priced`, pageWidth / 2, pageHeight - 4, { align: 'center' })

  doc.save(generateFilename(formData.customerName, formData.date))
}

/* ─── PDF: Fixed ──────────────────────────────────────────────────────────── */
const generateFixedPDF = (formData) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  let y = 20

  // Header
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, pageWidth, 38, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.setFont('helvetica', 'bold')
  doc.text(formData.companyName || 'Company Name', margin, 14)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 210, 220)
  doc.text((formData.companyAddress || '').split('\n')[0] || '', margin, 21)
  doc.text(`Ph: ${formData.companyPhone || ''}  |  GSTIN: ${formData.gstin || ''}`, margin, 27)
  if (formData.bankDetails) doc.text(formData.bankDetails.split('\n')[0].substring(0, 70), margin, 33)

  // LUMP SUM badge
  doc.setFillColor(37, 99, 235)
  doc.roundedRect(pageWidth - margin - 38, 7, 38, 8, 2, 2, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'bold')
  doc.text('LUMP SUM', pageWidth - margin - 19, 12.5, { align: 'center' })

  doc.setTextColor(96, 165, 250); doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text('FIXED PRICE QUOTATION', pageWidth - margin, 22, { align: 'right' })
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 210, 220)
  doc.text(`Ref: ${formData.quotationNumber}`, pageWidth - margin, 30, { align: 'right' })

  y = 48

  // Bill-to
  const boxH = formData.customerPhone ? 30 : 26
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 3, 3, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 3, 3, 'S')
  doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
  doc.text('BILL TO', margin + 5, y + 7)
  doc.setTextColor(15, 23, 42); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text(formData.customerName || 'Customer Name', margin + 5, y + 14)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139)
  doc.text((formData.customerAddress || '').split('\n')[0] || '', margin + 5, y + 20)
  if (formData.customerPhone) doc.text(`Ph: ${formData.customerPhone}`, margin + 5, y + 26)

  y += boxH + 8

  // Package box
  const pkgH = formData.packageDescription ? 28 : 18
  doc.setFillColor(239, 246, 255)
  doc.roundedRect(margin, y, pageWidth - margin * 2, pkgH, 3, 3, 'F')
  doc.setDrawColor(191, 219, 254)
  doc.roundedRect(margin, y, pageWidth - margin * 2, pkgH, 3, 3, 'S')
  doc.setTextColor(15, 23, 42); doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text(`📦 ${formData.packageName || 'Package'}`, margin + 5, y + 10)
  if (formData.packageDescription) {
    doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(100, 116, 139)
    const descLines = doc.splitTextToSize(formData.packageDescription, pageWidth - margin * 2 - 10)
    doc.text(descLines[0] || '', margin + 5, y + 18)
  }
  y += pkgH + 8

  // Inclusions
  if (formData.inclusions?.length > 0) {
    doc.setFillColor(240, 253, 244)
    const incH = 10 + formData.inclusions.length * 7
    doc.roundedRect(margin, y, (pageWidth - margin * 2) / 2 - 4, incH, 2, 2, 'F')
    doc.setDrawColor(187, 247, 208)
    doc.roundedRect(margin, y, (pageWidth - margin * 2) / 2 - 4, incH, 2, 2, 'S')
    doc.setTextColor(22, 163, 74); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.text('✓ WHAT\'S INCLUDED', margin + 4, y + 6)
    doc.setFont('helvetica', 'normal')
    formData.inclusions.forEach((inc, i) => {
      doc.setTextColor(21, 128, 61)
      doc.text(`✓ ${inc}`, margin + 4, y + 12 + i * 7)
    })
  }

  // Exclusions
  if (formData.exclusions?.filter(e => e).length > 0) {
    const excH = 10 + formData.exclusions.filter(e => e).length * 7
    const excX = margin + (pageWidth - margin * 2) / 2 + 4
    const excW = (pageWidth - margin * 2) / 2 - 4
    doc.setFillColor(254, 242, 242)
    doc.roundedRect(excX, y, excW, excH, 2, 2, 'F')
    doc.setDrawColor(254, 202, 202)
    doc.roundedRect(excX, y, excW, excH, 2, 2, 'S')
    doc.setTextColor(220, 38, 38); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.text('✗ NOT INCLUDED', excX + 4, y + 6)
    doc.setFont('helvetica', 'normal')
    formData.exclusions.filter(e => e).forEach((exc, i) => {
      doc.setTextColor(185, 28, 28)
      doc.text(`✗ ${exc}`, excX + 4, y + 12 + i * 7)
    })
  }

  const incH = Math.max(
    formData.inclusions?.length ? 10 + formData.inclusions.length * 7 : 0,
    formData.exclusions?.filter(e => e).length ? 10 + formData.exclusions.filter(e => e).length * 7 : 0
  )
  y += incH + 10

  // Pricing box
  const basePrice = Number(formData.basePrice || 0)
  const gstPct = Number(formData.gstPercent || 0)
  const gstAmt = basePrice * gstPct / 100
  const discountAmt = Number(formData.discount || 0)
  const total = basePrice + gstAmt - discountAmt

  const priceX = pageWidth - margin - 80
  const priceW = 80
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(priceX, y, priceW, 44, 3, 3, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(priceX, y, priceW, 44, 3, 3, 'S')

  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139)
  doc.text('Base Price:', priceX + 4, y + 8)
  doc.text(`Rs. ${fmtINR(basePrice).split('.')[0]}`, priceX + priceW - 4, y + 8, { align: 'right' })
  doc.text(`GST (${gstPct}%):`, priceX + 4, y + 16)
  doc.text(`Rs. ${fmtINR(gstAmt).split('.')[0]}`, priceX + priceW - 4, y + 16, { align: 'right' })
  if (discountAmt > 0) {
    doc.text('Discount:', priceX + 4, y + 24)
    doc.text(`-Rs. ${fmtINR(discountAmt).split('.')[0]}`, priceX + priceW - 4, y + 24, { align: 'right' })
  }

  doc.setFillColor(15, 23, 42)
  doc.roundedRect(priceX, y + 33, priceW, 11, 2, 2, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('PACKAGE TOTAL', priceX + 4, y + 40)
  doc.text(`Rs. ${fmtINR(total).split('.')[0]}`, priceX + priceW - 4, y + 40, { align: 'right' })

  y += 54

  // Terms
  if (formData.terms) {
    doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.text('Terms & Conditions', margin, y); y += 5
    doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105)
    const tl = doc.splitTextToSize(formData.terms, pageWidth - margin * 2)
    doc.text(tl, margin, y)
  }

  // Footer
  doc.setFillColor(15, 23, 42)
  doc.rect(0, pageHeight - 14, pageWidth, 14, 'F')
  doc.setTextColor(148, 163, 184); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
  doc.text(`${formData.companyName || ''}  |  ${formData.quotationNumber}  |  Fixed Price Quotation — Price guaranteed for stated validity`, pageWidth / 2, pageHeight - 4, { align: 'center' })

  doc.save(generateFilename(formData.customerName, formData.date))
}

/* ─── Section Head UI ─────────────────────────────────────────────────────── */
const SectionHead = ({ icon: Icon, title, color = '#2563EB' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #E2E8F0' }}>
    <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={14} color={color} />
    </div>
    <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{title}</span>
  </div>
)

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

/* ─── Quotation Type Selector ─────────────────────────────────────────────── */
function QuotationTypeSelector({ value, onChange }) {
  const types = [
    {
      id: 'breakdown',
      icon: '📋',
      title: 'Breakdown Quotation',
      subtitle: 'Itemized list of all items',
      pros: ['✓ High trust', '✓ Transparent pricing'],
    },
    {
      id: 'fixed',
      icon: '📦',
      title: 'Fixed / Lump Sum',
      subtitle: 'Single package price',
      pros: ['✓ Fast decision', '✓ Fixed margin'],
    },
  ]

  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <Label>Select Quotation Type</Label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '10px' }}>
        {types.map(t => {
          const selected = value === t.id
          return (
            <div
              key={t.id}
              onClick={() => onChange(t.id)}
              style={{
                cursor: 'pointer',
                borderRadius: '12px',
                padding: '20px',
                border: `2px solid ${selected ? '#2563EB' : '#E2E8F0'}`,
                background: selected ? '#EFF6FF' : 'white',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              {selected && (
                <div style={{ position: 'absolute', top: '12px', right: '12px', width: '20px', height: '20px', borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'white', fontSize: '11px' }}>✓</span>
                </div>
              )}
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>{t.icon}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: selected ? '#1D4ED8' : '#0F172A', marginBottom: '4px' }}>{t.title}</div>
              <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '10px' }}>{t.subtitle}</div>
              {t.pros.map(p => (
                <div key={p} style={{ fontSize: '11px', color: selected ? '#2563EB' : '#94A3B8', fontWeight: 600, marginBottom: '3px' }}>{p}</div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Breakdown Form ──────────────────────────────────────────────────────── */
function BreakdownForm({ form, setForm, inventory }) {
  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const addSection = () => {
    setForm(prev => ({ ...prev, sections: [...(prev.sections || []), emptySection()] }))
  }

  const removeSection = (sId) => {
    setForm(prev => ({ ...prev, sections: (prev.sections || []).filter(s => s.id !== sId) }))
  }

  const updateSectionName = (sId, name) => {
    setForm(prev => ({ ...prev, sections: (prev.sections || []).map(s => s.id === sId ? { ...s, name } : s) }))
  }

  const addItem = (sId) => {
    setForm(prev => ({ ...prev, sections: (prev.sections || []).map(s => s.id === sId ? { ...s, items: [...s.items, emptyItem()] } : s) }))
  }

  const removeItem = (sId, iId) => {
    setForm(prev => ({
      ...prev, sections: (prev.sections || []).map(s => {
        if (s.id !== sId) return s
        if (s.items.length === 1) return s
        return { ...s, items: s.items.filter(i => i.id !== iId) }
      })
    }))
  }

  const setItem = (sId, iId, key, val) => {
    setForm(prev => ({
      ...prev, sections: (prev.sections || []).map(s => {
        if (s.id !== sId) return s
        return { ...s, items: s.items.map(i => i.id === iId ? { ...i, [key]: val } : i) }
      })
    }))
  }

  const sections = form.sections || []
  const allItems = sections.flatMap(s => s.items || [])
  const requiredItems = allItems.filter(i => i.description && !i.isOptional)
  const optionalItems = allItems.filter(i => i.description && i.isOptional)
  const subtotal = requiredItems.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.rate || 0), 0)
  const optTotal = optionalItems.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.rate || 0), 0)
  const discount = Number(form.discount || 0)
  const grandTotal = subtotal - discount

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Info badge */}
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <Info size={16} color="#2563EB" style={{ flexShrink: 0, marginTop: '1px' }} />
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1D4ED8' }}>Breakdown Quotation</div>
          <div style={{ fontSize: '12px', color: '#3B82F6', marginTop: '2px' }}>Each item is individually priced. Customer can see exact quantities and rates. Best for contractors and material buyers.</div>
        </div>
      </div>

      {/* Project Name */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <SectionHead icon={Hash} title="Quotation Details" color="#D97706" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <Label>Quotation #</Label>
            <input style={inp} value={form.quotationNumber} onChange={e => setField('quotationNumber', e.target.value)} />
          </div>
          <div>
            <Label>Reference / Project Name (optional)</Label>
            <input style={inp} value={form.projectName || ''} onChange={e => setField('projectName', e.target.value)} placeholder="Bathroom Renovation - 2nd Floor" />
          </div>
        </div>
      </div>

      {/* Sections & Items */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <SectionHead icon={List} title="Line Items" color="#16A34A" />

        {sections.map((section, si) => (
          <div key={section.id} style={{ marginBottom: '20px' }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F1F5F9', borderRadius: '8px', padding: '8px 12px', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 700 }}>──</span>
              <input
                value={section.name}
                onChange={e => updateSectionName(section.id, e.target.value)}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', fontWeight: 700, color: '#0F172A', fontFamily: "'Inter', sans-serif" }}
                placeholder="Section Name (e.g. Tiles, Adhesives)"
              />
              <button onClick={() => removeSection(section.id)} style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={12} color="#DC2626" />
              </button>
            </div>

            {/* Item column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 76px 82px 82px 32px 100px', gap: '5px', padding: '0 2px', marginBottom: '6px' }}>
              {['Description', 'Qty', 'Unit', 'Rate (₹)', 'Amount', '', 'Options'].map(h => (
                <div key={h} style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>

            {section.items.map(item => {
              const amount = Number(item.quantity || 0) * Number(item.rate || 0)
              return (
                <div key={item.id} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 76px 82px 82px 32px 100px', gap: '5px', alignItems: 'center', opacity: item.isOptional ? 0.75 : 1 }}>
                    <AutocompleteInput
                      value={item.description}
                      onChange={v => setItem(section.id, item.id, 'description', v)}
                      inventory={inventory}
                      placeholder="Search or type..."
                      onSelect={inv => {
                        setItem(section.id, item.id, 'description', inv.name)
                        if (inv.rate !== undefined && inv.rate !== null && inv.rate !== '') setItem(section.id, item.id, 'rate', inv.rate)
                        if (inv.unit) setItem(section.id, item.id, 'unit', inv.unit)
                      }}
                    />
                    <input type="number" style={{ ...inp, textAlign: 'center' }} value={item.quantity} min="0" onChange={e => setItem(section.id, item.id, 'quantity', e.target.value)} />
                    <select style={inp} value={item.unit} onChange={e => setItem(section.id, item.id, 'unit', e.target.value)}>
                      {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <input type="number" style={{ ...inp, textAlign: 'right' }} value={item.rate} min="0" onChange={e => setItem(section.id, item.id, 'rate', e.target.value)} placeholder="0" />
                    <div style={{ ...inp, background: '#F8FAFC', color: item.isOptional ? '#D97706' : '#16A34A', fontWeight: 700, textAlign: 'right', cursor: 'default' }}>
                      {amount > 0 ? fmtINR(amount) : '—'}
                    </div>
                    <button onClick={() => removeItem(section.id, item.id)} disabled={section.items.length === 1} style={{ width: '32px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: section.items.length === 1 ? '#F8FAFC' : '#FEF2F2', border: `1px solid ${section.items.length === 1 ? '#E2E8F0' : '#FECACA'}`, cursor: section.items.length === 1 ? 'not-allowed' : 'pointer' }}>
                      <Trash2 size={12} color={section.items.length === 1 ? '#CBD5E1' : '#DC2626'} />
                    </button>
                    {/* Optional + Note */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748B', cursor: 'pointer', fontWeight: 600 }}>
                        <input type="checkbox" checked={item.isOptional} onChange={e => setItem(section.id, item.id, 'isOptional', e.target.checked)} style={{ cursor: 'pointer' }} />
                        Optional
                      </label>
                    </div>
                  </div>
                  {/* Item note */}
                  <div style={{ marginTop: '3px', paddingLeft: '2px' }}>
                    <input
                      value={item.note || ''}
                      onChange={e => setItem(section.id, item.id, 'note', e.target.value)}
                      placeholder="Item note (optional, appears in PDF)"
                      style={{ ...inp, fontSize: '11px', padding: '5px 10px', color: '#64748B', background: '#FAFBFC' }}
                    />
                  </div>
                </div>
              )
            })}

            <button onClick={() => addItem(section.id)} style={{ height: '32px', padding: '0 12px', borderRadius: '7px', background: 'white', color: '#16A34A', border: '1px dashed #86EFAC', fontWeight: 600, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <Plus size={13} /> Add Item to {section.name}
            </button>
          </div>
        ))}

        <button onClick={addSection} style={{ height: '38px', padding: '0 16px', borderRadius: '8px', background: 'white', color: '#7C3AED', border: '1px dashed #C4B5FD', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
          <Plus size={15} /> Add Section
        </button>
      </div>

      {/* Totals */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <SectionHead icon={DollarSign} title="Totals" color="#2563EB" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: '#64748B' }}>Subtotal (Required Items)</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(subtotal)}</span>
            </div>
            {optTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#D97706' }}>Optional Items Total</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#D97706' }}>₹{fmtINR(optTotal)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: '#64748B', flexShrink: 0 }}>Discount</span>
              <input type="number" style={{ ...inp, width: '120px', textAlign: 'right' }} value={form.discount} min="0" onChange={e => setField('discount', e.target.value)} placeholder="0" />
            </div>
            <div style={{ borderTop: '2px solid #0F172A', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>Grand Total</span>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>(Required items only)</div>
              </div>
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#2563EB' }}>₹{fmtINR(grandTotal)}</span>
            </div>
            {optTotal > 0 && (
              <div style={{ fontSize: '12px', color: '#D97706', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '8px 12px' }}>
                Optional items (₹{fmtINR(optTotal)}) not included in grand total
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Fixed Form ──────────────────────────────────────────────────────────── */
function FixedForm({ form, setForm }) {
  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
  const basePrice = Number(form.basePrice || 0)
  const gstPct = Number(form.gstPercent || 0)
  const gstAmt = basePrice * gstPct / 100
  const discountAmt = Number(form.discount || 0)
  const total = basePrice + gstAmt - discountAmt

  const inclusions = form.inclusions || ['']
  const exclusions = form.exclusions || []
  const showExclusions = form.showExclusions || false

  const addInclusion = () => setField('inclusions', [...inclusions, ''])
  const removeInclusion = (i) => setField('inclusions', inclusions.filter((_, idx) => idx !== i))
  const setInclusion = (i, val) => setField('inclusions', inclusions.map((v, idx) => idx === i ? val : v))

  const addExclusion = () => setField('exclusions', [...exclusions, ''])
  const removeExclusion = (i) => setField('exclusions', exclusions.filter((_, idx) => idx !== i))
  const setExclusion = (i, val) => setField('exclusions', exclusions.map((v, idx) => idx === i ? val : v))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Info badge */}
      <div style={{ background: '#F3E8FF', border: '1px solid #DDD6FE', borderRadius: '10px', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <Info size={16} color="#7C3AED" style={{ flexShrink: 0, marginTop: '1px' }} />
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#6D28D9' }}>Fixed Price Quotation</div>
          <div style={{ fontSize: '12px', color: '#7C3AED', marginTop: '2px' }}>Single package price. Customer sees inclusions but not individual item prices. Best for retail customers and packages.</div>
        </div>
      </div>

      {/* Package Details */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <SectionHead icon={Package} title="Package Details" color="#7C3AED" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <Label>Quotation #</Label>
              <input style={inp} value={form.quotationNumber} onChange={e => setField('quotationNumber', e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Package Name *</Label>
            <input style={inp} value={form.packageName || ''} onChange={e => setField('packageName', e.target.value)} placeholder="Complete Premium Bathroom Tile & Fitting Package" />
          </div>
          <div>
            <Label>Package Description</Label>
            <textarea style={{ ...inp, resize: 'vertical', minHeight: '80px', lineHeight: 1.6 }} value={form.packageDescription || ''} onChange={e => setField('packageDescription', e.target.value)} placeholder="Describe what is included in this package..." rows={3} />
          </div>
        </div>
      </div>

      {/* Inclusions */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <SectionHead icon={CheckCircle} title="What's Included" color="#16A34A" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {inclusions.map((inc, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>✓</span>
              <input style={{ ...inp, flex: 1 }} value={inc} onChange={e => setInclusion(i, e.target.value)} placeholder="Supply of vitrified floor tiles (50 sqft)" />
              <button onClick={() => removeInclusion(i)} style={{ width: '32px', height: '36px', borderRadius: '8px', border: '1px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={12} color="#DC2626" />
              </button>
            </div>
          ))}
          <button onClick={addInclusion} style={{ height: '36px', padding: '0 14px', borderRadius: '8px', background: 'white', color: '#16A34A', border: '1px dashed #86EFAC', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content', marginTop: '4px' }}>
            <Plus size={14} /> Add Inclusion
          </button>
        </div>
      </div>

      {/* Exclusions */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={14} color="#DC2626" />
            </div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>What's Not Included</span>
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>(optional)</span>
          </div>
          <button onClick={() => setField('showExclusions', !showExclusions)} style={{ fontSize: '12px', color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            {showExclusions ? '▲ Hide' : '▼ Show'}
          </button>
        </div>
        {showExclusions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {exclusions.map((exc, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>✗</span>
                <input style={{ ...inp, flex: 1 }} value={exc} onChange={e => setExclusion(i, e.target.value)} placeholder="Labour/installation charges" />
                <button onClick={() => removeExclusion(i)} style={{ width: '32px', height: '36px', borderRadius: '8px', border: '1px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trash2 size={12} color="#DC2626" />
                </button>
              </div>
            ))}
            <button onClick={addExclusion} style={{ height: '36px', padding: '0 14px', borderRadius: '8px', background: 'white', color: '#DC2626', border: '1px dashed #FECACA', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content', marginTop: '4px' }}>
              <Plus size={14} /> Add Exclusion
            </button>
          </div>
        )}
      </div>

      {/* Pricing */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <SectionHead icon={DollarSign} title="Package Pricing" color="#2563EB" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <Label>Base Price (₹) *</Label>
            <input type="number" style={inp} value={form.basePrice || ''} onChange={e => setField('basePrice', e.target.value)} placeholder="0" min="0" />
          </div>
          <div>
            <Label>GST %</Label>
            <select style={inp} value={form.gstPercent || 0} onChange={e => setField('gstPercent', Number(e.target.value))}>
              {GST_OPTIONS.map(g => <option key={g} value={g}>{g}%</option>)}
            </select>
          </div>
          <div>
            <Label>GST Amount (auto)</Label>
            <input style={{ ...inp, background: '#F8FAFC', color: '#64748B' }} value={`₹ ${fmtINR(gstAmt)}`} readOnly />
          </div>
          <div>
            <Label>Discount (₹)</Label>
            <input type="number" style={inp} value={form.discount || ''} onChange={e => setField('discount', e.target.value)} placeholder="0" min="0" />
          </div>
        </div>
        <div style={{ borderTop: '2px solid #0F172A', marginTop: '16px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>Package Total</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: '#2563EB' }}>₹{fmtINR(total)}</span>
        </div>
      </div>

      {/* Terms */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <SectionHead icon={FileCheck} title="Terms & Conditions" color="#7C3AED" />
        <textarea style={{ ...inp, resize: 'vertical', minHeight: '120px', lineHeight: 1.7 }} value={form.terms || FIXED_TERMS} onChange={e => setField('terms', e.target.value)} rows={6} />
      </div>
    </div>
  )
}

/* ─── Quotation History ───────────────────────────────────────────────────── */
function QuotationHistory({ quotations, onChangeStatus, onRedownload, onDelete, onConvertToBill }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [editStatusId, setEditStatusId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const filtered = quotations.filter(q => {
    const matchesSearch = !search ||
      q.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      q.quotationNumber?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'All Status' || q.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const approvedCount = quotations.filter(q => q.status === 'Approved').length
  const pendingCount = quotations.filter(q => q.status === 'Draft' || q.status === 'Sent').length

  const STATUS_COLORS_MAP = {
    Draft:    { color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' },
    Sent:     { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
    Approved: { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
    Rejected: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  }

  const TypeBadge = ({ type }) => {
    const isFixed = type === 'fixed'
    return (
      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: 700, background: isFixed ? '#F3E8FF' : '#EFF6FF', color: isFixed ? '#7C3AED' : '#2563EB', border: `1px solid ${isFixed ? '#DDD6FE' : '#BFDBFE'}` }}>
        {isFixed ? 'Lump Sum' : 'Itemized'}
      </span>
    )
  }

  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: '#FAFBFC' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={17} color="#2563EB" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Quotation History</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '1px' }}>{quotations.length} quotations total</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#2563EB' }}>{quotations.length}</div>
            <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Total</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#16A34A' }}>{approvedCount}</div>
            <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Approved</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#D97706' }}>{pendingCount}</div>
            <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Pending</div>
          </div>
          <div style={{ position: 'relative', width: '210px' }}>
            <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ width: '100%', paddingLeft: '30px', paddingRight: '10px', height: '34px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: "'Inter', sans-serif" }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ height: '34px', padding: '0 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', color: '#0F172A', cursor: 'pointer' }}>
            {['All Status', 'Draft', 'Sent', 'Approved', 'Rejected'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['QT Number', 'Customer', 'Type', 'Date', 'Amount', 'Status', 'Actions'].map((h, i) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: i >= 4 ? 'center' : 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '60px', textAlign: 'center' }}>
                <FileText size={48} color="#CBD5E1" style={{ marginBottom: '16px', display: 'block', margin: '0 auto 16px' }} />
                <div style={{ color: '#64748B', fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                  {quotations.length === 0 ? 'No quotations yet' : 'No quotations match your search'}
                </div>
                <div style={{ color: '#94A3B8', fontSize: '13px' }}>
                  {quotations.length === 0 ? 'Create your first quotation above' : 'Try a different name or clear the filter'}
                </div>
              </td></tr>
            )}
            {filtered.map((q, i) => {
              const sc = STATUS_COLORS_MAP[q.status] || STATUS_COLORS_MAP.Draft
              const isExpanded = expandedId === q.id
              return (
                <React.Fragment key={q.id}>
                  <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid #F1F5F9', background: i % 2 === 0 ? 'white' : '#FAFBFC', height: '48px' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2563EB', cursor: 'pointer', fontFamily: 'monospace', fontSize: '13px' }} onClick={() => setExpandedId(isExpanded ? null : q.id)}>
                      {q.quotationNumber}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>{q.customerName}</div>
                      {q.customerPhone && <div style={{ fontSize: '11px', color: '#94A3B8' }}>{q.customerPhone}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <TypeBadge type={q.type || 'breakdown'} />
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748B' }}>{fmtDate(q.date)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#0F172A' }}>₹{fmtINR(q.grandTotal)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', position: 'relative' }}>
                      {editStatusId === q.id ? (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          {Object.keys(STATUS_COLORS_MAP).map(s => (
                            <button key={s} onClick={() => { onChangeStatus(q.id, s); setEditStatusId(null) }}
                              style={{ padding: '3px 8px', borderRadius: '6px', border: `1px solid ${STATUS_COLORS_MAP[s].border}`, background: STATUS_COLORS_MAP[s].bg, color: STATUS_COLORS_MAP[s].color, fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}>
                              {s}
                            </button>
                          ))}
                          <button onClick={() => setEditStatusId(null)} style={{ padding: '3px 6px', borderRadius: '6px', border: '1px solid #E2E8F0', background: 'white', color: '#64748B', fontSize: '11px', cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : (
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '99px', background: sc.bg, color: sc.color, fontSize: '11px', fontWeight: 700, border: `1px solid ${sc.border}` }}>
                          {q.status || 'Draft'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button onClick={() => onConvertToBill(q)} title="Convert to Bill" style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#059669'; e.currentTarget.style.borderColor = '#6EE7B7' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#10B981'; e.currentTarget.style.borderColor = '#E2E8F0' }}>
                          <FileCheck size={14} />
                        </button>
                        <button onClick={() => onRedownload(q)} title="Download PDF" style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#2563EB'; e.currentTarget.style.borderColor = '#93C5FD' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = '#E2E8F0' }}>
                          <Download size={14} />
                        </button>
                        <button onClick={() => setEditStatusId(editStatusId === q.id ? null : q.id)} title="Change status" style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#7C3AED'; e.currentTarget.style.borderColor = '#C4B5FD' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = '#E2E8F0' }}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => onDelete(q.id)} title="Delete" style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                      <td colSpan={7} style={{ padding: '16px 24px' }}>
                        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                          <div style={{ padding: '12px 16px', background: '#F1F5F9', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>{q.quotationNumber} &nbsp;|&nbsp; <span style={{ color: '#64748B', fontWeight: 600 }}>{q.customerName}</span></span>
                            <TypeBadge type={q.type || 'breakdown'} />
                          </div>
                          {q.type === 'fixed' ? (
                            <div style={{ padding: '16px' }}>
                              {q.packageName && <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>📦 {q.packageName}</div>}
                              {q.packageDescription && <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '12px' }}>{q.packageDescription}</div>}
                              {q.inclusions?.filter(i => i).length > 0 && (
                                <div>
                                  <div style={{ fontWeight: 700, color: '#16A34A', marginBottom: '4px', fontSize: '12px' }}>INCLUDED:</div>
                                  {q.inclusions.filter(i => i).map((inc, idx) => (
                                    <div key={idx} style={{ fontSize: '12px', color: '#374151', marginBottom: '2px' }}>✓ {inc}</div>
                                  ))}
                                </div>
                              )}
                              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#0F172A' }}>
                                <span>Package Total</span><span style={{ color: '#2563EB' }}>₹{fmtINR(q.grandTotal)}</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                                    {['#', 'Description', 'Qty', 'Unit', 'Rate', 'Amount'].map((h, hi) => (
                                      <th key={h} style={{ padding: '8px 12px', textAlign: hi >= 2 ? 'right' : 'left', color: '#64748B', fontWeight: 600 }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(q.sections || []).flatMap(s => s.items || []).filter(it => it.description).map((it, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                      <td style={{ padding: '8px 12px', color: '#94A3B8' }}>{idx + 1}</td>
                                      <td style={{ padding: '8px 12px', fontWeight: 600, color: it.isOptional ? '#D97706' : '#0F172A' }}>
                                        {it.description} {it.isOptional && <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#D97706', padding: '1px 4px', borderRadius: '4px' }}>Optional</span>}
                                      </td>
                                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748B' }}>{it.quantity}</td>
                                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748B' }}>{it.unit}</td>
                                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748B' }}>₹{fmtINR(it.rate)}</td>
                                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>₹{fmtINR(Number(it.quantity || 0) * Number(it.rate || 0))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div style={{ padding: '12px 16px', background: '#FAFBFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                                Grand Total: ₹{fmtINR(q.grandTotal)}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Main QuotationPanel ─────────────────────────────────────────────────── */
export default function QuotationPanel({ apiKey, showToast, onNavigate }) {
  const [company, setCompany] = useState({})
  const [quotations, setQuotations] = useState([])
  const [inventory, setInventory] = useState([])
  const [quotationType, setQuotationType] = useState('breakdown')
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const [form, setForm] = useState({
    companyName: '', companyAddress: '', companyPhone: '', gstin: '', bankDetails: '',
    customerName: '', customerAddress: '', customerPhone: '',
    quotationNumber: 'Auto-generated on save',
    date: today(),
    // Breakdown fields
    projectName: '',
    sections: [emptySection('General')],
    discount: '',
    // Fixed fields
    packageName: '', packageDescription: '',
    inclusions: [''],
    exclusions: [],
    showExclusions: false,
    basePrice: '',
    gstPercent: 18,
    // Common
    terms: '',
    notes: '',
  })

  useEffect(() => {
    backendFetch('/quotations').then(setQuotations).catch(console.error)
    backendFetch('/inventory').then(setInventory).catch(console.error)
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

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  /* ── Derived totals for breakdown */
  const allItems = (form.sections || []).flatMap(s => s.items || [])
  const requiredItems = allItems.filter(i => i.description && !i.isOptional)
  const subtotal = requiredItems.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.rate || 0), 0)
  const discount = Number(form.discount || 0)
  const grandTotal = quotationType === 'fixed'
    ? Number(form.basePrice || 0) + Number(form.basePrice || 0) * Number(form.gstPercent || 0) / 100 - Number(form.discount || 0)
    : subtotal - discount

  const resetForm = () => {
    const c = company
    setForm({
      companyName: c.name || '', companyAddress: c.address || '', companyPhone: c.phone || '',
      gstin: c.gstin || '', bankDetails: c.bankDetails || '',
      customerName: '', customerAddress: '', customerPhone: '',
      quotationNumber: 'Auto-generated',
      date: today(),
      projectName: '',
      sections: [emptySection('General')],
      discount: '',
      packageName: '', packageDescription: '',
      inclusions: [''],
      exclusions: [],
      showExclusions: false,
      basePrice: '',
      gstPercent: 18,
      terms: '',
      notes: '',
    })
    setQuotationType('breakdown')
  }

  /* ── Convert breakdown to fixed */
  const convertToFixed = () => {
    const allSectItems = (form.sections || []).flatMap(s => s.items || [])
    const validItems = allSectItems.filter(i => i.description)
    const total = validItems.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.rate || 0), 0)
    const autoInclusions = validItems.map(i => `${i.quantity} ${i.unit} ${i.description}`)
    setForm(prev => ({
      ...prev,
      basePrice: String(Math.round(total)),
      inclusions: autoInclusions.length ? autoInclusions : [''],
      exclusions: [],
      packageName: '',
      packageDescription: '',
      terms: FIXED_TERMS,
    }))
    setQuotationType('fixed')
    showToast?.('Converted to Fixed Quotation! Review the details below.', 'info', 'Converted')
  }

  /* ✨ Save Quotation */
  const handleDownload = async () => {
    if (!form.customerName.trim()) {
      showToast?.('Please enter customer name before generating', 'warning', 'Missing Info')
      return
    }

    const payload = { ...form, type: quotationType, subtotal, discount, grandTotal }

    try {
      const savedQuotation = await backendFetch('/quotations', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      setQuotations(prev => [savedQuotation, ...prev])
      showToast?.(`Quotation saved to history`, 'success', 'Generated')
    } catch (err) {
      showToast?.(err.message, 'error')
    }
  }

  const convertToBill = (q) => {
    localStorage.setItem('opsagent_convert_quotation', JSON.stringify(q))
    onNavigate('billing')
  }

  const changeStatus = async (id, status) => {
    setQuotations(prev => prev.map(q => q.id === id ? { ...q, status } : q))
    try { await backendFetch(`/quotations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }) }
    catch (err) { console.error(err) }
  }

  const deleteQuotation = async (id) => {
    if (!window.confirm('Delete this quotation from history?')) return
    setQuotations(prev => prev.filter(q => q.id !== id))
    showToast?.('Quotation deleted', 'info', 'Deleted')
    try { await backendFetch(`/quotations/${id}`, { method: 'DELETE' }) }
    catch (err) { console.error(err) }
  }

  const redownload = (q) => {
    const pdfData = { ...q, ...company, companyName: company.name || q.companyName }
    if (q.type === 'fixed') {
      generateFixedPDF(pdfData)
    } else {
      generateBreakdownPDF(pdfData)
    }
    showToast?.(`Re-downloaded ${generateFilename(q.customerName, q.date)}`, 'success', 'PDF Downloaded')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', paddingBottom: '60px' }}>
      {/* Company setup banner */}
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
            <button onClick={() => { if (typeof onNavigate === 'function') onNavigate('settings') }} style={{ height: '32px', padding: '0 14px', borderRadius: '7px', background: '#D97706', color: 'white', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>Go to Settings →</button>
            <button onClick={() => setBannerDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400E', padding: '4px', fontSize: '16px' }}>✕</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: 0, fontFamily: "'Inter', sans-serif" }}>Quotation Generator</h2>
          <p style={{ fontSize: '14px', color: '#64748B', marginTop: '4px' }}>Create professional quotations and export as PDF</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Type selector */}
        <QuotationTypeSelector value={quotationType} onChange={setQuotationType} />

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

        {/* Type-specific form */}
        {quotationType === 'breakdown' ? (
          <>
            <BreakdownForm form={form} setForm={setForm} inventory={inventory} />
            {/* Terms (Breakdown) */}
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <SectionHead icon={FileCheck} title="Terms & Conditions (optional)" color="#7C3AED" />
              <textarea style={{ ...inp, resize: 'vertical', minHeight: '100px', lineHeight: 1.7 }} value={form.terms} onChange={e => setField('terms', e.target.value)} placeholder="Enter any terms and conditions here..." rows={5} />
            </div>
          </>
        ) : (
          <FixedForm form={form} setForm={setForm} />
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end', paddingBottom: '16px', alignItems: 'center' }}>
          {quotationType === 'breakdown' && (
            <button
              onClick={convertToFixed}
              className="btn-press"
              style={{ height: '44px', padding: '0 18px', borderRadius: '10px', background: 'white', color: '#7C3AED', border: '2px solid #7C3AED', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <ArrowRight size={15} /> Convert to Fixed Quote
            </button>
          )}
          <button
            onClick={resetForm}
            className="btn-press"
            style={{ height: '44px', padding: '0 18px', borderRadius: '10px', background: 'white', color: '#64748B', border: '1px solid #E2E8F0', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RotateCcw size={15} /> Reset
          </button>
          <button
            onClick={handleDownload}
            className="btn-press"
            style={{ height: '44px', padding: '0 22px', borderRadius: '10px', background: 'linear-gradient(135deg,#16A34A,#15803D)', color: 'white', border: 'none', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}
          >
            <FileCheck size={16} /> Generate Quotation
          </button>
        </div>

        {/* Quotation History */}
        <QuotationHistory
          quotations={quotations}
          onChangeStatus={changeStatus}
          onRedownload={redownload}
          onDelete={deleteQuotation}
        />
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        select option { background: white; color: #0F172A; }
      `}</style>
    </div>
  )
}

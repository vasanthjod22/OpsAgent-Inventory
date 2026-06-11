import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'

// Export to Excel
export const exportToExcel = (
  data, 
  filename, 
  sheetName = 'Report'
) => {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const buf = XLSX.write(wb, { 
    bookType: 'xlsx', 
    type: 'array' 
  })
  saveAs(
    new Blob([buf], {
      type: 'application/octet-stream'
    }),
    `${filename}.xlsx`
  )
}

// Export table to PDF
export const exportToPDF = (
  title,
  headers,
  rows,
  filename
) => {
  const doc = new jsPDF('landscape', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, pageWidth, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 13)
  doc.setFontSize(9)
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-IN')}`,
    pageWidth - 14, 13,
    { align: 'right' }
  )

  // Table headers
  let y = 30
  const colWidth = (pageWidth - 28) / headers.length

  doc.setFillColor(37, 99, 235)
  doc.rect(14, y - 6, pageWidth - 28, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  headers.forEach((h, i) => {
    doc.text(h, 14 + i * colWidth + 2, y)
  })

  // Table rows
  rows.forEach((row, rowIdx) => {
    y += 10
    if (y > 185) {
      doc.addPage()
      y = 20
    }
    if (rowIdx % 2 === 0) {
      doc.setFillColor(248, 250, 252)
      doc.rect(14, y - 6, pageWidth - 28, 9, 'F')
    }
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'normal')
    row.forEach((cell, i) => {
      doc.text(
        String(cell || '—').substring(0, 25),
        14 + i * colWidth + 2, y
      )
    })
  })

  // Footer
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFillColor(15, 23, 42)
    doc.rect(0, 195, pageWidth, 10, 'F')
    doc.setTextColor(148, 163, 184)
    doc.setFontSize(7)
    doc.text(
      `OpsAgent | ${title} | Page ${i} of ${pages}`,
      pageWidth / 2, 201,
      { align: 'center' }
    )
  }

  doc.save(`${filename}.pdf`)
}

// Format currency
export const fmtCurrency = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`

// Format date
export const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

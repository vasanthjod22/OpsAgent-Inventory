import jsPDF from 'jspdf'

export const generateBillPDF = (bill, company = {}) => {
  const doc = new jsPDF()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Tax Invoice', 105, 20, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  
  doc.text(`Company: ${company.name || 'Your Company'}`, 14, 30)
  doc.text(`Bill No: ${bill.bill_number}`, 14, 40)
  doc.text(`Customer: ${bill.customer_name || 'Walk-in'}`, 14, 48)
  doc.text(`Date: ${new Date(bill.created_at).toLocaleDateString('en-IN')}`, 14, 56)

  let y = 70
  doc.setFont('helvetica', 'bold')
  doc.text('Item', 14, y)
  doc.text('Qty', 100, y)
  doc.text('Rate', 140, y)
  doc.text('Amount', 170, y)

  y += 6
  doc.setFont('helvetica', 'normal')
  const items = bill.items || []
  items.forEach(item => {
    doc.text((item.description || item.name || '').substring(0, 30), 14, y)
    doc.text(String(item.quantity || 0), 100, y)
    doc.text(String(item.rate || 0), 140, y)
    doc.text(String(item.amount || 0), 170, y)
    y += 6
  })

  y += 10
  doc.setFont('helvetica', 'bold')
  doc.text(`Grand Total: INR ${bill.grand_total}`, 14, y)
  
  doc.save(`Bill_${bill.bill_number}.pdf`)
}

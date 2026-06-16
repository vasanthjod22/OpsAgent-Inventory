export const downloadTemplate = () => {
  const headers = ['HSN', 'Item Name', 'Category', 'Current Qty', 'Unit', 'Min Level', 'Max Level']
  const sampleRows = [
    ['HYD-FLT-001', 'Hydraulic Oil Filter 10 Micron', 'Filters', '20', 'Nos', '10', '50'],
    ['ENG-OIL-SAE', 'Engine Oil SAE 15W-40', 'Lubricants', '45', 'Ltrs', '20', '100'],
  ]
  const csvContent = [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'OpsAgent_Inventory_Template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export const parseRows = (rawRows) => {
  if (!rawRows || rawRows.length < 2) throw new Error('File is empty or has no data rows')
  const headers = rawRows[0].map(h => String(h ?? '').trim().toLowerCase())
  const headerMap = {
    hsn:      ['hsn', 'sku', 'item code', 'code', 'id'],
    name:     ['item name', 'name', 'description', 'item'],
    category: ['category', 'cat', 'type'],
    qty:      ['current qty', 'qty', 'quantity', 'stock'],
    unit:     ['unit', 'uom', 'unit of measure'],
    min:      ['min level', 'min', 'minimum', 'reorder point'],
    max:      ['max level', 'max', 'maximum'],
  }
  const getIndex = (variants) => {
    for (const v of variants) {
      const idx = headers.indexOf(v)
      if (idx !== -1) return idx
    }
    return -1
  }
  const col = {
    hsn: getIndex(headerMap.hsn), name: getIndex(headerMap.name), category: getIndex(headerMap.category),
    qty: getIndex(headerMap.qty), unit: getIndex(headerMap.unit), min: getIndex(headerMap.min), max: getIndex(headerMap.max),
  }
  if (col.hsn === -1 || col.name === -1) throw new Error('Could not find HSN or Name column.')
  return rawRows.slice(1).map((vals) => {
    const g = (i, fallback = '') => i !== -1 ? String(vals[i] ?? fallback).trim() : fallback
    const n = (i, fallback = 0) => i !== -1 ? Number(vals[i] ?? fallback) : fallback
    const row = { hsn: g(col.hsn), name: g(col.name), category: g(col.category, 'General') || 'General', qty: n(col.qty), unit: g(col.unit, 'Nos') || 'Nos', min: n(col.min), max: n(col.max, 100), rowErrors: [] }
    if (!row.hsn) row.rowErrors.push('HSN is required')
    if (!row.name) row.rowErrors.push('Item Name is required')
    return row
  })
}

export const exportCSV = (inventory) => {
  const headers = ['HSN', 'Item Name', 'Category', 'Current Qty', 'Unit', 'Min Level', 'Max Level']
  const rows = inventory.map(i => [i.hsn, `"${i.name}"`, i.category || '', i.qty, i.unit || '', i.min, i.max].join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `OpsAgent_Inventory_Export.csv`
  a.click()
  URL.revokeObjectURL(url)
}

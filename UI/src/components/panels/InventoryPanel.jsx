import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import {
  Search, Plus, X, Package, Trash2, Edit2,
  AlertTriangle, AlertCircle, Upload, Download,
  CheckCircle, XCircle, CloudUpload, FileText,
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'

/* ─── CSV Template Download ─────────────────────────────────── */
const downloadTemplate = () => {
  const headers = ['SKU', 'Item Name', 'Category', 'Current Qty', 'Unit', 'Min Level', 'Max Level']
  const sampleRows = [
    ['HYD-FLT-001', 'Hydraulic Oil Filter 10 Micron', 'Filters', '20', 'Nos', '10', '50'],
    ['ENG-OIL-SAE', 'Engine Oil SAE 15W-40', 'Lubricants', '45', 'Ltrs', '20', '100'],
    ['AIR-FLT-JCB', 'Air Filter JCB 3DX', 'Filters', '10', 'Nos', '5', '20'],
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

/* ─── Parse rows (shared by CSV + XLSX) ─────────────────────── */
const parseRows = (rawRows) => {
  if (!rawRows || rawRows.length < 2) throw new Error('File is empty or has no data rows')

  const headers = rawRows[0].map(h => String(h ?? '').trim().toLowerCase())
  const headerMap = {
    sku:      ['sku', 'item code', 'code', 'id'],
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
    sku:      getIndex(headerMap.sku),
    name:     getIndex(headerMap.name),
    category: getIndex(headerMap.category),
    qty:      getIndex(headerMap.qty),
    unit:     getIndex(headerMap.unit),
    min:      getIndex(headerMap.min),
    max:      getIndex(headerMap.max),
  }

  if (col.sku === -1)  throw new Error('Could not find SKU column. Please use our template.')
  if (col.name === -1) throw new Error('Could not find Item Name column. Please use our template.')

  return rawRows.slice(1).map((vals) => {
    const g = (i, fallback = '') => i !== -1 ? String(vals[i] ?? fallback).trim() : fallback
    const n = (i, fallback = 0) => i !== -1 ? Number(vals[i] ?? fallback) : fallback

    const row = {
      sku:       g(col.sku),
      name:      g(col.name),
      category:  g(col.category, 'General') || 'General',
      qty:       n(col.qty),
      unit:      g(col.unit, 'Nos') || 'Nos',
      min:       n(col.min),
      max:       n(col.max, 100),
      rowErrors: [],
    }

    if (!row.sku)                           row.rowErrors.push('SKU is required')
    if (!row.name)                          row.rowErrors.push('Item Name is required')
    if (isNaN(row.qty) || row.qty < 0)      row.rowErrors.push('Invalid quantity')
    if (isNaN(row.min))                     row.rowErrors.push('Invalid min level')
    if (isNaN(row.max))                     row.rowErrors.push('Invalid max level')
    if (!isNaN(row.min) && !isNaN(row.max) && row.min > row.max)
                                            row.rowErrors.push('Min cannot be greater than Max')
    return row
  })
}

/* ─── Export CSV ─────────────────────────────────────────────── */
const exportCSV = (inventory) => {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const headers = ['SKU', 'Item Name', 'Category', 'Current Qty', 'Unit', 'Min Level', 'Max Level']
  const rows = inventory.map(i => [i.sku, `"${i.name}"`, i.category || '', i.qty, i.unit || '', i.min, i.max].join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `OpsAgent_Inventory_Export_${dd}${mm}${yyyy}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ─── Import Modal ───────────────────────────────────────────── */
function ImportModal({ onClose, inventory, setInventory, showToast }) {
  const fileRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState(null)
  const [parsedRows, setParsedRows] = useState(null)
  const [parseError, setParseError] = useState(null)

  const processFile = useCallback((f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setParseError('Please upload a valid .csv or .xlsx file')
      setParsedRows(null)
      setFile(null)
      return
    }
    setFile(f)
    setParseError(null)
    const reader = new FileReader()

    if (ext === 'csv') {
      reader.onload = (e) => {
        try {
          const text = e.target.result
          const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
          const rawRows = lines.map(line => {
            const values = (line.match(/(".*?"|[^,]+)(?=,|$)/g) || line.split(','))
            return values.map(v => v.replace(/^"|"$/g, '').trim())
          })
          setParsedRows(parseRows(rawRows))
        } catch (err) {
          setParseError(err.message)
          setParsedRows(null)
        }
      }
      reader.readAsText(f)
    } else {
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
          setParsedRows(parseRows(rawRows))
        } catch (err) {
          setParseError(err.message)
          setParsedRows(null)
        }
      }
      reader.readAsArrayBuffer(f)
    }
  }, [])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    processFile(e.dataTransfer.files[0])
  }

  const handleFileChange = (e) => processFile(e.target.files[0])

  const validRows   = parsedRows?.filter(r => r.rowErrors.length === 0) || []
  const errorRows   = parsedRows?.filter(r => r.rowErrors.length > 0)   || []
  const dupSkus     = validRows.filter(r => inventory.some(i => i.sku.toLowerCase() === r.sku.toLowerCase()))
  const previewRows = parsedRows?.slice(0, 5) || []

  const handleImport = () => {
    const newItems = []
    const updatedItems = []

    validRows.forEach(row => {
      const existing = inventory.find(i => i.sku.toLowerCase() === row.sku.toLowerCase())
      if (existing) {
        updatedItems.push({ ...existing, name: row.name, category: row.category, qty: row.qty, unit: row.unit, min: row.min, max: row.max })
      } else {
        newItems.push({ id: Date.now() + Math.random(), sku: row.sku, name: row.name, category: row.category, qty: row.qty, unit: row.unit, min: row.min, max: row.max })
      }
    })

    const merged = inventory.map(item => updatedItems.find(u => u.sku === item.sku) || item)
    setInventory([...merged, ...newItems])
    backendFetch('/inventory/import', { 
      method: 'POST', 
      body: JSON.stringify({ items: [...updatedItems, ...newItems] }) 
    }).catch(console.error)

    const msg = errorRows.length > 0
      ? `Import Complete — ${newItems.length} new, ${updatedItems.length} updated, ${errorRows.length} rows skipped`
      : `Import Complete — ${newItems.length} new items added, ${updatedItems.length} updated`
    const type = errorRows.length > 0 ? 'warning' : 'success'
    showToast?.(msg, type, 'CSV Import')
    onClose()
  }

  const fmtSize = (bytes) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', overflowY: 'auto' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '720px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFBFC' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={18} color="#2563EB" />
            </div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A' }}>Import Inventory from CSV</div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>Upload a CSV or XLSX file to add or update inventory items</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Section 1 — Download Template */}
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <FileText size={16} color="#2563EB" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E40AF' }}>Download our CSV template</div>
                <div style={{ fontSize: '12px', color: '#3B82F6', marginTop: '2px' }}>Ensure your data imports correctly by using the official format — works with CSV and Excel</div>
              </div>
            </div>
            <button onClick={downloadTemplate} style={{ height: '34px', padding: '0 14px', borderRadius: '8px', background: 'white', color: '#2563EB', border: '1.5px solid #93C5FD', fontWeight: 600, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, whiteSpace: 'nowrap' }}>
              <Download size={13} /> Download Template
            </button>
          </div>

          {/* Section 2 — Upload Area */}
          <div>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? '#2563EB' : file ? '#16A34A' : '#CBD5E1'}`, borderRadius: '12px', padding: '32px 24px', textAlign: 'center', cursor: 'pointer', background: dragOver ? '#EFF6FF' : file ? '#F0FDF4' : '#FAFBFC', transition: 'all 0.2s' }}
            >
              {file ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={32} color="#16A34A" />
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '14px' }}>{file.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>{fmtSize(file.size)} · Click to change file</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <CloudUpload size={36} color={dragOver ? '#2563EB' : '#94A3B8'} />
                  <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '14px' }}>Drop your CSV or Excel file here</div>
                  <div style={{ fontSize: '13px', color: '#64748B' }}>or <span style={{ color: '#2563EB', textDecoration: 'underline' }}>click to browse</span></div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Accepts .csv and .xlsx files</div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} style={{ display: 'none' }} />
          </div>

          {/* Parse Error */}
          {parseError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <XCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div style={{ fontSize: '13px', color: '#B91C1C', fontWeight: 500 }}>{parseError}</div>
            </div>
          )}

          {/* Section 3 — Preview */}
          {parsedRows && parsedRows.length > 0 && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
                Preview <span style={{ color: '#94A3B8', fontWeight: 400 }}>(first {previewRows.length} of {parsedRows.length} rows)</span>
              </div>
              <div style={{ borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#0F172A' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'center', color: 'white', width: '32px' }}></th>
                        {['SKU', 'Name', 'Category', 'Qty', 'Unit', 'Min', 'Max'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'white', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, idx) => {
                        const isValid = row.rowErrors.length === 0
                        return (
                          <tr key={idx} style={{ background: isValid ? 'white' : '#FEF2F2', borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span title={isValid ? 'Valid' : row.rowErrors.join(', ')}>
                                {isValid
                                  ? <CheckCircle size={14} color="#16A34A" />
                                  : <XCircle size={14} color="#DC2626" />
                                }
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', color: '#64748B', fontWeight: 500 }}>{row.sku || <span style={{ color: '#DC2626' }}>—</span>}</td>
                            <td style={{ padding: '8px 10px', color: '#0F172A' }}>{row.name || <span style={{ color: '#DC2626' }}>—</span>}</td>
                            <td style={{ padding: '8px 10px', color: '#64748B' }}>{row.category}</td>
                            <td style={{ padding: '8px 10px', color: '#0F172A', fontWeight: 600 }}>{row.qty}</td>
                            <td style={{ padding: '8px 10px', color: '#64748B' }}>{row.unit}</td>
                            <td style={{ padding: '8px 10px', color: '#64748B' }}>{row.min}</td>
                            <td style={{ padding: '8px 10px', color: '#64748B' }}>{row.max}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Error messages */}
              {previewRows.filter(r => r.rowErrors.length > 0).map((row, i) => (
                <div key={i} style={{ marginTop: '6px', fontSize: '11px', color: '#DC2626' }}>
                  Row {parsedRows.indexOf(row) + 2}: {row.rowErrors.join(' · ')}
                </div>
              ))}
              {errorRows.length > 0 && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#DC2626', fontWeight: 500 }}>
                  {errorRows.length} row{errorRows.length > 1 ? 's' : ''} will be skipped due to errors
                </div>
              )}
            </div>
          )}

          {/* Section 4 — Import Summary */}
          {parsedRows && parsedRows.length > 0 && (
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>{parsedRows.length}</div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Total Rows</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#16A34A' }}>{validRows.length}</div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Valid Rows</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#DC2626' }}>{errorRows.length}</div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>With Errors</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#D97706' }}>{dupSkus.length}</div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Duplicates</div>
                {dupSkus.length > 0 && <div style={{ fontSize: '10px', color: '#D97706', marginTop: '2px' }}>will be updated</div>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} style={{ height: '40px', padding: '0 18px', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'white', fontWeight: 600, fontSize: '13px', color: '#64748B', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!validRows.length}
            style={{ height: '40px', padding: '0 20px', borderRadius: '8px', border: 'none', background: validRows.length ? '#2563EB' : '#CBD5E1', color: 'white', fontWeight: 700, fontSize: '13px', cursor: validRows.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: validRows.length ? '0 4px 12px rgba(37,99,235,0.3)' : 'none', transition: 'all 0.2s' }}
          >
            <Upload size={15} />
            Import {validRows.length > 0 ? `${validRows.length} Items` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main InventoryPanel ────────────────────────────────────── */
export default function InventoryPanel({ inventory = [], setInventory, showToast }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [adding, setAdding] = useState(false)
  const [editingItemSku, setEditingItemSku] = useState(null)
  const [newItem, setNewItem] = useState({ sku: '', name: '', category: 'Raw Materials', qty: '', unit: '', min: '', max: '' })
  const [showImport, setShowImport] = useState(false)

  const defaultCategories = ['Raw Materials', 'Finished Goods', 'Packaging', 'Consumables']
  const categories = Array.from(new Set([...defaultCategories, ...inventory.map(i => i.category).filter(Boolean)]))

  const getStatus = (item) => {
    if (item.qty < item.min) return 'Low Stock'
    if (item.qty > item.max) return 'Overstock'
    return 'OK'
  }

  const handleDelete = async (sku) => {
    setInventory(prev => prev.filter(i => i.sku !== sku))
    showToast?.(`Item ${sku} deleted`, 'success')
    try {
      await backendFetch(`/inventory/${sku}`, { method: 'DELETE' })
    } catch (err) {
      showToast?.(err.message, 'error')
    }
  }

  const enriched = inventory.map(item => ({ ...item, status: getStatus(item) }))
  const filtered = enriched.filter(item => {
    if (filter !== 'All' && item.status !== filter) return false
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !item.sku.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleAddClick = () => {
    setNewItem({ sku: '', name: '', category: 'Raw Materials', qty: '', unit: '', min: '', max: '' })
    setEditingItemSku(null)
    setAdding(true)
  }

  const handleEditClick = (item) => {
    setNewItem({ ...item })
    setEditingItemSku(item.sku)
    setAdding(true)
  }

  const handleAdd = async () => {
    if (!newItem.sku || !newItem.name) return showToast?.('SKU and Name are required', 'error')
    
    const processedItem = { ...newItem, qty: Number(newItem.qty) || 0, min: Number(newItem.min) || 0, max: Number(newItem.max) || 0 };

    if (editingItemSku) {
      setInventory(prev => prev.map(i => i.sku === editingItemSku ? processedItem : i))
      showToast?.('Item updated successfully', 'success')
      backendFetch(`/inventory/${editingItemSku}`, { method: 'PUT', body: JSON.stringify(processedItem) }).catch(console.error)
    } else {
      setInventory(prev => [processedItem, ...prev])
      showToast?.('Item added successfully', 'success')
      backendFetch(`/inventory`, { method: 'POST', body: JSON.stringify(processedItem) }).catch(err => showToast?.(err.message, 'error'))
    }
    
    setAdding(false)
    setEditingItemSku(null)
    setNewItem({ sku: '', name: '', category: 'Raw Materials', qty: '', unit: '', min: '', max: '' })
  }

  const handleExport = () => {
    if (inventory.length === 0) return showToast?.('No inventory to export', 'warning')
    exportCSV(inventory)
    showToast?.(`Exported ${inventory.length} items`, 'success', 'CSV Export')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', fontFamily: "'Inter', sans-serif" }}>Inventory</h2>
          <span className="badge badge-gray">{enriched.length} items</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} className="input-base" style={{ paddingLeft: '36px' }} />
          </div>
          {/* Export CSV */}
          <button
            onClick={handleExport}
            className="btn-press"
            style={{ height: '40px', padding: '0 14px', background: 'white', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
          >
            <Download size={15} /> Export CSV
          </button>
          {/* Import CSV */}
          <button
            onClick={() => setShowImport(true)}
            className="btn-press"
            style={{ height: '40px', padding: '0 14px', background: 'white', color: '#2563EB', border: '1.5px solid #93C5FD', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
          >
            <Upload size={15} /> Import CSV
          </button>
          {/* Add Item */}
          <button onClick={handleAddClick} className="btn-press" style={{ height: '40px', padding: '0 16px', background: '#2563EB', color: 'white', borderRadius: '8px', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="glass-card hover-up" style={{ padding: '16px', background: 'rgba(239, 246, 255, 0.6)', border: '1px solid #BFDBFE', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', background: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={16} color="#2563EB" /></div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E3A8A' }}>Total SKUs</span>
          </div>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#1E3A8A' }}>{enriched.length}</span>
        </div>
        <div className="glass-card hover-up" style={{ padding: '16px', background: 'rgba(254, 242, 242, 0.6)', border: '1px solid #FECACA', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', background: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={16} color="#DC2626" /></div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#7F1D1D' }}>Low Stock</span>
          </div>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#7F1D1D' }}>{enriched.filter(i => i.status === 'Low Stock').length}</span>
        </div>
        <div className="glass-card hover-up" style={{ padding: '16px', background: 'rgba(255, 251, 235, 0.6)', border: '1px solid #FDE68A', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', background: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={16} color="#D97706" /></div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#78350F' }}>Overstock</span>
          </div>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#78350F' }}>{enriched.filter(i => i.status === 'Overstock').length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card hover-up" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>SKU</th><th>Item Name</th><th>Category</th><th>Current Qty</th><th>Min/Max</th><th style={{ textAlign: 'center' }}>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {filtered.map(item => {
                const pct = Math.min((item.qty / (item.max || 1)) * 100, 100)
                const isLow = item.status === 'Low Stock'
                return (
                  <tr key={item.sku} style={{ borderLeft: isLow ? '3px solid #DC2626' : '3px solid transparent' }}>
                    <td style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>{item.sku}</td>
                    <td style={{ fontWeight: 600, color: '#0F172A' }}>{item.name}</td>
                    <td style={{ color: '#64748B' }}>{item.category}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: '#0F172A' }}>{item.qty} <span style={{ fontWeight: 400, color: '#94A3B8' }}>{item.unit}</span></span>
                        <div style={{ width: '100px', height: '4px', background: '#F1F5F9', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: isLow ? '#DC2626' : item.status === 'Overstock' ? '#D97706' : '#16A34A', borderRadius: '99px' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ color: '#94A3B8', fontSize: '13px' }}>{item.min} / {item.max}</td>
                    <td style={{ textAlign: 'center' }}><span className={`badge ${isLow ? 'badge-red' : item.status === 'Overstock' ? 'badge-amber' : 'badge-green'}`}>{item.status}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                        <button onClick={() => handleEditClick(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: '4px' }} onMouseEnter={e => e.currentTarget.style.color = '#2563EB'} onMouseLeave={e => e.currentTarget.style.color = '#CBD5E1'}><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(item.sku)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: '4px' }} onMouseEnter={e => e.currentTarget.style.color = '#DC2626'} onMouseLeave={e => e.currentTarget.style.color = '#CBD5E1'}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: '64px 0', textAlign: 'center', color: '#94A3B8' }}>No items found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {adding && (
        <div className="modal-in" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>{editingItemSku ? 'Edit Item' : 'Add New Item'}</h3>
              <button onClick={() => { setAdding(false); setEditingItemSku(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Item Name</label>
                <input type="text" className="input-base" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} placeholder="e.g. Hydraulic Filter" autoFocus />
              </div>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>SKU / Code</label><input type="text" className="input-base" value={newItem.sku} onChange={e => setNewItem({ ...newItem, sku: e.target.value })} /></div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Category</label>
                <input list="category-options" className="input-base" value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} placeholder="Select or type..." />
                <datalist id="category-options">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Current Qty</label><input type="number" className="input-base" value={newItem.qty} onChange={e => setNewItem({ ...newItem, qty: e.target.value })} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Unit</label><input type="text" className="input-base" value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Min Level</label><input type="number" className="input-base" value={newItem.min} onChange={e => setNewItem({ ...newItem, min: e.target.value })} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Max Level</label><input type="number" className="input-base" value={newItem.max} onChange={e => setNewItem({ ...newItem, max: e.target.value })} /></div>
            </div>
            <div style={{ padding: '16px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => { setAdding(false); setEditingItemSku(null) }} className="btn-press" style={{ padding: '0 16px', height: '40px', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'white', fontWeight: 600, fontSize: '13px', color: '#64748B', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAdd} className="btn-press" style={{ padding: '0 16px', height: '40px', borderRadius: '8px', border: 'none', background: '#2563EB', fontWeight: 600, fontSize: '13px', color: 'white', cursor: 'pointer' }}>{editingItemSku ? 'Save Changes' : 'Add Item'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          inventory={inventory}
          setInventory={setInventory}
          showToast={showToast}
        />
      )}
    </div>
  )
}

import { useState, useRef, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'
import * as pdfjsLib from 'pdfjs-dist'
import {
  Search, Plus, X, Package, Trash2, Edit2,
  AlertTriangle, AlertCircle, Upload, Download,
  CheckCircle, XCircle, CloudUpload, FileText, ChevronDown, Check,
  Camera, FileImage, Bot, ScanLine, SearchX, Pencil, TrendingUp, ChevronUp, Loader2
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import { callVisionAI } from '../../utils/api'
import ConfirmModal from '../ConfirmModal'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

async function convertPdfToBase64Image(base64Pdf) {
  const raw = atob(base64Pdf)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)

  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
  const page = await pdf.getPage(1)

  const scale = 2.0
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise

  const dataUrl = canvas.toDataURL('image/png')
  return dataUrl.split(',')[1]
}

const HEADER_FIELDS = ['supplier_name', 'po_number', 'date']
const ITEM_FIELDS   = ['hsn', 'description', 'quantity', 'unit_price']
const fieldLabel = (f) => f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

/* ─── Action Button ───────────────────────────────────── */
const ActionButton = ({ color, hoverColor, icon, tooltip, onClick }) => (
  <button
    onClick={onClick}
    title={tooltip}
    style={{
      width: 32, height: 32, borderRadius: 6, background: color, border: 'none',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s ease', color: 'white'
    }}
    onMouseEnter={e => e.target.style.background = hoverColor}
    onMouseLeave={e => e.target.style.background = color}
  >
    {icon}
  </button>
)

/* ─── Pagination Component ───────────────────────────────────── */
const PageBtn = ({ children, active, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: 32, height: 32, borderRadius: 6,
      border: active ? 'none' : '1px solid #E2E8F0',
      background: active ? '#2563EB' : 'white',
      color: active ? 'white' : disabled ? '#CBD5E1' : '#374151',
      fontSize: 13, fontWeight: active ? 600 : 400,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s ease',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}
  >
    {children}
  </button>
)

const Pagination = ({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange, onLimitChange }) => {
  const getPageNumbers = () => {
    const pages = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      const start = Math.max(2, currentPage-1)
      const end = Math.min(totalPages-1, currentPage+1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  const startItem = (currentPage-1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  if (totalItems === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderTop: '1px solid #E2E8F0' }}>
      <span style={{ fontSize: 13, color: '#0F172A' }}>
        Showing {startItem}–{endItem} of <strong>{totalItems}</strong> items
      </span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <PageBtn onClick={() => onPageChange(1)} disabled={currentPage === 1}>«</PageBtn>
        <PageBtn onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>‹</PageBtn>
        {getPageNumbers().map((page, i) => (
          page === '...' ? (
            <span key={i} style={{ padding: '0 8px', color: '#1E293B' }}>...</span>
          ) : (
            <PageBtn key={i} active={page === currentPage} onClick={() => onPageChange(page)}>{page}</PageBtn>
          )
        ))}
        <PageBtn onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>›</PageBtn>
        <PageBtn onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages}>»</PageBtn>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#0F172A' }}>Per page:</span>
        <select
          value={itemsPerPage}
          onChange={e => onLimitChange(Number(e.target.value))}
          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 13, color: '#0F172A', outline: 'none' }}
        >
          {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  )
}


/* ─── CSV Template Download ─────────────────────────────────── */
const downloadTemplate = () => {
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

const parseRows = (rawRows) => {
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
  if (col.hsn === -1 || col.name === -1) throw new Error('Could not find SKU or Name column.')
  return rawRows.slice(1).map((vals) => {
    const g = (i, fallback = '') => i !== -1 ? String(vals[i] ?? fallback).trim() : fallback
    const n = (i, fallback = 0) => i !== -1 ? Number(vals[i] ?? fallback) : fallback
    const row = { hsn: g(col.hsn), name: g(col.name), category: g(col.category, 'General') || 'General', qty: n(col.qty), unit: g(col.unit, 'Nos') || 'Nos', min: n(col.min), max: n(col.max, 100), rowErrors: [] }
    if (!row.hsn) row.rowErrors.push('HSN is required')
    if (!row.name) row.rowErrors.push('Item Name is required')
    return row
  })
}

const exportCSV = (inventory) => {
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

function ImportModal({ onClose, fetchInventory, showToast }) {
  const internalRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState(null)
  const [parsedRows, setParsedRows] = useState(null)
  const [parseError, setParseError] = useState(null)

  const processFile = useCallback((f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setParseError('Please upload a valid .csv or .xlsx file')
      return
    }
    setFile(f); setParseError(null)
    const reader = new FileReader()
    if (ext === 'csv') {
      reader.onload = (e) => {
        try {
          const lines = e.target.result.split('\n').map(l => l.trim()).filter(l => l)
          const rawRows = lines.map(line => (line.match(/(".*?"|[^,]+)(?=,|$)/g) || line.split(',')).map(v => v.replace(/^"|"$/g, '').trim()))
          setParsedRows(parseRows(rawRows))
        } catch (err) { setParseError(err.message) }
      }
      reader.readAsText(f)
    } else {
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
          setParsedRows(parseRows(rawRows))
        } catch (err) { setParseError(err.message) }
      }
      reader.readAsArrayBuffer(f)
    }
  }, [])

  const handleImport = async () => {
    const validRows = parsedRows?.filter(r => r.rowErrors.length === 0) || []
    if (!validRows.length) return
    try {
      await backendFetch('/inventory/import', { method: 'POST', body: JSON.stringify({ items: validRows }) })
      showToast?.(`Import Complete — ${validRows.length} new items added`, 'success', 'CSV Import')
      fetchInventory()
      onClose()
    } catch(e) { showToast?.(e.message, 'error') }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 600, padding: 24 }}>
        <h3 style={{marginTop:0}}>Import Inventory</h3>
        <button onClick={downloadTemplate} style={{marginBottom: 16}}>Download Template</button>
        <div style={{ border: '2px dashed #ccc', padding: 32, textAlign: 'center', cursor: 'pointer' }} onClick={() => internalRef.current?.click()}>
          {file ? file.name : 'Click to select CSV/XLSX'}
          <input ref={internalRef} type="file" accept=".csv,.xlsx" onChange={e => processFile(e.target.files[0])} style={{display:'none'}} />
        </div>
        {parseError && <div style={{color:'red', marginTop:10}}>{parseError}</div>}
        {parsedRows && <div style={{marginTop: 10}}>{parsedRows.length} rows parsed. {parsedRows.filter(r=>r.rowErrors.length>0).length} errors.</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleImport} style={{ background: '#2563EB', color: 'white' }}>Import Valid Rows</button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main InventoryPanel ────────────────────────────────────── */
export default function InventoryPanel({ showToast }) {
  // Inventory States
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 12 })
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [categories, setCategories] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(false)
  const formatQty = (q) => {
    const num = Number(q)
    if (isNaN(num)) return q
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 3 }).format(num)
  }
  
  // Modals
  const [adding, setAdding] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)
  const [newItem, setNewItem] = useState({ hsn: '', name: '', category: 'Raw Materials', qty: '', unit: '', min: '', max: '' })
  const [confirmModal, setConfirmModal] = useState(null)
  const [showImport, setShowImport] = useState(false)
  
  // GRN States
  const [grnExpanded, setGrnExpanded] = useState(false)
  const grnFileRef = useRef()
  const [grnDragging, setGrnDragging] = useState(false)
  const [grnFile, setGrnFile] = useState(null)
  const [grnBase64, setGrnBase64] = useState('')
  const [grnFileType, setGrnFileType] = useState('')
  const [grnLoading, setGrnLoading] = useState(false)
  const [grnData, setGrnData] = useState(null)
  const [grnError, setGrnError] = useState(null)
  const [grnApproving, setGrnApproving] = useState(false)
  const [grnHistory, setGrnHistory] = useState([])

  const tableRef = useRef(null)

  // Fetch Inventory
  const fetchInventory = async (params = {}) => {
    setLoading(true)
    try {
      const {
        page = pagination.currentPage,
        limit = pagination.itemsPerPage,
        searchTerm = search,
        cat = category,
        stat = status,
        sort = sortBy
      } = params

      const queryParams = new URLSearchParams({
        page, limit, search: searchTerm, category: cat, status: stat, sortBy: sort
      })

      const data = await backendFetch(`/inventory?${queryParams}`)
      if (Array.isArray(data)) {
        // Fallback for old backend
        data.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        setItems(data)
        setPagination(prev => ({ ...prev, currentPage: page, totalItems: data.length, totalPages: Math.ceil(data.length / prev.itemsPerPage) }))
        setStats({
          totalItems: data.length,
          lowStock: data.filter(i => i.qty <= i.min && i.qty > 0).length,
          outOfStock: data.filter(i => i.qty === 0).length,
          totalValue: data.reduce((sum, i) => sum + (i.qty * (i.rate || 0)), 0)
        })
      } else {
        setItems(data.items || [])
        setPagination(data.pagination || {})
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInventory({ page: 1, searchTerm: search })
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  // Filters & Page Size change
  useEffect(() => {
    fetchInventory({ page: 1 })
  }, [category, status, sortBy, pagination.itemsPerPage])

  const handlePageChange = (newPage) => {
    fetchInventory({ page: newPage })
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const fetchCategories = async () => {
    try {
      const data = await backendFetch('/inventory/categories')
      setCategories(data.categories || [])
    } catch (e) { console.error(e) }
  }

  const fetchStats = async () => {
    try {
      const data = await backendFetch('/inventory/stats')
      setStats(data || {})
    } catch (e) { console.error(e) }
  }

  const fetchGrnHistory = async () => {
    try {
      const data = await backendFetch('/grn')
      if (Array.isArray(data)) setGrnHistory(data.slice(0, 5))
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    fetchCategories()
    fetchStats()
    fetchGrnHistory()
  }, [])

  // Action Handlers
  const handleEditClick = (item) => {
    setNewItem({ ...item })
    setEditingItemId(item.id)
    setAdding(true)
  }

  const handleDamage = (item) => {
    setConfirmModal({
      title: 'Mark as Damaged',
      message: `Are you sure you want to deduct 1 quantity from ${item.name} for damage?`,
      confirmLabel: 'Confirm Damage',
      danger: true,
      onConfirm: async () => {
        try {
          await backendFetch(`/inventory/${item.id}/stock`, { method: 'PATCH', body: JSON.stringify({ delta: -1 }) })
          showToast?.('Item marked as damaged', 'success')
          fetchInventory()
          fetchStats()
        } catch (e) { showToast?.(e.message, 'error') }
        setConfirmModal(null)
      }
    })
  }

  const handleDelete = (item) => {
    setConfirmModal({
      title: 'Delete Item',
      message: `Are you sure you want to completely delete ${item.name}?`,
      confirmLabel: 'Yes, Delete It',
      danger: true,
      onConfirm: async () => {
        try {
          await backendFetch(`/inventory/${item.id}`, { method: 'DELETE' })
          showToast?.('Item deleted', 'success')
          fetchInventory()
          fetchStats()
          fetchCategories()
        } catch (e) { showToast?.(e.message, 'error') }
        setConfirmModal(null)
      }
    })
  }

  const handleAdd = async () => {
    if (!newItem.hsn || !newItem.name) return showToast?.('HSN and Name are required', 'error')
    try {
      const processedItem = { ...newItem, qty: Number(newItem.qty) || 0, min: Number(newItem.min) || 0, max: Number(newItem.max) || 0 };
      if (editingItemId) {
        await backendFetch(`/inventory/${editingItemId}`, { method: 'PUT', body: JSON.stringify(processedItem) })
        showToast?.('Item updated successfully', 'success')
      } else {
        await backendFetch(`/inventory`, { method: 'POST', body: JSON.stringify(processedItem) })
        showToast?.('Item added successfully', 'success')
      }
      setAdding(false)
      fetchInventory()
      fetchStats()
      fetchCategories()
    } catch (e) { showToast?.(e.message, 'error') }
  }

  // GRN Logic
  const processGrnFile = (f) => {
    if (!f) return
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setGrnError('Please upload a PDF, JPG, PNG, or WEBP file.')
      showToast?.('Invalid file format', 'error')
      return
    }
    setGrnFile(f); setGrnFileType(f.type); setGrnData(null); setGrnError(null);
    const reader = new FileReader()
    reader.onload = (e) => setGrnBase64(e.target.result.split(',')[1])
    reader.readAsDataURL(f)
  }

  const extractGrnData = async () => {
    if (!grnBase64) return
    setGrnLoading(true); setGrnError(null); setGrnData(null);
    try {
      let imageBase64 = grnBase64
      let imageMime = grnFileType
      if (grnFileType === 'application/pdf') {
        showToast?.('Converting PDF to image...', 'info')
        imageBase64 = await convertPdfToBase64Image(grnBase64)
        imageMime = 'image/png'
      }
      const parsed = await callVisionAI(null, imageBase64, imageMime)
      if (!parsed.items) parsed.items = []
      setGrnData(parsed)
      showToast?.('Extraction successful', 'success')
    } catch (e) {
      setGrnError(`Vision API Error: ${e.message}`)
      showToast?.('Extraction failed', 'error')
    }
    setGrnLoading(false)
  }

  const handleApproveGrn = async () => {
    setGrnApproving(true)
    try {
      await backendFetch('/grn', {
        method: 'POST',
        body: JSON.stringify({
          supplier: grnData.supplier_name || 'Unknown Supplier',
          po_number: grnData.po_number || undefined,
          date: grnData.date,
          items: grnData.items,
          updateInventory: true
        })
      })
      showToast?.('Stock updated from GRN', 'success')
      setGrnExpanded(false)
      setGrnFile(null); setGrnBase64(''); setGrnData(null);
      fetchInventory()
      fetchStats()
      fetchGrnHistory()
    } catch (err) {
      showToast?.(err.message || 'Failed to approve GRN', 'error')
    } finally {
      setGrnApproving(false)
    }
  }

  // Render Status Badge (Colored Pill)
  const getStatusBadge = (item) => {
    if (item.qty === 0) return <span style={{ padding: '4px 10px', background: '#DC2626', color: 'white', borderRadius: 99, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>⭕ Out of Stock</span>
    if (item.qty < item.min) return <span style={{ padding: '4px 10px', background: '#EA580C', color: 'white', borderRadius: 99, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>⚠️ Low Stock</span>
    if (item.qty > item.max) return <span style={{ padding: '4px 10px', background: '#F5F3FF', color: '#7C3AED', borderRadius: 99, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>📦 Overstock</span>
    return <span style={{ padding: '4px 10px', background: '#16A34A', color: 'white', borderRadius: 99, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>✅ OK</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
      
      {/* SECTION 1: GRN UPLOAD (Collapsible) */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <button
          onClick={() => setGrnExpanded(!grnExpanded)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#F8FAFC', border: 'none', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, background: '#EFF6FF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Upload size={16} color="#2563EB" /></div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Upload Goods Receipt Note (GRN)</span>
          </div>
          {grnExpanded ? <ChevronUp size={20} color="#64748B" /> : <ChevronDown size={20} color="#64748B" />}
        </button>

        {grnExpanded && (
          <div style={{ padding: 24, borderTop: '1px solid #E2E8F0' }}>
            {!grnFile && (
              <div
                onDragOver={e => { e.preventDefault(); setGrnDragging(true) }}
                onDragLeave={() => setGrnDragging(false)}
                onDrop={e => { e.preventDefault(); setGrnDragging(false); processGrnFile(e.dataTransfer.files[0]) }}
                onClick={() => grnFileRef.current?.click()}
                style={{ border: `2px dashed ${grnDragging ? '#2563EB' : '#CBD5E1'}`, borderRadius: 12, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: grnDragging ? '#EFF6FF' : '#FAFBFC' }}
              >
                <CloudUpload size={40} color={grnDragging ? '#2563EB' : '#94A3B8'} style={{ margin: '0 auto 12px auto' }} />
                <div style={{ fontWeight: 600, color: '#0F172A' }}>Drop GRN photo or PDF here</div>
                <div style={{ fontSize: 13, color: '#0F172A', marginTop: 4 }}>Accepts jpg, png, pdf</div>
                <input ref={grnFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => processGrnFile(e.target.files[0])} style={{ display: 'none' }} />
              </div>
            )}

            {grnFile && !grnData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', padding: '20px', border: '1px solid #E2E8F0', borderRadius: 12, background: '#F8FAFC' }}>
                <FileImage size={40} color="#2563EB" />
                <div style={{ fontWeight: 600 }}>{grnFile.name}</div>
                {grnError && <div style={{ color: '#DC2626', fontSize: 13 }}>{grnError}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setGrnFile(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={extractGrnData} disabled={grnLoading} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2563EB', color: 'white', fontWeight: 600, cursor: grnLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {grnLoading ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
                    {grnLoading ? 'Extracting...' : 'Extract Data with AI'}
                  </button>
                </div>
              </div>
            )}

            {grnData && (
              <div>
                <div style={{ padding: 16, border: '1px solid #10B981', background: '#ECFDF5', borderRadius: 12, marginBottom: 20 }}>
                  <h4 style={{ color: '#065F46', margin: '0 0 12px 0', fontSize: 14 }}>Extracted Header</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    {HEADER_FIELDS.map(f => (
                      <div key={f}>
                        <label style={{ fontSize: 11, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>{fieldLabel(f)}</label>
                        <input
                          type="text"
                          value={grnData[f] || ''}
                          onChange={e => setGrnData(p => ({ ...p, [f]: e.target.value }))}
                          style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #A7F3D0', background: 'white', fontSize: 13, marginTop: 4, outlineColor: '#34D399' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#0F172A', color: 'white' }}>{ITEM_FIELDS.map(f => <th key={f} style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{fieldLabel(f)}</th>)}<th style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>Unit</th></tr></thead>
                    <tbody>
                      {grnData.items.map((it, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                          {ITEM_FIELDS.map(f => (
                            <td key={f} style={{ padding: 8 }}>
                              <input type="text" value={it[f] || ''} onChange={e => { const copy = [...grnData.items]; copy[i][f] = e.target.value; setGrnData(p => ({ ...p, items: copy })) }} style={{ width: '100%', padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 13 }} />
                            </td>
                          ))}
                          <td style={{ padding: 8 }}><input type="text" value={it.unit || ''} onChange={e => { const copy = [...grnData.items]; copy[i].unit = e.target.value; setGrnData(p => ({ ...p, items: copy })) }} style={{ width: '60px', padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 13 }} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
                  <button onClick={() => { setGrnData(null); setGrnFile(null) }} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', fontWeight: 600, cursor: 'pointer' }}>Discard</button>
                  <button onClick={handleApproveGrn} disabled={grnApproving} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#16A34A', color: 'white', fontWeight: 600, cursor: grnApproving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {grnApproving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    Approve & Update Stock
                  </button>
                </div>
              </div>
            )}

            {/* GRN History Mini Table */}
            {grnHistory.length > 0 && !grnData && (
              <div style={{ marginTop: 32 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Recent GRNs</h4>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead><tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}><th style={{ padding: '10px 16px', fontWeight: 600 }}>Date</th><th style={{ padding: '10px 16px', fontWeight: 600 }}>Supplier</th><th style={{ padding: '10px 16px', fontWeight: 600 }}>Items</th></tr></thead>
                    <tbody>
                      {grnHistory.map(g => (
                        <tr key={g.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 16px', color: '#0F172A' }}>{new Date(g.date || g.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '10px 16px', fontWeight: 600 }}>{g.supplier}</td>
                          <td style={{ padding: '10px 16px' }}>{g.items?.length || 0} items</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 2: STAT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '20px', background: '#EFF6FF', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' }}>Total Items</span>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#1E3A8A' }}>{stats.totalItems || 0}</span>
          </div>
          <Package size={32} color="#2563EB" style={{ opacity: 0.2 }} />
        </div>
        <div onClick={() => setStatus('low')} style={{ padding: '20px', background: '#FEF2F2', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Low Stock</span>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#991B1B' }}>{stats.lowStock || 0}</span>
          </div>
          <AlertTriangle size={32} color="#DC2626" style={{ opacity: 0.2 }} />
        </div>
        <div onClick={() => setStatus('out')} style={{ padding: '20px', background: '#450A0A', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#FCA5A5', textTransform: 'uppercase' }}>Out of Stock</span>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#FEF2F2' }}>{stats.outOfStock || 0}</span>
          </div>
          <XCircle size={32} color="#FCA5A5" style={{ opacity: 0.2 }} />
        </div>
        <div style={{ padding: '20px', background: '#F0FDF4', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#16A34A', textTransform: 'uppercase' }}>Total Value</span>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#065F46' }}>₹{(stats.totalValue || 0).toLocaleString()}</span>
          </div>
          <TrendingUp size={32} color="#16A34A" style={{ opacity: 0.2 }} />
        </div>
      </div>

      {/* SECTION 3: INVENTORY TABLE */}
      <div ref={tableRef} style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        {/* Header Row */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0 }}>Inventory</h2>
            <span style={{ background: '#EFF6FF', color: '#2563EB', padding: '4px 10px', borderRadius: 99, fontSize: 13, fontWeight: 700 }}>{pagination.totalItems} items</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowImport(true)} style={{ height: 36, padding: '0 16px', borderRadius: 8, background: 'white', color: '#2563EB', border: '1.5px solid #2563EB', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Download size={16} /> Import CSV
            </button>
            <button onClick={() => exportCSV(items)} style={{ height: 36, padding: '0 16px', borderRadius: 8, background: 'white', color: '#16A34A', border: '1.5px solid #16A34A', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Upload size={16} /> Export CSV
            </button>
            <button onClick={() => { setNewItem({ hsn: '', name: '', category: 'General', qty: '', unit: '', min: '', max: '' }); setEditingItemId(null); setAdding(true) }} style={{ height: 36, padding: '0 16px', borderRadius: 8, background: '#2563EB', color: 'white', border: 'none', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Plus size={16} /> Add Item
            </button>
          </div>
        </div>

        {/* Search & Filter Row */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#FAFBFC', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" placeholder="Search by name, SKU, category..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', height: 40, padding: '0 14px 0 38px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outlineColor: '#2563EB' }} />
            {loading && search && <Loader2 size={14} color="#2563EB" className="animate-spin" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }} />}
          </div>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ height: 40, padding: '0 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outlineColor: '#2563EB' }}>
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ height: 40, padding: '0 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outlineColor: '#2563EB' }}>
            <option value="all">All Status</option>
            <option value="low">Low Stock</option>
            <option value="ok">OK</option>
            <option value="overstock">Overstock</option>
            <option value="out">Out of Stock</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ height: 40, padding: '0 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outlineColor: '#2563EB' }}>
            <option value="name">Name A-Z</option>
            <option value="qty_asc">Qty: Low to High</option>
            <option value="qty_desc">Qty: High to Low</option>
            <option value="created">Recently Added</option>
            <option value="category">Category</option>
          </select>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: 'auto', padding: '0 24px' }}>
          {loading && items.length === 0 ? (
            <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ height: 50, background: '#F1F5F9', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />)}
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '80px 0', textAlign: 'center', color: '#1E293B' }}>
              <SearchX size={48} style={{ margin: '0 auto 16px auto', opacity: 0.5 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#475569' }}>No items found</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{search ? `No items match '${search}'` : 'Try a different search or clear filters'}</div>
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%', minWidth: 900, marginTop: 16, textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 8px', color: '#0F172A', width: 40 }}>SNO</th><th style={{ padding: '12px 8px', color: '#0F172A' }}>SKU</th><th style={{ padding: '12px 8px', color: '#0F172A' }}>Item Name</th><th style={{ padding: '12px 8px', color: '#0F172A' }}>Category</th><th style={{ padding: '12px 8px', color: '#0F172A' }}>Qty</th><th style={{ padding: '12px 8px', color: '#0F172A' }}>Unit</th><th style={{ padding: '12px 8px', color: '#0F172A' }}>Min</th><th style={{ padding: '12px 8px', color: '#0F172A' }}>Max</th><th style={{ padding: '12px 8px', color: '#0F172A' }}>Rate</th><th style={{ textAlign: 'center', padding: '12px 8px', color: '#0F172A' }}>Status</th><th style={{ textAlign: 'right', padding: '12px 8px', color: '#0F172A' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(items.length > pagination.itemsPerPage ? items.slice((pagination.currentPage - 1) * pagination.itemsPerPage, pagination.currentPage * pagination.itemsPerPage) : items).map((item, index) => {
                  const pct = Math.min((item.qty / (item.max || 1)) * 100, 100)
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ fontSize: 13, color: '#1E293B', fontWeight: 600, padding: '12px 8px' }}>{(pagination.currentPage - 1) * pagination.itemsPerPage + index + 1}</td>
                      <td style={{ fontSize: 13, color: '#0F172A', fontWeight: 600, padding: '12px 8px' }}>{item.hsn}</td>
                      <td style={{ fontWeight: 600, color: '#0F172A', padding: '12px 8px' }}>{item.name}</td>
                      <td style={{ color: '#0F172A', padding: '12px 8px' }}>{item.category}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>{formatQty(item.qty)}</span>
                          <div style={{ width: 60, height: 4, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: item.qty < item.min ? '#DC2626' : item.qty > item.max ? '#D97706' : '#16A34A' }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ color: '#0F172A', padding: '12px 8px' }}>{item.unit}</td>
                      <td style={{ color: '#1E293B', padding: '12px 8px' }}>{item.min}</td>
                      <td style={{ color: '#1E293B', padding: '12px 8px' }}>{item.max}</td>
                      <td style={{ color: '#0F172A', padding: '12px 8px' }}>{item.rate ? `₹${item.rate}` : '—'}</td>
                      <td style={{ textAlign: 'center', padding: '12px 8px' }}>{getStatusBadge(item)}</td>
                      <td style={{ textAlign: 'right', padding: '12px 8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <ActionButton color="#2563EB" hoverColor="#1D4ED8" icon={<Pencil size={14} />} tooltip="Edit Item" onClick={() => handleEditClick(item)} />
                          <ActionButton color="#EA580C" hoverColor="#C2410C" icon={<AlertTriangle size={14} />} tooltip="Mark as Damaged" onClick={() => handleDamage(item)} />
                          <ActionButton color="#DC2626" hoverColor="#B91C1C" icon={<Trash2 size={14} />} tooltip="Delete Item" onClick={() => handleDelete(item)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination Wrapper */}
        <div style={{ padding: '0 24px' }}>
          {!search && items.length > 0 && (
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              itemsPerPage={pagination.itemsPerPage}
              onPageChange={handlePageChange}
              onLimitChange={limit => setPagination(p => ({ ...p, itemsPerPage: limit }))}
            />
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {adding && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: 12, width: '100%', maxWidth: 540, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>{editingItemId ? 'Edit Item' : 'Add New Item'}</h3>
              <button onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E293B' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>SKU</label>
                <input type="text" value={newItem.hsn} onChange={e => setNewItem({ ...newItem, hsn: e.target.value.toUpperCase() })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Item Name</label>
                <input type="text" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Category</label>
                <input type="text" list="cat-list" value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
                <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Current Qty</label>
                <input type="number" value={newItem.qty} onChange={e => setNewItem({ ...newItem, qty: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Unit</label>
                <select value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }}>
                  <option value="">Select...</option>
                  <option value="Nos">Nos</option>
                  <option value="Kg">Kg</option>
                  <option value="Ltrs">Ltrs</option>
                  <option value="Set">Set</option>
                  <option value="Metre">Metre</option>
                  <option value="Sqft">Sqft</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Rate (₹)</label>
                <input type="number" value={newItem.rate || ''} onChange={e => setNewItem({ ...newItem, rate: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Min Level</label>
                <input type="number" value={newItem.min} onChange={e => setNewItem({ ...newItem, min: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Max Level</label>
                <input type="number" value={newItem.max} onChange={e => setNewItem({ ...newItem, max: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', background: '#FAFBFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button onClick={() => setAdding(false)} style={{ padding: '0 20px', height: 40, borderRadius: 8, border: 'none', background: '#DC2626', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAdd} style={{ padding: '0 20px', height: 40, borderRadius: 8, border: 'none', background: '#2563EB', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Save Item</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} fetchInventory={() => {fetchInventory(); fetchStats(); fetchCategories()}} showToast={showToast} />}
    </div>
  )
}

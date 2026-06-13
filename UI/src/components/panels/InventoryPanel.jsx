import { useState, useRef, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'
import * as pdfjsLib from 'pdfjs-dist'
import {
  Search, Plus, X, Package, Trash2, Edit2,
  AlertTriangle, AlertCircle, Upload, Download,
  CheckCircle, XCircle, CloudUpload, FileText, ChevronDown, Check,
  Camera, FileImage, Bot, ScanLine, SearchX, Pencil, TrendingUp, ChevronUp, Loader2, CheckSquare, Square
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
const ActionBtn = ({ color, hover, icon, title, onClick }) => {
  const [isHover, setIsHover] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      style={{
        width: 32, height: 32, borderRadius: 6, border: 'none',
        background: isHover ? hover : color, color: 'white', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s ease', flexShrink: 0
      }}
    >
      {icon}
    </button>
  )
}

const ColHeader = ({ label, tooltip }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>{label}</span>
    {tooltip && (
      <span
        title={tooltip}
        style={{
          fontSize: 10, color: '#94A3B8', cursor: 'help', border: '1px solid #CBD5E1',
          borderRadius: '50%', width: 14, height: 14, display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}
      >
        ?
      </span>
    )}
  </div>
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

const InventoryAutocomplete = ({
  value,
  onChange,
  inventory,
  placeholder
}) => {
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!value || value.length < 1) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    const query = value.toLowerCase().trim()

    const prefixMatches = inventory.filter(
      item =>
        (item.name || '').toLowerCase().startsWith(query) ||
        (item.hsn || '').toLowerCase().startsWith(query)
    )

    const looseMatches = inventory.filter(
      item =>
        !(item.name || '').toLowerCase().startsWith(query) &&
        !(item.hsn || '').toLowerCase().startsWith(query) &&
        (
          (item.name || '').toLowerCase().includes(query) ||
          (item.hsn || '').toLowerCase().includes(query) ||
          (item.category || '').toLowerCase().includes(query)
        )
    )

    const combined = [
      ...prefixMatches.slice(0, 5),
      ...looseMatches.slice(0, 3)
    ]

    setSuggestions(combined)
    setShowDropdown(combined.length > 0)
    setActiveIndex(-1)
  }, [value, inventory])

  const handleKeyDown = (e) => {
    if (!showDropdown) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => prev < suggestions.length - 1 ? prev + 1 : 0)
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => prev > 0 ? prev - 1 : suggestions.length - 1)
    }
    if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[activeIndex])
    }
    if (e.key === 'Escape') {
      setShowDropdown(false)
      setActiveIndex(-1)
    }
  }

  const selectSuggestion = (item) => {
    onChange(item.name)
    setShowDropdown(false)
    setSuggestions([])
    inputRef.current?.focus()
  }

  const highlightText = (text, query) => {
    if (!text) return ''
    if (!query) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text

    return (
      <>
        {text.slice(0, idx)}
        <strong style={{ color: '#2563EB', fontWeight: 700 }}>
          {text.slice(idx, idx + query.length)}
        </strong>
        {text.slice(idx + query.length)}
      </>
    )
  }

  const getStatusBadge = (item) => {
    if (item.qty === 0) return { label: 'Out', color: '#4F46E5' }
    if (item.qty < item.min) return { label: 'Low', color: '#EA580C' }
    if (item.qty > item.max) return { label: 'Over', color: '#D97706' }
    return { label: 'OK', color: '#16A34A' }
  }

  useEffect(() => {
    const handleOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const query = value?.toLowerCase().trim()
  const prefixCount = suggestions.filter(
    s => (s.name || '').toLowerCase().startsWith(query) || (s.hsn || '').toLowerCase().startsWith(query)
  ).length

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 250, maxWidth: 360 }}>
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true) }}
          placeholder={placeholder || "Search items..."}
          style={{ width: '100%', height: 40, paddingLeft: 38, paddingRight: value ? 36 : 12, borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, color: '#0F172A', outline: 'none', transition: 'border 0.2s ease', boxSizing: 'border-box' }}
          onFocusCapture={e => e.target.style.borderColor = '#2563EB'}
          onBlurCapture={e => e.target.style.borderColor = '#E2E8F0'}
        />
        {value && (
          <button
            onClick={() => { onChange(''); setSuggestions([]); setShowDropdown(false); inputRef.current?.focus() }}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: '#94A3B8', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', color: 'white', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ×
          </button>
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div ref={dropdownRef} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden', maxHeight: 320, overflowY: 'auto' }}>
          {prefixCount > 0 && (
            <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
              Best matches
            </div>
          )}

          {suggestions.map((item, index) => {
            const isPrefix = (item.name||'').toLowerCase().startsWith(query) || (item.hsn||'').toLowerCase().startsWith(query)
            const statusBadge = getStatusBadge(item)
            const showDivider = index === prefixCount && prefixCount > 0 && prefixCount < suggestions.length

            return (
              <div key={item.hsn || index} style={{ display: 'contents' }}>
                {showDivider && (
                  <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', borderTop: '1px solid #F1F5F9' }}>
                    Other matches
                  </div>
                )}
                <div
                  onClick={() => selectSuggestion(item)}
                  style={{ padding: '10px 14px', cursor: 'pointer', background: index === activeIndex ? '#EFF6FF' : 'white', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.15s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; setActiveIndex(index) }}
                  onMouseLeave={e => { if (index !== activeIndex) e.currentTarget.style.background = 'white' }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>📦</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#0F172A', fontWeight: isPrefix ? 500 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {highlightText(item.name, value)}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, display: 'flex', gap: 8 }}>
                      <span>{highlightText(item.hsn, value)}</span>
                      <span>•</span>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.category}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{item.qty} {item.unit}</div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: statusBadge.color, background: statusBadge.color + '18', padding: '1px 6px', borderRadius: 999 }}>
                      {statusBadge.label}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
          <div style={{ padding: '6px 12px', fontSize: 11, color: '#94A3B8', background: '#F8FAFC', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 12 }}>
            <span>↑↓ Navigate</span><span>Enter to select</span><span>Esc to close</span>
          </div>
        </div>
      )}
    </div>
  )
}

const CategoryAutocomplete = ({ value, onChange, categories, onAddCategory, width = 180 }) => {
  const [inputValue, setInputValue] = useState(value === 'all' ? '' : value)
  const [showDropdown, setShowDropdown] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    setInputValue(value === 'all' ? '' : value)
  }, [value])

  const filtered = categories.filter(c => c.toLowerCase().includes(inputValue.toLowerCase()))
  const isExactMatch = categories.some(c => c.toLowerCase() === inputValue.trim().toLowerCase())

  useEffect(() => {
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
        if (inputValue.trim() !== '' && inputValue !== (value === 'all' ? '' : value)) {
          onChange(inputValue.trim())
        }
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [inputValue, value, onChange])

  const handleAdd = async (newCat) => {
    if (onAddCategory) await onAddCategory(newCat)
    onChange(newCat)
    setShowDropdown(false)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width }}>
      <input
        type="text"
        value={inputValue}
        placeholder="All Categories"
        onChange={e => {
          setInputValue(e.target.value)
          setShowDropdown(true)
        }}
        onFocus={() => setShowDropdown(true)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const val = inputValue.trim()
            if (val && !isExactMatch) {
              handleAdd(val)
            } else {
              onChange(val || 'all')
              setShowDropdown(false)
            }
          }
        }}
        style={{ width: '100%', height: 40, padding: '0 12px', paddingRight: 30, borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outlineColor: '#2563EB', boxSizing: 'border-box' }}
      />
      <ChevronDown size={14} color="#64748B" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      {showDropdown && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
          <div
            onClick={() => { onChange('all'); setInputValue(''); setShowDropdown(false) }}
            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#0F172A', borderBottom: '1px solid #F1F5F9' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            All Categories
          </div>
          {filtered.map(cat => (
            <div
              key={cat}
              onClick={() => { onChange(cat); setInputValue(cat); setShowDropdown(false) }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#0F172A' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {cat}
            </div>
          ))}
          {inputValue.trim() !== '' && !isExactMatch && (
            <div
              onClick={() => handleAdd(inputValue.trim())}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#2563EB', fontWeight: 600, borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Plus size={14} /> Add "{inputValue.trim()}"
            </div>
          )}
          <div style={{ padding: '6px 12px', fontSize: 11, color: '#94A3B8', background: '#F8FAFC', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 12 }}>
            <span>↑↓ Navigate</span><span>Enter to select/add</span><span>Esc to close</span>
          </div>
        </div>
      )}
    </div>
  )
}

const FilterSelect = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    style={{ height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, color: '#374151', background: 'white', cursor: 'pointer', outline: 'none', minWidth: 140 }}
  >
    {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
  </select>
)

const FilterChip = ({ label, onRemove }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 12, color: '#2563EB', fontWeight: 500 }}>
    {label}
    <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1, display: 'flex' }}>×</button>
  </div>
)

const FormAutocomplete = ({ value, onChange, options, onAddOption, placeholder = "Select...", width = '100%' }) => {
  const [inputValue, setInputValue] = useState(value || '')
  const [showDropdown, setShowDropdown] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    setInputValue(value || '')
  }, [value])

  const filtered = options.filter(o => o.toLowerCase().includes(inputValue.toLowerCase()))
  const isExactMatch = options.some(o => o.toLowerCase() === inputValue.trim().toLowerCase())

  useEffect(() => {
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
        if (inputValue.trim() !== '' && inputValue !== value) {
          onChange(inputValue.trim())
        }
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [inputValue, value, onChange])

  const handleAdd = async (newVal) => {
    if (onAddOption) await onAddOption(newVal)
    onChange(newVal)
    setShowDropdown(false)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width }}>
      <input
        type="text"
        value={inputValue}
        placeholder={placeholder}
        onChange={e => {
          setInputValue(e.target.value)
          setShowDropdown(true)
        }}
        onFocus={() => setShowDropdown(true)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const val = inputValue.trim()
            if (val && !isExactMatch) {
              handleAdd(val)
            } else {
              onChange(val)
              setShowDropdown(false)
            }
          }
        }}
        style={{ width: '100%', height: 40, padding: '0 12px', paddingRight: 30, borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outlineColor: '#2563EB', boxSizing: 'border-box' }}
      />
      <ChevronDown size={14} color="#64748B" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      {showDropdown && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
          {filtered.map(opt => (
            <div
              key={opt}
              onClick={() => { onChange(opt); setInputValue(opt); setShowDropdown(false) }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#0F172A' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {opt}
            </div>
          ))}
          {inputValue.trim() !== '' && !isExactMatch && (
            <div
              onClick={() => handleAdd(inputValue.trim())}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#2563EB', fontWeight: 600, borderTop: filtered.length > 0 ? '1px solid #F1F5F9' : 'none', display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Plus size={14} /> Add "{inputValue.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function InventoryPanel({ showToast }) {
  // Inventory States
  const [items, setItems] = useState([])
  const [editValues, setEditValues] = useState({})

  const handleFieldChange = (itemId, field, value) => {
    setEditValues(prev => ({ ...prev, [`${itemId}-${field}`]: value }))
  }

  const getValue = (item, field) => {
    const localVal = editValues[`${item.id}-${field}`]
    return localVal !== undefined ? localVal : (item[field] ?? '')
  }

  const saveFieldToBackend = async (item, field) => {
    const localVal = editValues[`${item.id}-${field}`]
    if (localVal === undefined || String(localVal) === String(item[field])) return

    try {
      await backendFetch(`/inventory/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ [field]: Number(localVal) })
      })
      
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, [field]: Number(localVal) } : i))
      
      // Background refresh to update calculated fields
      fetchInventory({ page: pagination.currentPage })
    } catch (err) {
      showToast?.(err.message, 'error')
    }
  }
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 12 })
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState(() => {
    const f = sessionStorage.getItem('inventory_filter')
    if (f) {
      sessionStorage.removeItem('inventory_filter')
      return f
    }
    return 'all'
  })
  const [sortBy, setSortBy] = useState('name')
  const [categories, setCategories] = useState([])
  const [units, setUnits] = useState(['Nos', 'Kg', 'Ltrs', 'Set', 'Metre', 'Sqft'])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(false)
  const [allItems, setAllItems] = useState([])
  
  const fetchAllForAutocomplete = async () => {
    try {
      const data = await backendFetch('/inventory?limit=10000&page=1')
      setAllItems(Array.isArray(data) ? data : (data.items || []))
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    fetchAllForAutocomplete()
  }, [])

  useEffect(() => {
    setStats({
      totalItems: allItems.length,
      lowStock: allItems.filter(i => Number(i.qty) <= Number(i.min) && Number(i.qty) > 0).length,
      outOfStock: allItems.filter(i => Number(i.qty) === 0).length,
      overstock: allItems.filter(i => Number(i.qty) > Number(i.max)).length,
      totalValue: Math.round(allItems.reduce((sum, i) => sum + ((Number(i.qty) || 0) * (Number(i.rate) || 0)), 0))
    })
  }, [allItems])

  const formatQty = (q) => {
    const num = Number(q)
    if (isNaN(num)) return q
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 3 }).format(num)
  }
  
  // Modals
  const [adding, setAdding] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)
  const [newItem, setNewItem] = useState({ hsn: '', name: '', category: 'Raw Materials', total_qty: '', qty: '', unit: '', min: '', max: '', cost_price: '', rate: '', gst: '18' })
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

  const fetchUnits = async () => {
    try {
      const data = await backendFetch('/inventory/units')
      setUnits(data.units || ['Nos', 'Kg', 'Ltrs', 'Set', 'Metre', 'Sqft'])
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
    fetchUnits()
    fetchGrnHistory()
  }, [])

  // Action Handlers
  const handleEditClick = (item) => {
    document.getElementById('main-scroll-area')?.scrollTo({ top: 0, behavior: 'smooth' });
    setNewItem({ ...item, gst: item.gst ?? '18' })
    setEditingItemId(item.id)
    setAdding(true)
  }

  const handleToggleGst = async (item) => {
    try {
      const hasGst = (Number(item.cgst_percent) || 0) + (Number(item.sgst_percent) || 0) > 0
      const payload = hasGst 
        ? { cgst_percent: 0, sgst_percent: 0 } 
        : { cgst_percent: 9, sgst_percent: 9 }
      
      await backendFetch(`/inventory/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
      fetchInventory({ page: pagination.currentPage })
      showToast?.('GST Updated', 'success')
    } catch (err) {
      showToast?.(err.message, 'error')
    }
  }

  const handleDamage = (item) => {
    const currentQty = (item.opening_stock || 0) + (item.stock_in || 0) - (item.stock_out || 0) - (item.damaged_qty || 0)
    const qtyStr = prompt(`Enter quantity of ${item.name} to mark as damaged (Max: ${currentQty}):`)
    if (!qtyStr) return
    const qty = Number(qtyStr)
    if (isNaN(qty) || qty <= 0 || qty > currentQty) {
      alert(`Invalid quantity. Must be between 1 and ${currentQty}.`)
      return
    }
    const reason = prompt(`Enter reason for damage:`, 'Damaged in transit')
    
    backendFetch(`/inventory/${item.id}/damage`, {
      method: 'POST',
      body: JSON.stringify({ qty, reason, notes: '' })
    }).then(() => {
      showToast?.(`Marked ${qty} ${item.unit} as damaged`, 'success')
      fetchInventory({ page: pagination.currentPage })
    }).catch(err => {
      showToast?.(err.message, 'error')
    })
  }

  const handleDelete = (item) => {
    document.getElementById('main-scroll-area')?.scrollTo({ top: 0, behavior: 'smooth' });
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
          fetchAllForAutocomplete()
          fetchCategories()
        } catch (e) { showToast?.(e.message, 'error') }
        setConfirmModal(null)
      }
    })
  }

  const handleDeleteGrn = (grn) => {
    document.getElementById('main-scroll-area')?.scrollTo({ top: 0, behavior: 'smooth' });
    setConfirmModal({
      title: 'Delete GRN',
      message: `Are you sure you want to delete the GRN from ${grn.supplier} and reverse its inventory updates?`,
      confirmLabel: 'Yes, Delete It',
      danger: true,
      onConfirm: async () => {
        try {
          await backendFetch(`/grn/${grn.id}`, { method: 'DELETE' })
          showToast?.('GRN deleted & stock reversed', 'success')
          fetchGrnHistory()
          fetchInventory()
          fetchAllForAutocomplete()
        } catch (e) { showToast?.(e.message, 'error') }
        setConfirmModal(null)
      }
    })
  }

  const handleAdd = async () => {
    if (!newItem.hsn || !newItem.name) return showToast?.('HSN and Name are required', 'error')
    try {
      const parseDate = (dStr) => {
        if (!dStr) return dStr;
        const s = String(dStr).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const p = s.split(/[-/]/);
        if (p.length === 3 && p[0].length <= 2 && p[2].length === 4) {
           return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
        }
        return s;
      }
      
      const processedItem = { 
        ...newItem, 
        qty: Number(newItem.qty) || 0, 
        opening_stock: Number(newItem.opening_stock ?? newItem.qty) || 0,
        min: Number(newItem.min) || 0, 
        max: Number(newItem.max) || 0,
        reorder_qty: Number(newItem.reorder_qty) || 0,
        purchase_rate: Number(newItem.purchase_rate || newItem.rate) || 0,
        selling_rate: Number(newItem.selling_rate) || 0,
        cgst_percent: Number(newItem.cgst_percent) || 0,
        sgst_percent: Number(newItem.sgst_percent) || 0,
        date_added: parseDate(newItem.date_added),
        last_restocked: parseDate(newItem.last_restocked)
      };
      if (editingItemId) {
        await backendFetch(`/inventory/${editingItemId}`, { method: 'PUT', body: JSON.stringify(processedItem) })
        showToast?.('Item updated successfully', 'success')
      } else {
        await backendFetch(`/inventory`, { method: 'POST', body: JSON.stringify(processedItem) })
        showToast?.('Item added successfully', 'success')
      }
      setAdding(false)
      fetchInventory()
      fetchAllForAutocomplete()
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
      fetchAllForAutocomplete()
      fetchGrnHistory()
    } catch (err) {
      showToast?.(err.message || 'Failed to approve GRN', 'error')
    } finally {
      setGrnApproving(false)
    }
  }

  // Render Status Badge (Colored Pill)
  const getStatusBadge = (item) => {
    if (item.qty === 0) return <span style={{ padding: '4px 10px', background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4338CA', borderRadius: 99, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>🚫 Out of Stock</span>
    if (item.qty < item.min) return <span style={{ padding: '4px 10px', background: '#EA580C', color: 'white', borderRadius: 99, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>⚠️ Low Stock</span>
    if (item.qty > item.max) return <span style={{ padding: '4px 10px', background: '#D97706', color: 'white', borderRadius: 99, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>📦 Overstock</span>
    return <span style={{ padding: '4px 10px', background: '#16A34A', color: 'white', borderRadius: 99, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>✅ OK</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>

      {/* SECTION 2: STAT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '20px', background: '#EFF6FF', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' }}>Total Items</span>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#1E3A8A' }}>{stats.totalItems || 0}</span>
          </div>
          <Package size={32} color="#2563EB" style={{ opacity: 0.2 }} />
        </div>
        <div onClick={() => setStatus('overstock')} style={{ padding: '20px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>Overstock</span>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#92400E' }}>{stats.overstock || 0}</span>
          </div>
          <Package size={32} color="#D97706" style={{ opacity: 0.2 }} />
        </div>
        <div onClick={() => setStatus('low')} style={{ padding: '20px', background: '#FEF2F2', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Low Stock</span>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#991B1B' }}>{stats.lowStock || 0}</span>
          </div>
          <AlertTriangle size={32} color="#DC2626" style={{ opacity: 0.2 }} />
        </div>
        <div style={{ padding: '20px', background: '#F0FDF4', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#16A34A', textTransform: 'uppercase' }}>Total Value</span>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#065F46' }}>₹{(stats.totalValue || 0).toLocaleString()}</span>
          </div>
          <TrendingUp size={32} color="#16A34A" style={{ opacity: 0.2 }} />
        </div>
      </div>
      
      {/* GRN UPLOAD MODAL */}
      {grnExpanded && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: 12, width: 800, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, background: '#EFF6FF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Upload size={16} color="#2563EB" /></div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Upload Goods Receipt Note (GRN)</h3>
              </div>
              <button onClick={() => setGrnExpanded(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}><X size={20}/></button>
            </div>
            <div style={{ padding: 24 }}>
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

                <div style={{ borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '900px' }}>
                    <thead>
                      <tr style={{ background: '#0F172A', color: 'white' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>HSN</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>Description</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>Qty</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>Unit Price</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>Unit</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>Category</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>Min</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grnData.items.map((it, i) => {
                        const handleChange = (f, val) => {
                          const copy = [...grnData.items]
                          copy[i][f] = val
                          setGrnData(p => ({ ...p, items: copy }))
                        }
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                            <td style={{ padding: 8 }}><input type="text" value={it.hsn || ''} onChange={e => handleChange('hsn', e.target.value)} style={{ width: '80px', padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 13 }} /></td>
                            <td style={{ padding: 8 }}><input type="text" value={it.description || ''} onChange={e => handleChange('description', e.target.value)} style={{ width: '100%', minWidth: '150px', padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 13 }} /></td>
                            <td style={{ padding: 8 }}><input type="number" value={it.quantity || ''} onChange={e => handleChange('quantity', e.target.value)} style={{ width: '60px', padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 13 }} /></td>
                            <td style={{ padding: 8 }}><input type="number" value={it.unit_price || ''} onChange={e => handleChange('unit_price', e.target.value)} style={{ width: '70px', padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 13 }} /></td>
                            <td style={{ padding: 8 }}><input type="text" list="grn-unit-list" value={it.unit || ''} onChange={e => handleChange('unit', e.target.value)} style={{ width: '70px', padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 13 }} /></td>
                            <td style={{ padding: 8 }}><input type="text" list="grn-cat-list" value={it.category || ''} onChange={e => handleChange('category', e.target.value)} style={{ width: '100px', padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 13 }} /></td>
                            <td style={{ padding: 8 }}><input type="number" value={it.min || ''} onChange={e => handleChange('min', e.target.value)} style={{ width: '50px', padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 13 }} /></td>
                            <td style={{ padding: 8 }}><input type="number" value={it.max || ''} onChange={e => handleChange('max', e.target.value)} style={{ width: '50px', padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 13 }} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <datalist id="grn-unit-list">
                    <option value="Nos">Nos</option>
                    <option value="Kg">Kg</option>
                    <option value="Ltrs">Ltrs</option>
                    <option value="Set">Set</option>
                    <option value="Metre">Metre</option>
                    <option value="Sqft">Sqft</option>
                  </datalist>
                  <datalist id="grn-cat-list">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
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

            </div>
          </div>
        </div>
      )}





      {/* SECTION 3: INVENTORY TABLE */}
      <div ref={tableRef} style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        {/* Header Row */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0 }}>Inventory</h2>
            <span style={{ background: '#EFF6FF', color: '#2563EB', padding: '4px 10px', borderRadius: 99, fontSize: 13, fontWeight: 700 }}>{pagination.totalItems} items</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { document.getElementById('main-scroll-area')?.scrollTo({ top: 0, behavior: 'smooth' }); setGrnExpanded(true); }} style={{ height: 36, padding: '0 16px', borderRadius: 8, background: '#EFF6FF', color: '#2563EB', border: '1.5px solid #2563EB', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Upload size={16} /> Upload GRN
            </button>
            <button onClick={() => { document.getElementById('main-scroll-area')?.scrollTo({ top: 0, behavior: 'smooth' }); setShowImport(true); }} style={{ height: 36, padding: '0 16px', borderRadius: 8, background: 'white', color: '#2563EB', border: '1.5px solid #2563EB', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Download size={16} /> Import CSV
            </button>
            <button onClick={() => exportCSV(items)} style={{ height: 36, padding: '0 16px', borderRadius: 8, background: 'white', color: '#16A34A', border: '1.5px solid #16A34A', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Upload size={16} /> Export CSV
            </button>
            <button onClick={() => { document.getElementById('main-scroll-area')?.scrollTo({ top: 0, behavior: 'smooth' }); setNewItem(prev => ({ hsn: '', name: '', category: prev?.category || 'General', total_qty: '', qty: '', unit: prev?.unit || '', min: '', max: '', cost_price: '', rate: '', date_added: prev?.date_added || '', last_restocked: prev?.last_restocked || '', gst: prev?.gst || '' })); setEditingItemId(null); setAdding(true) }} style={{ height: 36, padding: '0 16px', borderRadius: 8, background: '#2563EB', color: 'white', border: 'none', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Plus size={16} /> Add Item
            </button>
          </div>
        </div>

        {/* Search & Filter Row */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#FAFBFC' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <InventoryAutocomplete
              value={search}
              onChange={val => setSearch(val)}
              inventory={allItems}
              placeholder="Search items by name, HSN..."
            />

            {(search !== '' || category !== 'all' || status !== 'all' || sortBy !== 'name') && (
              <button
                onClick={() => {
                  setSearch(''); setCategory('all'); setStatus('all'); setSortBy('name');
                  setPagination(p => ({ ...p, currentPage: 1 }));
                  fetchInventory({ page: 1, searchTerm: '', cat: 'all', stat: 'all', sort: 'name' });
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s ease', height: 40, boxSizing: 'border-box' }}
                onMouseEnter={e => e.currentTarget.style.background = '#FEE2E2'}
                onMouseLeave={e => e.currentTarget.style.background = '#FEF2F2'}
              >
                <X size={14} /> Clear Filters
              </button>
            )}

            <CategoryAutocomplete
              value={category}
              onChange={val => { setCategory(val); setPagination(p => ({...p, currentPage: 1})); }}
              categories={categories}
              onAddCategory={async (newCat) => {
                try {
                  await backendFetch('/inventory/categories', { method: 'POST', body: JSON.stringify({ name: newCat }) })
                  fetchCategories()
                  // Don't show toast for success, let it be seamless, or maybe just a subtle success
                } catch (e) {
                  console.error(e)
                }
              }}
            />

            <FilterSelect
              value={status}
              onChange={val => { setStatus(val); setPagination(p => ({...p, currentPage: 1})); }}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'low', label: '⚠️ Low Stock' },
                { value: 'ok', label: '✅ OK' },
                { value: 'overstock', label: '📦 Overstock' },
                { value: 'out', label: '🚫 Out of Stock' }
              ]}
            />

            <FilterSelect
              value={sortBy}
              onChange={val => { setSortBy(val); setPagination(p => ({...p, currentPage: 1})); }}
              options={[
                { value: 'name', label: 'Name A-Z' },
                { value: 'name_desc', label: 'Name Z-A' },
                { value: 'qty_asc', label: 'Qty: Low → High' },
                { value: 'qty_desc', label: 'Qty: High → Low' },
                { value: 'date_added_desc', label: '📅 Date Added (Newest)' },
                { value: 'date_added_asc', label: '📅 Date Added (Oldest)' },
                { value: 'last_restocked_desc', label: '🔄 Last Restocked (Recent)' },
                { value: 'not_restocked', label: '⚠️ Not Restocked (Oldest First)' },
                { value: 'created', label: 'Created At' },
                { value: 'category', label: 'Category' }
              ]}
            />
          </div>

          {(search !== '' || category !== 'all' || status !== 'all') && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {search && <FilterChip label={`Search: "${search}"`} onRemove={() => setSearch('')} />}
              {category !== 'all' && <FilterChip label={`Category: ${category}`} onRemove={() => { setCategory('all'); setPagination(p => ({...p, currentPage: 1})) }} />}
              {status !== 'all' && <FilterChip label={{'low':'Low Stock', 'ok':'OK', 'overstock':'Overstock', 'out':'Out of Stock'}[status]} onRemove={() => { setStatus('all'); setPagination(p => ({...p, currentPage: 1})) }} />}
            </div>
          )}
        </div>

        {loading && items.length === 0 ? (
            <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ height: 50, background: '#F1F5F9', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />)}
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '80px 0', textAlign: 'center', color: '#1E293B' }}>
              {search ? (
                <>
                  <SearchX size={56} color="#94A3B8" style={{ margin: '0 auto 16px auto' }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Item not found</div>
                  <div style={{ fontSize: 14, color: '#64748B', marginTop: 8, maxWidth: 300, margin: '8px auto' }}>
                    No items match '{search}'. Try checking the spelling or search by HSN or category.
                  </div>
                  <button onClick={() => setSearch('')} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#EFF6FF', color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}>Clear Search</button>
                </>
              ) : status === 'low' ? (
                <>
                  <CheckCircle size={56} color="#10B981" style={{ margin: '0 auto 16px auto' }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>No Low Stock Items</div>
                  <div style={{ fontSize: 14, color: '#64748B', marginTop: 8 }}>All items are above minimum levels.</div>
                  <button onClick={() => {setStatus('all'); setPagination(p => ({...p, currentPage: 1}))}} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#EFF6FF', color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}>Clear Filter</button>
                </>
              ) : status === 'ok' ? (
                <>
                  <Package size={56} color="#94A3B8" style={{ margin: '0 auto 16px auto' }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>No Items with OK Status</div>
                  <div style={{ fontSize: 14, color: '#64748B', marginTop: 8 }}>Check your min/max levels.</div>
                  <button onClick={() => {setStatus('all'); setPagination(p => ({...p, currentPage: 1}))}} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#EFF6FF', color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}>Clear Filter</button>
                </>
              ) : status === 'overstock' ? (
                <>
                  <CheckCircle size={56} color="#10B981" style={{ margin: '0 auto 16px auto' }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>No Overstock Items</div>
                  <div style={{ fontSize: 14, color: '#64748B', marginTop: 8 }}>All items are within limits.</div>
                  <button onClick={() => {setStatus('all'); setPagination(p => ({...p, currentPage: 1}))}} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#EFF6FF', color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}>Clear Filter</button>
                </>
              ) : status === 'out' ? (
                <>
                  <CheckCircle size={56} color="#10B981" style={{ margin: '0 auto 16px auto' }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>No Out of Stock Items</div>
                  <div style={{ fontSize: 14, color: '#64748B', marginTop: 8 }}>All items have stock available.</div>
                  <button onClick={() => {setStatus('all'); setPagination(p => ({...p, currentPage: 1}))}} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#EFF6FF', color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}>Clear Filter</button>
                </>
              ) : category !== 'all' ? (
                <>
                  <div style={{ fontSize: 56, margin: '0 auto 16px auto' }}>📁</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>No items found in '{category}'</div>
                  <div style={{ fontSize: 14, color: '#64748B', marginTop: 8 }}>Try selecting a different category.</div>
                  <button onClick={() => {setCategory('all'); setPagination(p => ({...p, currentPage: 1}))}} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#EFF6FF', color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}>Clear Filter</button>
                </>
              ) : (
                <>
                  <Package size={56} color="#94A3B8" style={{ margin: '0 auto 16px auto' }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>No Items Found</div>
                  <div style={{ fontSize: 14, color: '#64748B', marginTop: 8 }}>Try adjusting your filters or search.</div>
                </>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%', borderTop: '1px solid #E2E8F0', paddingBottom: 16 }}>
              <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                    <th style={{ position: 'sticky', left: 0, zIndex: 2, background: '#F8FAFC', width: 50, padding: '12px 8px' }}><ColHeader label="#" /></th>
                    <th style={{ width: 100, padding: '12px 8px' }}><ColHeader label="HSN/SKU" tooltip="HSN Code / Stock Keeping Unit" /></th>
                    <th style={{ width: 200, padding: '12px 8px' }}><ColHeader label="Item Name" /></th>
                    <th style={{ width: 120, padding: '12px 8px' }}><ColHeader label="Category" /></th>
                    <th style={{ width: 90, padding: '12px 8px' }}><ColHeader label="Total Qty" tooltip="Opening stock / Total quantity" /></th>
                    <th style={{ width: 80, padding: '12px 8px' }}><ColHeader label="Current Qty" tooltip="Current stock available" /></th>
                    <th style={{ width: 80, padding: '12px 8px' }}><ColHeader label="Sold Qty" tooltip="Total sold from bills" /></th>
                    <th style={{ width: 80, padding: '12px 8px' }}><ColHeader label="Damaged" tooltip="Written off / damaged units" /></th>
                    <th style={{ width: 70, padding: '12px 8px' }}><ColHeader label="Unit" /></th>
                    <th style={{ width: 80, padding: '12px 8px' }}><ColHeader label="Min" tooltip="Minimum stock / reorder point" /></th>
                    <th style={{ width: 80, padding: '12px 8px' }}><ColHeader label="Max" /></th>
                    <th style={{ width: 90, padding: '12px 8px' }}><ColHeader label="Reorder Qty" tooltip="Quantity to order when stock hits Min" /></th>
                    <th style={{ width: 100, padding: '12px 8px' }}><ColHeader label="Purchase Rate" tooltip="Cost price per unit" /></th>
                    <th style={{ width: 100, padding: '12px 8px' }}><ColHeader label="Selling Rate" tooltip="Selling price per unit" /></th>
                    <th style={{ width: 70, padding: '12px 8px' }}><ColHeader label="CGST %" /></th>
                    <th style={{ width: 70, padding: '12px 8px' }}><ColHeader label="SGST %" /></th>
                    <th style={{ width: 80, padding: '12px 8px' }}><ColHeader label="GST %" tooltip="Total GST (CGST + SGST)" /></th>
                    <th style={{ width: 110, padding: '12px 8px' }}><ColHeader label="Total Value" tooltip="Current Qty × Purchase Rate" /></th>
                    <th style={{ width: 130, padding: '12px 8px' }}><ColHeader label="Supplier" /></th>
                    <th style={{ width: 100, padding: '12px 8px' }}><ColHeader label="Date Added" /></th>
                    <th style={{ width: 100, padding: '12px 8px' }}><ColHeader label="Last Restock" /></th>
                    <th style={{ width: 110, padding: '12px 8px' }}><ColHeader label="Status" /></th>
                    <th style={{ position: 'sticky', right: 0, zIndex: 2, background: '#F8FAFC', width: 110, padding: '12px 8px', boxShadow: '-2px 0 4px rgba(0,0,0,0.05)' }}><ColHeader label="Actions" /></th>
                  </tr>
                </thead>
                <tbody>
                  {(!search && items.length > pagination.itemsPerPage ? items.slice((pagination.currentPage - 1) * pagination.itemsPerPage, pagination.currentPage * pagination.itemsPerPage) : items).map((item, index) => {
                    const currentQty = item.qty || 0
                    const totalValue = currentQty * (item.purchase_rate || item.rate || 0)
                    
                    const getStatus = (cq, min, max) => {
                      if (cq === 0) return { label: 'Out of Stock', color: '#4F46E5', bg: '#EEF2FF' }
                      if (cq < min) return { label: 'Low Stock', color: '#EA580C', bg: '#FFF7ED' }
                      if (max > 0 && cq > max) return { label: 'Overstock', color: '#D97706', bg: '#FEF3C7' }
                      return { label: 'OK', color: '#16A34A', bg: '#F0FDF4' }
                    }
                    const statBadge = getStatus(currentQty, item.min || 0, item.max || 0)
                    
                    const inputStyle = { width: '100%', padding: '4px 6px', border: '1px solid transparent', borderRadius: 4, outlineColor: '#2563EB', fontSize: 13, background: 'transparent' }
                    const inputFocusStyle = { background: 'white', border: '1px solid #E2E8F0', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #E2E8F0', ':hover': { background: '#F8FAFC' } }}>
                        {/* 1. S.No */}
                        <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'white', fontSize: 13, color: '#64748B', fontWeight: 500, padding: '12px 8px' }}>
                          {(pagination.currentPage - 1) * pagination.itemsPerPage + index + 1}
                        </td>
                        {/* 2. HSN/SKU */}
                        <td style={{ fontSize: 13, color: '#0F172A', fontWeight: 600, padding: '12px 8px' }}>{item.hsn || item.sku}</td>
                        {/* 3. Item Name */}
                        <td style={{ fontWeight: 600, color: '#0F172A', padding: '12px 8px' }}>{item.name}</td>
                        {/* 4. Category */}
                        <td style={{ color: '#0F172A', padding: '12px 8px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 99, background: '#F1F5F9', fontSize: 12 }}>{item.category}</span>
                        </td>
                        {/* 5. Total Qty */}
                        <td style={{ fontWeight: 600, color: '#475569', padding: '12px 8px' }}>{formatQty(item.total_qty ?? item.qty)}</td>
                        {/* 6. Current Qty */}
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{ fontWeight: 700, color: '#10B981', fontSize: 14 }}>{formatQty(currentQty)}</span>
                        </td>
                        {/* 7. Sold Qty */}
                        <td style={{ fontWeight: 600, color: '#3B82F6', padding: '12px 8px' }}>{formatQty(Math.max(0, (item.total_qty ?? item.qty) - currentQty))}</td>
                        {/* 8. Damaged */}
                        <td style={{ fontWeight: 600, color: '#EF4444', padding: '12px 8px' }}>{formatQty(item.damaged_qty)}</td>
                        {/* 10. Unit */}
                        <td style={{ color: '#64748B', padding: '12px 8px' }}>{item.unit}</td>
                        {/* 11. Min */}
                        <td style={{ padding: '4px 8px' }}>
                          <input type="number"
                            value={getValue(item, 'min')}
                            onChange={e => handleFieldChange(item.id, 'min', e.target.value)}
                            onBlur={() => saveFieldToBackend(item, 'min')}
                            onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                            onMouseLeave={e => { if(document.activeElement !== e.target) Object.assign(e.target.style, inputStyle) }}
                            style={inputStyle}
                          />
                        </td>
                        {/* 12. Max */}
                        <td style={{ padding: '4px 8px' }}>
                          <input type="number"
                            value={getValue(item, 'max')}
                            onChange={e => handleFieldChange(item.id, 'max', e.target.value)}
                            onBlur={() => saveFieldToBackend(item, 'max')}
                            onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                            onMouseLeave={e => { if(document.activeElement !== e.target) Object.assign(e.target.style, inputStyle) }}
                            style={inputStyle}
                          />
                        </td>
                        {/* 13. Reorder Qty */}
                        <td style={{ padding: '4px 8px' }}>
                          <input type="number"
                            value={getValue(item, 'reorder_qty')}
                            onChange={e => handleFieldChange(item.id, 'reorder_qty', e.target.value)}
                            onBlur={() => saveFieldToBackend(item, 'reorder_qty')}
                            onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                            onMouseLeave={e => { if(document.activeElement !== e.target) Object.assign(e.target.style, inputStyle) }}
                            style={inputStyle}
                          />
                        </td>
                        {/* 14. Purchase Rate */}
                        <td style={{ padding: '4px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ color: '#64748B', fontSize: 13 }}>₹</span>
                            <input type="number"
                              value={getValue(item, 'purchase_rate') || getValue(item, 'rate')}
                              onChange={e => handleFieldChange(item.id, 'purchase_rate', e.target.value)}
                              onBlur={() => saveFieldToBackend(item, 'purchase_rate')}
                              onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                              onMouseLeave={e => { if(document.activeElement !== e.target) Object.assign(e.target.style, inputStyle) }}
                              style={inputStyle}
                            />
                          </div>
                        </td>
                        {/* 15. Selling Rate */}
                        <td style={{ padding: '4px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ color: '#64748B', fontSize: 13 }}>₹</span>
                            <input type="number"
                              value={getValue(item, 'selling_rate')}
                              onChange={e => handleFieldChange(item.id, 'selling_rate', e.target.value)}
                              onBlur={() => saveFieldToBackend(item, 'selling_rate')}
                              onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                              onMouseLeave={e => { if(document.activeElement !== e.target) Object.assign(e.target.style, inputStyle) }}
                              style={inputStyle}
                            />
                          </div>
                        </td>
                        {/* 16. CGST % */}
                        <td style={{ padding: '4px 8px' }}>
                          <input type="number"
                            value={getValue(item, 'cgst_percent')}
                            onChange={e => handleFieldChange(item.id, 'cgst_percent', e.target.value)}
                            onBlur={() => saveFieldToBackend(item, 'cgst_percent')}
                            onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                            onMouseLeave={e => { if(document.activeElement !== e.target) Object.assign(e.target.style, inputStyle) }}
                            style={{ ...inputStyle, width: 50 }}
                          />
                        </td>
                        {/* 17. SGST % */}
                        <td style={{ padding: '4px 8px' }}>
                          <input type="number"
                            value={getValue(item, 'sgst_percent')}
                            onChange={e => handleFieldChange(item.id, 'sgst_percent', e.target.value)}
                            onBlur={() => saveFieldToBackend(item, 'sgst_percent')}
                            onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                            onMouseLeave={e => { if(document.activeElement !== e.target) Object.assign(e.target.style, inputStyle) }}
                            style={{ ...inputStyle, width: 50 }}
                          />
                        </td>
                        {/* 18. GST % */}
                        <td style={{ color: '#0F172A', padding: '12px 8px', fontWeight: 600 }}>
                          {Number(item.cgst_percent || 0) + Number(item.sgst_percent || 0)}%
                        </td>
                        {/* 19. Total Value */}
                        <td style={{ color: '#0F172A', padding: '12px 8px', fontWeight: 700 }}>
                          ₹{totalValue.toFixed(2)}
                        </td>
                        {/* 20. Supplier */}
                        <td style={{ color: '#475569', padding: '12px 8px' }}>{item.supplier_name || '—'}</td>
                        {/* 21. Date Added */}
                        <td style={{ color: '#64748B', padding: '12px 8px', fontSize: 12 }}>
                          {item.date_added ? new Date(item.date_added).toLocaleDateString('en-IN') : '—'}
                        </td>
                        {/* 22. Last Restock */}
                        <td style={{ color: '#64748B', padding: '12px 8px', fontSize: 12 }}>
                          {item.last_restocked ? new Date(item.last_restocked).toLocaleDateString('en-IN') : '—'}
                        </td>
                        {/* 23. Status */}
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: statBadge.color, background: statBadge.bg, padding: '4px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                            {statBadge.label}
                          </span>
                        </td>
                        {/* 24. Actions */}
                        <td style={{ position: 'sticky', right: 0, zIndex: 1, background: 'white', padding: '12px 8px', boxShadow: '-2px 0 4px rgba(0,0,0,0.05)' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <ActionBtn color="#2563EB" hover="#1D4ED8" icon={<Pencil size={14} />} title="Edit Item" onClick={() => handleEditClick(item)} />
                            <ActionBtn color="#EA580C" hover="#C2410C" icon={<AlertTriangle size={14} />} title="Mark Damaged" onClick={() => handleDamage(item)} />
                            <ActionBtn color="#DC2626" hover="#B91C1C" icon={<Trash2 size={14} />} title="Delete Item" onClick={() => handleDelete(item)} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        
        {/* Pagination Wrapper */}
        <div style={{ padding: '0 24px' }}>
          {!search && items.length > 0 && (
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              itemsPerPage={pagination.itemsPerPage}
              onPageChange={handlePageChange}
              onLimitChange={limit => { setPagination(p => ({ ...p, itemsPerPage: limit, currentPage: 1 })); fetchInventory({ page: 1, limit }); }}
            />
          )}
        </div>
      </div>

      {/* GRN History Mini Table (Always visible if there's history) */}
      {grnHistory.length > 0 && !grnData && (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: 24 }}>
          <h4 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 16px 0' }}>Recent Goods Receipts (GRN)</h4>
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead><tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Date</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Supplier</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Items Received</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Actions</th>
              </tr></thead>
              <tbody>
                {grnHistory.map(g => (
                  <tr key={g.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 16px', color: '#0F172A', fontWeight: 500 }}>{new Date(g.date || g.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1E293B' }}>{g.supplier}</td>
                    <td style={{ padding: '12px 16px', color: '#64748B' }}><span style={{ background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>{g.items?.length || 0} items</span></td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <ActionBtn icon={<Trash2 size={16} />} color="#EF4444" hover="#DC2626" title="Delete GRN" onClick={() => handleDeleteGrn(g)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {adding && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: 12, width: '100%', maxWidth: 640, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>{editingItemId ? 'Edit Item' : 'Add New Item'}</h3>
              <button onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E293B' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
              {/* Row 1 */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>HSN / SKU</label>
                <input type="text" value={newItem.hsn || newItem.sku || ''} onChange={e => setNewItem({ ...newItem, hsn: e.target.value.toUpperCase() })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Item Name</label>
                <input type="text" value={newItem.name || ''} onChange={e => setNewItem({ ...newItem, name: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
              </div>
              
              {/* Row 2 */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Category</label>
                <FormAutocomplete
                  value={newItem.category || ''}
                  onChange={val => setNewItem({ ...newItem, category: val })}
                  options={categories}
                  placeholder="Select Category..."
                  onAddOption={async (newCat) => {
                    try {
                      await backendFetch('/inventory/categories', { method: 'POST', body: JSON.stringify({ name: newCat }) })
                      fetchCategories()
                    } catch (e) { console.error(e) }
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Supplier</label>
                <input type="text" value={newItem.supplier_name || ''} onChange={e => setNewItem({ ...newItem, supplier_name: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} placeholder="Supplier Name" />
              </div>

              {/* Row 3 */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Total / Opening Stock</label>
                <input type="number" value={newItem.total_qty ?? newItem.qty ?? ''} onChange={e => setNewItem({ ...newItem, total_qty: e.target.value, qty: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} disabled={!!editingItemId} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Unit</label>
                <FormAutocomplete
                  value={newItem.unit || ''}
                  onChange={val => setNewItem({ ...newItem, unit: val })}
                  options={units}
                  placeholder="Select Unit..."
                  onAddOption={async (newUnit) => {
                    try {
                      await backendFetch('/inventory/units', { method: 'POST', body: JSON.stringify({ name: newUnit }) })
                      fetchUnits()
                    } catch (e) { console.error(e) }
                  }}
                />
              </div>

              {/* Row 4 */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Min Level</label>
                <input type="number" value={newItem.min ?? ''} onChange={e => setNewItem({ ...newItem, min: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Max Level</label>
                <input type="number" value={newItem.max ?? ''} onChange={e => setNewItem({ ...newItem, max: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
              </div>

              {/* Row 5 */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Reorder Qty</label>
                <input type="number" value={newItem.reorder_qty || ''} onChange={e => setNewItem({ ...newItem, reorder_qty: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Date Added</label>
                <input type="text" placeholder="DD-MM-YYYY or YYYY-MM-DD" value={newItem.date_added || ''} onChange={e => setNewItem({ ...newItem, date_added: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
              </div>

              {/* Row 6 */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Purchase Rate (₹)</label>
                <input type="number" value={newItem.rate || newItem.purchase_rate || ''} onChange={e => setNewItem({ ...newItem, rate: e.target.value, purchase_rate: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Selling Rate (₹)</label>
                <input type="number" value={newItem.selling_rate || ''} onChange={e => setNewItem({ ...newItem, selling_rate: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
              </div>

              {/* Row 7 */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>CGST (%)</label>
                <input type="number" value={newItem.cgst_percent || ''} onChange={e => setNewItem({ ...newItem, cgst_percent: e.target.value, gst: Number(e.target.value || 0) + Number(newItem.sgst_percent || 0) })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>SGST (%)</label>
                <input type="number" value={newItem.sgst_percent || ''} onChange={e => setNewItem({ ...newItem, sgst_percent: e.target.value, gst: Number(newItem.cgst_percent || 0) + Number(e.target.value || 0) })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }} />
              </div>

              {/* Row 8 */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: 6 }}>Total GST (%)</label>
                <select value={newItem.gst || ''} onChange={e => {
                  const val = Number(e.target.value);
                  setNewItem({ ...newItem, gst: val, cgst_percent: val/2, sgst_percent: val/2 });
                }} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', outlineColor: '#2563EB', fontSize: 13 }}>
                  <option value="">None (0%)</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#F8FAFC', borderRadius: 8, padding: '8px 14px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Profit Calculator</div>
                {(() => {
                  const profit = Number(newItem.selling_rate || 0) - Number(newItem.rate || newItem.purchase_rate || 0);
                  const margin = Number(newItem.selling_rate || 0) > 0 ? (profit / Number(newItem.selling_rate)) * 100 : 0;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: profit > 0 ? '#16A34A' : '#DC2626' }}>₹{profit.toFixed(2)}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>({margin.toFixed(1)}% margin)</span>
                    </div>
                  );
                })()}
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
      {showImport && <ImportModal onClose={() => setShowImport(false)} fetchInventory={() => {fetchInventory(); fetchCategories()}} showToast={showToast} />}
    </div>
  )
}

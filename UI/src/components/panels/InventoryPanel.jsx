import { formatDate } from '../../utils/dateUtils';
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search, Plus, X, Package, Trash2, Edit2,
  AlertTriangle, AlertCircle, Upload, Download,
  CheckCircle, XCircle, CloudUpload, FileText, ChevronDown, Check,
  Camera, FileImage, Bot, ScanLine, SearchX, Pencil, TrendingUp, ChevronUp, Loader2, CheckSquare, Square
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import { callVisionAI } from '../../utils/api'
import ConfirmModal from '../ConfirmModal'
import { downloadTemplate, parseRows, exportCSV } from '../../features/inventory/utils/exportUtils'
import ImportModal from '../../features/inventory/components/ImportModal'
import InventoryItemModal from '../../features/inventory/components/InventoryItemModal'
import InventoryTable from '../../features/inventory/components/InventoryTable'
import GRNHistoryTable from '../../features/inventory/components/GRNHistoryTable'
import { ActionBtn, ColHeader, Pagination } from '../../features/inventory/components/InventoryShared'
import { InventoryAutocomplete, CategoryAutocomplete, FilterSelect, FilterChip, FormAutocomplete } from '../../features/inventory/components/InventoryFilters'

async function convertPdfToBase64Image(base64Pdf) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

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







/* ─── Main InventoryPanel ────────────────────────────────────── */


export default function InventoryPanel({ showToast }) {
  // Inventory States
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
      
      await backendFetch(`/inventory/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ [field]: Number(localVal) })
      })
      
      refetchInventory()
      fetchAllForAutocomplete()
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
  const [stats, setStats] = useState({})
  

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
  const [expandedGrnId, setExpandedGrnId] = useState(null)

  const tableRef = useRef(null)

  const queryClient = useQueryClient()

  // React Query fetchers
  const { data: allItems = [], refetch: fetchAllForAutocomplete } = useQuery({
    queryKey: ['inventory', 'all'],
    queryFn: async () => {
      const data = await backendFetch('/inventory?limit=10000&page=1')
      return Array.isArray(data) ? data : (data.items || [])
    },
    refetchInterval: 60000
  })

  useEffect(() => {
    setStats({
      totalItems: allItems.length,
      lowStock: allItems.filter(i => Number(i.qty) <= Number(i.min) && Number(i.qty) > 0).length,
      outOfStock: allItems.filter(i => Number(i.qty) === 0).length,
      overstock: allItems.filter(i => Number(i.qty) > Number(i.max)).length,
      totalValue: Math.round(allItems.reduce((sum, i) => sum + ((Number(i.qty) || 0) * (Number(i.rate) || 0)), 0))
    })
  }, [allItems])

  const { data: rawInventory, isLoading: isInventoryLoading, refetch: fetchInventory } = useQuery({
    queryKey: ['inventory', pagination.currentPage, pagination.itemsPerPage, search, category, status, sortBy],
    queryFn: async () => {
      const queryParams = new URLSearchParams({
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        search,
        category,
        status,
        sortBy
      })
      return backendFetch(`/inventory?${queryParams}`)
    },
    refetchInterval: 60000
  })

  const items = Array.isArray(rawInventory) 
    ? [...rawInventory].sort((a,b) => (a.name||'').localeCompare(b.name||'')) 
    : (rawInventory?.items || [])

  const activePagination = Array.isArray(rawInventory)
    ? { ...pagination, totalItems: rawInventory.length, totalPages: Math.ceil(rawInventory.length / pagination.itemsPerPage) }
    : (rawInventory?.pagination || pagination)

  const loading = isInventoryLoading

  const { data: categories = [], refetch: fetchCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const data = await backendFetch('/inventory/categories')
      return data.categories || []
    },
    refetchInterval: 60000
  })

  const { data: units = ['Nos', 'Kg', 'Ltrs', 'Set', 'Metre', 'Sqft'], refetch: fetchUnits } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const data = await backendFetch('/inventory/units')
      return data.units && data.units.length > 0 ? data.units : ['Nos', 'Kg', 'Ltrs', 'Set', 'Metre', 'Sqft']
    },
    refetchInterval: 60000
  })

  const { data: grnHistory = [], refetch: fetchGrnHistory } = useQuery({
    queryKey: ['grnHistory'],
    queryFn: async () => {
      const data = await backendFetch('/grn')
      return Array.isArray(data) ? data.slice(0, 5) : []
    },
    refetchInterval: 60000
  })

  // Debounced Search triggers React Query by changing `search` state
  // We can just rely on the search state changing to trigger a refetch,
  // but if we want to reset to page 1 on filter changes:
  useEffect(() => {
    setPagination(p => ({ ...p, currentPage: 1 }))
  }, [category, status, sortBy, pagination.itemsPerPage, search])

  const handlePageChange = (newPage) => {
    setPagination(p => ({ ...p, currentPage: newPage }))
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Action Handlers
  const handleEditClick = (item) => {
    document.getElementById('main-scroll-area')?.firstElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    document.getElementById('main-scroll-area')?.firstElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    document.getElementById('main-scroll-area')?.firstElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      
      parsed.items.sort((a, b) => {
        const nameA = (a.description || '').toLowerCase();
        const nameB = (b.description || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

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
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: 800, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, background: '#EFF6FF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Upload size={16} color="#2563EB" /></div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Upload Goods Receipt Note (GRN)</h3>
              </div>
              <button onClick={() => setGrnExpanded(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20}/></button>
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
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Drop GRN photo or PDF here</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 4 }}>Accepts jpg, png, pdf</div>
                <input ref={grnFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => processGrnFile(e.target.files[0])} style={{ display: 'none' }} />
              </div>
            )}

            {grnFile && !grnData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', padding: '20px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-main)' }}>
                <FileImage size={40} color="#2563EB" />
                <div style={{ fontWeight: 600 }}>{grnFile.name}</div>
                {grnError && <div style={{ color: '#DC2626', fontSize: 13 }}>{grnError}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setGrnFile(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer' }}>Cancel</button>
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
                          style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #A7F3D0', background: 'var(--bg-card)', fontSize: 13, marginTop: 4, outlineColor: '#34D399' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', overflowX: 'auto' }}>
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
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: 8 }}><input type="text" value={it.hsn || ''} onChange={e => handleChange('hsn', e.target.value)} style={{ width: '80px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13 }} /></td>
                            <td style={{ padding: 8 }}><input type="text" value={it.description || ''} onChange={e => handleChange('description', e.target.value)} style={{ width: '100%', minWidth: '150px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13 }} /></td>
                            <td style={{ padding: 8 }}><input type="number" value={it.quantity || ''} onChange={e => handleChange('quantity', e.target.value)} style={{ width: '60px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13 }} /></td>
                            <td style={{ padding: 8 }}>
                              <input type="number" value={it.unit_price || ''} onChange={e => handleChange('unit_price', e.target.value)} style={{ width: '70px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13 }} />
                            </td>
                            <td style={{ padding: 8 }}><input type="text" list="grn-unit-list" value={it.unit || ''} onChange={e => handleChange('unit', e.target.value)} style={{ width: '70px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13 }} /></td>
                            <td style={{ padding: 8 }}><input type="text" list="grn-cat-list" value={it.category || ''} onChange={e => handleChange('category', e.target.value)} style={{ width: '100px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13 }} /></td>
                            <td style={{ padding: 8 }}><input type="number" value={it.min || ''} onChange={e => handleChange('min', e.target.value)} style={{ width: '50px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13 }} /></td>
                            <td style={{ padding: 8 }}><input type="number" value={it.max || ''} onChange={e => handleChange('max', e.target.value)} style={{ width: '50px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13 }} /></td>
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
                  <button onClick={() => { setGrnData(null); setGrnFile(null) }} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', fontWeight: 600, cursor: 'pointer' }}>Discard</button>
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
      <div ref={tableRef} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        {/* Header Row */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Inventory</h2>
            <span style={{ background: '#EFF6FF', color: '#2563EB', padding: '4px 10px', borderRadius: 99, fontSize: 13, fontWeight: 700 }}>{activePagination.totalItems} items</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { document.getElementById('main-scroll-area')?.firstElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setGrnExpanded(true); }} style={{ height: 36, padding: '0 16px', borderRadius: 8, background: '#EFF6FF', color: '#2563EB', border: '1.5px solid #2563EB', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Upload size={16} /> Upload GRN
            </button>
            <button onClick={() => { document.getElementById('main-scroll-area')?.firstElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setShowImport(true); }} style={{ height: 36, padding: '0 16px', borderRadius: 8, background: 'var(--bg-card)', color: '#2563EB', border: '1.5px solid #2563EB', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Download size={16} /> Import CSV
            </button>
            <button onClick={() => exportCSV(items)} style={{ height: 36, padding: '0 16px', borderRadius: 8, background: 'var(--bg-card)', color: '#16A34A', border: '1.5px solid #16A34A', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Upload size={16} /> Export CSV
            </button>
            <button onClick={() => { document.getElementById('main-scroll-area')?.firstElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setNewItem(prev => ({ hsn: '', name: '', category: prev?.category || 'General', total_qty: '', qty: '', unit: prev?.unit || '', min: '', max: '', cost_price: '', rate: '', date_added: prev?.date_added || '', last_restocked: prev?.last_restocked || '', gst: prev?.gst || '' })); setEditingItemId(null); setAdding(true) }} style={{ height: 36, padding: '0 16px', borderRadius: 8, background: '#2563EB', color: 'white', border: 'none', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Plus size={16} /> Add Item
            </button>
          </div>
        </div>

        {/* Search & Filter Row */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: '#FAFBFC' }}>
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
              {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ height: 50, background: 'var(--bg-main)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />)}
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-primary)' }}>
              {search ? (
                <>
                  <SearchX size={56} color="#94A3B8" style={{ margin: '0 auto 16px auto' }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Item not found</div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8, maxWidth: 300, margin: '8px auto' }}>
                    No items match '{search}'. Try checking the spelling or search by HSN or category.
                  </div>
                  <button onClick={() => setSearch('')} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#EFF6FF', color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}>Clear Search</button>
                </>
              ) : status === 'low' ? (
                <>
                  <CheckCircle size={56} color="#10B981" style={{ margin: '0 auto 16px auto' }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>No Low Stock Items</div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>All items are above minimum levels.</div>
                  <button onClick={() => {setStatus('all'); setPagination(p => ({...p, currentPage: 1}))}} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#EFF6FF', color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}>Clear Filter</button>
                </>
              ) : status === 'ok' ? (
                <>
                  <Package size={56} color="#94A3B8" style={{ margin: '0 auto 16px auto' }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>No Items with OK Status</div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>Check your min/max levels.</div>
                  <button onClick={() => {setStatus('all'); setPagination(p => ({...p, currentPage: 1}))}} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#EFF6FF', color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}>Clear Filter</button>
                </>
              ) : status === 'overstock' ? (
                <>
                  <CheckCircle size={56} color="#10B981" style={{ margin: '0 auto 16px auto' }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>No Overstock Items</div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>All items are within limits.</div>
                  <button onClick={() => {setStatus('all'); setPagination(p => ({...p, currentPage: 1}))}} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#EFF6FF', color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}>Clear Filter</button>
                </>
              ) : status === 'out' ? (
                <>
                  <CheckCircle size={56} color="#10B981" style={{ margin: '0 auto 16px auto' }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>No Out of Stock Items</div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>All items have stock available.</div>
                  <button onClick={() => {setStatus('all'); setPagination(p => ({...p, currentPage: 1}))}} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#EFF6FF', color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}>Clear Filter</button>
                </>
              ) : category !== 'all' ? (
                <>
                  <div style={{ fontSize: 56, margin: '0 auto 16px auto' }}>📁</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>No items found in '{category}'</div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>Try selecting a different category.</div>
                  <button onClick={() => {setCategory('all'); setPagination(p => ({...p, currentPage: 1}))}} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#EFF6FF', color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}>Clear Filter</button>
                </>
              ) : (
                <>
                  <Package size={56} color="#94A3B8" style={{ margin: '0 auto 16px auto' }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>No Items Found</div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>Try adjusting your filters or search.</div>
                </>
              )}
            </div>
          ) : (
            <InventoryTable
              items={items}
              pagination={activePagination}
              search={search}
              getValue={getValue}
              handleFieldChange={handleFieldChange}
              saveFieldToBackend={saveFieldToBackend}
              grnHistory={grnHistory}
              handleEditClick={handleEditClick}
              handleDamage={handleDamage}
              handleDelete={handleDelete}
              formatQty={formatQty}
            />
          )}
        
        {/* Pagination Wrapper */}
        <div style={{ padding: '0 24px' }}>
          {!search && items.length > 0 && (
            <Pagination
              currentPage={activePagination.currentPage}
              totalPages={activePagination.totalPages}
              totalItems={activePagination.totalItems}
              itemsPerPage={activePagination.itemsPerPage}
              onPageChange={handlePageChange}
              onLimitChange={limit => { setPagination(p => ({ ...p, itemsPerPage: limit, currentPage: 1 })); refetchInventory(); }}
            />
          )}
        </div>
      </div>

      {/* GRN History Mini Table (Always visible if there's history) */}
      <GRNHistoryTable
        grnHistory={grnHistory}
        grnData={grnData}
        expandedGrnId={expandedGrnId}
        setExpandedGrnId={setExpandedGrnId}
        handleDeleteGrn={handleDeleteGrn}
      />

      <InventoryItemModal
        adding={adding}
        setAdding={setAdding}
        editingItemId={editingItemId}
        newItem={newItem}
        setNewItem={setNewItem}
        categories={categories}
        units={units}
        handleAdd={handleAdd}
        fetchCategories={fetchCategories}
        fetchUnits={fetchUnits}
        FormAutocomplete={CategoryAutocomplete}
      />

      {/* Confirm Modal */}
      {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} fetchInventory={() => {fetchInventory(); fetchCategories()}} showToast={showToast} />}
    </div>
  )
}

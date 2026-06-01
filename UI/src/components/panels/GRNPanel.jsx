import { useState, useRef } from 'react'
import { callVisionAI } from '../../utils/api'
import { backendFetch } from '../../utils/backend'
import * as pdfjsLib from 'pdfjs-dist'
import {
  Upload, Loader2, AlertTriangle, X, CheckCircle, AlertCircle, FileImage, FileText,
  Edit3, Globe, Camera, ScanLine, Bot
} from 'lucide-react'

// Use CDN worker matching the installed pdfjs-dist version
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

  // Return as PNG base64 (without data: prefix)
  const dataUrl = canvas.toDataURL('image/png')
  return dataUrl.split(',')[1]
}

function buildPrompt() {
  return `Extract GRN data. Return ONLY JSON: { "supplier_name": "", "grn_number": "", "po_number": "", "date": "", "items": [{ "sku": "", "description": "", "quantity": "", "unit": "", "unit_price": "" }] }`
}

const HEADER_FIELDS = ['supplier_name', 'grn_number', 'po_number', 'date']
const ITEM_FIELDS   = ['sku', 'description', 'quantity', 'unit', 'unit_price']
const fieldLabel = (f) => f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const isUnclear   = (v) => v === null || v === 'unclear' || v === '' || (typeof v === 'string' && v.toLowerCase().includes('unclear'))

function ConfidenceDot({ fieldVal, isTamil }) {
  if (isUnclear(fieldVal)) return <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#DC2626', flexShrink: 0 }} />
  if (isTamil) return <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D97706', flexShrink: 0 }} />
  return <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} />
}

export default function GRNPanel({ showToast }) {
  const fileRef = useRef()
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [fileType, setFileType] = useState('')
  const [base64Data, setBase64] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [confirmed, setConfirmed] = useState(new Set())
  const [approving, setApproving] = useState(false)

  const [isPdfConverting, setIsPdfConverting] = useState(false)

  const processFile = (f) => {
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError('Please upload a PDF, JPG, PNG, or WEBP file.')
      showToast?.('Invalid file format', 'error')
      return
    }

    setFile(f); setFileName(f.name); setFileType(f.type)
    setData(null); setError(null); setConfirmed(new Set())

    const reader = new FileReader()
    reader.onload = (e) => {
      const b64 = e.target.result.split(',')[1]
      setBase64(b64)
      if (f.type === 'application/pdf') {
        showToast?.('PDF uploaded. Converting to image...', 'info')
      }
    }
    reader.readAsDataURL(f)
  }

  const extractData = async () => {
    if (!base64Data) return
    setLoading(true); setError(null); setData(null); setConfirmed(new Set())
    try {
      let imageBase64 = base64Data
      let imageMime = fileType

      // Convert PDF page 1 to PNG before sending to Vision API
      if (fileType === 'application/pdf') {
        setIsPdfConverting(true)
        showToast?.('Converting PDF to image...', 'info')
        imageBase64 = await convertPdfToBase64Image(base64Data)
        imageMime = 'image/png'
        setIsPdfConverting(false)
      }

      const parsed = await callVisionAI(null, imageBase64, imageMime)
      if (!parsed.items) parsed.items = []
      setData(parsed)
      showToast?.('Extraction successful', 'success')
    } catch (e) {
      setIsPdfConverting(false)
      setError(`Vision API Error: ${e.message}`)
      showToast?.('Extraction failed', 'error')
    }
    setLoading(false)
  }

  const handleApprove = async () => {
    setApproving(true)
    try {
      await backendFetch('/grn', {
        method: 'POST',
        body: JSON.stringify({
          supplier: data.supplier_name || 'Unknown Supplier',
          date: data.date,
          items: data.items,
          updateInventory: true
        })
      })
      showToast?.('GRN approved and stock updated', 'success')
    } catch (err) {
      showToast?.(err.message || 'Failed to approve GRN', 'error')
    } finally {
      setFile(null); setFileName(''); setFileType(''); setBase64('')
      setData(null); setError(null); setConfirmed(new Set()); setApproving(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const setHeader = (f, v) => setData(p => ({ ...p, [f]: v }))
  const setItem = (i, f, v) => setData(p => { const items = [...p.items]; items[i] = { ...items[i], [f]: v }; return { ...p, items } })

  const renderField = (value, onChange, fkey) => (
    <input
      type="text"
      value={value === null ? '' : value}
      placeholder={value === null ? 'Not found' : isUnclear(value) ? 'Unclear' : ''}
      onChange={e => { onChange(e.target.value); setConfirmed(p => new Set([...p, fkey])) }}
      onClick={() => setConfirmed(p => new Set([...p, fkey]))}
      className="input-base"
      style={{ height: '32px', padding: '0 8px', fontSize: '13px', background: confirmed.has(fkey) ? 'white' : (isUnclear(value) ? '#FEF2F2' : 'white'), borderColor: confirmed.has(fkey) ? 'transparent' : (isUnclear(value) ? '#FECACA' : 'transparent') }}
    />
  )

  const uploadZoneStyle = {
    background: dragging ? '#EFF6FF' : 'white',
    border: `2px dashed ${dragging ? '#2563EB' : '#CBD5E1'}`,
    borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', gap: '16px', cursor: 'pointer', transition: 'all 0.2s'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
      {!file ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            style={uploadZoneStyle}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
            onClick={() => !loading && fileRef.current.click()}
          >
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,image/jpeg,image/png" onChange={e => { const f = e.target.files[0]; if (f) processFile(f) }} />
            <Camera size={48} color="#94A3B8" />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', marginBottom: '6px' }}>Drop GRN Photo/PDF here</p>
              <button className="btn-press" style={{ padding: '8px 20px', border: '1.5px solid #2563EB', color: '#2563EB', borderRadius: '8px', fontSize: '13px', fontWeight: 500, background: 'transparent', cursor: 'pointer', marginTop: '12px' }}>Browse Files</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {fileType === 'application/pdf' ? <FileText size={20} color="#2563EB" /> : <FileImage size={20} color="#2563EB" />}
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{fileName}</p>
                <p style={{ fontSize: '12px', color: '#64748B' }}>{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button onClick={() => setFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
          </div>

          {!data && !loading && (
            <button onClick={extractData} className="btn-press" style={{ width: '100%', height: '44px', borderRadius: '8px', background: '#2563EB', color: 'white', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none', cursor: 'pointer' }}><ScanLine size={18} /> Extract Data</button>
          )}
        </div>
      )}

      {loading && (
        <div className="skeleton" style={{ height: '200px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748B', fontSize: '14px', fontWeight: 500 }}>
            <Loader2 size={18} className="animate-spin" />
            {isPdfConverting ? 'Converting PDF to image...' : 'Extracting data from document...'}
          </div>
        </div>
      )}
      {error && <div style={{ padding: '16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', color: '#DC2626', fontWeight: 500 }}>{error}</div>}


      {data && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {HEADER_FIELDS.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '99px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{fieldLabel(f)}</span>
                <div style={{ width: '120px' }}>{renderField(data[f], v => setHeader(f, v), `header-${f}`)}</div>
              </div>
            ))}
          </div>

          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th style={{ width: '32px' }}></th>{ITEM_FIELDS.map(h => <th key={h}>{fieldLabel(h)}</th>)}</tr></thead>
                <tbody>
                  {data.items.map((item, i) => (
                    <tr key={i} className="group">
                      <td style={{ textAlign: 'center' }}><Edit3 size={14} color="#CBD5E1" /></td>
                      {ITEM_FIELDS.map(f => (
                        <td key={f} style={{ padding: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ConfidenceDot fieldVal={item[f]} isTamil={false} />
                            {renderField(item[f], v => setItem(i, f, v), `item-${i}-${f}`)}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button onClick={handleApprove} disabled={approving} className="btn-press" style={{ width: '100%', height: '44px', borderRadius: '8px', background: '#16A34A', color: 'white', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none', cursor: approving ? 'not-allowed' : 'pointer', opacity: approving ? 0.7 : 1 }}>
            {approving ? <><Loader2 size={18} className="animate-spin" /> Updating...</> : <><CheckCircle size={18} /> Approve & Update Stock</>}
          </button>
        </div>
      )}
    </div>
  )
}

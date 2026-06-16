import React, { useState, useRef, useCallback } from 'react';
import { backendFetch } from '../../../utils/backend';
import { downloadTemplate, parseRows } from '../utils/exportUtils';

export default function ImportModal({ onClose, fetchInventory, showToast }) {
  const internalRef = useRef(null)
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
      reader.onload = async (e) => {
        try {
          const XLSX = await import('xlsx')
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

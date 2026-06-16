import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, Table } from 'lucide-react';

export default function ExportButton({ onExportPDF, onExportExcel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button 
        onClick={() => setOpen(!open)} 
        style={{ 
          display: 'flex', alignItems: 'center', gap: 6, background: '#2563EB', 
          border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', 
          fontSize: 13, fontWeight: 600, color: 'white' 
        }}
      >
        <Download size={14} /> Download
      </button>
      
      {open && (
        <div style={{ 
          position: 'absolute', top: '100%', right: 0, marginTop: 8, 
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, 
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 50, 
          minWidth: 140, overflow: 'hidden' 
        }}>
          <button 
            onClick={() => { setOpen(false); onExportPDF(); }}
            style={{ 
              width: '100%', textAlign: 'left', padding: '10px 16px', 
              background: 'transparent', border: 'none', cursor: 'pointer', 
              fontSize: 13, color: 'var(--text-secondary)', borderBottom: '1px solid #F1F5F9',
              display: 'flex', alignItems: 'center', gap: 8
            }}
            onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            <FileText size={14} /> PDF Format
          </button>
          <button 
            onClick={() => { setOpen(false); onExportExcel(); }}
            style={{ 
              width: '100%', textAlign: 'left', padding: '10px 16px', 
              background: 'transparent', border: 'none', cursor: 'pointer', 
              fontSize: 13, color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 8
            }}
            onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            <Table size={14} /> Excel Format
          </button>
        </div>
      )}
    </div>
  );
}

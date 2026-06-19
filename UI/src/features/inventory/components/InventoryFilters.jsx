import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Plus } from 'lucide-react';

export const InventoryAutocomplete = ({
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
          style={{ width: '100%', height: 40, paddingLeft: 38, paddingRight: value ? 36 : 12, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', transition: 'border 0.2s ease', boxSizing: 'border-box' }}
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
        <div ref={dropdownRef} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden', maxHeight: 320, overflowY: 'auto' }}>
          {prefixCount > 0 && (
            <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg-main)', borderBottom: '1px solid #F1F5F9' }}>
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
                  <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg-main)', borderBottom: '1px solid #F1F5F9', borderTop: '1px solid #F1F5F9' }}>
                    Other matches
                  </div>
                )}
                <div
                  onClick={() => selectSuggestion(item)}
                  style={{ padding: '10px 14px', cursor: 'pointer', background: index === activeIndex ? '#EFF6FF' : 'white', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.15s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; setActiveIndex(index) }}
                  onMouseLeave={e => { if (index !== activeIndex) e.currentTarget.style.background = 'white' }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>📦</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: isPrefix ? 500 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {highlightText(item.name, value)}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, display: 'flex', gap: 8 }}>
                      <span>{highlightText(item.hsn, value)}</span>
                      <span>•</span>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.category}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.qty} {item.unit}</div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: statusBadge.color, background: statusBadge.color + '18', padding: '1px 6px', borderRadius: 999 }}>
                      {statusBadge.label}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
          <div style={{ padding: '6px 12px', fontSize: 11, color: '#94A3B8', background: 'var(--bg-main)', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 12 }}>
            <span>↑↓ Navigate</span><span>Enter to select</span><span>Esc to close</span>
          </div>
        </div>
      )}
    </div>
  )
}

export const CategoryAutocomplete = ({ value, onChange, categories, onAddCategory, width = 180 }) => {
  const [inputValue, setInputValue] = useState(value === 'all' ? '' : value)
  const [showDropdown, setShowDropdown] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    setInputValue(value === 'all' ? '' : value)
  }, [value])

  const safeCategories = categories || []
  const filtered = safeCategories.filter(c => c.toLowerCase().includes(inputValue.toLowerCase()))
  const isExactMatch = safeCategories.some(c => c.toLowerCase() === inputValue.trim().toLowerCase())

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
        style={{ width: '100%', height: 40, padding: '0 12px', paddingRight: 30, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, outlineColor: '#2563EB', boxSizing: 'border-box' }}
      />
      <ChevronDown size={14} color="#64748B" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      {showDropdown && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
          <div
            onClick={() => { onChange('all'); setInputValue(''); setShowDropdown(false) }}
            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid #F1F5F9' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            All Categories
          </div>
          {filtered.map(cat => (
            <div
              key={cat}
              onClick={() => { onChange(cat); setInputValue(cat); setShowDropdown(false) }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}
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
        </div>
      )}
    </div>
  )
}

export const FilterSelect = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    style={{ height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: '#374151', background: 'var(--bg-card)', cursor: 'pointer', outline: 'none', minWidth: 140 }}
  >
    {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
  </select>
)

export const FilterChip = ({ label, onRemove }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 12, color: '#2563EB', fontWeight: 500 }}>
    {label}
    <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1, display: 'flex' }}>×</button>
  </div>
)

export const FormAutocomplete = ({ value, onChange, options, onAddOption, placeholder = "Select...", width = '100%' }) => {
  const [inputValue, setInputValue] = useState(value || '')
  const [showDropdown, setShowDropdown] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    setInputValue(value || '')
  }, [value])

  const safeOptions = options || []
  const filtered = safeOptions.filter(o => o.toLowerCase().includes(inputValue.toLowerCase()))
  const isExactMatch = safeOptions.some(o => o.toLowerCase() === inputValue.trim().toLowerCase())

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
        style={{ width: '100%', height: 40, padding: '0 12px', paddingRight: 30, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, outlineColor: '#2563EB', boxSizing: 'border-box' }}
      />
      <ChevronDown size={14} color="#64748B" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      {showDropdown && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
          {filtered.map(opt => (
            <div
              key={opt}
              onClick={() => { onChange(opt); setInputValue(opt); setShowDropdown(false) }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}
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

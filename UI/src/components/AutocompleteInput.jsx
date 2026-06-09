import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function AutocompleteInput({ 
  value, 
  onChange, 
  onSelect,
  inventory = [],
  placeholder 
}) {
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    if (showDropdown && inputRef.current) {
      const updateCoords = () => {
        const rect = inputRef.current.getBoundingClientRect()
        setCoords({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        })
      }
      updateCoords()
      window.addEventListener('scroll', updateCoords, true)
      window.addEventListener('resize', updateCoords)
      return () => {
        window.removeEventListener('scroll', updateCoords, true)
        window.removeEventListener('resize', updateCoords)
      }
    }
  }, [showDropdown, suggestions])

  // Search inventory when user types
  useEffect(() => {
    if (!value || value.length < 1) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    const searchTerm = value.toLowerCase()
    const exactStarts = []
    const includes = []
    
    inventory.forEach(item => {
      const name = (item.name || '').toLowerCase()
      const hsn = (item.hsn || '').toLowerCase()
      const category = (item.category || '').toLowerCase()
      
      if (name.startsWith(searchTerm) || hsn.startsWith(searchTerm)) {
        exactStarts.push(item)
      } else if (name.includes(searchTerm) || hsn.includes(searchTerm) || category.includes(searchTerm)) {
        includes.push(item)
      }
    })
    
    const matches = [...exactStarts, ...includes].slice(0, 8)

    setSuggestions(matches)
    setShowDropdown(matches.length > 0)
    setActiveIndex(-1)
  }, [value, inventory])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!showDropdown) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : 0
      )
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => 
        prev > 0 ? prev - 1 : suggestions.length - 1
      )
    }
    if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIndex])
    }
    if (e.key === 'Escape') {
      setShowDropdown(false)
      setActiveIndex(-1)
    }
  }

  const handleSelect = (item) => {
    onSelect(item)
    setShowDropdown(false)
    setSuggestions([])
  }

  // Highlight matching text in suggestion
  const highlightMatch = (text, query) => {
    if (!text) return ''
    const index = text.toLowerCase().indexOf(query.toLowerCase())
    if (index === -1) return text
    return (
      <>
        {text.slice(0, index)}
        <span className="font-bold text-blue-600">
          {text.slice(index, index + query.length)}
        </span>
        {text.slice(index + query.length)}
      </>
    )
  }

  // Stock status color
  const getStockColor = (item) => {
    const qty = Number(item.qty) || 0
    const min = Number(item.minLevel) || 0
    const max = Number(item.maxLevel) || Infinity
    if (qty <= min) return 'text-red-500'
    if (qty >= max) return 'text-amber-500'
    return 'text-green-500'
  }

  return (
    <div className="relative w-full">
      {/* Input Field */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) 
            setShowDropdown(true)
        }}
        placeholder={placeholder || "Type item name..."}
        className="w-full h-10 px-3 rounded-lg border 
                   border-gray-200 text-sm
                   focus:outline-none focus:ring-2 
                   focus:ring-blue-200 focus:border-blue-400"
      />

      {/* Search icon inside input */}
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            setSuggestions([])
            setShowDropdown(false)
            inputRef.current?.focus()
          }}
          className="absolute right-2 top-1/2 
                     -translate-y-1/2 text-gray-400 
                     hover:text-gray-600"
        >
          ✕
        </button>
      )}

      {/* Dropdown */}
      {showDropdown && suggestions.length > 0 && createPortal(
        <div
          ref={dropdownRef}
          style={{ top: coords.top + 4, left: coords.left, width: coords.width }}
          className="absolute bg-white border border-gray-200 
                     rounded-lg shadow-lg z-[99999] 
                     max-h-64 overflow-y-auto"
        >
          {suggestions.map((item, index) => (
            <div
              key={item.id || item.hsn || index}
              onClick={() => handleSelect(item)}
              className={`
                px-3 py-2.5 cursor-pointer 
                border-b border-gray-50 last:border-0
                transition-colors
                ${activeIndex === index 
                  ? 'bg-blue-50' 
                  : 'hover:bg-gray-50'
                }
              `}
            >
              {/* Item Name with highlight */}
              <div className="text-sm text-gray-900">
                {highlightMatch(item.name, value)}
              </div>

              {/* HSN + Stock info */}
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-gray-400">
                  {item.hsn}
                </span>
                <span className={`text-xs font-medium ${getStockColor(item)}`}>
                  Stock: {parseFloat(Number(item.qty).toFixed(6))} {item.unit}
                </span>
                <span className="text-xs text-gray-400">
                  Rate: ₹{item.rate || '-'}
                </span>
              </div>
            </div>
          ))}

          {/* Footer hint */}
          <div className="px-3 py-1.5 bg-gray-50 
                          border-t border-gray-100">
            <p className="text-xs text-gray-400">
              ↑↓ Navigate  •  Enter to select  •  Esc to close
            </p>
          </div>
        </div>
      , document.body)}

      {/* No results message */}
      {value.length >= 1 && 
       suggestions.length === 0 && 
       showDropdown === false && (
        <div className="absolute top-full left-0 
                        right-0 mt-1 bg-white border 
                        border-gray-200 rounded-lg 
                        shadow-sm z-50 px-3 py-2">
          <p className="text-xs text-gray-400">
            No items found. Type freely or add to inventory first.
          </p>
        </div>
      )}
    </div>
  )
}

import re

filepath = 'd:/Inventory/UI/src/components/AutocompleteInput.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add createPortal import
if "createPortal" not in content:
    content = content.replace("import { useState, useEffect, useRef } from 'react'", "import { useState, useEffect, useRef } from 'react'\nimport { createPortal } from 'react-dom'")

# 2. Add coords state and effect
coords_state = """  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })

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
  }, [showDropdown, suggestions])"""

# Inject coords_state right after inputRef declaration
if "const [coords, setCoords] = useState" not in content:
    content = content.replace("const dropdownRef = useRef(null)", "const dropdownRef = useRef(null)\n" + coords_state)

# 3. Update search logic to prioritize startsWith
old_search = """    const matches = inventory.filter(item =>
      (item.name && item.name.toLowerCase().includes(searchTerm)) ||
      (item.hsn && item.hsn.toLowerCase().includes(searchTerm)) ||
      (item.category && item.category.toLowerCase().includes(searchTerm))
    ).slice(0, 6) // max 6 suggestions"""

new_search = """    const exactStarts = []
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
    
    const matches = [...exactStarts, ...includes].slice(0, 8)"""

content = content.replace(old_search, new_search)

# 4. Replace dropdown rendering with createPortal
old_dropdown_start = "{showDropdown && suggestions.length > 0 && ("
new_dropdown_start = "{showDropdown && suggestions.length > 0 && createPortal("

# We need to change the styling of the dropdown container to use coords
old_dropdown_div = """        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 
                     mt-1 bg-white border border-gray-200 
                     rounded-lg shadow-lg z-50 
                     max-h-64 overflow-y-auto"
        >"""

new_dropdown_div = """        <div
          ref={dropdownRef}
          style={{ top: coords.top + 4, left: coords.left, width: coords.width }}
          className="absolute bg-white border border-gray-200 
                     rounded-lg shadow-lg z-[99999] 
                     max-h-64 overflow-y-auto"
        >"""

# Also need to close the createPortal parenthesis at the end
# The end of the dropdown is:
#           </div>
#         </div>
#       )}

old_dropdown_end = """        </div>
      )}"""
new_dropdown_end = """        </div>
      ), document.body)}"""

if old_dropdown_start in content:
    content = content.replace(old_dropdown_start, new_dropdown_start)
    content = content.replace(old_dropdown_div, new_dropdown_div)
    content = content.replace(old_dropdown_end, new_dropdown_end)
else:
    print("Could not find dropdown start")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated AutocompleteInput!")

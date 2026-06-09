import re

filepath = 'd:/Inventory/UI/src/components/panels/InventoryPanel.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# ── 1. Insert SmartComboBox after the imports block ──────────────
smart_combo = '''
/* \u2500\u2500\u2500 SmartComboBox \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function SmartComboBox({ value, onChange, options, placeholder = 'Select or type...' }) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const ref = React.useRef(null)

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
  const isCustom = query.trim() && !options.some(o => o.toLowerCase() === query.toLowerCase())

  const select = (val) => { onChange(val); setQuery(''); setOpen(false) }

  return (
    <div ref={ref} style={{ position: \'relative\' }}>
      <div style={{
        display: \'flex\', alignItems: \'center\',
        border: `1.5px solid ${open ? \'#2563EB\' : \'#E2E8F0\'}`,
        borderRadius: \'10px\', background: \'white\',
        boxShadow: open ? \'0 0 0 3px rgba(37,99,235,0.12)\' : \'0 1px 3px rgba(0,0,0,0.05)\',
        transition: \'all 0.15s\', overflow: \'hidden\',
      }}>
        <input
          type="text"
          value={open ? query : value}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value) }}
          onFocus={() => { setOpen(true); setQuery(\'\') }}
          placeholder={value || placeholder}
          autoComplete="off"
          style={{
            flex: 1, border: \'none\', outline: \'none\', padding: \'10px 14px\',
            fontSize: \'13px\', fontFamily: "\'Inter\', sans-serif",
            color: \'#0F172A\', background: \'transparent\', cursor: \'text\',
          }}
        />
        <div
          onClick={() => setOpen(o => !o)}
          style={{ padding: \'0 12px\', color: \'#94A3B8\', cursor: \'pointer\', transition: \'transform 0.2s\', transform: open ? \'rotate(180deg)\' : \'rotate(0)\' }}
        >
          <ChevronDown size={15} />
        </div>
      </div>

      {open && (
        <div
          className="dropdown-open"
          style={{
            position: \'absolute\', top: \'calc(100% + 6px)\', left: 0, right: 0, zIndex: 9000,
            background: \'white\', borderRadius: \'12px\',
            border: \'1px solid #E2E8F0\',
            boxShadow: \'0 16px 40px rgba(0,0,0,0.13), 0 3px 10px rgba(0,0,0,0.06)\',
            overflow: \'hidden\',
          }}
        >
          {options.length > 4 && (
            <div style={{ padding: \'8px 12px\', borderBottom: \'1px solid #F1F5F9\', background: \'#FAFBFC\' }}>
              <span style={{ fontSize: \'10px\', color: \'#94A3B8\', fontWeight: 700, letterSpacing: \'0.08em\', textTransform: \'uppercase\' }}>Select or type to add new</span>
            </div>
          )}
          <div style={{ maxHeight: \'196px\', overflowY: \'auto\' }}>
            {filtered.length === 0 && !isCustom && (
              <div style={{ padding: \'14px\', textAlign: \'center\', color: \'#94A3B8\', fontSize: \'13px\' }}>No matches</div>
            )}
            {filtered.map((opt, i) => (
              <div
                key={opt}
                onMouseDown={() => select(opt)}
                style={{
                  padding: \'10px 14px\', cursor: \'pointer\', fontSize: \'13px\',
                  color: opt === value ? \'#2563EB\' : \'#0F172A\',
                  background: opt === value ? \'#EFF6FF\' : \'white\',
                  fontWeight: opt === value ? 600 : 400,
                  display: \'flex\', alignItems: \'center\', justifyContent: \'space-between\',
                  borderBottom: i < filtered.length - 1 || isCustom ? \'1px solid #F8FAFC\' : \'none\',
                  transition: \'background 0.1s\',
                }}
                onMouseEnter={e => { if (opt !== value) e.currentTarget.style.background = \'#F8FAFC\' }}
                onMouseLeave={e => { e.currentTarget.style.background = opt === value ? \'#EFF6FF\' : \'white\' }}
              >
                <span>{opt}</span>
                {opt === value && <Check size={13} color="#2563EB" />}
              </div>
            ))}
            {isCustom && (
              <div
                onMouseDown={() => select(query.trim())}
                style={{
                  padding: \'10px 14px\', cursor: \'pointer\', fontSize: \'13px\',
                  color: \'#2563EB\', fontWeight: 600, background: \'white\',
                  borderTop: filtered.length > 0 ? \'1px solid #E2E8F0\' : \'none\',
                  display: \'flex\', alignItems: \'center\', gap: \'8px\',
                }}
                onMouseEnter={e => e.currentTarget.style.background = \'#EFF6FF\'}
                onMouseLeave={e => e.currentTarget.style.background = \'white\'}
              >
                <Plus size={13} /> Add "{query.trim()}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

'''

# Insert SmartComboBox after the import block (after "import { backendFetch }" line)
insert_after = "import { backendFetch } from '../../utils/backend'"
content = content.replace(insert_after, insert_after + smart_combo, 1)

# ── 2. Replace React.useState with useState (since we import directly) ──
content = content.replace('React.useState(false)', 'useState(false)')
content = content.replace('React.useState(\'\')', "useState('')")
content = content.replace('React.useRef(null)', 'useRef(null)')
content = content.replace('React.useEffect(', 'useEffect(')

# ── 3. Replace Category datalist with SmartComboBox ──────────────────────
old_cat = """                <input
                  list="category-options"
                  className="input-base"
                  value={newItem.category}
                  onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                  placeholder="Select or type new..."
                />
                <datalist id="category-options">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>"""
new_cat = """                <SmartComboBox
                  value={newItem.category}
                  onChange={val => setNewItem({ ...newItem, category: val })}
                  options={categories}
                  placeholder="Select or type new..."
                />"""
content = content.replace(old_cat, new_cat)

# ── 4. Replace Unit datalist with SmartComboBox ───────────────────────────
old_unit = """                <input
                  list="unit-options"
                  className="input-base"
                  value={newItem.unit}
                  onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                  placeholder="e.g. Nos, Ltrs..."
                />
                <datalist id="unit-options">
                  {units.map(u => <option key={u} value={u} />)}
                </datalist>"""
new_unit = """                <SmartComboBox
                  value={newItem.unit}
                  onChange={val => setNewItem({ ...newItem, unit: val })}
                  options={units}
                  placeholder="e.g. Nos, Ltrs, Kgs..."
                />"""
content = content.replace(old_unit, new_unit)

# ── 5. Add row animation state in InventoryPanel ──────────────────────────
old_state = "  const [confirmModal, setConfirmModal] = useState(null) // { message, title, onConfirm }"
new_state = """  const [confirmModal, setConfirmModal] = useState(null) // { message, title, onConfirm }
  const [exitingRows, setExitingRows] = useState(new Set())
  const [newRowIds, setNewRowIds] = useState(new Set())"""
content = content.replace(old_state, new_state)

# ── 6. Update handleDelete to animate exit first ──────────────────────────
old_delete_confirm = """        setConfirmModal(null)
        setInventory(prev => prev.filter(i => i.id !== id))
        showToast?.(`Item deleted`, 'success')
        try {
          await backendFetch(`/inventory/${id}`, { method: 'DELETE' })
        } catch (err) {
          showToast?.(err.message, 'error')
        }"""
new_delete_confirm = """        setConfirmModal(null)
        // Animate exit first
        setExitingRows(prev => new Set([...prev, id]))
        setTimeout(async () => {
          setInventory(prev => prev.filter(i => i.id !== id))
          setExitingRows(prev => { const n = new Set(prev); n.delete(id); return n })
          showToast?.(`Item deleted`, 'success')
          try {
            await backendFetch(`/inventory/${id}`, { method: 'DELETE' })
          } catch (err) {
            showToast?.(err.message, 'error')
          }
        }, 320)"""
content = content.replace(old_delete_confirm, new_delete_confirm)

# ── 7. Update handleAdd confirm to mark new row ───────────────────────────
old_add_else = """          setInventory(prev => [processedItem, ...prev])
          showToast?.('Item added successfully', 'success')
          backendFetch(`/inventory`, { method: 'POST', body: JSON.stringify(processedItem) }).catch(err => showToast?.(err.message, 'error'))"""
new_add_else = """          const tempId = processedItem.id || `temp-${Date.now()}`
          const itemWithId = { ...processedItem, _tempId: tempId }
          setInventory(prev => [processedItem, ...prev])
          setNewRowIds(prev => new Set([...prev, 0]))
          setTimeout(() => setNewRowIds(new Set()), 500)
          showToast?.('Item added successfully', 'success')
          backendFetch(`/inventory`, { method: 'POST', body: JSON.stringify(processedItem) }).catch(err => showToast?.(err.message, 'error'))"""
content = content.replace(old_add_else, new_add_else)

# ── 8. Add row-enter and row-exit classes to table rows ───────────────────
old_tr = "                  <tr key={item.id} style={{ borderLeft: isLow ? '3px solid #DC2626' : '3px solid transparent' }}>"
new_tr = "                  <tr key={item.id} className={exitingRows.has(item.id) ? 'row-exit' : ''} style={{ borderLeft: isLow ? '3px solid #DC2626' : '3px solid transparent', transition: 'background 0.2s' }}>"
content = content.replace(old_tr, new_tr)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! SmartComboBox inserted, row animations added.")

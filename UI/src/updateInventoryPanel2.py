import os

filepath = 'd:/Inventory/UI/src/components/panels/InventoryPanel.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Header changes
content = content.replace("'SKU'", "'HSN'")
content = content.replace("SKU is required", "HSN is required")
content = content.replace("SKU / Code", "HSN / Code")
content = content.replace("Total SKUs", "Total Items")

# Rename variables
content = content.replace(".sku", ".hsn")
content = content.replace("sku:", "hsn:")
content = content.replace("sku =", "hsn =")
content = content.replace("{sku}", "{hsn}")
content = content.replace("item.sku", "item.hsn")
content = content.replace("i.sku", "i.hsn")
content = content.replace("row.sku", "row.hsn")
content = content.replace("editingItemSku", "editingItemId")
content = content.replace("setEditingItemSku", "setEditingItemId")
content = content.replace("handleDelete(item.hsn)", "handleDelete(item.id)")
content = content.replace("key={item.hsn}", "key={item.id}")
content = content.replace("setEditingItemId(item.hsn)", "setEditingItemId(item.id)")

# Remove duplicate checks
content = content.replace("const dupSkus     = validRows.filter(r => inventory.some(i => i.hsn.toLowerCase() === r.hsn.toLowerCase()))", "")

import_logic_target = """
    validRows.forEach(row => {
      const existing = inventory.find(i => i.hsn.toLowerCase() === row.hsn.toLowerCase())
      if (existing) {
        updatedItems.push({ ...existing, name: row.name, category: row.category, qty: row.qty, unit: row.unit, min: row.min, max: row.max })
      } else {
        newItems.push({ id: Date.now() + Math.random(), hsn: row.hsn, name: row.name, category: row.category, qty: row.qty, unit: row.unit, min: row.min, max: row.max })
      }
    })

    const merged = inventory.map(item => updatedItems.find(u => u.hsn === item.hsn) || item)
    setInventory([...merged, ...newItems])
    backendFetch('/inventory/import', { 
      method: 'POST', 
      body: JSON.stringify({ items: [...updatedItems, ...newItems] }) 
    }).catch(console.error)

    const msg = errorRows.length > 0
      ? `Import Complete — ${newItems.length} new, ${updatedItems.length} updated, ${errorRows.length} rows skipped`
      : `Import Complete — ${newItems.length} new items added, ${updatedItems.length} updated`
"""

import_logic_replacement = """
    validRows.forEach(row => {
      newItems.push({ id: Date.now() + Math.random(), hsn: row.hsn, name: row.name, category: row.category, qty: row.qty, unit: row.unit, min: row.min, max: row.max })
    })

    setInventory([...inventory, ...newItems])
    backendFetch('/inventory/import', { 
      method: 'POST', 
      body: JSON.stringify({ items: newItems }) 
    }).catch(console.error)

    const msg = errorRows.length > 0
      ? `Import Complete — ${newItems.length} new items added, ${errorRows.length} rows skipped`
      : `Import Complete — ${newItems.length} new items added`
"""

content = content.replace(import_logic_target.strip(), import_logic_replacement.strip())

# Remove duplicates visual from summary
content = content.replace("""              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#D97706' }}>{dupSkus.length}</div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Duplicates</div>
                {dupSkus.length > 0 && <div style={{ fontSize: '10px', color: '#D97706', marginTop: '2px' }}>will be updated</div>}
              </div>""", "")


# Add Confirmation for delete
delete_logic_target = """
  const handleDelete = async (id) => {
    setInventory(prev => prev.filter(i => i.id !== id))
    showToast?.(`Item ${id} deleted`, 'success')
    try {
      await backendFetch(`/inventory/${id}`, { method: 'DELETE' })
    } catch (err) {
      showToast?.(err.message, 'error')
    }
  }
"""

delete_logic_replacement = """
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    setInventory(prev => prev.filter(i => i.id !== id))
    showToast?.(`Item deleted`, 'success')
    try {
      await backendFetch(`/inventory/${id}`, { method: 'DELETE' })
    } catch (err) {
      showToast?.(err.message, 'error')
    }
  }
"""

content = content.replace(delete_logic_target.strip(), delete_logic_replacement.strip())

# Add Confirmation for Add/Edit
add_logic_target = """
  const handleAdd = async () => {
    if (!newItem.hsn || !newItem.name) return showToast?.('HSN and Name are required', 'error')
    
    const processedItem = { ...newItem, qty: Number(newItem.qty) || 0, min: Number(newItem.min) || 0, max: Number(newItem.max) || 0 };

    if (editingItemId) {
      setInventory(prev => prev.map(i => i.id === editingItemId ? processedItem : i))
      showToast?.('Item updated successfully', 'success')
      backendFetch(`/inventory/${editingItemId}`, { method: 'PUT', body: JSON.stringify(processedItem) }).catch(console.error)
    } else {
      setInventory(prev => [processedItem, ...prev])
      showToast?.('Item added successfully', 'success')
      backendFetch(`/inventory`, { method: 'POST', body: JSON.stringify(processedItem) }).catch(err => showToast?.(err.message, 'error'))
    }
    
    setAdding(false)
    setEditingItemId(null)
    setNewItem({ hsn: '', name: '', category: 'Raw Materials', qty: '', unit: '', min: '', max: '' })
  }
"""

add_logic_replacement = """
  const handleAdd = async () => {
    if (!newItem.hsn || !newItem.name) return showToast?.('HSN and Name are required', 'error')
    if (!window.confirm(`Are you sure you want to ${editingItemId ? 'save changes to' : 'add'} this item?`)) return;
    
    const processedItem = { ...newItem, qty: Number(newItem.qty) || 0, min: Number(newItem.min) || 0, max: Number(newItem.max) || 0 };

    if (editingItemId) {
      setInventory(prev => prev.map(i => i.id === editingItemId ? processedItem : i))
      showToast?.('Item updated successfully', 'success')
      backendFetch(`/inventory/${editingItemId}`, { method: 'PUT', body: JSON.stringify(processedItem) }).catch(console.error)
    } else {
      setInventory(prev => [processedItem, ...prev])
      showToast?.('Item added successfully', 'success')
      backendFetch(`/inventory`, { method: 'POST', body: JSON.stringify(processedItem) }).catch(err => showToast?.(err.message, 'error'))
    }
    
    setAdding(false)
    setEditingItemId(null)
    setNewItem({ hsn: '', name: '', category: 'Raw Materials', qty: '', unit: '', min: '', max: '' })
  }
"""

content = content.replace(add_logic_target.strip(), add_logic_replacement.strip())

# handle the header map
content = content.replace("hsn:      ['sku', 'item code', 'code', 'id']", "hsn:      ['hsn', 'sku', 'item code', 'code', 'id']")

# Fix delete parameter from item.sku to item.id
content = content.replace("handleDelete(item.hsn)", "handleDelete(item.id)")
# Fix `editingItemSku = item.sku`
content = content.replace("setEditingItemId(item.hsn)", "setEditingItemId(item.id)")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

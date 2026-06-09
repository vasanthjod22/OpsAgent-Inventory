import re

with open('d:/Inventory/UI/src/components/panels/InventoryPanel.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Header changes
content = content.replace("'SKU'", "'HSN'")
content = content.replace("sku:      ['sku',", "hsn:      ['hsn', 'sku',")
content = content.replace("col.sku", "col.hsn")
content = content.replace("row.sku", "row.hsn")
content = content.replace("headerMap.sku", "headerMap.hsn")
content = content.replace("i.sku", "i.hsn")
content = content.replace("item.sku", "item.hsn")
content = content.replace("newItem.sku", "newItem.hsn")
content = content.replace("sku:", "hsn:")
content = content.replace("SKU is required", "HSN is required")
content = content.replace("SKU / Code", "HSN / Code")
content = content.replace("Total SKUs", "Total Items")
content = content.replace("SKU column", "HSN column")

# Duplicate logic removal in ImportModal
content = re.sub(r'const dupSkus.*?;\n', '', content, flags=re.DOTALL)
content = content.replace("{dupSkus.length}", "0")
content = re.sub(r'<div style={{ textAlign: \'center\' }}>\s*<div style={{ fontSize: \'22px\', fontWeight: 800, color: \'#D97706\' }}>0</div>\s*<div style={{ fontSize: \'11px\', color: \'#64748B\', fontWeight: 600, textTransform: \'uppercase\' }}>Duplicates</div>\s*\{0 > 0 && <div style={{ fontSize: \'10px\', color: \'#D97706\', marginTop: \'2px\' }}>will be updated</div>\}\s*</div>', '', content, flags=re.DOTALL)

# Handle Import logic simplification
import_logic = """
  const handleImport = () => {
    const newItems = []
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
    const type = errorRows.length > 0 ? 'warning' : 'success'
    showToast?.(msg, type, 'CSV Import')
    onClose()
  }
"""
content = re.sub(r'const handleImport = \(\) => \{.*?\n  \}', import_logic.strip(), content, flags=re.DOTALL)

# Edit and Delete logic
content = content.replace("editingItemSku", "editingItemId")
content = content.replace("setEditingItemSku", "setEditingItemId")

delete_logic = """
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
content = re.sub(r'const handleDelete = async \(.*?\) => \{.*?\n  \}', delete_logic.strip(), content, flags=re.DOTALL)

content = content.replace("handleDelete(item.hsn)", "handleDelete(item.id)")
content = content.replace("handleEditClick = (item) => {\n    setNewItem({ ...item })\n    setEditingItemId(item.hsn)", "handleEditClick = (item) => {\n    setNewItem({ ...item })\n    setEditingItemId(item.id)")

# Add confirmation
add_logic = """
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
content = re.sub(r'const handleAdd = async \(\) => \{.*?\n  \}', add_logic.strip(), content, flags=re.DOTALL)

# Also fix the key in the loop
content = content.replace("key={item.hsn}", "key={item.id}")

with open('d:/Inventory/UI/src/components/panels/InventoryPanel.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

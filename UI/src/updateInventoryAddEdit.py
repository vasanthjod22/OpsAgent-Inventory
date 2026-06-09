import re

filepath = 'd:/Inventory/UI/src/components/panels/InventoryPanel.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update handleAdd
old_handle_add = """  const handleAdd = () => {
    if (!newItem.hsn || !newItem.name) return showToast?.('HSN and Name are required', 'error')
    const isEdit = !!editingItemId
    setConfirmModal({
      title: isEdit ? 'Save Changes' : 'Add Item',
      message: isEdit ? 'Are you sure you want to save these changes?' : 'Are you sure you want to add this item?',
      confirmLabel: isEdit ? 'Yes, Save It' : 'Yes, Add It',
      danger: false,
      onConfirm: async () => {
        setConfirmModal(null)
        // Persist new category/unit
        saveNewCategory(newItem.category)
        saveNewUnit(newItem.unit)
        const processedItem = { ...newItem, qty: Number(newItem.qty) || 0, min: Number(newItem.min) || 0, max: Number(newItem.max) || 0 };
        if (isEdit) {
          setInventory(prev => prev.map(i => i.id === editingItemId ? processedItem : i))
          showToast?.('Item updated successfully', 'success')
          backendFetch(`/inventory/${editingItemId}`, { method: 'PUT', body: JSON.stringify(processedItem) }).catch(console.error)
        } else {
          const tempId = processedItem.id || `temp-${Date.now()}`
          const itemWithId = { ...processedItem, _tempId: tempId }
          setInventory(prev => [processedItem, ...prev])
          setNewRowIds(prev => new Set([...prev, 0]))
          setTimeout(() => setNewRowIds(new Set()), 500)
          showToast?.('Item added successfully', 'success')
          backendFetch(`/inventory`, { method: 'POST', body: JSON.stringify(processedItem) }).catch(err => showToast?.(err.message, 'error'))
        }
        setAdding(false)
        setEditingItemId(null)
        setNewItem({ hsn: '', name: '', category: 'Raw Materials', qty: '', unit: '', min: '', max: '' })
        setShowNameSuggestions(false)
      }
    })
  }"""

new_handle_add = """  const handleAdd = () => {
    if (!newItem.hsn || !newItem.name) return showToast?.('HSN and Name are required', 'error')
    const isEdit = !!editingItemId
    setConfirmModal({
      title: isEdit ? 'Save Changes' : 'Add Item',
      message: isEdit ? 'Are you sure you want to save these changes?' : 'Are you sure you want to add this item?',
      confirmLabel: isEdit ? 'Yes, Save It' : 'Yes, Add It',
      danger: false,
      onConfirm: async () => {
        setConfirmModal(null)
        // Persist new category/unit
        saveNewCategory(newItem.category)
        saveNewUnit(newItem.unit)
        const processedItem = { ...newItem, qty: Number(newItem.qty) || 0, min: Number(newItem.min) || 0, max: Number(newItem.max) || 0 };
        
        if (isEdit) {
          // Keep the existing ID explicitly
          const itemToUpdate = { ...processedItem, id: editingItemId };
          setInventory(prev => prev.map(i => i.id === editingItemId ? itemToUpdate : i))
          showToast?.('Item updated successfully', 'success')
          backendFetch(`/inventory/${editingItemId}`, { method: 'PUT', body: JSON.stringify(itemToUpdate) }).catch(console.error)
        } else {
          const tempId = `temp-${Date.now()}`
          const itemWithId = { ...processedItem, id: tempId }
          setInventory(prev => [itemWithId, ...prev])
          setNewRowIds(prev => new Set([...prev, tempId]))
          setTimeout(() => setNewRowIds(new Set()), 500)
          
          backendFetch(`/inventory`, { method: 'POST', body: JSON.stringify(processedItem) })
            .then(res => {
              if (res && res.id) {
                // Update local state with the actual ID from DB
                setInventory(prev => prev.map(i => i.id === tempId ? { ...i, id: res.id } : i))
              }
              showToast?.('Item added successfully', 'success')
            })
            .catch(err => showToast?.(err.message, 'error'))
        }
        setAdding(false)
        setEditingItemId(null)
        setNewItem({ hsn: '', name: '', category: 'Raw Materials', qty: '', unit: '', min: '', max: '' })
        setShowNameSuggestions(false)
      }
    })
  }"""

if old_handle_add in content:
    content = content.replace(old_handle_add, new_handle_add)
else:
    print("Could not find exact handleAdd to replace. Using regex fallback.")
    pattern = r"  const handleAdd = \(\) => \{.*?(?=  const handleExport = \(\) => \{)"
    content = re.sub(pattern, new_handle_add + "\n\n", content, flags=re.DOTALL)


# 2. Update TR class to use newRowIds
old_tr = """<tr key={item.id} className={exitingRows.has(item.id) ? 'row-exit' : ''} style={{ borderLeft: isLow ? '3px solid #DC2626' : '3px solid transparent', transition: 'background 0.2s' }}>"""
new_tr = """<tr key={item.id} className={exitingRows.has(item.id) ? 'row-exit' : newRowIds.has(item.id) ? 'row-enter' : ''} style={{ borderLeft: isLow ? '3px solid #DC2626' : '3px solid transparent', transition: 'background 0.2s' }}>"""

content = content.replace(old_tr, new_tr)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated handleAdd successfully!")

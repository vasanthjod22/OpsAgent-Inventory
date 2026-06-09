import os

files_to_process = [
    'QuotationPanel.jsx'
]

base_path = 'd:/Inventory/UI/src/components/panels/'

for filename in files_to_process:
    filepath = os.path.join(base_path, filename)
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Generic replacements
    content = content.replace("inventory.find(i => i.hsn === item.inventoryId)", "inventory.find(i => i.id === item.inventoryId)")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

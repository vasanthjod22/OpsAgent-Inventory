import re
import glob
import os

files_to_process = [
    'BillingPanel.jsx',
    'QuotationPanel.jsx',
    'ReportsPanel.jsx',
    'DashboardPanel.jsx',
    'GRNPanel.jsx'
]

base_path = 'd:/Inventory/UI/src/components/panels/'

for filename in files_to_process:
    filepath = os.path.join(base_path, filename)
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Generic replacements
    content = content.replace("inventorySku", "inventoryId")
    content = content.replace("SKU", "HSN")
    content = content.replace("sku", "hsn")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

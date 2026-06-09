import re

filepath = 'd:/Inventory/UI/src/components/panels/BillingPanel.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update generateBillFilename
old_filename_func = """const generateBillFilename = (customerName) => {
  const clean = (customerName || 'Customer')
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 25)
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${clean}_BILL_${dd}${mm}${yyyy}.pdf`
}"""

new_filename_func = """const generateBillFilename = (customerName, billNumber, dateStr) => {
  const clean = (customerName || 'Customer')
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 25)
  const yyyy = dateStr ? dateStr.split('-')[0] : new Date().getFullYear()
  let no = '0001'
  if (billNumber && billNumber.includes('-')) {
    const parts = billNumber.split('-')
    no = parts[parts.length - 1]
  }
  return `${clean}_${yyyy}_${no}.pdf`
}"""

if old_filename_func in content:
    content = content.replace(old_filename_func, new_filename_func)
else:
    print("Could not find old generateBillFilename")

# 2. Update doc.save usage
# Find: doc.save(generateBillFilename(bill.customerName))
old_doc_save = "doc.save(generateBillFilename(bill.customerName))"
new_doc_save = "doc.save(generateBillFilename(bill.customerName, bill.billNumber, bill.date))"
if old_doc_save in content:
    content = content.replace(old_doc_save, new_doc_save)
else:
    print("Could not find old_doc_save")

# 3. Update showToast usage
# Find: showToast?.(`${generateBillFilename(savedBill.customerName)} downloaded!`
old_toast = "showToast?.(`${generateBillFilename(savedBill.customerName)} downloaded!`, 'success', 'Bill Generated')"
new_toast = "showToast?.(`${generateBillFilename(savedBill.customerName, savedBill.billNumber, savedBill.date)} downloaded!`, 'success', 'Bill Generated')"
if old_toast in content:
    content = content.replace(old_toast, new_toast)
else:
    print("Could not find old_toast")

# 4. Add billDate state
old_state = "const [customerName, setCustomerName] = useState('')"
new_state = "const [billDate, setBillDate] = useState(todayISO())\n  const [customerName, setCustomerName] = useState('')"
if old_state in content:
    content = content.replace(old_state, new_state)
else:
    print("Could not find old_state")

# 5. Update buildBillData
old_build = "date: todayISO(),"
new_build = "date: billDate,"
# Careful, we only want to replace the one inside buildBillData
# Let's use regex for this specific part
pattern = r"(const buildBillData = \(\) => \(\{.*?)(date: todayISO\(\),)(.*?\})";
content = re.sub(pattern, r"\1date: billDate,\3", content, flags=re.DOTALL)


# 6. Update UI input
old_input = "<div><Lbl>Bill Date</Lbl><input style={readOnly} value={fmtDate(todayISO())} readOnly /></div>"
new_input = """<div><Lbl>Bill Date</Lbl><input type="date" className="input-base" style={{ padding: '8px 12px', height: '36px' }} value={billDate} onChange={e => setBillDate(e.target.value)} /></div>"""
if old_input in content:
    content = content.replace(old_input, new_input)
else:
    # try slightly different formatting
    old_input2 = "<div><Lbl>Bill Date</Lbl><input style={readOnly} value={fmtDate(todayISO())} readOnly /></div>"
    if old_input2 in content:
        content = content.replace(old_input2, new_input)
    else:
        print("Could not find old_input")
        # find loosely
        loose_pattern = r"<div><Lbl>Bill Date</Lbl><input style=\{readOnly\} value=\{fmtDate\(todayISO\(\)\)\} readOnly /></div>"
        content = re.sub(loose_pattern, new_input, content)


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated BillingPanel!")

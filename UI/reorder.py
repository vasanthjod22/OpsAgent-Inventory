import sys

with open('src/components/panels/InventoryPanel.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

s1Start = content.find('{/* SECTION 1: GRN UPLOAD (Collapsible) */}')
historyStart = content.find('{/* GRN History Mini Table')
s2Start = content.find('{/* SECTION 2: STAT CARDS */}')
s3Start = content.find('{/* SECTION 3: INVENTORY TABLE */}')
footerStart = content.find('{/* Add/Edit Modal */}')

if -1 in [s1Start, historyStart, s2Start, s3Start, footerStart]:
    print("Could not find sections")
    sys.exit(1)

topEnd = content[:s1Start]
grnUploadBlock = content[s1Start:historyStart]
grnHistoryBlock = content[historyStart:s2Start]
statCardsBlock = content[s2Start:s3Start]
invTableBlock = content[s3Start:footerStart]
footerBlock = content[footerStart:]

modifiedGrnUpload = grnUploadBlock.replace(
    "<div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>",
    """{/* GRN UPLOAD MODAL */}
      {grnExpanded && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: 12, width: 800, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>"""
)

buttonTarget = """<button
          onClick={() => setGrnExpanded(!grnExpanded)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#F8FAFC', border: 'none', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, background: '#EFF6FF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Upload size={16} color="#2563EB" /></div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Upload Goods Receipt Note (GRN)</span>
          </div>
          {grnExpanded ? <ChevronUp size={20} color="#64748B" /> : <ChevronDown size={20} color="#64748B" />}
        </button>

        {grnExpanded && ("""

buttonReplacement = """<div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, background: '#EFF6FF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Upload size={16} color="#2563EB" /></div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Upload Goods Receipt Note (GRN)</h3>
              </div>
              <button onClick={() => setGrnExpanded(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}><X size={20}/></button>
            </div>"""

modifiedGrnUpload = modifiedGrnUpload.replace(buttonTarget, buttonReplacement)

endDivsTarget = """</div>
        )}
      </div>"""

endDivsReplacement = """</div>
        </div>
      )}"""

modifiedGrnUpload = modifiedGrnUpload.replace(endDivsTarget, endDivsReplacement)

newContent = topEnd + statCardsBlock + invTableBlock + "\\n      " + grnHistoryBlock + "\\n      " + modifiedGrnUpload + "\\n      " + footerBlock

importButtonTarget = """<button onClick={() => setShowImport(true)} style={{ height: 36, padding: '0 16px', borderRadius: 8, background: 'white', color: '#2563EB', border: '1.5px solid #2563EB', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>"""

importButtonReplacement = """<button onClick={() => setGrnExpanded(true)} style={{ height: 36, padding: '0 16px', borderRadius: 8, background: '#EFF6FF', color: '#2563EB', border: '1.5px solid #2563EB', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Upload size={16} /> Upload GRN
            </button>
            <button onClick={() => setShowImport(true)} style={{ height: 36, padding: '0 16px', borderRadius: 8, background: 'white', color: '#2563EB', border: '1.5px solid #2563EB', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>"""

newContent = newContent.replace(importButtonTarget, importButtonReplacement)

with open('src/components/panels/InventoryPanel.jsx', 'w', encoding='utf-8') as f:
    f.write(newContent)

print('Success')

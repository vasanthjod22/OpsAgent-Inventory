const fs = require('fs');
let content = fs.readFileSync('src/components/panels/InventoryPanel.jsx', 'utf8');

const s1Start = content.indexOf("      {/* SECTION 1: GRN UPLOAD (Collapsible) */}");
const s2Start = content.indexOf("      {/* GRN History Mini Table (Always visible if there's history) */}");
const s3Start = content.indexOf("      {/* SECTION 2: STAT CARDS */}");
const s4Start = content.indexOf("      {/* SECTION 3: INVENTORY TABLE */}");
const sEnd = content.indexOf("      {/* Add/Edit Modal */}");

if (s1Start === -1 || s2Start === -1 || s3Start === -1 || s4Start === -1 || sEnd === -1) {
  console.error("Could not find sections!");
  process.exit(1);
}

const grnUploadBlock = content.substring(s1Start, s2Start);
const grnHistoryBlock = content.substring(s2Start, s3Start);
const statCardsBlock = content.substring(s3Start, s4Start);
const invTableBlock = content.substring(s4Start, sEnd);

// Step 1: Fix the GRN Upload block to become a modal.
// It starts with `      <div style={{ background: 'white', borderRadius: 12, ... }}>`
// and ends with `      </div>\n\n`
let modalContent = grnUploadBlock.replace(
  "      {/* SECTION 1: GRN UPLOAD (Collapsible) */}",
  "      {/* GRN Upload Modal */}"
);

modalContent = modalContent.replace(
  /<div style=\{\{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba\(0,0,0,0\.05\)' \}\}>.*?<\/button>\s*\{grnExpanded && \(\s*<div style=\{\{ padding: 24, borderTop: '1px solid #E2E8F0' \}\}>/s,
  `{grnExpanded && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 1000, maxHeight: '90vh', overflowY: 'auto', padding: 24, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0F172A' }}>Upload Goods Receipt Note (GRN)</h3>
              <button onClick={() => setGrnExpanded(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E293B' }}><X size={20} /></button>
            </div>`
);

// Remove the two trailing </div> that wrapped the collapsible
modalContent = modalContent.replace(/<\/div>\s*\)\}\s*<\/div>\s*$/, '          </div>\n        </div>\n      )}\n\n      ');

// Step 2: Add "Upload GRN" button next to Import/Export
let newInvTableBlock = invTableBlock.replace(
  '<button onClick={() => setShowImport(true)}',
  `<button onClick={() => setGrnExpanded(true)} style={{ height: 36, padding: '0 16px', borderRadius: 8, background: '#EFF6FF', color: '#2563EB', border: '1.5px solid #2563EB', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Upload size={16} /> Upload GRN
            </button>
            <button onClick={() => setShowImport(true)}`
);

// Step 3: Reassemble the file
const prefix = content.substring(0, s1Start);
const suffix = content.substring(sEnd);

const finalContent = prefix +
  statCardsBlock +
  newInvTableBlock +
  grnHistoryBlock +
  modalContent +
  suffix;

fs.writeFileSync('src/components/panels/InventoryPanel.jsx', finalContent, 'utf8');
console.log('Successfully refactored!');

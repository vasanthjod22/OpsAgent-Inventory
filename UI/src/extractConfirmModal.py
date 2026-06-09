import os

# 1. Create ConfirmModal.jsx
confirm_modal_content = """import React, { useState } from 'react'
import { AlertOctagon } from 'lucide-react'

export default function ConfirmModal({ title, message, confirmLabel = 'Yes, Remove It', cancelLabel = 'Cancel', onConfirm, onCancel, danger = true }) {
  const [closing, setClosing] = useState(false)

  const handleCancel = () => {
    setClosing(true)
    setTimeout(onCancel, 220)
  }
  const handleConfirm = () => {
    setClosing(true)
    setTimeout(onConfirm, 220)
  }

  const accentColor = danger ? '#EF4444' : '#2563EB'
  const ringColor   = danger ? 'rgba(239,68,68,0.15)' : 'rgba(37,99,235,0.15)'
  const bgColor     = danger ? 'rgba(254,242,242,0.6)' : 'rgba(239,246,255,0.6)'
  const borderColor = danger ? '#FECACA' : '#BFDBFE'
  const btnShadow   = danger ? '0 6px 20px rgba(220,38,38,0.4)' : '0 6px 20px rgba(37,99,235,0.4)'
  const btnBg       = danger ? '#DC2626' : '#2563EB'

  return (
    <div
      onClick={handleCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: closing ? 'rgba(15,23,42,0)' : 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        transition: 'background 0.22s ease',
        animation: 'modalBackdropIn 0.2s ease forwards',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '24px', width: '100%', maxWidth: '400px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.1)',
          overflow: 'visible', position: 'relative',
          animation: closing ? 'modalCardOut 0.22s cubic-bezier(0.4,0,0.6,1) forwards' : 'modalCardIn 0.36s cubic-bezier(0.34,1.3,0.64,1) forwards',
        }}
      >
        {/* Colored top stripe */}
        <div style={{
          height: '6px', borderRadius: '24px 24px 0 0',
          background: danger
            ? 'linear-gradient(90deg,#EF4444,#F97316)'
            : 'linear-gradient(90deg,#2563EB,#7C3AED)',
        }} />

        {/* Icon area */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 32px 20px' }}>
          {/* Animated icon with pulse ring */}
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            {/* Pulse ring */}
            <div style={{
              position: 'absolute', inset: '-8px', borderRadius: '50%',
              border: `2px solid ${accentColor}`,
              animation: 'iconPulseRing 1.8s ease-out infinite',
              opacity: 0,
            }} />
            {/* Icon circle */}
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              border: `2px solid ${borderColor}`,
              background: bgColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'iconBounce 0.5s cubic-bezier(0.34,1.5,0.64,1) 0.1s both',
              position: 'relative', zIndex: 1,
            }}>
              <AlertOctagon size={34} color={accentColor} strokeWidth={1.8} />
            </div>
          </div>

          {title && (
            <p style={{
              fontSize: '19px', fontWeight: 800, color: '#0F172A',
              marginBottom: '8px', textAlign: 'center', letterSpacing: '-0.3px',
              animation: 'modalCardIn 0.35s ease 0.15s both',
            }}>
              {title}
            </p>
          )}
          <p style={{
            fontSize: '14px', color: '#64748B', textAlign: 'center',
            lineHeight: 1.65, maxWidth: '280px',
            animation: 'modalCardIn 0.35s ease 0.2s both',
          }}>
            {message}
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: '#F1F5F9', margin: '0 24px' }} />

        {/* Buttons */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '12px', padding: '20px 24px 24px',
          animation: 'modalCardIn 0.35s ease 0.25s both',
        }}>
          <button
            onClick={handleCancel}
            style={{
              height: '46px', borderRadius: '12px',
              border: '1.5px solid #E2E8F0', background: 'white',
              fontWeight: 600, fontSize: '14px', color: '#64748B',
              cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#F8FAFC'
              e.currentTarget.style.borderColor = '#CBD5E1'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'white'
              e.currentTarget.style.borderColor = '#E2E8F0'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            style={{
              height: '46px', borderRadius: '12px', border: 'none',
              background: btnBg, fontWeight: 700, fontSize: '14px', color: 'white',
              cursor: 'pointer', transition: 'all 0.15s',
              boxShadow: btnShadow, fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
              e.currentTarget.style.boxShadow = danger ? '0 10px 28px rgba(220,38,38,0.5)' : '0 10px 28px rgba(37,99,235,0.5)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)'
              e.currentTarget.style.boxShadow = btnShadow
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
"""

with open('d:/Inventory/UI/src/components/ConfirmModal.jsx', 'w', encoding='utf-8') as f:
    f.write(confirm_modal_content)


# 2. Update InventoryPanel.jsx to import ConfirmModal and remove its inline definition
inventory_path = 'd:/Inventory/UI/src/components/panels/InventoryPanel.jsx'
with open(inventory_path, 'r', encoding='utf-8') as f:
    inv_content = f.read()

# Find and remove the ConfirmModal inline definition
import re
# We look for: /* ─── Custom Confirm Modal ─── ... to the end of the component
pattern = r"/\* ─── Custom Confirm Modal ───.*?\nfunction ConfirmModal\(\{.*?\}\) \{.*?return \(\n.*?    </div>\n  \)\n}"

inv_content = re.sub(pattern, '', inv_content, flags=re.DOTALL)

# Add import at the top
if "import ConfirmModal from '../ConfirmModal'" not in inv_content:
    import_line = "import { backendFetch } from '../../utils/backend'"
    inv_content = inv_content.replace(import_line, import_line + "\nimport ConfirmModal from '../ConfirmModal'")

with open(inventory_path, 'w', encoding='utf-8') as f:
    f.write(inv_content)

# 3. Update Sidebar.jsx to use ConfirmModal and useState
sidebar_path = 'd:/Inventory/UI/src/components/Sidebar.jsx'
with open(sidebar_path, 'r', encoding='utf-8') as f:
    side_content = f.read()

# Fix imports
if "import React, { useState }" not in side_content:
    side_content = "import React, { useState } from 'react'\nimport ConfirmModal from './ConfirmModal'\n" + side_content

# Fix component
old_sidebar_decl = "export default function Sidebar({ active, onNavigate, mobile, currentUser, onLogout }) {"
new_sidebar_decl = """export default function Sidebar({ active, onNavigate, mobile, currentUser, onLogout }) {
  const [showSignoutConfirm, setShowSignoutConfirm] = useState(false)"""
side_content = side_content.replace(old_sidebar_decl, new_sidebar_decl)

# Desktop log out button
old_desktop_btn = """        <button
          onClick={() => {
            if (onLogout) onLogout();
          }}
          className="btn-press"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '0 10px',
            height: '36px',
            borderRadius: '8px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s',
            color: '#64748B',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748B' }}
        >
          <LogOut size={16} />
          <span style={{ fontSize: '13px', fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  )
}"""

new_desktop_btn = """        <button
          onClick={() => setShowSignoutConfirm(true)}
          className="btn-press"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '0 10px',
            height: '36px',
            borderRadius: '8px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s',
            color: '#64748B',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748B' }}
        >
          <LogOut size={16} />
          <span style={{ fontSize: '13px', fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
            Sign Out
          </span>
        </button>
      </div>

      {showSignoutConfirm && (
        <ConfirmModal
          title="Sign Out"
          message="Are you sure you want to sign out? You will need to log in again to access your dashboard."
          confirmLabel="Yes, Sign Out"
          cancelLabel="Cancel"
          danger={true}
          onConfirm={() => {
            setShowSignoutConfirm(false)
            if (onLogout) onLogout()
          }}
          onCancel={() => setShowSignoutConfirm(false)}
        />
      )}
    </aside>
  )
}"""
side_content = side_content.replace(old_desktop_btn, new_desktop_btn)

# Mobile log out button (if it exists, though looking at the code, mobile doesn't have it explicitly shown in the provided snippet, it maps allItems. Let's assume it doesn't need changes right now or is handled similarly).

with open(sidebar_path, 'w', encoding='utf-8') as f:
    f.write(side_content)

print("Done! Extracted ConfirmModal and added SignOut confirmation.")

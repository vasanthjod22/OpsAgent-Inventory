import React, { useState, useEffect } from 'react'
import ConfirmModal from './ConfirmModal'
import { SignOutAnimation } from './ui/SignOutAnimation'
import {
  LayoutDashboard,
  DollarSign,
  Upload,
  Package,
  FileText,
  Receipt,
  MessageSquare,
  Settings,
  LogOut,
  BarChart2,
  Users,
  ShoppingCart,
  Sparkles,
} from 'lucide-react'

const navGroups = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard },
      { id: 'reports',   label: 'Reports',    icon: BarChart2 },
      { id: 'finance',   label: 'Finance',    icon: DollarSign },
    ]
  },
  {
    label: 'Operations',
    items: [
      { id: 'purchase_orders', label: 'Purchase Orders', icon: ShoppingCart },
      { id: 'customers', label: 'Customers',  icon: Users },
      { id: 'inventory', label: 'Inventory',  icon: Package },
      { id: 'quotation', label: 'Quotation',  icon: FileText },
      { id: 'billing',   label: 'Billing',    icon: Receipt },
    ]
  },
  {
    label: 'AI Assistant',
    items: [
      { id: 'chat',      label: 'OpsAgent AI',       icon: Sparkles },
    ]
  }
]

export default function Sidebar({ active, onNavigate, mobile, currentUser, onLogout }) {
  const [showSignoutConfirm, setShowSignoutConfirm] = useState(false)
  const [showSignOutAnimation, setShowSignOutAnimation] = useState(false)
  const [pendingPOCount, setPendingPOCount] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem('opsagent_token')
    if (token) {
      fetch(`${import.meta.env.VITE_API_URL}/purchase-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPendingPOCount(data.filter(po => ['Draft', 'Sent'].includes(po.status)).length)
        }
      })
      .catch(err => console.error('Error fetching POs for sidebar:', err))
    }
  }, [])

  const handleAnimationComplete = () => {
    localStorage.removeItem('opsagent_auth')
    localStorage.removeItem('opsagent_token')
    window.location.hash = ''
    if (onLogout) onLogout()
    window.location.href = '/'
  }

  if (mobile) {
    const allItems = [
      ...navGroups.flatMap(g => g.items),
      { id: 'settings', label: 'Settings', icon: Settings }
    ]
    return (
      <>
        {allItems.map(({ id, icon: Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="btn-press"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                padding: '6px 4px',
                borderRadius: '8px',
                background: isActive ? '#EFF6FF' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <Icon size={20} color={isActive ? '#2563EB' : '#94A3B8'} />
            </button>
          )
        })}
      </>
    )
  }

  return (
    <aside style={{
      width: '240px',
      background: 'linear-gradient(180deg, #1E3A8A 0%, #2563EB 100%)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      borderRight: 'none',
      flexShrink: 0,
    }}>
      {/* Logo / Header */}
      <div style={{
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{
          width: '28px', height: '28px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '7px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginRight: '10px', flexShrink: 0,
        }}>
          <div style={{ width: '10px', height: '10px', background: 'white', borderRadius: '3px' }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, color: 'white', fontSize: '15px', lineHeight: 1.2, letterSpacing: '-0.3px' }}>OpsAgent</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.2, marginTop: '1px' }}>Back-Office Manager</div>
        </div>
      </div>

      {/* Nav Items */}
      <nav style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} style={{ marginTop: gIdx > 0 ? '20px' : '4px' }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.5)',
              padding: '0 10px',
              marginBottom: '6px',
            }}>
              {group.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {group.items.map(({ id, label, icon: Icon }) => {
                const isActive = active === id
                return (
                  <button
                    key={id}
                    onClick={() => onNavigate(id)}
                    className="btn-press"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '0 10px',
                      height: '40px',
                      borderRadius: '8px',
                      background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <Icon size={17} color={isActive ? '#2563EB' : '#94A3B8'} />
                    <span style={{
                      flex: 1,
                      textAlign: 'left',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                      fontFamily: "'Inter', sans-serif",
                    }}>
                      {label}
                    </span>
                    {id === 'purchase_orders' && pendingPOCount > 0 && (
                      <span style={{
                        background: '#EF4444',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '99px',
                        marginLeft: '8px'
                      }}>
                        {pendingPOCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '16px', flexShrink: 0 }}>
        {/* Settings Button */}
        <button
          onClick={() => onNavigate('settings')}
          className="btn-press"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '0 10px',
            height: '36px',
            borderRadius: '8px',
            background: active === 'settings' ? 'rgba(255,255,255,0.2)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            marginBottom: '12px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (active !== 'settings') e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
          onMouseLeave={e => { if (active !== 'settings') e.currentTarget.style.background = 'transparent' }}
        >
          <Settings size={16} color={active === 'settings' ? 'white' : 'rgba(255,255,255,0.6)'} />
          <span style={{ fontSize: '13px', fontWeight: 500, color: active === 'settings' ? 'white' : 'rgba(255,255,255,0.8)', fontFamily: "'Inter', sans-serif" }}>
            Settings
          </span>
        </button>

        {/* User Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 600, color: 'white', flexShrink: 0,
          }}>
            {currentUser?.avatar || 'AD'}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser?.fullName || 'Admin User'}
              </div>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#2563EB', background: '#EFF6FF', padding: '1px 6px', borderRadius: '99px', textTransform: 'uppercase' }}>Admin</span>
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.company || 'Operations Lead'}
            </div>
          </div>
        </div>

        <button
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
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,0,0,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <LogOut size={16} color="#FECACA" />
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#FECACA', fontFamily: "'Inter', sans-serif" }}>
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
            setShowSignOutAnimation(true)
          }}
          onCancel={() => setShowSignoutConfirm(false)}
        />
      )}

      <SignOutAnimation
        isPlaying={showSignOutAnimation}
        userName={currentUser?.fullName || 'User'}
        onComplete={handleAnimationComplete}
      />
    </aside>
  )
}

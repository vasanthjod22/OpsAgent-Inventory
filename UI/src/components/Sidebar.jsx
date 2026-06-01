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
} from 'lucide-react'

const navGroups = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard },
      { id: 'finance',   label: 'Finance',    icon: DollarSign },
    ]
  },
  {
    label: 'Operations',
    items: [
      { id: 'grn',       label: 'GRN Upload', icon: Upload },
      { id: 'inventory', label: 'Inventory',  icon: Package },
      { id: 'quotation', label: 'Quotation',  icon: FileText },
      { id: 'billing',   label: 'Billing',    icon: Receipt },
    ]
  },
  {
    label: 'AI Assistant',
    items: [
      { id: 'chat',      label: 'Chat',       icon: MessageSquare },
    ]
  }
]

export default function Sidebar({ active, onNavigate, mobile, currentUser, onLogout }) {
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
      background: '#0F172A',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      borderRight: '1px solid #1E293B',
      flexShrink: 0,
    }}>
      {/* Logo / Header */}
      <div style={{
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        flexShrink: 0,
        borderBottom: '1px solid #1E293B',
      }}>
        <div style={{
          width: '28px', height: '28px',
          background: '#2563EB',
          borderRadius: '7px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginRight: '10px', flexShrink: 0,
        }}>
          <div style={{ width: '10px', height: '10px', background: 'white', borderRadius: '3px' }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, color: 'white', fontSize: '15px', lineHeight: 1.2, letterSpacing: '-0.3px' }}>OpsAgent</div>
          <div style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.2, marginTop: '1px' }}>Back-Office Manager</div>
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
              color: '#475569',
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
                      background: isActive ? '#2563EB' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#1E293B' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <Icon size={17} color={isActive ? 'white' : '#64748B'} />
                    <span style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: isActive ? 'white' : '#94A3B8',
                      fontFamily: "'Inter', sans-serif",
                    }}>
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #1E293B', padding: '16px', flexShrink: 0 }}>
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
            background: active === 'settings' ? '#2563EB' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            marginBottom: '12px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (active !== 'settings') e.currentTarget.style.background = '#1E293B' }}
          onMouseLeave={e => { if (active !== 'settings') e.currentTarget.style.background = 'transparent' }}
        >
          <Settings size={16} color={active === 'settings' ? 'white' : '#64748B'} />
          <span style={{ fontSize: '13px', fontWeight: 500, color: active === 'settings' ? 'white' : '#94A3B8', fontFamily: "'Inter', sans-serif" }}>
            Settings
          </span>
        </button>

        {/* User Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: '#2563EB',
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
            <div style={{ fontSize: '11px', color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.company || 'Operations Lead'}
            </div>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={() => {
            if (window.confirm('Sign out of OpsAgent?')) {
              onLogout && onLogout()
              window.location.reload()
            }
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
}

import { Search, Bell, ChevronDown } from 'lucide-react'

const titles = {
  dashboard: { label: 'Dashboard',  breadcrumb: 'Overview' },
  finance:   { label: 'Finance',    breadcrumb: 'Overview' },
  grn:       { label: 'GRN Upload', breadcrumb: 'Operations' },
  inventory: { label: 'Inventory',  breadcrumb: 'Operations' },
  chat:      { label: 'Chat',       breadcrumb: 'AI Assistant' },
  settings:  { label: 'Settings',   breadcrumb: 'System' },
}

export default function TopBar({ activeNav }) {
  const page = titles[activeNav] || { label: 'Dashboard', breadcrumb: 'Overview' }

  return (
    <header style={{
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      background: 'white',
      borderBottom: '1px solid #E2E8F0',
      flexShrink: 0,
      zIndex: 10,
    }}>
      {/* Left: Title + Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <h1 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#0F172A',
          fontFamily: "'Inter', sans-serif",
          letterSpacing: '-0.3px',
          lineHeight: 1,
        }}>
          {page.label}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#CBD5E1', fontSize: '16px' }}>/</span>
          <span style={{ fontSize: '13px', color: '#94A3B8', fontFamily: "'Inter', sans-serif" }}>
            {page.breadcrumb}
          </span>
        </div>
      </div>

      {/* Right: Search + Notifications + Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Search */}
        <div style={{ position: 'relative' }} className="hidden md:block">
          <Search
            size={15}
            style={{
              position: 'absolute', left: '10px',
              top: '50%', transform: 'translateY(-50%)',
              color: '#94A3B8', pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search..."
            style={{
              width: '200px',
              height: '36px',
              paddingLeft: '32px',
              paddingRight: '12px',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '13px',
              fontFamily: "'Inter', sans-serif",
              color: '#0F172A',
              background: '#F8FAFC',
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={e => {
              e.target.style.borderColor = '#2563EB'
              e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'
              e.target.style.background = 'white'
            }}
            onBlur={e => {
              e.target.style.borderColor = '#E2E8F0'
              e.target.style.boxShadow = 'none'
              e.target.style.background = '#F8FAFC'
            }}
          />
        </div>

        {/* Notification Bell */}
        <button
          className="btn-press"
          style={{
            position: 'relative',
            width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '8px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Bell size={18} color="#64748B" />
          <span style={{
            position: 'absolute', top: '7px', right: '7px',
            width: '7px', height: '7px',
            background: '#EF4444',
            borderRadius: '50%',
            border: '1.5px solid white',
          }} />
        </button>

        {/* Avatar */}
        <button
          className="btn-press"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 6px',
            borderRadius: '8px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{
            width: '30px', height: '30px',
            borderRadius: '50%',
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 600, color: '#2563EB',
            fontFamily: "'Inter', sans-serif",
          }}>
            AD
          </div>
          <ChevronDown size={13} color="#94A3B8" />
        </button>
      </div>
    </header>
  )
}

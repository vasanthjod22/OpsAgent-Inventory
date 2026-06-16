import { MoreHorizontal, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function SummaryCard({ id, icon: Icon, title, value, trend, trendValue, colors }) {
  const { bg, text } = colors

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendClass = trend === 'up' ? 'badge-green' : trend === 'down' ? 'badge-red' : 'badge-gray'

  return (
    <div
      id={id}
      className="glass-card hover-up"
      style={{
        borderRadius: '12px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: '32px', height: '32px',
          borderRadius: '8px',
          background: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={16} color={text} />
        </div>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px' }}
          onMouseEnter={e => e.currentTarget.style.color = '#64748B'}
          onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Value */}
      <div style={{ marginTop: '16px' }}>
        <div style={{
          fontSize: '28px', fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.5px',
          lineHeight: 1.1,
          fontFamily: "'Inter', sans-serif",
          marginBottom: '4px',
        }}>
          {value}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
          {title}
        </div>
      </div>

      {/* Trend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginTop: '16px', paddingTop: '16px',
        borderTop: '1px solid #F1F5F9',
      }}>
        {trendValue && (
          <>
            <span className={`badge ${trendClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <TrendIcon size={11} />
              {trendValue}
            </span>
            <span style={{ fontSize: '12px', color: '#94A3B8', fontFamily: "'Inter', sans-serif" }}>vs last week</span>
          </>
        )}
        {!trendValue && (
          <span style={{ fontSize: '12px', color: '#94A3B8', fontFamily: "'Inter', sans-serif" }}>No change data</span>
        )}
      </div>
    </div>
  )
}

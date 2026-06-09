import React, { useState } from 'react'
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

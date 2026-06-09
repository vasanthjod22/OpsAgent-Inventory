import React, { useState, useEffect } from 'react';

const GlitchText = ({ text }) => (
  <div style={{ position: 'relative', display: 'inline-block' }}>
    <span style={{ color: 'white' }}>{text}</span>
    <span style={{
      position: 'absolute', top: 0, left: 0,
      color: '#EF4444', clipPath: 'inset(30% 0 40% 0)',
      animation: 'glitch1 2s infinite', opacity: 0.7
    }}>{text}</span>
    <span style={{
      position: 'absolute', top: 0, left: 0,
      color: '#2563EB', clipPath: 'inset(60% 0 20% 0)',
      animation: 'glitch2 2s infinite', opacity: 0.7
    }}>{text}</span>
  </div>
)

const DataWipeRow = ({ label, delay }) => {
  const [wiped, setWiped] = useState(false)
  
  useEffect(() => {
    const t = setTimeout(() => setWiped(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
      opacity: wiped ? 1 : 0.3, transition: 'opacity 0.3s ease',
      animation: wiped ? 'fadeInLeft 0.3s ease' : 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: wiped ? '#EF4444' : '#374151' }}/>
        <span style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'monospace' }}>{label}</span>
      </div>
      {wiped ? (
        <span style={{ fontSize: 11, color: '#EF4444', fontFamily: 'monospace', animation: 'fadeIn 0.3s ease' }}>
          CLEARED ✓
        </span>
      ) : (
        <span style={{ fontSize: 11, color: '#374151', fontFamily: 'monospace' }}>
          pending...
        </span>
      )}
    </div>
  )
}

const LockingScreen = ({ phase }) => {
  return (
    <div style={{ textAlign: 'center', animation: 'fadeInUp 0.4s ease' }}>
      {/* ANIMATED LOCK ICON */}
      <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 32px' }}>
        {/* Outer pulsing rings */}
        {[1,2,3].map(i => (
          <div key={i} style={{
            position: 'absolute', inset: -(i * 16),
            borderRadius: '50%', border: '1px solid rgba(239,68,68,0.3)',
            animation: `ringPulse 2s ease ${i * 0.3}s infinite`
          }}/>
        ))}

        {/* Main circle */}
        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(185,28,28,0.3))',
          border: '2px solid rgba(239,68,68,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', animation: phase >= 2 ? 'lockShake 0.5s ease' : 'none'
        }}>
          {/* SVG Lock that closes */}
          <svg viewBox="0 0 24 24" style={{ width: 52, height: 52, filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.8))' }}>
            {/* Lock body */}
            <rect x="3" y="11" width="18" height="11" rx="2" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="58" strokeDashoffset="0" />
            {/* Lock shackle - animates closed */}
            <path d={phase >= 2 ? "M7 11V7a5 5 0 0 1 10 0v4" : "M7 11V9a5 5 0 0 1 10 0v2"} fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" style={{ transition: 'all 0.4s ease' }} />
            {/* Keyhole */}
            <circle cx="12" cy="16" r="1" fill="#EF4444" />
          </svg>
        </div>
      </div>

      {/* STATUS TEXT */}
      <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 8, letterSpacing: '-0.5px' }}>
        {phase === 1 && "Signing Out..."}
        {phase === 2 && <GlitchText text="Securing Session..." />}
        {phase >= 3 && <GlitchText text="Clearing Data..." />}
      </div>

      {/* SCANNING LINE EFFECT */}
      {phase >= 2 && (
        <div style={{ position: 'relative', width: 300, height: 2, background: 'rgba(239,68,68,0.2)', borderRadius: 999, margin: '16px auto', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 0, left: '-100%', width: '100%', height: '100%',
            background: 'linear-gradient(90deg, transparent, #EF4444, transparent)',
            animation: 'scanLine 1s linear infinite'
          }}/>
        </div>
      )}

      {/* DATA WIPE VISUAL — Phase 3 */}
      {phase >= 3 && (
        <div style={{ marginTop: 24, width: 300, margin: '24px auto 0' }}>
          {[
            'Session token',
            'User credentials', 
            'Cache data',
            'Auth state'
          ].map((item, i) => (
            <DataWipeRow key={item} label={item} delay={i * 200} />
          ))}
        </div>
      )}
    </div>
  )
}

const GoodbyeMessage = ({ userName }) => {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : hour < 21 ? 'Good Evening' : 'Good Night'
  const fullGreeting = `BYE ${greeting.toUpperCase()}`

  return (
    <div style={{ textAlign: 'center', animation: 'fadeInScale 0.5s ease' }}>
      {/* OpsAgent Logo */}
      <div style={{
        width: 72, height: 72, borderRadius: 18,
        background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 24px', boxShadow: '0 0 40px rgba(37,99,235,0.4)',
        animation: 'float 2s ease infinite'
      }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: 'white', letterSpacing: '-1px' }}>OA</span>
      </div>

      {/* Greeting */}
      <div style={{ fontSize: 14, color: '#64748B', marginBottom: 8, letterSpacing: '2px', textTransform: 'uppercase', animation: 'fadeInUp 0.4s ease 0.2s both' }}>
        {fullGreeting}
      </div>

      {/* Name */}
      <div style={{ fontSize: 32, fontWeight: 700, color: 'white', marginBottom: 12, animation: 'fadeInUp 0.4s ease 0.3s both' }}>
        {userName || 'User'}
      </div>

      {/* Message */}
      <div style={{ fontSize: 15, color: '#94A3B8', marginBottom: 32, lineHeight: 1.6, animation: 'fadeInUp 0.4s ease 0.4s both' }}>
        You've been signed out securely.<br/>
        Your data is safe with OpsAgent.
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 24, justifyContent: 'center', animation: 'fadeInUp 0.4s ease 0.5s both' }}>
        {[
          { icon: '🔒', label: 'Session Secured' },
          { icon: '💾', label: 'Data Saved' },
          { icon: '✅', label: 'All Clear' },
        ].map(({ icon, label }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontSize: 11, color: '#475569' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Fading dots */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 32 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: '#334155',
            animation: `dotFade 1.2s ease ${i * 0.2}s infinite`
          }}/>
        ))}
      </div>
    </div>
  )
}

export const SignOutAnimation = ({ isPlaying, userName, onComplete }) => {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    if (!isPlaying) return

    const timers = [
      setTimeout(() => setPhase(1), 0),
      setTimeout(() => setPhase(2), 500),
      setTimeout(() => setPhase(3), 1200),
      setTimeout(() => setPhase(4), 2200),
      setTimeout(() => setPhase(5), 3000),
      setTimeout(() => onComplete(), 3500),
    ]

    return () => timers.forEach(clearTimeout)
  }, [isPlaying, onComplete])

  if (!isPlaying) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: phase >= 5 ? 'black' : 'rgba(0,0,0,0.92)',
      backdropFilter: 'blur(12px)', transition: 'background 0.5s ease'
    }}>
      {phase >= 1 && phase < 4 && <LockingScreen phase={phase} />}
      {phase >= 4 && <GoodbyeMessage userName={userName} />}
    </div>
  )
}

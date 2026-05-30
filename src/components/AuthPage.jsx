import { useState, useEffect, useRef, useCallback } from 'react'
import {
  User, Lock, Mail, Building, Eye, EyeOff,
  Zap, ArrowRight, ShieldCheck, CheckCircle2
} from 'lucide-react'
import { initDemoUser, findUser, verifyPassword, registerUser, updatePassword } from '../utils/auth'

/* ─── Animated SVG Checkmark ─────────────────────────────────────────────── */
function AnimatedCheckmark({ size = 72, color = '#16A34A' }) {
  return (
    <svg viewBox="0 0 52 52" style={{ width: size, height: size, display: 'block' }}>
      <circle
        cx="26" cy="26" r="25"
        fill="none" stroke={color} strokeWidth="2"
        strokeDasharray="0 157"
        style={{ animation: 'circleGrow 0.5s ease forwards' }}
      />
      <path
        fill="none" stroke={color} strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round"
        d="M14 27 L22 35 L38 19"
        strokeDasharray="48" strokeDashoffset="48"
        style={{ animation: 'checkDraw 0.4s ease 0.45s forwards' }}
      />
    </svg>
  )
}

/* ─── Progress Bar ───────────────────────────────────────────────────────── */
function ProgressBar({ duration = 1500, color = '#2563EB' }) {
  return (
    <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '99px', overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: '99px', background: color,
        animation: `progressFill ${duration}ms ease-in-out forwards`,
        width: '0%',
      }} />
    </div>
  )
}

/* ─── Confetti ───────────────────────────────────────────────────────────── */
const CONFETTI_COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED']
const confettiPieces = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 6 + Math.random() * 4,
  isCircle: Math.random() > 0.5,
  tx: `${-200 + Math.random() * 400}px`,
  ty: `${-300 + Math.random() * 400}px`,
  rot: `${Math.random() * 720}deg`,
  delay: `${Math.random() * 0.3}s`,
}))

function Confetti({ active }) {
  if (!active) return null
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 10 }}>
      {confettiPieces.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            width: p.size, height: p.size,
            background: p.color,
            borderRadius: p.isCircle ? '50%' : '0',
            '--tx': p.tx, '--ty': p.ty, '--rot': p.rot,
            animation: `confettiFly 1s ease-out ${p.delay} forwards`,
            opacity: 1,
          }}
        />
      ))}
    </div>
  )
}

/* ─── Sparkles (Signup left panel) ─────────────────────────────────────────── */
const sparkles = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  x: `${5 + Math.random() * 90}%`,
  y: `${5 + Math.random() * 90}%`,
  delay: `${Math.random() * 2}s`,
  dur: `${1.5 + Math.random() * 1.5}s`,
}))

/* ─── Main AuthPage ─────────────────────────────────────────────────────── */
export default function AuthPage({ onAuthSuccess, showToast }) {
  const [view, setView] = useState('login')
  const [leftPanel, setLeftPanel] = useState({ bg: '#0F172A', mode: 'default' })
  const [sliding, setSliding] = useState(false)
  const [successUser, setSuccessUser] = useState(null)

  useEffect(() => { initDemoUser() }, [])

  const handleAuthSuccess = useCallback((user) => {
    setSuccessUser(user)
    setSliding(true)
    setTimeout(() => onAuthSuccess(user), 600)
  }, [onAuthSuccess])

  const setPanel = useCallback((mode) => {
    if (mode === 'loginSuccess') setLeftPanel({ bg: '#052E16', mode: 'loginSuccess' })
    else if (mode === 'signupSuccess') setLeftPanel({ bg: '#1E1B4B', mode: 'signupSuccess' })
    else setLeftPanel({ bg: '#0F172A', mode: 'default' })
  }, [])

  return (
    <div
      className={sliding ? 'animate-slideUp' : ''}
      style={{ display: 'flex', minHeight: '100vh', width: '100vw', fontFamily: "'Inter', sans-serif", overflow: 'hidden' }}
    >
      {/* ── Left Dark Panel ── */}
      <div
        className="hidden md:flex flex-col justify-center auth-panel-transition"
        style={{ width: '40%', background: leftPanel.bg, padding: '60px', position: 'relative', overflow: 'hidden' }}
      >
        {/* Sparkles for signup success */}
        {leftPanel.mode === 'signupSuccess' && sparkles.map(s => (
          <div key={s.id} style={{
            position: 'absolute', left: s.x, top: s.y,
            width: '6px', height: '6px', borderRadius: '50%', background: '#A78BFA',
            animation: `twinkle ${s.dur} ease-in-out ${s.delay} infinite`,
          }} />
        ))}

        {/* Logo */}
        <div style={{ position: 'absolute', top: '40px', left: '60px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', background: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '12px', height: '12px', background: '#2563EB', borderRadius: '4px' }} />
          </div>
          <span style={{ color: 'white', fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>OpsAgent</span>
        </div>

        {/* Default content */}
        {leftPanel.mode === 'default' && (
          <div style={{ zIndex: 10 }} className="animate-fadein">
            <h1 style={{ color: 'white', fontSize: '28px', fontWeight: 600, lineHeight: 1.3, marginBottom: '16px' }}>
              Your AI-powered<br />back-office manager
            </h1>
            <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.5, marginBottom: '40px', maxWidth: '320px' }}>
              Automate GRN processing, track inventory, and get instant financial insights.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '60px' }}>
              {['AI-powered GRN OCR processing', 'Real-time inventory management', 'Smart financial analytics'].map((text, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', animation: `fadein 0.4s ease forwards ${i * 0.1 + 0.1}s`, opacity: 0 }}>
                  <CheckCircle2 size={20} color="#2563EB" />
                  <span style={{ color: '#CBD5E1', fontSize: '14px' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Login success panel content */}
        {leftPanel.mode === 'loginSuccess' && (
          <div style={{ zIndex: 10 }} className="animate-fadein">
            <h1 style={{ color: 'white', fontSize: '28px', fontWeight: 600, lineHeight: 1.3, marginBottom: '16px' }}>
              Welcome to<br />OpsAgent
            </h1>
            <p style={{ color: '#86EFAC', fontSize: '15px', lineHeight: 1.5, marginBottom: '40px' }}>
              Your dashboard is loading. Everything is ready for you.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {['AI-powered GRN OCR processing', 'Real-time inventory management', 'Smart financial analytics'].map((text, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CheckCircle2 size={20} color="#4ADE80" />
                  <span style={{ color: '#BBF7D0', fontSize: '14px', textShadow: '0 0 12px rgba(74,222,128,0.3)' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signup success panel content */}
        {leftPanel.mode === 'signupSuccess' && (
          <div style={{ zIndex: 10 }} className="animate-fadein">
            <h1 style={{ color: 'white', fontSize: '32px', fontWeight: 700, lineHeight: 1.2, marginBottom: '16px' }}>
              You're all set!
            </h1>
            <p style={{ color: '#C4B5FD', fontSize: '15px', lineHeight: 1.5, marginBottom: '40px' }}>
              Start automating your business today with AI-powered tools.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['Account created & secured', 'AI agents standing by', 'Dashboard ready'].map((text, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', animation: `fadein 0.4s ease forwards ${i * 0.2}s`, opacity: 0 }}>
                  <CheckCircle2 size={20} color="#A78BFA" />
                  <span style={{ color: '#DDD6FE', fontSize: '14px' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom trust badges (default only) */}
        {leftPanel.mode === 'default' && (
          <div style={{ position: 'absolute', bottom: '40px', left: '60px' }}>
            <p style={{ color: '#475569', fontSize: '12px', marginBottom: '12px' }}>Trusted by small businesses across India</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['KC','LB','GT'].map(initials => (
                <div key={initials} style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '11px', fontWeight: 600 }}>{initials}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right Form Panel ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#F8FAFC' }}>
        <div style={{ maxWidth: '480px', width: '100%', background: 'white', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0', position: 'relative', transition: 'box-shadow 0.4s ease' }}>
          {/* Mobile Logo */}
          <div className="md:hidden flex items-center justify-center gap-2 mb-8">
            <div style={{ width: '28px', height: '28px', background: '#2563EB', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '10px', height: '10px', background: 'white', borderRadius: '3px' }} />
            </div>
            <span style={{ color: '#0F172A', fontSize: '20px', fontWeight: 700 }}>OpsAgent</span>
          </div>

          {view === 'login' && <LoginForm onAuthSuccess={handleAuthSuccess} onSwitch={() => setView('signup')} onForgot={() => setView('forgot')} onPanelChange={setPanel} showToast={showToast} />}
          {view === 'signup' && <SignupForm onAuthSuccess={handleAuthSuccess} onSwitch={() => setView('login')} onPanelChange={setPanel} showToast={showToast} />}
          {view === 'forgot' && <ForgotStep1 onNext={() => setView('forgot-otp')} onBack={() => setView('login')} />}
          {view === 'forgot-otp' && <ForgotStep2 onNext={() => setView('forgot-reset')} onBack={() => setView('login')} />}
          {view === 'forgot-reset' && <ForgotStep3 onResetSuccess={() => setView('login')} onBack={() => setView('login')} showToast={showToast} />}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIN FORM
═══════════════════════════════════════════════════════════════════════════ */
function LoginForm({ onAuthSuccess, onSwitch, onForgot, onPanelChange, showToast }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('idle') // idle | typing | loading | success | redirect
  const [shake, setShake] = useState(false)
  const [loggedInUser, setLoggedInUser] = useState(null)

  const triggerError = (msg) => {
    setError(msg)
    setPhase('idle')
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const doLogin = useCallback((id, pwd) => {
    const user = findUser(id)
    if (!user || !verifyPassword(user, pwd)) {
      triggerError('Invalid username or password')
      return
    }
    // SUCCESS SEQUENCE
    setLoggedInUser(user)
    setPhase('success')
    onPanelChange('loginSuccess')
    showToast && showToast(`Welcome back, ${user.fullName}!`, 'success', 'Signed in successfully')
    // After 1.6s (progress bar), redirect
    setTimeout(() => onAuthSuccess(user), 1700)
  }, [onAuthSuccess, onPanelChange, showToast])

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (phase !== 'idle') return
    setError('')
    if (!identifier || !password) { triggerError('Please fill in all fields'); return }
    setPhase('loading')
    setTimeout(() => doLogin(identifier, password), 600)
  }

  // Demo typewriter
  const handleDemo = () => {
    if (phase !== 'idle') return
    setPhase('typing')
    setIdentifier('')
    setPassword('')
    setError('')
    const demoUser = 'demo'
    const demoPass = 'demo123'
    let i = 0
    const typeUser = setInterval(() => {
      i++
      setIdentifier(demoUser.slice(0, i))
      if (i >= demoUser.length) {
        clearInterval(typeUser)
        let j = 0
        const typePass = setInterval(() => {
          j++
          setPassword(demoPass.slice(0, j))
          if (j >= demoPass.length) {
            clearInterval(typePass)
            // Small pause then submit
            setTimeout(() => {
              setPhase('loading')
              setTimeout(() => doLogin(demoUser, demoPass), 400)
            }, 300)
          }
        }, 80)
      }
    }, 80)
  }

  if (phase === 'success') {
    return (
      <div className="animate-fadein" style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <AnimatedCheckmark size={80} color="#16A34A" />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>Login Successful!</h2>
        <p style={{ fontSize: '16px', color: '#64748B', marginBottom: '24px' }}>
          Welcome back, {loggedInUser?.fullName?.split(' ')[0] || 'there'}!
        </p>
        <div style={{ marginBottom: '8px' }}>
          <ProgressBar duration={1500} color="#2563EB" />
        </div>
        <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '8px' }}>Loading your dashboard...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={shake ? 'animate-shake' : ''}>
      <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>Welcome back</h2>
      <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '24px' }}>Sign in to your OpsAgent account</p>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#0F172A', marginBottom: '6px' }}>Username or Email</label>
        <div style={{ position: 'relative' }}>
          <User size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text" value={identifier}
            onChange={e => { setIdentifier(e.target.value); setError('') }}
            placeholder="Enter your username"
            className="input-base"
            style={{ paddingLeft: '38px', height: '44px', borderColor: error ? '#DC2626' : '#E2E8F0' }}
            disabled={phase !== 'idle'}
          />
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Password</label>
          <button type="button" onClick={onForgot} style={{ fontSize: '12px', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Forgot password?</button>
        </div>
        <div style={{ position: 'relative' }}>
          <Lock size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type={showPassword ? 'text' : 'password'} value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="Enter your password"
            className="input-base"
            style={{ paddingLeft: '38px', paddingRight: '40px', height: '44px', borderColor: error ? '#DC2626' : '#E2E8F0' }}
            disabled={phase !== 'idle'}
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
            {showPassword ? <EyeOff size={16} color="#94A3B8" /> : <Eye size={16} color="#94A3B8" />}
          </button>
        </div>
      </div>

      {error && <p className="animate-fadeUp" style={{ color: '#DC2626', fontSize: '12px', marginBottom: '12px' }}>{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <input type="checkbox" id="remember" style={{ accentColor: '#2563EB', width: '14px', height: '14px' }} />
        <label htmlFor="remember" style={{ fontSize: '13px', color: '#475569', cursor: 'pointer' }}>Remember me for 30 days</label>
      </div>

      {/* Sign In Button */}
      <button
        type="submit"
        disabled={phase === 'loading' || phase === 'typing'}
        className="btn-press"
        style={{
          width: '100%', height: '44px',
          background: phase === 'loading' ? '#16A34A' : '#2563EB',
          color: 'white', borderRadius: '8px', border: 'none',
          fontWeight: 600, fontSize: '14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          cursor: (phase === 'loading' || phase === 'typing') ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 12px rgba(37,99,235,0.2)', marginBottom: '24px',
          transition: 'background 0.3s ease',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {phase === 'loading' ? (
          <>
            <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <span>Signing in...</span>
          </>
        ) : phase === 'typing' ? (
          <span>Preparing demo...</span>
        ) : (
          <><span>Sign In</span><ArrowRight size={16} /></>
        )}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
        <span style={{ fontSize: '12px', color: '#94A3B8' }}>or continue with</span>
        <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
      </div>

      <button
        type="button" onClick={handleDemo}
        disabled={phase !== 'idle'}
        className="btn-press"
        style={{ width: '100%', height: '44px', background: 'white', color: '#0F172A', borderRadius: '8px', border: '1px solid #E2E8F0', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: phase !== 'idle' ? 'not-allowed' : 'pointer', marginBottom: '24px', fontFamily: "'Inter', sans-serif" }}
      >
        <Zap size={16} color="#F59E0B" /> Try Demo Account
      </button>

      <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748B' }}>
        Don't have an account?{' '}
        <button type="button" onClick={onSwitch} style={{ color: '#2563EB', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Sign up</button>
      </p>
    </form>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIGNUP FORM
═══════════════════════════════════════════════════════════════════════════ */
function SignupForm({ onAuthSuccess, onSwitch, onPanelChange, showToast }) {
  const [formData, setFormData] = useState({ fullName: '', username: '', email: '', company: '', password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [phase, setPhase] = useState('idle') // idle | loading | confetti | success
  const [newUser, setNewUser] = useState(null)
  const [visibleSteps, setVisibleSteps] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)

  const isUsernameTaken = (uname) => uname.length >= 3 && findUser(uname) !== undefined

  const validate = useCallback(() => {
    const errs = {}
    if (touched.fullName && formData.fullName.length < 2) errs.fullName = 'Name is too short'
    if (touched.username) {
      if (formData.username.length < 3) errs.username = 'Min 3 characters'
      else if (/\s/.test(formData.username)) errs.username = 'No spaces allowed'
      else if (isUsernameTaken(formData.username)) errs.username = '✗ Username taken'
    }
    if (touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Invalid email format'
    if (touched.password && formData.password.length < 8) errs.password = 'Min 8 characters required'
    if (touched.confirm && formData.password !== formData.confirm) errs.confirm = "Passwords don't match"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [formData, touched])

  useEffect(() => { validate() }, [formData, touched, validate])

  const getStrength = () => {
    let s = 0
    if (formData.password.length > 7) s++
    if (/[A-Z]/.test(formData.password)) s++
    if (/[0-9]/.test(formData.password)) s++
    if (/[^A-Za-z0-9]/.test(formData.password)) s++
    return s
  }
  const strength = getStrength()
  const strengthColors = ['#E2E8F0', '#DC2626', '#F59E0B', '#16A34A', '#2563EB']

  const isReady = formData.fullName.length >= 2 &&
    formData.username.length >= 3 &&
    !isUsernameTaken(formData.username) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
    formData.password.length >= 8 &&
    formData.password === formData.confirm &&
    !Object.keys(errors).length

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isReady || phase !== 'idle') return
    setPhase('loading')
    setTimeout(() => {
      const user = registerUser({
        fullName: formData.fullName,
        username: formData.username,
        email: formData.email,
        company: formData.company,
        password: formData.password,
      })
      setNewUser(user)
      setShowConfetti(true)
      setPhase('confetti')
      onPanelChange('signupSuccess')
      showToast && showToast(`Welcome to OpsAgent, ${user.fullName}!`, 'info', '🎉 Account created!')

      // Sequential setup steps
      const steps = [1, 2, 3, 4]
      steps.forEach((_, i) => {
        setTimeout(() => setVisibleSteps(i + 1), 400 + i * 400)
      })

      // Move to success card after confetti
      setTimeout(() => setPhase('success'), 400)

      // Final redirect
      setTimeout(() => onAuthSuccess(user), 2800)
    }, 800)
  }

  if (phase === 'confetti' || phase === 'success') {
    return (
      <div style={{ position: 'relative', overflow: 'visible', textAlign: 'center', padding: '8px 0' }}>
        <Confetti active={showConfetti} />

        <div className="animate-scaleBounce" style={{ fontSize: '52px', marginBottom: '16px', display: 'inline-block' }}>🎉</div>
        <h2 className="animate-fadeUp" style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', marginBottom: '8px', animationDelay: '0.1s', opacity: 0 }}>
          Welcome to OpsAgent!
        </h2>
        <p className="animate-fadeUp" style={{ fontSize: '14px', color: '#64748B', marginBottom: '20px', animationDelay: '0.15s', opacity: 0 }}>
          Your account has been created successfully
        </p>

        {/* User info card */}
        {newUser && (
          <div className="animate-fadeUp" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px', textAlign: 'left', animationDelay: '0.2s', opacity: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <User size={14} color="#64748B" />
              <span style={{ fontSize: '13px', color: '#0F172A', fontWeight: 500 }}>{newUser.fullName}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: newUser.company ? '8px' : 0 }}>
              <span style={{ fontSize: '14px', color: '#64748B', lineHeight: 1 }}>@</span>
              <span style={{ fontSize: '13px', color: '#64748B' }}>{newUser.username}</span>
            </div>
            {newUser.company && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building size={14} color="#64748B" />
                <span style={{ fontSize: '13px', color: '#64748B' }}>{newUser.company}</span>
              </div>
            )}
          </div>
        )}

        <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '8px' }}>Setting up your workspace...</p>
        <div style={{ marginBottom: '20px' }}>
          <ProgressBar duration={2200} color="#2563EB" />
        </div>

        {/* Sequential steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
          {['Account created', 'Profile configured', 'Demo data loaded', 'Ready to go!'].map((step, i) => (
            <div
              key={step}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                opacity: visibleSteps > i ? 1 : 0,
                animation: visibleSteps > i ? 'stepFadeIn 0.3s ease forwards' : 'none',
              }}
            >
              <CheckCircle2 size={16} color="#16A34A" />
              <span style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>Create your account</h2>
      <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '20px' }}>Start managing your business with AI</p>

      {[
        { field: 'fullName', label: 'Full Name', Icon: User, placeholder: 'Your full name', type: 'text' },
        { field: 'username', label: 'Username', Icon: User, placeholder: 'Choose a username', type: 'text' },
        { field: 'email', label: 'Email Address', Icon: Mail, placeholder: 'your@email.com', type: 'email' },
        { field: 'company', label: 'Company Name', Icon: Building, placeholder: 'Your company name', type: 'text', optional: true },
      ].map(({ field, label, Icon, placeholder, type, optional }) => (
        <div key={field} style={{ marginBottom: '14px' }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: '#0F172A', marginBottom: '5px' }}>
            <span>{label}</span>
            {optional && <span style={{ color: '#94A3B8', fontWeight: 400, fontSize: '12px' }}>Optional</span>}
          </label>
          <div style={{ position: 'relative' }}>
            <Icon size={15} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type={type}
              value={formData[field]}
              onChange={e => setFormData({ ...formData, [field]: e.target.value })}
              onBlur={() => setTouched(p => ({ ...p, [field]: true }))}
              placeholder={placeholder}
              className="input-base"
              style={{
                paddingLeft: '36px', height: '42px',
                borderColor: errors[field] ? '#DC2626' : (touched[field] && !errors[field] && formData[field] ? '#16A34A' : '#E2E8F0'),
              }}
            />
            {field === 'username' && touched.username && !errors.username && formData.username.length >= 3 && (
              <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#16A34A', fontSize: '12px', fontWeight: 600 }}>✓ Available</span>
            )}
          </div>
          {errors[field] && <p style={{ color: '#DC2626', fontSize: '11px', marginTop: '3px' }}>{errors[field]}</p>}
        </div>
      ))}

      {/* Password */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', display: 'block', marginBottom: '5px' }}>Password</label>
        <div style={{ position: 'relative' }}>
          <Lock size={15} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            onBlur={() => setTouched(p => ({ ...p, password: true }))}
            placeholder="Create a password"
            className="input-base"
            style={{ paddingLeft: '36px', paddingRight: '40px', height: '42px', borderColor: errors.password ? '#DC2626' : '#E2E8F0' }}
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
            {showPassword ? <EyeOff size={15} color="#94A3B8" /> : <Eye size={15} color="#94A3B8" />}
          </button>
        </div>
        {touched.password && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', gap: '3px', marginBottom: '6px' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ height: '3px', flex: 1, borderRadius: '99px', background: strength >= i ? strengthColors[strength] : '#E2E8F0', transition: 'background 0.3s' }} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
              {[
                { label: '8+ characters', ok: formData.password.length >= 8 },
                { label: 'Uppercase letter', ok: /[A-Z]/.test(formData.password) },
                { label: 'One number', ok: /[0-9]/.test(formData.password) },
                { label: 'Special character', ok: /[^A-Za-z0-9]/.test(formData.password) },
              ].map(({ label, ok }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: ok ? '#16A34A' : '#94A3B8', fontSize: '11px' }}>
                  <CheckCircle2 size={11} /> {label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirm Password */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', display: 'block', marginBottom: '5px' }}>Confirm Password</label>
        <div style={{ position: 'relative' }}>
          <Lock size={15} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="password"
            value={formData.confirm}
            onChange={e => setFormData({ ...formData, confirm: e.target.value })}
            onBlur={() => setTouched(p => ({ ...p, confirm: true }))}
            placeholder="Repeat your password"
            className="input-base"
            style={{ paddingLeft: '36px', paddingRight: '40px', height: '42px', borderColor: touched.confirm ? (formData.confirm && formData.password === formData.confirm ? '#16A34A' : '#DC2626') : '#E2E8F0' }}
          />
          {touched.confirm && formData.confirm && (
            <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}>
              {formData.password === formData.confirm ? '✓' : '✗'}
            </span>
          )}
        </div>
        {errors.confirm && <p style={{ color: '#DC2626', fontSize: '11px', marginTop: '3px' }}>{errors.confirm}</p>}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '20px' }}>
        <input type="checkbox" id="terms" required style={{ accentColor: '#2563EB', width: '14px', height: '14px', marginTop: '2px' }} />
        <label htmlFor="terms" style={{ fontSize: '13px', color: '#475569', lineHeight: 1.4 }}>
          I agree to the <a href="#" style={{ color: '#2563EB', textDecoration: 'none' }}>Terms of Service</a> and <a href="#" style={{ color: '#2563EB', textDecoration: 'none' }}>Privacy Policy</a>
        </label>
      </div>

      <button
        type="submit"
        disabled={!isReady || phase !== 'idle'}
        className="btn-press"
        style={{ width: '100%', height: '44px', background: (!isReady || phase !== 'idle') ? '#94A3B8' : '#2563EB', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '14px', cursor: (!isReady || phase !== 'idle') ? 'not-allowed' : 'pointer', marginBottom: '20px', transition: 'background 0.2s', fontFamily: "'Inter', sans-serif" }}
      >
        {phase === 'loading' ? 'Creating account...' : 'Create Account'}
      </button>

      <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748B' }}>
        Already have an account?{' '}
        <button type="button" onClick={onSwitch} style={{ color: '#2563EB', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Sign in</button>
      </p>
    </form>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   FORGOT STEP 1
═══════════════════════════════════════════════════════════════════════════ */
function ForgotStep1({ onNext, onBack }) {
  const [ident, setIdent] = useState('')
  const [error, setError] = useState('')

  const handleSend = () => {
    const u = findUser(ident)
    if (!u) { setError('No account found with this username'); return }
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    localStorage.setItem('opsagent_otp', JSON.stringify({ username: u.username, otp, expiresAt: Date.now() + 300000 }))
    alert(`DEMO ONLY: Your reset code is ${otp}`)
    onNext()
  }

  return (
    <div className="animate-fadein">
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <div style={{ width: '52px', height: '52px', background: '#EFF6FF', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={26} color="#2563EB" />
        </div>
      </div>
      <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', marginBottom: '4px', textAlign: 'center' }}>Forgot your password?</h2>
      <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '28px', textAlign: 'center' }}>Enter your username and we'll help you reset it</p>

      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <User size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          type="text" value={ident}
          onChange={e => { setIdent(e.target.value); setError('') }}
          placeholder="Username or Email"
          className="input-base"
          style={{ paddingLeft: '36px', height: '44px', borderColor: error ? '#DC2626' : '#E2E8F0' }}
        />
      </div>
      {error && <p style={{ color: '#DC2626', fontSize: '12px', marginTop: '-12px', marginBottom: '16px', textAlign: 'center' }}>{error}</p>}

      <button onClick={handleSend} disabled={!ident} className="btn-press" style={{ width: '100%', height: '44px', background: ident ? '#2563EB' : '#94A3B8', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '14px', cursor: ident ? 'pointer' : 'not-allowed', marginBottom: '20px', fontFamily: "'Inter', sans-serif" }}>
        Send Reset Code
      </button>
      <div style={{ textAlign: 'center' }}>
        <button onClick={onBack} style={{ color: '#64748B', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer' }}>← Back to Login</button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   FORGOT STEP 2
═══════════════════════════════════════════════════════════════════════════ */
function ForgotStep2({ onNext, onBack }) {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [timeLeft, setTimeLeft] = useState(300)
  const inputs = useRef([])

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(p => p > 0 ? p - 1 : 0), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleChange = (i, v) => {
    if (!/^[0-9]*$/.test(v)) return
    const nc = [...code]; nc[i] = v; setCode(nc); setError('')
    if (v && i < 5) inputs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) inputs.current[i - 1]?.focus()
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').slice(0, 6).replace(/\D/g, '')
    const nc = [...code]
    for (let i = 0; i < pasted.length; i++) nc[i] = pasted[i]
    setCode(nc)
    inputs.current[Math.min(pasted.length, 5)]?.focus()
  }

  const handleVerify = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('opsagent_otp'))
      if (!stored || Date.now() > stored.expiresAt || stored.otp !== code.join('')) {
        setError('Invalid code. Please try again'); return
      }
      onNext()
    } catch { setError('Error verifying code') }
  }

  const full = code.join('').length === 6

  return (
    <div className="animate-fadein">
      <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', marginBottom: '4px', textAlign: 'center' }}>Enter reset code</h2>
      <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '28px', textAlign: 'center' }}>We generated a 6-digit code for you</p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
        {code.map((d, i) => (
          <input
            key={i} ref={el => inputs.current[i] = el}
            type="text" maxLength={1} value={d}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            style={{ width: '48px', height: '56px', fontSize: '22px', fontWeight: 600, textAlign: 'center', borderRadius: '8px', border: `1.5px solid ${d ? '#2563EB' : '#E2E8F0'}`, outline: 'none', transition: 'all 0.15s', boxShadow: d ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none', fontFamily: "'Inter', sans-serif" }}
            onFocus={e => e.target.style.borderColor = '#2563EB'}
            onBlur={e => e.target.style.borderColor = d ? '#2563EB' : '#E2E8F0'}
          />
        ))}
      </div>
      {error && <p style={{ color: '#DC2626', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>{error}</p>}

      <p style={{ textAlign: 'center', fontSize: '13px', color: timeLeft < 60 ? '#DC2626' : '#64748B', marginBottom: '20px', fontWeight: 500 }}>
        {timeLeft > 0
          ? `Code expires in ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`
          : <button style={{ color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Resend Code</button>
        }
      </p>

      <button onClick={handleVerify} disabled={!full} className="btn-press" style={{ width: '100%', height: '44px', background: full ? '#2563EB' : '#94A3B8', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '14px', cursor: full ? 'pointer' : 'not-allowed', marginBottom: '20px', fontFamily: "'Inter', sans-serif" }}>
        Verify Code
      </button>
      <div style={{ textAlign: 'center' }}>
        <button onClick={onBack} style={{ color: '#64748B', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer' }}>← Back to Login</button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   FORGOT STEP 3 — with animated countdown + checkmark success
═══════════════════════════════════════════════════════════════════════════ */
function ForgotStep3({ onResetSuccess, onBack, showToast }) {
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [phase, setPhase] = useState('idle') // idle | success
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    if (phase !== 'success') return
    if (countdown <= 0) { onResetSuccess(); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown, onResetSuccess])

  const handleReset = () => {
    if (pwd.length < 8 || pwd !== confirm) return
    const stored = JSON.parse(localStorage.getItem('opsagent_otp') || '{}')
    if (!stored.username) return
    updatePassword(stored.username, pwd)
    localStorage.removeItem('opsagent_otp')
    setPhase('success')
    showToast && showToast('Password updated!', 'success', '✓ Password Reset')
  }

  if (phase === 'success') {
    return (
      <div className="animate-fadein" style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <AnimatedCheckmark size={80} color="#16A34A" />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#16A34A', marginBottom: '8px' }}>Password Reset!</h2>
        <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '28px' }}>Your password has been updated successfully</p>

        {/* Countdown */}
        <div style={{ marginBottom: '20px' }}>
          <span
            key={countdown}
            style={{
              display: 'inline-block',
              fontSize: '14px', color: '#64748B', fontWeight: 500,
              animation: 'countPop 0.4s ease forwards',
            }}
          >
            Returning to login in {countdown}...
          </span>
        </div>

        <ProgressBar duration={3000} color="#16A34A" />
      </div>
    )
  }

  return (
    <div className="animate-fadein">
      <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', marginBottom: '4px', textAlign: 'center' }}>Set new password</h2>
      <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '28px', textAlign: 'center' }}>Choose a strong password</p>

      <div style={{ position: 'relative', marginBottom: '14px' }}>
        <Lock size={15} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="New Password" className="input-base" style={{ paddingLeft: '36px', height: '44px' }} />
      </div>
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <Lock size={15} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm New Password" className="input-base" style={{ paddingLeft: '36px', height: '44px', borderColor: (confirm && pwd !== confirm) ? '#DC2626' : '#E2E8F0' }} />
        {confirm && pwd !== confirm && <p style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px' }}>Passwords do not match</p>}
      </div>

      <button
        onClick={handleReset} disabled={pwd.length < 8 || pwd !== confirm} className="btn-press"
        style={{ width: '100%', height: '44px', background: (pwd.length >= 8 && pwd === confirm) ? '#2563EB' : '#94A3B8', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '14px', cursor: (pwd.length >= 8 && pwd === confirm) ? 'pointer' : 'not-allowed', marginBottom: '20px', fontFamily: "'Inter', sans-serif" }}
      >
        Reset Password
      </button>
      <div style={{ textAlign: 'center' }}>
        <button onClick={onBack} style={{ color: '#64748B', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer' }}>← Cancel</button>
      </div>
    </div>
  )
}

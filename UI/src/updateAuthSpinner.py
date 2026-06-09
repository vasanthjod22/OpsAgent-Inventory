filepath = 'd:/Inventory/UI/src/components/AuthPage.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# ── Hardware Loading Spinner component ───────────────────────────
hardware_spinner = '''
/* \u2500\u2500\u2500 Hardware Loading Spinner \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function HardwareSpinner({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ display: \'block\', animation: \'gearPulse 2s ease-in-out infinite\' }}>
      {/* Outer gear - large */}
      <g style={{ transformOrigin: \'24px 24px\', animation: \'gearSpin 3s linear infinite\' }}>
        {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => (
          <rect key={i}
            x="22" y="2" width="4" height="7" rx="1.5"
            fill="#2563EB" opacity="0.85"
            style={{ transformOrigin: \'24px 24px\', transform: `rotate(${deg}deg)` }}
          />
        ))}
        <circle cx="24" cy="24" r="14" fill="none" stroke="#2563EB" strokeWidth="2.5" opacity="0.6" />
        <circle cx="24" cy="24" r="10" fill="#EFF6FF" />
      </g>

      {/* Inner bolt icon */}
      <g style={{ transformOrigin: \'24px 24px\', animation: \'boltFlash 1.4s ease-in-out infinite\' }}>
        <path d="M26 14 L20 24 H25 L22 34 L32 22 H26 L29 14 Z"
          fill="#2563EB" opacity="0.9" />
      </g>

      {/* Circuit arc lines */}
      <circle cx="24" cy="24" r="20"
        fill="none" stroke="#2563EB" strokeWidth="1" strokeOpacity="0.25"
        strokeDasharray="12 4"
        style={{ transformOrigin: \'24px 24px\', animation: \'gearSpinReverse 8s linear infinite\' }}
      />
    </svg>
  )
}

/* \u2500\u2500\u2500 Hardware Loading Screen \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function HardwareLoadingScreen({ label = \'Processing...\' }) {
  const steps = [
    { icon: \'⚙\', text: \'Authenticating credentials\' },
    { icon: \'🔌\', text: \'Connecting to inventory system\' },
    { icon: \'📦\', text: \'Loading your workspace\' },
  ]
  const [activeStep, setActiveStep] = React.useState(0)
  React.useEffect(() => {
    const id = setInterval(() => setActiveStep(s => (s + 1) % steps.length), 700)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{ display: \'flex\', flexDirection: \'column\', alignItems: \'center\', gap: \'16px\', padding: \'8px 0\' }}>
      <HardwareSpinner size={56} />
      <div style={{ fontSize: \'14px\', fontWeight: 600, color: \'#0F172A\' }}>{label}</div>
      <div style={{
        fontSize: \'12px\', color: \'#64748B\', display: \'flex\', alignItems: \'center\', gap: \'6px\',
        background: \'#F8FAFC\', padding: \'6px 14px\', borderRadius: \'99px\', border: \'1px solid #E2E8F0\'
      }}>
        <span>{steps[activeStep].icon}</span>
        <span style={{ transition: \'opacity 0.3s\' }}>{steps[activeStep].text}</span>
      </div>
    </div>
  )
}

'''

# Insert after the imports block (after logoutUser import)
insert_after = "import { loginUser, registerUser, logoutUser } from '../utils/auth'"
content = content.replace(insert_after, insert_after + '\n' + hardware_spinner, 1)

# ── Replace React.useState / React.useEffect with proper hooks in new components ──
# (They already import useState/useEffect, so use those directly)
content = content.replace('React.useState(', 'useState(')
content = content.replace('React.useRef(null)', 'useRef(null)')
content = content.replace('React.useEffect(', 'useEffect(')

# ── Replace the plain spinner in Login button with HardwareSpinner ──
old_spinner = """          <>
            <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <span>Signing in...</span>
          </>"""
new_spinner = """          <>
            <span style={{ display: 'inline-block', width: '18px', height: '18px' }}>
              <svg width="18" height="18" viewBox="0 0 48 48" fill="none" style={{ animation: 'gearSpin 1.2s linear infinite' }}>
                {[0,60,120,180,240,300].map((deg, i) => (
                  <rect key={i} x="22" y="2" width="4" height="8" rx="2" fill="rgba(255,255,255,0.9)"
                    style={{ transformOrigin: '24px 24px', transform: `rotate(${deg}deg)` }} />
                ))}
                <circle cx="24" cy="24" r="10" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="3" />
                <circle cx="24" cy="24" r="5" fill="white" />
              </svg>
            </span>
            <span>Signing in...</span>
          </>"""
content = content.replace(old_spinner, new_spinner)

# ── Replace ProgressBar in login success with hardware themed version ──
old_login_progress = """        <div style={{ marginBottom: '8px' }}>
          <ProgressBar duration={1500} color="#2563EB" />
        </div>
        <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '8px' }}>Loading your dashboard...</p>"""
new_login_progress = """        <div style={{ marginBottom: '8px' }}>
          <ProgressBar duration={1500} color="#2563EB" />
        </div>
        <HardwareLoadingScreen label="Logging you in..." />"""
content = content.replace(old_login_progress, new_login_progress)

# ── Replace "Creating account..." plain text with hardware spinner ──
old_signup_btn = "{phase === 'loading' ? 'Creating account...' : 'Create Account'}"
new_signup_btn = """{phase === 'loading' ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 48 48" fill="none" style={{ animation: 'gearSpin 1.2s linear infinite', flexShrink: 0 }}>
              {[0,60,120,180,240,300].map((deg, i) => (
                <rect key={i} x="22" y="2" width="4" height="8" rx="2" fill="rgba(255,255,255,0.9)"
                  style={{ transformOrigin: '24px 24px', transform: `rotate(${deg}deg)` }} />
              ))}
              <circle cx="24" cy="24" r="10" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="3" />
              <circle cx="24" cy="24" r="5" fill="white" />
            </svg>
            <span>Creating account...</span>
          </span>
        ) : 'Create Account'}"""
content = content.replace(old_signup_btn, new_signup_btn)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! Hardware spinner added to AuthPage.")

filepath = 'd:/Inventory/UI/src/components/panels/InventoryPanel.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_modal = '''/* \u2500\u2500\u2500 Custom Confirm Modal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function ConfirmModal({ title, message, confirmLabel = 'Yes, Remove It', cancelLabel = 'Cancel', onConfirm, onCancel, danger = true }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', animation: 'fadeIn 0.15s ease'
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '20px', width: '100%', maxWidth: '380px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
          animation: 'slideUp 0.2s ease'
        }}
      >
        {/* Icon area */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 32px 24px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            border: `2px solid ${danger ? '#FCA5A5' : '#93C5FD'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
            background: danger ? 'rgba(254,226,226,0.3)' : 'rgba(219,234,254,0.3)'
          }}>
            <AlertOctagon size={32} color={danger ? '#EF4444' : '#3B82F6'} strokeWidth={1.5} />
          </div>
          {title && (
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px', textAlign: 'center' }}>
              {title}
            </p>
          )}
          <p style={{ fontSize: '14px', color: '#64748B', textAlign: 'center', lineHeight: 1.6 }}>
            {message}
          </p>
        </div>

        {/* Buttons */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '12px', padding: '0 24px 24px'
        }}>
          <button
            onClick={onCancel}
            style={{
              height: '44px', borderRadius: '10px',
              border: '1.5px solid #E2E8F0', background: 'white',
              fontWeight: 600, fontSize: '14px', color: '#64748B',
              cursor: 'pointer', transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#E2E8F0' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              height: '44px', borderRadius: '10px', border: 'none',
              background: danger ? '#DC2626' : '#2563EB',
              fontWeight: 700, fontSize: '14px', color: 'white',
              cursor: 'pointer', transition: 'all 0.15s',
              boxShadow: danger ? '0 4px 14px rgba(220,38,38,0.35)' : '0 4px 14px rgba(37,99,235,0.35)'
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}'''

new_modal = '''/* \u2500\u2500\u2500 Custom Confirm Modal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function ConfirmModal({ title, message, confirmLabel = \'Yes, Remove It\', cancelLabel = \'Cancel\', onConfirm, onCancel, danger = true }) {
  const [closing, setClosing] = useState(false)

  const handleCancel = () => {
    setClosing(true)
    setTimeout(onCancel, 220)
  }
  const handleConfirm = () => {
    setClosing(true)
    setTimeout(onConfirm, 220)
  }

  const accentColor = danger ? \'#EF4444\' : \'#2563EB\'
  const ringColor   = danger ? \'rgba(239,68,68,0.15)\' : \'rgba(37,99,235,0.15)\'
  const bgColor     = danger ? \'rgba(254,242,242,0.6)\' : \'rgba(239,246,255,0.6)\'
  const borderColor = danger ? \'#FECACA\' : \'#BFDBFE\'
  const btnShadow   = danger ? \'0 6px 20px rgba(220,38,38,0.4)\' : \'0 6px 20px rgba(37,99,235,0.4)\'
  const btnBg       = danger ? \'#DC2626\' : \'#2563EB\'

  return (
    <div
      onClick={handleCancel}
      style={{
        position: \'fixed\', inset: 0, zIndex: 9999,
        background: closing ? \'rgba(15,23,42,0)\' : \'rgba(15,23,42,0.55)\',
        backdropFilter: \'blur(6px)\',
        display: \'flex\', alignItems: \'center\', justifyContent: \'center\',
        padding: \'24px\',
        transition: \'background 0.22s ease\',
        animation: \'modalBackdropIn 0.2s ease forwards\',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: \'white\', borderRadius: \'24px\', width: \'100%\', maxWidth: \'400px\',
          boxShadow: \'0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.1)\',
          overflow: \'visible\', position: \'relative\',
          animation: closing ? \'modalCardOut 0.22s cubic-bezier(0.4,0,0.6,1) forwards\' : \'modalCardIn 0.36s cubic-bezier(0.34,1.3,0.64,1) forwards\',
        }}
      >
        {/* Colored top stripe */}
        <div style={{
          height: \'6px\', borderRadius: \'24px 24px 0 0\',
          background: danger
            ? \'linear-gradient(90deg,#EF4444,#F97316)\'
            : \'linear-gradient(90deg,#2563EB,#7C3AED)\',
        }} />

        {/* Icon area */}
        <div style={{ display: \'flex\', flexDirection: \'column\', alignItems: \'center\', padding: \'32px 32px 20px\' }}>
          {/* Animated icon with pulse ring */}
          <div style={{ position: \'relative\', marginBottom: \'20px\' }}>
            {/* Pulse ring */}
            <div style={{
              position: \'absolute\', inset: \'-8px\', borderRadius: \'50%\',
              border: `2px solid ${accentColor}`,
              animation: \'iconPulseRing 1.8s ease-out infinite\',
              opacity: 0,
            }} />
            {/* Icon circle */}
            <div style={{
              width: \'72px\', height: \'72px\', borderRadius: \'50%\',
              border: `2px solid ${borderColor}`,
              background: bgColor,
              display: \'flex\', alignItems: \'center\', justifyContent: \'center\',
              animation: \'iconBounce 0.5s cubic-bezier(0.34,1.5,0.64,1) 0.1s both\',
              position: \'relative\', zIndex: 1,
            }}>
              <AlertOctagon size={34} color={accentColor} strokeWidth={1.8} />
            </div>
          </div>

          {title && (
            <p style={{
              fontSize: \'19px\', fontWeight: 800, color: \'#0F172A\',
              marginBottom: \'8px\', textAlign: \'center\', letterSpacing: \'-0.3px\',
              animation: \'modalCardIn 0.35s ease 0.15s both\',
            }}>
              {title}
            </p>
          )}
          <p style={{
            fontSize: \'14px\', color: \'#64748B\', textAlign: \'center\',
            lineHeight: 1.65, maxWidth: \'280px\',
            animation: \'modalCardIn 0.35s ease 0.2s both\',
          }}>
            {message}
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: \'1px\', background: \'#F1F5F9\', margin: \'0 24px\' }} />

        {/* Buttons */}
        <div style={{
          display: \'grid\', gridTemplateColumns: \'1fr 1fr\',
          gap: \'12px\', padding: \'20px 24px 24px\',
          animation: \'modalCardIn 0.35s ease 0.25s both\',
        }}>
          <button
            onClick={handleCancel}
            style={{
              height: \'46px\', borderRadius: \'12px\',
              border: \'1.5px solid #E2E8F0\', background: \'white\',
              fontWeight: 600, fontSize: \'14px\', color: \'#64748B\',
              cursor: \'pointer\', transition: \'all 0.15s\',
              fontFamily: "\'Inter\', sans-serif",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = \'#F8FAFC\'
              e.currentTarget.style.borderColor = \'#CBD5E1\'
              e.currentTarget.style.transform = \'translateY(-1px)\'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = \'white\'
              e.currentTarget.style.borderColor = \'#E2E8F0\'
              e.currentTarget.style.transform = \'translateY(0)\'
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            style={{
              height: \'46px\', borderRadius: \'12px\', border: \'none\',
              background: btnBg, fontWeight: 700, fontSize: \'14px\', color: \'white\',
              cursor: \'pointer\', transition: \'all 0.15s\',
              boxShadow: btnShadow, fontFamily: "\'Inter\', sans-serif",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = \'translateY(-2px) scale(1.02)\'
              e.currentTarget.style.boxShadow = danger ? \'0 10px 28px rgba(220,38,38,0.5)\' : \'0 10px 28px rgba(37,99,235,0.5)\'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = \'translateY(0) scale(1)\'
              e.currentTarget.style.boxShadow = btnShadow
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}'''

if old_modal in content:
    content = content.replace(old_modal, new_modal)
    print("ConfirmModal replaced successfully!")
else:
    print("ERROR: Could not find old ConfirmModal to replace")
    # Try partial match
    if "function ConfirmModal(" in content:
        print("Found ConfirmModal function but content doesn't match exactly")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

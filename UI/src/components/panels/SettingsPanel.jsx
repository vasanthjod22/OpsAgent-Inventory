import { useState, useEffect, useRef } from 'react'
import { Save, Database, Trash2, FileCode2, Building2, Image, X, Moon, Sun } from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import { useAppStore } from '../../store/appStore'

export default function SettingsPanel({ onClearAll, onLoadDemo, showToast }) {
  const { theme, setTheme } = useAppStore()
  const [company, setCompany] = useState({})
  const [logoPreview, setLogoPreview] = useState(null)
  const logoInputRef = useRef(null)

  useEffect(() => {
    backendFetch('/company').then(res => {
      const data = res.company || res
      setCompany(data)
      if (data.logo_base64) setLogoPreview(data.logo_base64)
    }).catch(console.error)
  }, [])

  const setComp = (key, val) => setCompany(prev => ({ ...prev, [key]: val }))
  
  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast?.('Please upload a valid image file (PNG, JPG, etc.)', 'error')
      return
    }
    if (file.size > 500 * 1024) {
      showToast?.('Logo must be under 500KB', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target.result // full data URL e.g. data:image/png;base64,...
      setLogoPreview(base64)
      setComp('logo_base64', base64)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setLogoPreview(null)
    setComp('logo_base64', null)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }
  
  const handleSaveCompany = async () => {
    if (company.gstin && !/^[A-Z0-9]{15}$/.test(company.gstin)) {
      showToast?.('GSTIN must be exactly 15 alphanumeric characters', 'error', 'Invalid GSTIN')
      return
    }
    try {
      await backendFetch('/company', { method: 'PUT', body: JSON.stringify(company) })
      showToast?.('Company profile saved successfully!', 'success', 'Settings Updated')
    } catch(err) {
      showToast?.(err.message, 'error')
    }
  }

  const handleClear = () => {
    if (window.confirm('Are you sure you want to delete all inventory, chat, and finance data? This cannot be undone.')) {
      onClearAll()
    }
  }

  const inp = {
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-primary)',
    outline: 'none', background: 'var(--bg-card)', fontFamily: "'Inter', sans-serif",
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
      
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif" }}>System Settings</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>Manage API integrations, company info, and local data.</p>
      </div>

      {/* Company Details */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={16} color="#7C3AED" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Company Profile</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>Pre-fills every quotation & bill automatically. Saved permanently.</p>
          </div>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Logo Upload */}
          <div style={{ borderRadius: '10px', border: '1px solid var(--border)', padding: '16px', background: 'var(--bg-main)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Image size={13} /> Company Logo <span style={{ fontWeight: 400, color: '#94A3B8', textTransform: 'none' }}>(Optional — appears on bills & PDFs)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {logoPreview ? (
                <div style={{ position: 'relative', width: 80, height: 60, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <img src={logoPreview} alt="Company Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
              ) : (
                <div style={{ width: 80, height: 60, borderRadius: 8, border: '2px dashed #CBD5E1', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
                  <Image size={18} color="#94A3B8" />
                  <span style={{ fontSize: 9, color: '#94A3B8' }}>No Logo</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => logoInputRef.current?.click()}
                  style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #7C3AED', background: 'var(--bg-card)', color: '#7C3AED', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Image size={14} /> {logoPreview ? 'Change Logo' : 'Upload Logo'}
                </button>
                {logoPreview && (
                  <button
                    onClick={handleRemoveLogo}
                    style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #FECACA', background: 'var(--bg-card)', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <X size={14} /> Remove Logo
                  </button>
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 11, color: '#94A3B8' }}>Recommended: PNG or JPG, max 500KB. Will appear in the top-right of Tax Invoice PDFs.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Company Name</label>
              <input style={inp} value={company.name || ''} onChange={e => setComp('name', e.target.value)} placeholder="Your Company Name" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Address</label>
              <textarea style={{ ...inp, resize: 'vertical', minHeight: '56px' }} value={company.address || ''} onChange={e => setComp('address', e.target.value)} placeholder="123 Main St, City, State" rows={2} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Phone</label>
              <input style={inp} value={company.phone || ''} onChange={e => setComp('phone', e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Email</label>
              <input style={inp} value={company.email || ''} onChange={e => setComp('email', e.target.value)} placeholder="info@yourcompany.com" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>GSTIN</label>
              <input
                style={inp}
                value={company.gstin || ''}
                onChange={e => setComp('gstin', e.target.value.toUpperCase())}
                placeholder="33AABCK2341C1ZP"
                maxLength={15}
              />
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Your GST Identification Number (15 characters) · Ex: 33AABCK2341C1ZP</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>State</label>
              <input style={inp} value={company.state || ''} onChange={e => setComp('state', e.target.value)} placeholder="Tamil Nadu" />
            </div>
          </div>

          {/* Bank Details */}
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Bank Details (optional)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Bank Name</label>
                <input style={inp} value={company.bankName || ''} onChange={e => setComp('bankName', e.target.value)} placeholder="State Bank of India" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Account Number</label>
                <input style={inp} value={company.accountNumber || ''} onChange={e => setComp('accountNumber', e.target.value)} placeholder="1234567890" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>IFSC Code</label>
                <input style={{ ...inp }} value={company.ifsc || ''} onChange={e => setComp('ifsc', e.target.value.toUpperCase())} placeholder="SBIN0001234" />
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveCompany}
            className="btn-press"
            style={{ width: '100%', height: '44px', borderRadius: '8px', background: '#7C3AED', color: 'white', border: 'none', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(124,58,237,0.3)', marginTop: '4px' }}
          >
            <Save size={16} /> Save Company Profile
          </button>
        </div>
      </div>


      {/* Theme Settings */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Moon size={16} color="#7C3AED" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Appearance</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>Customize the look and feel of your dashboard.</p>
          </div>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-main)' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Dark Mode</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>Switch to a dark theme for low-light environments.</p>
            </div>
            <div style={{ display: 'flex', background: '#E2E8F0', borderRadius: '8px', padding: '4px' }}>
              <button
                onClick={() => setTheme('light')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: 'none', background: theme === 'light' ? 'white' : 'transparent', color: theme === 'light' ? '#0F172A' : '#64748B', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
              >
                <Sun size={14} /> Light
              </button>
              <button
                onClick={() => setTheme('dark')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: 'none', background: theme === 'dark' ? '#1E293B' : 'transparent', color: theme === 'dark' ? 'white' : '#64748B', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: theme === 'dark' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
              >
                <Moon size={14} /> Dark
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Integrations */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileCode2 size={16} color="#16A34A" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>AI Integrations</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>Configure API keys for AI capabilities like Groq.</p>
          </div>
        </div>
        <div style={{ padding: '24px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Groq API Key</label>
            <input 
              type="password"
              style={inp} 
              defaultValue={localStorage.getItem('opsagent_groq_key') || ''} 
              id="groq-key-input"
              placeholder="gsk_..." 
            />
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Get your free API key at <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: '#2563EB', textDecoration: 'none' }}>console.groq.com</a>. This key is stored securely in your browser.</div>
          </div>
          <button
            onClick={() => {
              const val = document.getElementById('groq-key-input').value;
              localStorage.setItem('opsagent_groq_key', val);
              showToast?.('AI settings saved successfully!', 'success');
            }}
            className="btn-press"
            style={{ width: '100%', height: '44px', borderRadius: '8px', background: '#16A34A', color: 'white', border: 'none', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(22,163,74,0.3)', marginTop: '16px' }}
          >
            <Save size={16} /> Save AI Settings
          </button>
        </div>
      </div>

      {/* Demo Data Section */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileCode2 size={16} color="#2563EB" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Demo Data</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>Populate the application with sample data to test the dashboard.</p>
          </div>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-main)' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Load Demo Data</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>Loads sample inventory items and finance data into the Cloud Database.</p>
            </div>
            <button 
              onClick={onLoadDemo}
              className="btn-press"
              style={{ height: '36px', padding: '0 16px', borderRadius: '8px', background: 'transparent', color: '#2563EB', border: '1px solid #2563EB', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FileCode2 size={16} /> Load Data
            </button>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={16} color="#DC2626" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Danger Zone</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>Manage data securely.</p>
          </div>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid #FECACA', borderRadius: '8px', background: '#FEF2F2' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#991B1B' }}>Clear All Data</p>
              <p style={{ fontSize: '13px', color: '#B91C1C', marginTop: '2px' }}>Clears local chat data. Contact support to wipe cloud database.</p>
            </div>
            <button 
              onClick={handleClear}
              className="btn-press"
              style={{ height: '36px', padding: '0 16px', borderRadius: '8px', background: 'transparent', color: '#DC2626', border: '1px solid #DC2626', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Trash2 size={16} /> Clear All Data
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

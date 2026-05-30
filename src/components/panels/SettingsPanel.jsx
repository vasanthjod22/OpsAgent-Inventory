import { useState } from 'react'
import { Key, Save, AlertTriangle, Database, Trash2, Eye, EyeOff, FileCode2, CheckCircle } from 'lucide-react'

export default function SettingsPanel({ apiKey, setApiKey, onClearAll, onLoadDemo, showToast }) {
  const [tempKey, setTempKey] = useState(apiKey || '')
  const [showKey, setShowKey] = useState(false)

  const handleSaveKey = () => {
    setApiKey(tempKey.trim())
    showToast?.('API Key saved successfully', 'success', 'Settings Updated')
  }

  const handleClear = () => {
    if (window.confirm('Are you sure you want to delete all inventory, chat, and finance data? This cannot be undone.')) {
      onClearAll()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px', maxWidth: '768px' }}>
      
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', fontFamily: "'Inter', sans-serif" }}>System Settings</h2>
        <p style={{ fontSize: '14px', color: '#64748B', marginTop: '4px' }}>Manage API integrations and local data.</p>
      </div>

      {/* AI Configuration */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Key size={16} color="#2563EB" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Groq API Key</h3>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>Required for Finance Analysis, GRN Upload, and Chat Assistant.</p>
          </div>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>API Key</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input 
                  type={showKey ? 'text' : 'password'} 
                  value={tempKey} 
                  onChange={e => setTempKey(e.target.value)} 
                  className="input-base" 
                  placeholder="gsk_..." 
                  style={{ width: '100%', paddingRight: '40px' }}
                />
                <button 
                  onClick={() => setShowKey(!showKey)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button 
                onClick={handleSaveKey}
                className="btn-press"
                style={{ height: '40px', padding: '0 20px', borderRadius: '8px', background: '#2563EB', color: 'white', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
              >
                <Save size={16} /> Save Key
              </button>
            </div>
          </div>
          {!apiKey ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA' }}>
              <AlertTriangle size={16} color="#DC2626" />
              <p style={{ fontSize: '13px', color: '#991B1B', fontWeight: 600 }}>No API key set</p>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: '#F0FDF4', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
              <CheckCircle size={16} color="#16A34A" />
              <p style={{ fontSize: '13px', color: '#15803D', fontWeight: 600 }}>Key saved</p>
            </div>
          )}
          <p style={{ fontSize: '12px', color: '#64748B' }}>Get your free API key at <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color: '#2563EB', textDecoration: 'underline' }}>console.groq.com</a></p>
        </div>
      </div>

      {/* Demo Data Section */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileCode2 size={16} color="#2563EB" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Demo Data</h3>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>Populate the application with sample data to test the dashboard.</p>
          </div>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#F8FAFC' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Load Demo Data</p>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>Loads sample inventory items and finance data into localStorage.</p>
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
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={16} color="#DC2626" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Danger Zone</h3>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>Manage localStorage data securely.</p>
          </div>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid #FECACA', borderRadius: '8px', background: '#FEF2F2' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#991B1B' }}>Clear All Data</p>
              <p style={{ fontSize: '13px', color: '#B91C1C', marginTop: '2px' }}>Clears all localStorage keys (Inventory, Chat, Finance). API key will be kept.</p>
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

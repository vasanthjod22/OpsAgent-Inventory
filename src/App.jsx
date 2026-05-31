import { useState, useCallback, useEffect } from 'react'
import { CheckCircle, X, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import DashboardPanel from './components/panels/DashboardPanel'
import FinancePanel from './components/panels/FinancePanel'
import GRNPanel from './components/panels/GRNPanel'
import InventoryPanel from './components/panels/InventoryPanel'
import ChatPanel from './components/panels/ChatPanel'
import SettingsPanel from './components/panels/SettingsPanel'
import QuotationPanel from './components/panels/QuotationPanel'
import BillingPanel from './components/panels/BillingPanel'
import AuthPage from './components/AuthPage'
import { useLocalStorage } from './hooks/useLocalStorage'
import { STORAGE_KEYS } from './hooks/storageKeys'
import { INVENTORY_SEED, FINANCE_SEED, FINANCE_SUMMARY_SEED, GRN_HISTORY_SEED } from './data/seedData'

const panels = {
  dashboard: DashboardPanel,
  finance: FinancePanel,
  grn: GRNPanel,
  inventory: InventoryPanel,
  quotation: QuotationPanel,
  billing:   BillingPanel,
  chat: ChatPanel,
  settings: SettingsPanel,
}

/* ─── Root App — Auth Gate ─────────────────────────────────────────────── */
export default function App() {
  const [authState, setAuthState] = useLocalStorage('opsagent_auth', { isLoggedIn: false, currentUser: null })
  const [dashboardVisible, setDashboardVisible] = useState(false)

  // Top-level toast — shared between AuthPage and MainDashboard
  const [toasts, setToasts] = useState([])
  const showToast = useCallback((message, type = 'info', title = null) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { id, message, type, title }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const handleAuthSuccess = (user) => {
    setDashboardVisible(true)
    // Small delay so the slide-in class is applied before auth state flips
    setTimeout(() => {
      setAuthState({ isLoggedIn: true, currentUser: user, loginTime: new Date().toISOString() })
    }, 50)
  }

  const handleLogout = () => {
    setDashboardVisible(false)
    setAuthState({ isLoggedIn: false, currentUser: null })
  }

  const toastIcons = {
    success: { Icon: CheckCircle,   color: 'text-[var(--success)]', border: 'border-l-[var(--success)]' },
    error:   { Icon: AlertCircle,   color: 'text-[var(--danger)]',  border: 'border-l-[var(--danger)]'  },
    warning: { Icon: AlertTriangle, color: 'text-[var(--warning)]', border: 'border-l-[var(--warning)]' },
    info:    { Icon: Info,          color: 'text-[var(--primary)]', border: 'border-l-[var(--primary)]' },
  }

  const ToastContainer = () => (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none" style={{ width: '340px' }}>
      {toasts.map(toast => {
        const t = toastIcons[toast.type] || toastIcons.info
        const { Icon } = t
        return (
          <div
            key={toast.id}
            className={`toast-in pointer-events-auto flex items-start gap-3 p-4 rounded-[12px] bg-white border border-l-4 ${t.border} shadow-[var(--shadow-dropdown)]`}
            style={{ borderLeftWidth: '4px' }}
          >
            <Icon size={18} className={`${t.color} mt-0.5 shrink-0`} />
            <div className="flex-1 min-w-0">
              {toast.title && <p className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight mb-0.5">{toast.title}</p>}
              <p className="text-[13px] text-[var(--text-secondary)] leading-snug">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors shrink-0 mt-0.5"
            >
              <X size={15} />
            </button>
          </div>
        )
      })}
    </div>
  )

  if (!authState.isLoggedIn) {
    return (
      <>
        <ToastContainer />
        <AuthPage onAuthSuccess={handleAuthSuccess} showToast={showToast} />
      </>
    )
  }

  return (
    <div className={dashboardVisible ? 'animate-slideInFromBottom' : ''}>
      <ToastContainer />
      <MainDashboard
        currentUser={authState.currentUser}
        onLogout={handleLogout}
        showToast={showToast}
      />
    </div>
  )
}

/* ─── Main Dashboard ────────────────────────────────────────────────────── */
function MainDashboard({ currentUser, onLogout, showToast }) {
  // Sync active nav with URL hash to support the browser Back button
  const [activeNav, setActiveNavState] = useState(() => {
    const hash = window.location.hash.replace('#', '')
    return panels[hash] ? hash : 'dashboard'
  })

  const setActiveNav = useCallback((nav) => {
    window.location.hash = nav
    setActiveNavState(nav)
  }, [])

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      if (panels[hash]) {
        setActiveNavState(hash)
      } else if (!hash) {
        setActiveNavState('dashboard')
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Persisted global state. Auto-load seed data if the demo user logs in and storage is empty.
  const isDemo = currentUser?.username === 'demo'
  const [apiKey, setApiKey]             = useLocalStorage(STORAGE_KEYS.API_KEY, '')
  const [financeSummary, setFinanceSummary] = useLocalStorage(STORAGE_KEYS.FINANCE, isDemo ? FINANCE_SUMMARY_SEED : null)
  const [transactions, setTransactions] = useLocalStorage(STORAGE_KEYS.FINANCE_RAW, isDemo ? FINANCE_SEED : [])
  const [inventory, setInventory]       = useLocalStorage(STORAGE_KEYS.INVENTORY, isDemo ? INVENTORY_SEED : [])
  const [grnHistory, setGrnHistory]     = useLocalStorage(STORAGE_KEYS.GRN_HISTORY, isDemo ? GRN_HISTORY_SEED : [])
  const [chatMessages, setChatMessages] = useLocalStorage(STORAGE_KEYS.CHAT_MESSAGES, []) // persists chat history

  const handleUpdateStock = (grnNumber, items) => {
    setInventory(prev => {
      const newInv = [...prev]
      items.forEach(item => {
        if (!item.sku || item.quantity == null) return
        const idx = newInv.findIndex(i => i.sku === item.sku)
        if (idx !== -1) {
          newInv[idx] = { ...newInv[idx], qty: newInv[idx].qty + Number(item.quantity) }
        } else {
          newInv.unshift({
            sku: item.sku,
            name: item.description || 'New Item',
            category: 'Uncategorized',
            qty: Number(item.quantity),
            unit: item.unit || 'Unit',
            min: 10,
            max: 100,
          })
        }
      })
      return newInv
    })
    setGrnHistory(prev => [{
      id: grnNumber,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      items: items.length,
      status: 'Processed',
    }, ...prev])
    showToast(`Stock updated from GRN #${grnNumber}`, 'success', 'GRN Approved')
  }

  const handleClearAll = () => {
    setInventory([])
    setChatMessages([])
    setFinanceSummary(null)
    setTransactions([])
    setGrnHistory([])
    showToast('All data has been cleared', 'info', 'Data Reset')
    setTimeout(() => window.location.reload(), 1000)
  }

  const handleLoadDemo = () => {
    setInventory(INVENTORY_SEED)
    setFinanceSummary(FINANCE_SUMMARY_SEED)
    setTransactions(FINANCE_SEED)
    setGrnHistory(GRN_HISTORY_SEED)
    showToast('Demo data loaded successfully', 'success', 'Demo Data Loaded')
  }

  // Force-load demo data on first login for the demo user if they have no data (runs once)
  useEffect(() => {
    if (isDemo && inventory.length === 0 && !financeSummary) {
      handleLoadDemo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ActivePanel = panels[activeNav]

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--bg-main)', fontFamily: "'Inter', sans-serif" }}>

      {/* Sidebar — Desktop */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar active={activeNav} onNavigate={setActiveNav} currentUser={currentUser} onLogout={onLogout} />
      </div>

      {/* Main Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar activeNav={activeNav} />

        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-main)' }}>
          <div key={activeNav} className="max-w-7xl mx-auto p-6 h-full animate-fadein">
            <ActivePanel
              apiKey={apiKey}
              setApiKey={setApiKey}
              financeSummary={financeSummary}
              setFinanceSummary={setFinanceSummary}
              transactions={transactions}
              setTransactions={setTransactions}
              inventory={inventory}
              setInventory={setInventory}
              grnHistory={grnHistory}
              setGrnHistory={setGrnHistory}
              chatMessages={chatMessages}
              setChatMessages={setChatMessages}
              onApproveGRN={handleUpdateStock}
              onClearAll={handleClearAll}
              onLoadDemo={handleLoadDemo}
              showToast={showToast}
              onNavigate={setActiveNav}
            />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-white flex justify-around p-2 pb-safe">
        <Sidebar mobile active={activeNav} onNavigate={setActiveNav} currentUser={currentUser} onLogout={onLogout} />
      </div>
    </div>
  )
}

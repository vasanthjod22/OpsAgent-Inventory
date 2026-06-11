import { useState, useCallback, useEffect } from 'react'
import { CheckCircle, X, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import DashboardPanel from './components/panels/DashboardPanel'
import FinancePanel from './components/panels/FinancePanel'
import InventoryPanel from './components/panels/InventoryPanel'
import ChatPanel from './components/panels/ChatPanel'
import SettingsPanel from './components/panels/SettingsPanel'
import QuotationPanel from './components/panels/QuotationPanel'
import BillingPanel from './components/panels/BillingPanel'
import PurchaseOrdersPanel from './components/panels/PurchaseOrdersPanel'
import DemandsPanel from './components/panels/DemandsPanel'
import CustomersPanel from './components/panels/CustomersPanel'
import ReportsPanel from './components/panels/ReportsPanel'
import AuthPage from './components/AuthPage'
import { useLocalStorage } from './hooks/useLocalStorage'
import { STORAGE_KEYS } from './hooks/storageKeys'
import { backendFetch } from './utils/backend'

const panels = {
  customers: CustomersPanel,
  dashboard: DashboardPanel,
  finance: FinancePanel,
  inventory: InventoryPanel,
  purchase_orders: PurchaseOrdersPanel,
  quotation: QuotationPanel,
  billing:   BillingPanel,
  demands:   DemandsPanel,
  chat: ChatPanel,
  settings: SettingsPanel,
  reports: ReportsPanel,
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
    window.location.hash = 'dashboard'
    setDashboardVisible(true)
    // Small delay so the slide-in class is applied before auth state flips
    setTimeout(() => {
      setAuthState({ isLoggedIn: true, currentUser: user, loginTime: new Date().toISOString() })
    }, 50)
  }

  const handleLogout = () => {
    setDashboardVisible(false)
    setAuthState({ isLoggedIn: false, currentUser: null })
    localStorage.removeItem('opsagent_token')
  }

  useEffect(() => {
    const handleUnauthorized = () => {
      handleLogout()
      showToast('Session expired or unauthorized. Please log in again.', 'warning')
    }
    window.addEventListener('opsagent_unauthorized', handleUnauthorized)
    return () => window.removeEventListener('opsagent_unauthorized', handleUnauthorized)
  }, [showToast, setAuthState])

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

  // Global Data State
  const [financeSummary, setFinanceSummary] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [inventory, setInventory]       = useState([])
  const [grnHistory, setGrnHistory]     = useState([])
  const [quotations, setQuotations]     = useState([])
  const [breakdownQuotations, setBreakdownQuotations] = useState([])
  const [finalizedQuotations, setFinalizedQuotations] = useState([])
  const [bills, setBills]               = useState([])
  const [customers, setCustomers]       = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  
  // Persisted chat history
  const [chatMessages, setChatMessages] = useLocalStorage(STORAGE_KEYS.CHAT_MESSAGES, [])

  const loadData = useCallback(async () => {
    try {
      const data = await backendFetch('/init')
      setInventory(data.inventory || [])
      setFinanceSummary(data.financeSummary || { totalRevenue: 0, totalExpenses: 0, balance: 0 })
      setTransactions(data.finance || [])
      setGrnHistory(data.grn || [])
      setQuotations(data.quotations || [])
      setBreakdownQuotations(data.breakdown_quotations || [])
      setFinalizedQuotations(data.finalized_quotations || [])
      setBills(data.bills || [])
      setCustomers(data.customers || [])
      setPurchaseOrders(data.purchase_orders || [])
    } catch (err) {
      console.error('Failed to load initial data:', err)
      showToast('Failed to load data from server', 'error')
    }
  }, [showToast])

  // Fetch all data on mount
  useEffect(() => {
    loadData()
  }, [])

  const handleClearAll = () => {
    setChatMessages([])
    showToast('Local chat history cleared', 'info')
  }

  const handleLoadDemo = () => {
    // Demo data loading logic can be moved to the backend or removed since we have backend seeds
    showToast('Demo data should be loaded via backend DB reset', 'info')
  }

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

        <main id="main-scroll-area" className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-main)' }}>
          <div key={activeNav} className="max-w-7xl mx-auto p-6 h-full animate-fadein">
              <ActivePanel
              financeSummary={financeSummary}
              setFinanceSummary={setFinanceSummary}
              transactions={transactions}
              setTransactions={setTransactions}
              inventory={inventory}
              setInventory={setInventory}
              grnHistory={grnHistory}
              setGrnHistory={setGrnHistory}
              quotations={quotations}
              breakdownQuotations={breakdownQuotations}
              finalizedQuotations={finalizedQuotations}
              bills={bills}
              customers={customers}
              setCustomers={setCustomers}
              purchaseOrders={purchaseOrders}
              chatMessages={chatMessages}
              setChatMessages={setChatMessages}
              onClearAll={handleClearAll}
              onLoadDemo={handleLoadDemo}
              showToast={showToast}
              onNavigate={setActiveNav}
              refreshData={loadData}
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

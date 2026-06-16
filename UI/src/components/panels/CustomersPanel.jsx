import { formatDate } from '../../utils/dateUtils';
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Users, TrendingUp, AlertCircle, Activity, Search, Filter,
  Grid, List, Plus, MoreVertical, Phone, Mail, MapPin,
  Star, ChevronLeft, Edit2, Receipt, FileText, Package,
  Clock, CheckCircle, XCircle, MessageSquare, Copy, Trash2,
  X, Save, Building2, CreditCard, StickyNote, ArrowUpDown,
  Eye, RefreshCw, Send, BarChart2, Tag
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import { useAppStore } from '../../store/appStore'
import { useQuery, useQueryClient } from '@tanstack/react-query'

/* ─── Helpers ─────────────────────────────────────────────────── */
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtDate = (d) => {
  if (!d) return '—'
  try {
    return formatDate(d)
  } catch { return d }
}

const AVATAR_COLORS = [
  '#2563EB', '#7C3AED', '#DB2777', '#1D4ED8', '#D97706',
  '#DC2626', '#0891B2', '#65A30D', '#EA580C', '#8B5CF6',
]
const avatarColor = (name) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]
const initials = (name) => {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

/* ─── Build customers from bills + quotations + manual records ── */
const buildCustomers = (bills = [], quotations = [], manualCustomers = []) => {
  const customerMap = {}

  const ensureCustomer = (name, fallbackData = {}) => {
    if (!name) return
    if (!customerMap[name]) {
      customerMap[name] = {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        phone: fallbackData.phone || '',
        email: fallbackData.email || '',
        address: fallbackData.address || '',
        city: fallbackData.city || '',
        gstin: fallbackData.gstin || '',
        notes: fallbackData.notes || '',
        bills: [],
        quotations: [],
        totalPurchases: 0,
        outstanding: 0,
        lastPurchase: null,
        topItems: {},
        firstSeen: fallbackData.date || new Date().toISOString().split('T')[0],
        addedManually: false,
        manualId: null,
        tags: [],
        contacts: [],
      }
    }
  }

  bills.forEach(bill => {
    const name = bill.customerName || bill.customer_name
    if (!name) return
    ensureCustomer(name, {
      phone: bill.customerPhone || bill.customer_phone || '',
      address: bill.customerAddress || bill.customer_address || '',
      date: bill.date
    })
    const c = customerMap[name]
    if (bill.customerPhone && !c.phone) c.phone = bill.customerPhone
    if (bill.customerAddress && !c.address) c.address = bill.customerAddress

    c.bills.push(bill)
    const status = bill.paymentStatus || bill.payment_status
    const total = Number(bill.grandTotal || bill.grand_total || 0)
    if (status === 'Paid') c.totalPurchases += total
    else if (status === 'Unpaid') c.outstanding += total
    else if (status === 'Partial') c.outstanding += Number(bill.balanceDue || bill.balance_due || 0)

    const d = bill.date
    if (d && (!c.lastPurchase || d > c.lastPurchase)) c.lastPurchase = d

    const items = bill.items || []
    items.forEach(item => {
      const key = item.description || item.name || 'Unknown'
      if (!c.topItems[key]) c.topItems[key] = { name: key, qty: 0, unit: item.unit || '', amount: 0 }
      c.topItems[key].qty += Number(item.quantity || 0)
      c.topItems[key].amount += Number(item.amount || 0)
    })
  })

  quotations.forEach(qt => {
    const name = qt.customerName || qt.customer_name
    if (!name) return
    ensureCustomer(name, {
      phone: qt.customerPhone || qt.customer_phone || '',
      date: qt.date
    })
    customerMap[name].quotations.push(qt)
  })

  // Merge / enrich with manual customer records
  manualCustomers.forEach(mc => {
    const name = mc.name
    if (!name) return
    ensureCustomer(name)
    const c = customerMap[name]
    c.addedManually = true
    c.manualId = mc.id
    // manual data wins for profile fields
    if (mc.phone) c.phone = mc.phone
    if (mc.email) c.email = mc.email
    if (mc.address) c.address = mc.address
    if (mc.city) c.city = mc.city
    if (mc.gstin) c.gstin = mc.gstin
    if (mc.notes) c.notes = mc.notes
    if (mc.tags) c.tags = mc.tags
    if (mc.contacts) c.contacts = mc.contacts
  })

  return Object.values(customerMap)
}

/* ─── Small UI helpers ───────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, color, bg, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: bg, border: `1px solid ${color}22`, borderRadius: 12,
      padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
      cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.15s',
    }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = 'translateY(-2px)' }}
    onMouseLeave={e => { if (onClick) e.currentTarget.style.transform = 'translateY(0)' }}
  >
    <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={20} color={color} />
    </div>
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>{label}</div>
    </div>
  </div>
)

const Badge = ({ text, color = '#64748B', bg = '#F1F5F9' }) => (
  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: bg, color, whiteSpace: 'nowrap' }}>{text}</span>
)

const Btn = ({ children, onClick, variant = 'secondary', small = false, icon: Icon, style: extraStyle }) => {
  const styles = {
    primary: { background: '#2563EB', color: 'white', border: 'none' },
    secondary: { background: 'var(--bg-main)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    danger: { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' },
    ghost: { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' },
  }
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: small ? '5px 12px' : '8px 16px',
        borderRadius: 8, cursor: 'pointer', fontSize: small ? 12 : 13,
        fontWeight: 600, fontFamily: "'Inter', sans-serif",
        transition: 'all 0.15s', ...styles[variant], ...extraStyle
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
    >
      {Icon && <Icon size={small ? 13 : 15} />}
      {children}
    </button>
  )
}

const PageBtn = ({ active, disabled, onClick, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: 32, height: 32, borderRadius: 6,
      border: active ? 'none' : '1px solid #E2E8F0',
      background: active ? '#2563EB' : 'white',
      color: active ? 'white' : disabled ? '#CBD5E1' : '#374151',
      fontSize: 13, fontWeight: active ? 600 : 400,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s ease',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}
  >
    {children}
  </button>
)

const Pagination = ({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange, onLimitChange }) => {
  const getPageNumbers = () => {
    const pages = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)

    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      const start = Math.max(2, currentPage-1)
      const end = Math.min(totalPages-1, currentPage+1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  const startItem = (currentPage-1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  if (totalItems === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderTop: '1px solid var(--border)', marginTop: 16 }}>
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
        Showing {startItem}–{endItem} of <strong>{totalItems}</strong> customers
      </span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <PageBtn onClick={() => onPageChange(1)} disabled={currentPage === 1}>«</PageBtn>
        <PageBtn onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>‹</PageBtn>
        {getPageNumbers().map((page, i) => (
          page === '...' ? (
            <span key={i} style={{ padding: '0 8px', color: 'var(--text-primary)' }}>...</span>
          ) : (
            <PageBtn key={i} active={page === currentPage} onClick={() => onPageChange(page)}>{page}</PageBtn>
          )
        ))}
        <PageBtn onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>›</PageBtn>
        <PageBtn onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages}>»</PageBtn>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Per page:</span>
        <select
          value={itemsPerPage}
          onChange={e => onLimitChange(Number(e.target.value))}
          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}
        >
          {[12, 24, 48, 96].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  )
}

/* ─── Customer Card (Grid View) ─────────────────────────────── */
function CustomerCard({ customer, onView, onCreateBill, onCreateQuote, onRemind, onCopy, onDelete, companyName }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const color = avatarColor(customer.name)
  const isTop = customer.totalPurchases >= 100000
  const hasOutstanding = customer.outstanding > 0
  const topItemsList = Object.values(customer.topItems).sort((a, b) => b.amount - a.amount).slice(0, 2)
  
  const primaryContact = customer.contacts?.find(c => c.is_primary) || customer.contacts?.[0]
  const displayPhone = primaryContact?.phone || customer.phone

  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    if (menuOpen) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)',
      padding: '20px', display: 'flex', flexDirection: 'column', gap: 14,
      transition: 'box-shadow 0.2s, transform 0.2s', position: 'relative',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {/* Outstanding badge */}
      {hasOutstanding && (
        <div style={{ position: 'absolute', top: 14, right: 46, background: '#DC2626', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
          {fmt(customer.outstanding)} due
        </div>
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
          {initials(customer.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {customer.name}
            </div>
            {isTop && <span title="Top customer">⭐</span>}
          </div>
          {(customer.city || customer.address) && (
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <MapPin size={10} style={{ marginRight: 3 }} />{customer.city || customer.address.split(',')[0]}
            </div>
          )}
          {displayPhone && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              <Phone size={10} style={{ marginRight: 3 }} />
              {displayPhone} {primaryContact && <span style={{fontSize:9, color:'#94A3B8'}}>({primaryContact.full_name})</span>}
            </div>
          )}
          {customer.tags && customer.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {customer.tags.map((t, i) => (
                <span key={i} style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${t.color}15`, color: t.color, border: `1px solid ${t.color}30` }}>
                  {t.label}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* Three-dot menu */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: '#94A3B8' }}
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 28, background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 180, overflow: 'hidden',
            }}>
              {[
                { label: 'View Details', icon: Eye, action: onView },
                { label: 'Create Bill', icon: Receipt, action: onCreateBill },
                { label: 'Create Quotation', icon: FileText, action: onCreateQuote },
                ...(primaryContact ? [
                  { label: `Call ${primaryContact.full_name.split(' ')[0]}`, icon: Phone, action: () => window.location.href=`tel:+91${primaryContact.phone}` },
                  { label: `WhatsApp ${primaryContact.full_name.split(' ')[0]}`, icon: MessageSquare, action: () => window.open(`https://wa.me/91${primaryContact.phone}`, '_blank') },
                ] : []),
                ...(hasOutstanding ? [{ label: 'Send Reminder', icon: MessageSquare, action: onRemind }] : []),
                { label: 'Copy Phone', icon: Copy, action: onCopy },
                { label: 'Delete', icon: Trash2, action: onDelete, danger: true },
              ].map(({ label, icon: Icon, action, danger }) => (
                <button
                  key={label}
                  onClick={() => { setMenuOpen(false); action?.() }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: danger ? '#DC2626' : '#334155', textAlign: 'left',
                    fontFamily: "'Inter', sans-serif",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = danger ? '#FEF2F2' : '#F8FAFC' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                >
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1D4ED8', marginBottom: 2 }}>{fmt(customer.totalPurchases)}</div>
          <div style={{ fontSize: 10, color: '#6B7280' }}>Total Purchases</div>
        </div>
        <div style={{ background: hasOutstanding ? '#FEF2F2' : '#F8FAFC', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: hasOutstanding ? '#DC2626' : '#94A3B8', marginBottom: 2 }}>{fmt(customer.outstanding)}</div>
          <div style={{ fontSize: 10, color: '#6B7280' }}>Outstanding</div>
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#94A3B8' }}>
          Last: {fmtDate(customer.lastPurchase)}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Badge text={`${customer.bills.length} Bills`} color="#2563EB" bg="#EFF6FF" />
          <Badge text={`${customer.quotations.length} Quotes`} color="#7C3AED" bg="#F5F3FF" />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
        <Btn small onClick={onCreateBill} icon={Receipt} variant="secondary" style={{ flex: 1, justifyContent: 'center' }}>Bill</Btn>
        <Btn small onClick={onView} icon={Eye} variant="primary" style={{ flex: 1, justifyContent: 'center' }}>Details</Btn>
      </div>
    </div>
  )
}

/* ─── Customer Detail ──────────────────────────────────────────── */
function CustomerDetail({ customer, onBack, onEdit, onNavigate, showToast, companyName, companyPhone }) {
  const [activeTab, setActiveTab] = useState('overview')

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'bills', label: 'Bills', icon: Receipt },
    { id: 'quotations', label: 'Quotations', icon: FileText },
    { id: 'items', label: 'Top Items', icon: Package },
    { id: 'contacts', label: 'Contacts', icon: Users },
  ]

  const paidBills = customer.bills.filter(b => (b.paymentStatus || b.payment_status) === 'Paid')
  const unpaidBills = customer.bills.filter(b => (b.paymentStatus || b.payment_status) === 'Unpaid')
  const partialBills = customer.bills.filter(b => (b.paymentStatus || b.payment_status) === 'Partial')

  const paymentRate = customer.bills.length ? Math.round((paidBills.length / customer.bills.length) * 100) : 0
  const rating = paymentRate >= 80 ? 5 : paymentRate >= 60 ? 4 : paymentRate >= 40 ? 3 : paymentRate >= 20 ? 2 : 1

  // Combined activity timeline
  const timeline = [
    ...customer.bills.map(b => ({ type: 'bill', date: b.date, label: b.billNumber || b.bill_number, amount: b.grandTotal || b.grand_total, status: b.paymentStatus || b.payment_status })),
    ...customer.quotations.map(q => ({ type: 'quote', date: q.date, label: q.quotationNumber || q.quotation_number, amount: q.grandTotal || q.grand_total, status: q.status })),
  ].sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1).slice(0, 10)

  const topItemsList = Object.values(customer.topItems).sort((a, b) => b.amount - a.amount)
  const maxAmount = topItemsList[0]?.amount || 1

  const sendReminder = () => {
    const unpaid = customer.bills.filter(b => (b.paymentStatus || b.payment_status) !== 'Paid')
    if (!unpaid.length) { showToast('No pending bills found', 'info'); return }
    const billLines = unpaid.slice(0, 3).map(b => `• ${b.billNumber || b.bill_number} dated ${fmtDate(b.date)} — ${fmt(b.grandTotal || b.grand_total)}`).join('\n')
    const msg = `Dear ${customer.name},\n\nThis is a friendly reminder that the following payment(s) are pending:\n\n${billLines}\n\nTotal Outstanding: ${fmt(customer.outstanding)}\n\nKindly arrange payment at your earliest convenience.\n\nThank you,\n${companyName || 'Your Company'}\n📞 ${companyPhone || ''}`
    const phone = customer.phone?.replace(/\D/g, '')
    if (phone) {
      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    } else {
      navigator.clipboard.writeText(msg)
      showToast('Phone not found — message copied to clipboard', 'info')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Back */}
      <button
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#2563EB', fontSize: 13, fontWeight: 600, marginBottom: 20, padding: 0 }}
      >
        <ChevronLeft size={18} />← Back to Customers
      </button>

      {/* Customer Header */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', padding: '24px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: avatarColor(customer.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 22, flexShrink: 0 }}>
            {initials(customer.name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{customer.name}</h2>
              <button onClick={onEdit} style={{ background: '#EFF6FF', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#2563EB', fontWeight: 600 }}>
                <Edit2 size={12} />Edit
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {customer.phone && <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={13} />{customer.phone}</span>}
              {customer.email && <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><Mail size={13} />{customer.email}</span>}
              {(customer.city || customer.address) && <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={13} />{customer.city || customer.address}</span>}
              {customer.gstin && <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><CreditCard size={13} />GST: {customer.gstin}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Btn onClick={() => onNavigate('billing')} icon={Receipt} variant="primary" small>Create Bill</Btn>
            {customer.outstanding > 0 && <Btn onClick={sendReminder} icon={MessageSquare} variant="secondary" small>Remind</Btn>}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard icon={TrendingUp} label="Total Purchases" value={fmt(customer.totalPurchases)} color="#1D4ED8" bg="#F0FDF4" />
        <StatCard icon={AlertCircle} label="Outstanding" value={fmt(customer.outstanding)} color={customer.outstanding > 0 ? '#DC2626' : '#94A3B8'} bg={customer.outstanding > 0 ? '#FEF2F2' : '#F8FAFC'} />
        <StatCard icon={Receipt} label="Total Bills" value={customer.bills.length} color="#2563EB" bg="#EFF6FF" />
        <StatCard icon={FileText} label="Total Quotes" value={customer.quotations.length} color="#7C3AED" bg="#F5F3FF" />
      </div>

      {/* Tabs */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-main)' }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                flex: 1, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                fontSize: 13, fontWeight: 600, color: activeTab === id ? '#2563EB' : '#64748B',
                borderBottom: activeTab === id ? '2px solid #2563EB' : '2px solid transparent',
                transition: 'all 0.15s', fontFamily: "'Inter', sans-serif",
              }}
            >
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
        <div style={{ padding: 24 }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Timeline */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, marginTop: 0 }}>Activity Timeline</h4>
                {timeline.length === 0 ? <p style={{ fontSize: 13, color: '#94A3B8' }}>No activity yet</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {timeline.map((item, i) => {
                      const statusC = { Paid: '#1D4ED8', Unpaid: '#DC2626', Partial: '#D97706', Approved: '#1D4ED8', Rejected: '#DC2626', Draft: '#64748B', Sent: '#2563EB' }
                      const statusB = { Paid: '#F0FDF4', Unpaid: '#FEF2F2', Partial: '#FFFBEB', Approved: '#F0FDF4', Rejected: '#FEF2F2', Draft: '#F1F5F9', Sent: '#EFF6FF' }
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-main)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: item.type === 'bill' ? '#EFF6FF' : '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {item.type === 'bill' ? <Receipt size={13} color="#2563EB" /> : <FileText size={13} color="#7C3AED" />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{item.label}</div>
                            <div style={{ fontSize: 11, color: '#94A3B8' }}>{fmtDate(item.date)}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(item.amount)}</div>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: statusB[item.status] || '#F1F5F9', color: statusC[item.status] || '#64748B' }}>{item.status}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              {/* Payment Analysis */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, marginTop: 0 }}>Payment Analysis</h4>
                {[
                  { label: 'Paid', count: paidBills.length, color: '#1D4ED8', bg: '#F0FDF4' },
                  { label: 'Partial', count: partialBills.length, color: '#D97706', bg: '#FFFBEB' },
                  { label: 'Unpaid', count: unpaidBills.length, color: '#DC2626', bg: '#FEF2F2' },
                ].map(({ label, count, color, bg }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 80, fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
                    <div style={{ flex: 1, height: 8, background: 'var(--bg-main)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${customer.bills.length ? (count / customer.bills.length) * 100 : 0}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ width: 50, fontSize: 12, color, fontWeight: 700, textAlign: 'right' }}>{count}/{customer.bills.length}</div>
                  </div>
                ))}
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>Customer Rating</div>
                  <div style={{ fontSize: 22 }}>{'⭐'.repeat(rating)}{'☆'.repeat(5 - rating)}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Based on {paymentRate}% on-time payment rate</div>
                </div>
                {customer.notes && (
                  <div style={{ marginTop: 20, padding: 14, background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', marginBottom: 4 }}>📝 Notes</div>
                    <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.5 }}>{customer.notes}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'bills' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                  <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{fmt(customer.totalPurchases + customer.outstanding)}</strong></span>
                  <span>Paid: <strong style={{ color: '#1D4ED8' }}>{fmt(customer.totalPurchases)}</strong></span>
                  <span>Outstanding: <strong style={{ color: '#DC2626' }}>{fmt(customer.outstanding)}</strong></span>
                </div>
                <Btn onClick={() => onNavigate('billing')} icon={Plus} variant="primary" small>New Bill</Btn>
              </div>
              {customer.bills.length === 0 ? <p style={{ fontSize: 13, color: '#94A3B8' }}>No bills yet</p> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-main)' }}>
                        {['Bill No', 'Date', 'Amount', 'Status'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {customer.bills.map((b, i) => {
                        const status = b.paymentStatus || b.payment_status
                        const sc = { Paid: '#1D4ED8', Unpaid: '#DC2626', Partial: '#D97706' }
                        const sb = { Paid: '#F0FDF4', Unpaid: '#FEF2F2', Partial: '#FFFBEB' }
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#2563EB' }}>{b.billNumber || b.bill_number}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{fmtDate(b.date)}</td>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(b.grandTotal || b.grand_total)}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: sb[status] || '#F1F5F9', color: sc[status] || '#64748B' }}>{status}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'quotations' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <Btn onClick={() => onNavigate('quotation')} icon={Plus} variant="primary" small>New Quotation</Btn>
              </div>
              {customer.quotations.length === 0 ? <p style={{ fontSize: 13, color: '#94A3B8' }}>No quotations yet</p> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-main)' }}>
                        {['Quote No', 'Date', 'Amount', 'Status'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {customer.quotations.map((q, i) => {
                        const statusC = { Draft: '#64748B', Sent: '#2563EB', Approved: '#1D4ED8', Rejected: '#DC2626' }
                        const statusB = { Draft: '#F1F5F9', Sent: '#EFF6FF', Approved: '#F0FDF4', Rejected: '#FEF2F2' }
                        const status = q.status || 'Draft'
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#7C3AED' }}>{q.quotationNumber || q.quotation_number}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{fmtDate(q.date)}</td>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(q.grandTotal || q.grand_total)}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: statusB[status] || '#F1F5F9', color: statusC[status] || '#64748B' }}>{status}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'items' && (
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, marginTop: 0 }}>Items Purchased Most</h4>
              {topItemsList.length === 0 ? <p style={{ fontSize: 13, color: '#94A3B8' }}>No itemized data available</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {topItemsList.map((item, i) => (
                    <div key={i} style={{ padding: '12px 16px', background: 'var(--bg-main)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                         <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                         <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                           <span style={{ color: 'var(--text-muted)' }}>{item.qty} {item.unit}</span>
                           <span style={{ fontWeight: 700, color: '#1D4ED8' }}>{fmt(item.amount)}</span>
                         </div>
                       </div>
                       <div style={{ height: 6, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' }}>
                         <div style={{ width: `${(item.amount / maxAmount) * 100}%`, height: '100%', background: '#2563EB', borderRadius: 99, transition: 'width 0.5s' }} />
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'contacts' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <Btn onClick={() => window.dispatchEvent(new CustomEvent('open-contact-modal'))} icon={Plus} variant="primary" small>Add Contact</Btn>
              </div>
              {(!customer.contacts || customer.contacts.length === 0) ? <p style={{ fontSize: 13, color: '#94A3B8' }}>No contacts added yet</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {customer.contacts.sort((a,b)=> b.is_primary ? 1 : -1).map((c, i) => (
                    <div key={i} style={{ border: `1px solid ${c.is_primary ? '#FCD34D' : '#E2E8F0'}`, background: c.is_primary ? '#FFFBEB' : '#F8FAFC', padding: 16, borderRadius: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {c.is_primary && <Star size={14} fill="#F59E0B" color="#F59E0B" />}
                            {c.full_name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.designation || 'Contact Person'}</div>
                        </div>
                        {c.is_primary && <Badge text="PRIMARY" color="#D97706" bg="#FEF3C7" />}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={12}/>{c.phone}</div>
                        {c.email && <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={12}/>{c.email}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Btn small onClick={() => window.location.href=`tel:+91${c.phone}`} icon={Phone} variant="ghost" style={{flex: 1, padding: '4px 0', justifyContent: 'center'}}>Call</Btn>
                        <Btn small onClick={() => window.open(`https://wa.me/91${c.phone}`, '_blank')} icon={MessageSquare} variant="ghost" style={{flex: 1, padding: '4px 0', justifyContent: 'center'}}>WhatsApp</Btn>
                        {c.email && <Btn small onClick={() => window.location.href=`mailto:${c.email}`} icon={Mail} variant="ghost" style={{flex: 1, padding: '4px 0', justifyContent: 'center'}}>Email</Btn>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Add / Edit Customer Modal ────────────────────────────────── */
function CustomerModal({ onClose, onSave, existing, availableTags }) {
  const [form, setForm] = useState({
    name: existing?.name || '',
    phone: existing?.phone || '',
    email: existing?.email || '',
    address: existing?.address || '',
    city: existing?.city || '',
    gstin: existing?.gstin || '',
    notes: existing?.notes || '',
    tags: existing?.tags || [],
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (form.phone && !/^\d{10}$/.test(form.phone.replace(/\D/g, ''))) e.phone = 'Enter valid 10-digit mobile'
    if (form.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstin.toUpperCase())) e.gstin = 'Invalid GSTIN format'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const Field = ({ label, field, placeholder, required, textarea, type = 'text' }) => (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
        {label} {required && <span style={{ color: '#DC2626' }}>*</span>}
      </label>
      {textarea ? (
        <textarea
          value={form[field]}
          onChange={e => { setForm(f => ({ ...f, [field]: e.target.value })); setErrors(er => ({ ...er, [field]: undefined })) }}
          placeholder={placeholder}
          rows={3}
          style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors[field] ? '#DC2626' : '#D1D5DB'}`, borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", resize: 'vertical', boxSizing: 'border-box' }}
        />
      ) : (
        <input
          type={type}
          value={form[field]}
          onChange={e => { setForm(f => ({ ...f, [field]: e.target.value })); setErrors(er => ({ ...er, [field]: undefined })) }}
          placeholder={placeholder}
          style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors[field] ? '#DC2626' : '#D1D5DB'}`, borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }}
        />
      )}
      {errors[field] && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{errors[field]}</div>}
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{existing ? 'Edit Customer' : 'Add New Customer'}</h3>
          <button onClick={onClose} style={{ background: 'var(--bg-main)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Customer Name" field="name" placeholder="e.g. Rajan Builders" required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Phone</label>
              <div style={{ display: 'flex', border: `1px solid ${errors.phone ? '#DC2626' : '#D1D5DB'}`, borderRadius: 8, overflow: 'hidden' }}>
                <span style={{ padding: '9px 10px', background: 'var(--bg-main)', fontSize: 13, color: 'var(--text-muted)', borderRight: '1px solid #D1D5DB' }}>+91</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(er => ({ ...er, phone: undefined })) }}
                  placeholder="98421 55678"
                  style={{ flex: 1, padding: '9px 12px', border: 'none', fontSize: 13, fontFamily: "'Inter', sans-serif", outline: 'none' }}
                />
              </div>
              {errors.phone && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{errors.phone}</div>}
            </div>
            <Field label="Email" field="email" placeholder="name@email.com" type="email" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="City" field="city" placeholder="Chennai" />
            <Field label="GSTIN" field="gstin" placeholder="33AABCR1234F1Z5" />
          </div>
          <Field label="Address" field="address" placeholder="Full address..." textarea />
          <Field label="Notes" field="notes" placeholder="Any special instructions or preferences..." textarea />
          
          <div>
             <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Tags</label>
             <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px', border: '1px solid #D1D5DB', borderRadius: 8, minHeight: 40 }}>
                {availableTags.map(t => {
                   const active = form.tags.some(x => x.label === t.label)
                   return (
                     <button
                       key={t.label}
                       onClick={() => {
                          setForm(f => ({
                             ...f,
                             tags: active ? f.tags.filter(x => x.label !== t.label) : [...f.tags, t]
                          }))
                       }}
                       style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${active ? t.color : '#E2E8F0'}`, background: active ? `${t.color}15` : '#F8FAFC', color: active ? t.color : '#64748B' }}
                     >
                       {t.label}
                     </button>
                   )
                })}
             </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <Btn onClick={onClose} variant="ghost" style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
          <Btn onClick={handleSave} variant="primary" icon={saving ? RefreshCw : Save} style={{ flex: 2, justifyContent: 'center' }}>
            {saving ? 'Saving…' : existing ? 'Update Customer' : 'Add Customer'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

/* ─── Add Contact Modal ────────────────────────────────────────── */
function ContactModal({ onClose, onSave, existing }) {
  const [form, setForm] = useState({
    full_name: existing?.full_name || '',
    designation: existing?.designation || '',
    phone: existing?.phone || '',
    email: existing?.email || '',
    is_primary: existing?.is_primary || false,
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.full_name.trim()) e.full_name = 'Name is required'
    if (!form.phone || !/^\d{10}$/.test(form.phone.replace(/\D/g, ''))) e.phone = 'Enter valid 10-digit mobile'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{existing ? 'Edit Contact' : 'Add Contact'}</h3>
          <button onClick={onClose} style={{ background: 'var(--bg-main)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Full Name <span style={{ color: '#DC2626' }}>*</span></label>
            <input type="text" value={form.full_name} onChange={e => { setForm(f => ({ ...f, full_name: e.target.value })); setErrors(er => ({ ...er, full_name: undefined })) }} placeholder="e.g. Rajan Kumar" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.full_name ? '#DC2626' : '#D1D5DB'}`, borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
            {errors.full_name && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{errors.full_name}</div>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Designation</label>
            <input type="text" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="e.g. Owner, Manager" style={{ width: '100%', padding: '9px 12px', border: `1px solid #D1D5DB`, borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Phone <span style={{ color: '#DC2626' }}>*</span></label>
            <input type="tel" value={form.phone} onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(er => ({ ...er, phone: undefined })) }} placeholder="98421 55678" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.phone ? '#DC2626' : '#D1D5DB'}`, borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
            {errors.phone && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{errors.phone}</div>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@email.com" style={{ width: '100%', padding: '9px 12px', border: `1px solid #D1D5DB`, borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_primary} onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Set as Primary Contact</span>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <Btn onClick={onClose} variant="ghost" style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
          <Btn onClick={handleSave} variant="primary" icon={saving ? RefreshCw : Save} style={{ flex: 2, justifyContent: 'center' }}>
            {saving ? 'Saving…' : existing ? 'Update Contact' : 'Add Contact'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

/* ─── Main CustomersPanel ─────────────────────────────────────── */
export default function CustomersPanel({ showToast, onNavigate }) {
  const queryClient = useQueryClient();

  const { data: bills = [] } = useQuery({ queryKey: ['bills'], queryFn: async () => { const res = await backendFetch('/bills'); return res.bills || res || [] }, refetchInterval: 60000 })
  const { data: quotations = [] } = useQuery({ queryKey: ['quotations'], queryFn: async () => { const res = await backendFetch('/quotations'); return res.quotations || res || [] }, refetchInterval: 60000 })
  const { data: manualCustomers = [] } = useQuery({ queryKey: ['customers'], queryFn: async () => { const res = await backendFetch('/customers'); return res.customers || res || [] }, refetchInterval: 60000 })

  const [viewMode, setViewMode] = useState('grid')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('name')
  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [detailCustomer, setDetailCustomer] = useState(null)
  const [companySettings, setCompanySettings] = useState({})

  const [showContactModal, setShowContactModal] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  
  useEffect(() => {
    const handleOpenContact = () => { setEditingContact(null); setShowContactModal(true); }
    window.addEventListener('open-contact-modal', handleOpenContact)
    return () => window.removeEventListener('open-contact-modal', handleOpenContact)
  }, [])

  const [pagination, setPagination] = useState({ currentPage: 1, itemsPerPage: 9 })

  const [availableTags, setAvailableTags] = useState([
    { label: 'VIP', color: '#F59E0B' },
    { label: 'Contractor', color: '#2563EB' },
    { label: 'Retail', color: '#7C3AED' },
    { label: 'Regular', color: '#16A34A' },
    { label: 'New', color: '#06B6D4' },
    { label: 'Wholesale', color: '#EA580C' },
    { label: 'Risky', color: '#DC2626' },
    { label: 'Inactive', color: '#6B7280' }
  ])
  const [selectedTagFilters, setSelectedTagFilters] = useState([])

  // Load company settings & custom tags
  useEffect(() => {
    try {
      const s = localStorage.getItem('opsagent_company')
      if (s) setCompanySettings(JSON.parse(s))
    } catch {}
    
    backendFetch('/customers/tags/all').then(data => {
       if (data && data.length) {
          setAvailableTags(prev => {
             const map = new Map(prev.map(t => [t.label, t]));
             data.forEach(t => map.set(t.label, t));
             return Array.from(map.values());
          });
       }
    }).catch(()=>{})
  }, [])

  // Build merged customer list
  const allCustomers = useMemo(() => buildCustomers(bills, quotations, manualCustomers), [bills, quotations, manualCustomers])

  // If detailCustomer is open, refresh it from allCustomers
  const detailLive = useMemo(() => {
    if (!detailCustomer) return null
    return allCustomers.find(c => c.name === detailCustomer.name) || detailCustomer
  }, [detailCustomer, allCustomers])

  // Stats
  const thisMonth = new Date().toISOString().slice(0, 7)
  const totalRevenue = allCustomers.reduce((s, c) => s + c.totalPurchases, 0)
  const totalOutstanding = allCustomers.reduce((s, c) => s + c.outstanding, 0)
  const activeThisMonth = allCustomers.filter(c => c.lastPurchase?.startsWith(thisMonth)).length

  // Filter + sort + search
  const displayed = useMemo(() => {
    let list = [...allCustomers]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
      )
    }

    if (selectedTagFilters.length > 0) {
      list = list.filter(c => {
         const cTags = c.tags || []
         return selectedTagFilters.some(tf => cTags.some(t => t.label === tf))
      })
    }

    if (filter === 'outstanding') list = list.filter(c => c.outstanding > 0)
    else if (filter === 'regular') list = list.filter(c => c.bills.length >= 3)
    else if (filter === 'new') list = list.filter(c => c.bills.length === 1)
    else if (filter === 'top') list = list.filter(c => c.totalPurchases >= 100000)
    else if (filter === 'inactive') {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90)
      list = list.filter(c => !c.lastPurchase || new Date(c.lastPurchase) < cutoff)
    }

    list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'purchases') return b.totalPurchases - a.totalPurchases
      if (sort === 'outstanding') return b.outstanding - a.outstanding
      if (sort === 'lastPurchase') return (b.lastPurchase || '') > (a.lastPurchase || '') ? 1 : -1
      if (sort === 'bills') return b.bills.length - a.bills.length
      return 0
    })

    return list
  }, [allCustomers, search, filter, sort])

  // Reset page to 1 when filters change
  useEffect(() => {
    setPagination(p => ({ ...p, currentPage: 1 }))
  }, [search, filter, sort])

  const paginatedDisplayed = useMemo(() => {
    const start = (pagination.currentPage - 1) * pagination.itemsPerPage
    return displayed.slice(start, start + pagination.itemsPerPage)
  }, [displayed, pagination.currentPage, pagination.itemsPerPage])

  const handleSaveCustomer = async (formData) => {
    try {
      if (editingCustomer?.manualId) {
        await backendFetch(`/customers/${editingCustomer.manualId}`, {
          method: 'PATCH',
          body: JSON.stringify(formData),
        })
        showToast('Customer updated!', 'success')
      } else {
        await backendFetch('/customers', {
          method: 'POST',
          body: JSON.stringify(formData),
        })
        showToast('Customer added!', 'success')
      }
      queryClient.invalidateQueries(['customers'])
    } catch (err) {
      showToast(err.message || 'Failed to save customer', 'error')
    }
    setShowModal(false)
    setEditingCustomer(null)
  }

  const handleDelete = async (customer) => {
    document.getElementById('main-scroll-area')?.scrollTo({ top: 0, behavior: 'smooth' });
    if (customer.bills.length > 0) {
      showToast('Cannot delete a customer with existing bills', 'error')
      return
    }
    if (!window.confirm(`Delete ${customer.name}?`)) return
    try {
      if (customer.manualId) {
        await backendFetch(`/customers/${customer.manualId}`, { method: 'DELETE' })
        queryClient.invalidateQueries(['customers'])
      }
      showToast('Customer deleted', 'info')
    } catch (err) {
      showToast(err.message || 'Failed to delete', 'error')
    }
  }

  const handleCopyPhone = (customer) => {
    navigator.clipboard.writeText(customer.phone || '')
    showToast('Phone number copied!', 'success')
  }

  const handleSendReminder = (customer) => {
    const unpaid = customer.bills.filter(b => (b.paymentStatus || b.payment_status) !== 'Paid')
    if (!unpaid.length) { showToast('No pending bills', 'info'); return }
    const billLines = unpaid.slice(0, 3).map(b => `• ${b.billNumber || b.bill_number} — ${fmt(b.grandTotal || b.grand_total)}`).join('\n')
    const msg = `Dear ${customer.name},\n\nThis is a friendly reminder that the following payment(s) are pending:\n\n${billLines}\n\nTotal Outstanding: ${fmt(customer.outstanding)}\n\nKindly arrange payment at your earliest convenience.\n\nThank you,\n${companySettings.name || 'Your Company'}${companySettings.phone ? '\n📞 ' + companySettings.phone : ''}`
    const phone = customer.phone?.replace(/\D/g, '')
    if (phone) window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    else { navigator.clipboard.writeText(msg); showToast('Message copied — phone number not found', 'info') }
  }

  const handleSaveContact = async (formData) => {
    if (!detailLive?.manualId) {
      showToast('You must add this customer manually first to save contacts.', 'error')
      return
    }
    try {
      if (editingContact?.id) {
        await backendFetch(`/customers/contacts/${editingContact.id}`, {
          method: 'PATCH',
          body: JSON.stringify(formData),
        })
      } else {
        await backendFetch(`/customers/${detailLive.manualId}/contacts`, {
          method: 'POST',
          body: JSON.stringify(formData),
        })
      }
      showToast(editingContact ? 'Contact updated' : 'Contact added', 'success')
      queryClient.invalidateQueries(['customers'])
    } catch (err) {
      showToast(err.message || 'Failed to save contact', 'error')
    }
    setShowContactModal(false)
  }

  // ── Render detail view
  if (detailLive) {
    return (
      <CustomerDetail
        customer={detailLive}
        onBack={() => setDetailCustomer(null)}
        onEdit={() => { document.getElementById('main-scroll-area')?.scrollTo({ top: 0, behavior: 'smooth' }); setEditingCustomer(detailLive); setShowModal(true) }}
        onNavigate={onNavigate}
        showToast={showToast}
        companyName={companySettings.name}
        companyPhone={companySettings.phone}
      />
    )
  }

  // ── Main list view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Customers</h1>
            <span style={{ background: '#EFF6FF', color: '#2563EB', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
              {allCustomers.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, phone, city…"
                style={{ paddingLeft: 34, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', width: 220, fontFamily: "'Inter', sans-serif", outline: 'none' }}
              />
            </div>
            {/* Filter */}
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', background: 'var(--bg-card)', fontFamily: "'Inter', sans-serif" }}
            >
              <option value="all">All Customers</option>
              <option value="outstanding">With Outstanding</option>
              <option value="regular">Regular (3+ bills)</option>
              <option value="new">New (1 bill)</option>
              <option value="top">Top (₹1L+)</option>
              <option value="inactive">Inactive (90d)</option>
            </select>
            {/* Sort */}
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', background: 'var(--bg-card)', fontFamily: "'Inter', sans-serif" }}
            >
              <option value="name">Name A–Z</option>
              <option value="purchases">Top Purchases</option>
              <option value="outstanding">Outstanding</option>
              <option value="lastPurchase">Recent First</option>
              <option value="bills">Most Bills</option>
            </select>
            {/* View toggle */}
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {[{ mode: 'grid', Icon: Grid }, { mode: 'list', Icon: List }].map(({ mode, Icon }) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  style={{ padding: '8px 12px', border: 'none', cursor: 'pointer', background: viewMode === mode ? '#2563EB' : 'white', color: viewMode === mode ? 'white' : '#64748B', transition: 'all 0.15s' }}>
                  <Icon size={15} />
                </button>
              ))}
            </div>
            {/* Add Customer */}
            <Btn onClick={() => { document.getElementById('main-scroll-area')?.scrollTo({ top: 0, behavior: 'smooth' }); setEditingCustomer(null); setShowModal(true) }} icon={Plus} variant="primary">Add Customer</Btn>
          </div>
        </div>

      </div>

      {/* Summary Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard icon={Users} label="Total Customers" value={allCustomers.length} color="#2563EB" bg="#EFF6FF" />
        <StatCard icon={TrendingUp} label="Total Revenue" value={fmt(totalRevenue)} color="#1D4ED8" bg="#F0FDF4" />
        <StatCard icon={AlertCircle} label="Outstanding" value={fmt(totalOutstanding)} color="#DC2626" bg="#FEF2F2"
          onClick={totalOutstanding > 0 ? () => setFilter('outstanding') : undefined}
        />
        <StatCard icon={Activity} label="Active This Month" value={activeThisMonth} color="#D97706" bg="#FFFBEB" />
      </div>

      {/* Empty State */}
      {allCustomers.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <Users size={64} color="#CBD5E1" style={{ marginBottom: 20 }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-secondary)', margin: 0, marginBottom: 8 }}>No customers yet</h3>
          <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 20, maxWidth: 360 }}>
            Your customers will automatically appear here when you create bills or quotations.
          </p>
          <Btn onClick={() => setShowModal(true)} icon={Plus} variant="primary">Add Customer Manually</Btn>
          <p style={{ fontSize: 12, color: '#CBD5E1', marginTop: 12 }}>or create your first bill to get started</p>
        </div>
      )}

      {/* No results */}
      {allCustomers.length > 0 && displayed.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 14, color: '#94A3B8' }}>No customers match your search or filter.</p>
          <Btn onClick={() => { setSearch(''); setFilter('all') }} variant="ghost" style={{ margin: '12px auto 0' }}>Clear Filters</Btn>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && displayed.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {paginatedDisplayed.map(customer => (
              <CustomerCard
                key={customer.name}
              customer={customer}
              companyName={companySettings.name}
              onView={() => setDetailCustomer(customer)}
              onCreateBill={() => onNavigate('billing')}
              onCreateQuote={() => onNavigate('quotation')}
              onRemind={() => handleSendReminder(customer)}
              onCopy={() => handleCopyPhone(customer)}
              onDelete={() => handleDelete(customer)}
            />
            ))}
          </div>
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={Math.ceil(displayed.length / pagination.itemsPerPage)}
            totalItems={displayed.length}
            itemsPerPage={pagination.itemsPerPage}
            onPageChange={page => setPagination(p => ({ ...p, currentPage: page }))}
            onLimitChange={limit => setPagination({ currentPage: 1, itemsPerPage: limit })}
          />
        </>
      )}

      {/* List View */}
      {viewMode === 'list' && displayed.length > 0 && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
                  {[
                    { label: 'Customer', key: 'name' },
                    { label: 'Phone', key: null },
                    { label: 'Total Purchases', key: 'purchases' },
                    { label: 'Outstanding', key: 'outstanding' },
                    { label: 'Last Purchase', key: 'lastPurchase' },
                    { label: 'Bills', key: 'bills' },
                    { label: 'Actions', key: null },
                  ].map(({ label, key }) => (
                    <th key={label}
                      onClick={key ? () => setSort(key) : undefined}
                      style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: key ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {label}{key && <ArrowUpDown size={11} color={sort === key ? '#2563EB' : '#94A3B8'} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedDisplayed.map((customer, i) => (
                  <tr key={customer.name}
                    style={{ borderBottom: i < displayed.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: avatarColor(customer.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                          {initials(customer.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{customer.name}</div>
                          {customer.city && <div style={{ fontSize: 11, color: '#94A3B8' }}>{customer.city}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{customer.phone || '—'}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1D4ED8' }}>{fmt(customer.totalPurchases)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: customer.outstanding > 0 ? '#DC2626' : '#94A3B8' }}>{fmt(customer.outstanding)}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{fmtDate(customer.lastPurchase)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge text={customer.bills.length} color="#2563EB" bg="#EFF6FF" />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn small onClick={() => setDetailCustomer(customer)} icon={Eye} variant="ghost">View</Btn>
                        <Btn small onClick={() => onNavigate('billing')} icon={Receipt} variant="secondary">Bill</Btn>
                        {customer.outstanding > 0 && (
                          <button onClick={() => handleSendReminder(customer)} title="Send WhatsApp reminder"
                            style={{ padding: '5px 8px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, cursor: 'pointer', color: '#1D4ED8' }}>
                            <MessageSquare size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0 16px' }}>
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={Math.ceil(displayed.length / pagination.itemsPerPage)}
              totalItems={displayed.length}
              itemsPerPage={pagination.itemsPerPage}
              onPageChange={page => setPagination(p => ({ ...p, currentPage: page }))}
              onLimitChange={limit => setPagination({ currentPage: 1, itemsPerPage: limit })}
            />
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <CustomerModal
          existing={editingCustomer}
          onClose={() => { setShowModal(false); setEditingCustomer(null) }}
          onSave={handleSaveCustomer}
          availableTags={availableTags}
        />
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <ContactModal
          existing={editingContact}
          onClose={() => { setShowContactModal(false); setEditingContact(null) }}
          onSave={handleSaveContact}
        />
      )}
    </div>
  )
}

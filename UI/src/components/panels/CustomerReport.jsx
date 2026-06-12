import React, { useState, useEffect, useMemo } from 'react'
import {
  ArrowLeft, Download, Users, UserPlus, RefreshCw, AlertCircle, MessageCircle, Search, ArrowUpDown
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts'
import { exportToPDF, exportToExcel } from '../../utils/exportUtils'
import ExportButton from '../ui/ExportButton'
import DateRangePicker, { getDateRange } from '../ui/DateRangePicker'

const CHART_COLORS = ['#38BDF8', '#8B5CF6', '#2563EB', '#F59E0B', '#EF4444', '#6366F1', '#EC4899', '#14B8A6']
const axisStyle = { tick: { fontSize: 12, fill: '#64748B' }, axisLine: { stroke: '#E2E8F0' }, tickLine: false }
const gridStyle = { strokeDasharray: '3 3', stroke: '#F1F5F9', vertical: false }
const tooltipStyle = {
  contentStyle: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 8, color: '#0F172A', fontSize: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
  itemStyle: { color: '#0F172A', fontWeight: 600 }
}

const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`

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

const Pagination = ({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange, itemName = "items" }) => {
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid #E2E8F0' }}>
      <span style={{ fontSize: 13, color: '#0F172A' }}>
        Showing {startItem}–{endItem} of <strong>{totalItems}</strong> {itemName}
      </span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <PageBtn onClick={() => onPageChange(1)} disabled={currentPage === 1}>«</PageBtn>
        <PageBtn onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>‹</PageBtn>
        {getPageNumbers().map((page, i) => (
          page === '...' ? (
            <span key={i} style={{ padding: '0 8px', color: '#1E293B' }}>...</span>
          ) : (
            <PageBtn key={i} active={page === currentPage} onClick={() => onPageChange(page)}>{page}</PageBtn>
          )
        ))}
        <PageBtn onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>›</PageBtn>
        <PageBtn onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages}>»</PageBtn>
      </div>
    </div>
  )
}

export default function CustomerReport({ onBack }) {
  const historyRef = React.useRef(null)
  const outstandingRef = React.useRef(null)

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  
  const [dateRange, setDateRange] = useState('all')
  const [customFrom, setCustomFrom] = useState(null)
  const [customTo, setCustomTo] = useState(null)

  // Table state
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('totalSpent')
  const [sortOrder, setSortOrder] = useState('desc')
  const [kpiFilter, setKpiFilter] = useState('all')
  const [historyPage, setHistoryPage] = useState(1)
  const [outstandingPage, setOutstandingPage] = useState(1)
  const itemsPerPage = 12

  useEffect(() => {
    fetchData()
  }, [dateRange, customFrom, customTo])

  const fetchData = async () => {
    let f = ''
    let t = ''

    if (dateRange !== 'custom') {
      const range = getDateRange(dateRange)
      f = range.from || ''
      t = range.to || ''
    } else {
      if (!customFrom || !customTo) {
        return
      }
      f = customFrom.toISOString()
      t = new Date(customTo.getTime() + 86399999).toISOString()
    }

    setLoading(true)
    try {
      const res = await backendFetch(`/reports/customers?from=${f}&to=${t}`)
      setData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = () => {
    if (!data) return
    const headers = ['Customer', 'Total Orders', 'Total Spent', 'Avg Order', 'Customer Since']
    const rows = sortedHistory.map(c => [
      c.customer, c.orders, formatCurrency(c.totalSpent), formatCurrency(c.avgOrder), 
      new Date(c.firstOrder).toLocaleDateString('en-IN')
    ])
    exportToPDF('Customer Purchase History', headers, rows, 'Customer_History')
  }

  const handleExportExcel = () => {
    if (!data) return
    import('xlsx').then(XLSX => {
      const wb = XLSX.utils.book_new()
      
      const wsHistory = XLSX.utils.json_to_sheet(sortedHistory.map(c => ({
        Customer: c.customer, Phone: c.phone, TotalOrders: c.orders, 
        TotalSpent: c.totalSpent, AvgOrder: c.avgOrder, 
        LastOrder: new Date(c.lastOrder).toLocaleDateString('en-IN'),
        CustomerSince: new Date(c.firstOrder).toLocaleDateString('en-IN')
      })))
      XLSX.utils.book_append_sheet(wb, wsHistory, "Purchase History")

      const wsOut = XLSX.utils.json_to_sheet(data.outstanding.map(o => ({
        Customer: o.customer, Phone: o.phone, Bills: o.bills,
        TotalDue: o.totalDue, OldestBill: new Date(o.oldestBill).toLocaleDateString('en-IN'),
        DaysOverdue: o.daysOverdue
      })))
      XLSX.utils.book_append_sheet(wb, wsOut, "Outstanding Balances")

      XLSX.writeFile(wb, `Customer_Report_${new Date().toISOString().split('T')[0]}.xlsx`)
    })
  }

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const sortedHistory = useMemo(() => {
    if (!data?.customerHistory) return []
    let list = [...data.customerHistory]
    if (search) {
      list = list.filter(c => c.customer.toLowerCase().includes(search.toLowerCase()))
    }
    
    if (kpiFilter === 'new') list = list.filter(c => c.isNew)
    if (kpiFilter === 'repeat') list = list.filter(c => c.isRepeat)
    if (kpiFilter === 'todayActive') list = list.filter(c => c.activeToday)
    if (kpiFilter === 'todayNew') list = list.filter(c => c.newToday)

    list.sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [data, search, sortField, sortOrder])

  // Pagination lists
  const paginatedHistory = useMemo(() => {
    return sortedHistory.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage)
  }, [sortedHistory, historyPage])

  const outstandingList = data?.outstanding || []
  const paginatedOutstanding = useMemo(() => {
    return outstandingList.slice((outstandingPage - 1) * itemsPerPage, outstandingPage * itemsPerPage)
  }, [outstandingList, outstandingPage])

  const sendReminder = (o) => {
    const text = `Dear ${o.customer}, this is a gentle reminder that an amount of ₹${o.totalDue} is due. Please make the payment at the earliest. Thank you!`
    const phone = o.phone ? o.phone.replace(/\D/g, '') : ''
    if (phone) {
      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(text)}`, '_blank')
    } else {
      alert("No phone number available for this customer.")
    }
  }

  return (
    <div className="customer-report-page" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button 
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #E2E8F0', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#475569', transition: 'all 0.2s' }}
          >
            <ArrowLeft size={16} /> Back to Reports
          </button>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>Customer Report</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DateRangePicker 
            value={dateRange}
            onChange={setDateRange}
            customFrom={customFrom}
            customTo={customTo}
            onCustomChange={(type, date) => {
              if (type === 'from') setCustomFrom(date)
              else setCustomTo(date)
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <ExportButton onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} />
          </div>
        </div>
      </div>

      {loading || !data ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* ── KPI CARDS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            <div 
              style={{ background: kpiFilter === 'todayActive' ? '#EFF6FF' : 'white', padding: 20, borderRadius: 12, border: kpiFilter === 'todayActive' ? '2px solid #2563EB' : '1px solid #E2E8F0', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              <div 
                style={{ cursor: 'pointer' }}
                onClick={() => { setKpiFilter('all'); setSortField('totalSpent'); setSortOrder('desc'); historyPage !== 1 && setHistoryPage(1); historyRef.current?.scrollIntoView({ behavior: 'smooth' }) }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                    <Users size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Total Customers</div>
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#0F172A' }}>{data.kpis.totalCustomers}</div>
              </div>
              <div 
                style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); setKpiFilter('todayActive'); historyPage !== 1 && setHistoryPage(1); historyRef.current?.scrollIntoView({ behavior: 'smooth' }) }}
              >
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>Purchased Today</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#2563EB', background: '#DBEAFE', padding: '2px 8px', borderRadius: 12 }}>{data.kpis.todayCustomersCount || 0}</span>
              </div>
            </div>

            <div 
              style={{ background: kpiFilter === 'new' || kpiFilter === 'todayNew' ? '#EFF6FF' : 'white', padding: 20, borderRadius: 12, border: kpiFilter === 'new' || kpiFilter === 'todayNew' ? '2px solid #2563EB' : '1px solid #E2E8F0', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              <div 
                style={{ cursor: 'pointer' }}
                onClick={() => { setKpiFilter('new'); setSortField('firstOrder'); setSortOrder('desc'); historyPage !== 1 && setHistoryPage(1); historyRef.current?.scrollIntoView({ behavior: 'smooth' }) }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>New Customers</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>Added in period</div>
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#2563EB' }}>{data.kpis.newCustomers}</div>
              </div>
              <div 
                style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); setKpiFilter('todayNew'); historyPage !== 1 && setHistoryPage(1); historyRef.current?.scrollIntoView({ behavior: 'smooth' }) }}
              >
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>Added Today</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#2563EB', background: '#DBEAFE', padding: '2px 8px', borderRadius: 12 }}>{data.kpis.todayNewCustomersCount || 0}</span>
              </div>
            </div>

            <div 
              onClick={() => { setKpiFilter('repeat'); setSortField('orders'); setSortOrder('desc'); historyPage !== 1 && setHistoryPage(1); historyRef.current?.scrollIntoView({ behavior: 'smooth' }) }}
              style={{ background: kpiFilter === 'repeat' ? '#F3E8FF' : 'white', padding: 20, borderRadius: 12, border: kpiFilter === 'repeat' ? '2px solid #7C3AED' : '1px solid #E2E8F0', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED' }}>
                  <RefreshCw size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Repeat Customers</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>2 or more orders</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#7C3AED' }}>{data.kpis.repeatCustomers}</div>
            </div>

            <div 
              onClick={() => outstandingRef.current?.scrollIntoView({ behavior: 'smooth' })}
              style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                  <AlertCircle size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Outstanding Due</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Total receivables</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#DC2626' }}>{formatCurrency(data.kpis.outstandingDue)}</div>
            </div>
          </div>

          {/* ── CHARTS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
            <div style={{ background: 'white', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Top 10 Customers by Revenue</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.topCustomers} layout="vertical" margin={{ left: 0, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" {...axisStyle} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={120} {...axisStyle} />
                  <Tooltip {...tooltipStyle} formatter={(value, name, props) => [`${formatCurrency(value)} (${props.payload.orders} bills)`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#38BDF8" radius={[0,4,4,0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: 'white', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Customer Purchase Trend</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.monthlyTrend}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="month" {...axisStyle} />
                  <YAxis {...axisStyle} />
                  <Tooltip {...tooltipStyle} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#64748B' }} />
                  <Line name="New Customers" type="monotone" dataKey="newCustomers" stroke="#2563EB" strokeWidth={3} dot={data?.monthlyTrend?.length > 24 ? false : { r: 4 }} activeDot={{ r: 6 }} />
                  <Line name="Existing Customers" type="monotone" dataKey="existingCustomers" stroke="#10B981" strokeWidth={3} dot={data?.monthlyTrend?.length > 24 ? false : { r: 4 }} activeDot={{ r: 6 }} />
                  <Line name="Repeat Orders" type="monotone" dataKey="orders" stroke="#7C3AED" strokeWidth={3} dot={data?.monthlyTrend?.length > 24 ? false : { r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── PURCHASE HISTORY TABLE ── */}
          <div ref={historyRef} style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Customer Purchase History</h3>
                {kpiFilter !== 'all' && (
                  <button 
                    onClick={() => setKpiFilter('all')}
                    style={{ fontSize: 12, padding: '4px 12px', borderRadius: 12, background: '#F1F5F9', color: '#475569', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div style={{ position: 'relative', width: 250 }}>
                <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Search customers..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none' }}
                />
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#F8FAFC', fontSize: 12, color: '#64748B', textTransform: 'uppercase' }}>
                  <tr>
                    {['Customer', 'Phone', 'Orders', 'TotalSpent', 'AvgOrder', 'LastOrder', 'FirstOrder'].map((col, idx) => (
                      <th key={col} style={{ padding: '16px 24px', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort(col)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {col.replace(/([A-Z])/g, ' $1').trim()}
                          <ArrowUpDown size={12} color={sortField === col ? '#2563EB' : '#CBD5E1'} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{c.customer}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{c.phone || '-'}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{c.orders}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{formatCurrency(c.totalSpent)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{formatCurrency(c.avgOrder)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{new Date(c.lastOrder).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{new Date(c.firstOrder).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                  {sortedHistory.length === 0 && (
                    <tr><td colSpan="7" style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>No matching customers!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {sortedHistory.length > 0 && (
              <Pagination
                currentPage={historyPage}
                totalPages={Math.ceil(sortedHistory.length / itemsPerPage)}
                totalItems={sortedHistory.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setHistoryPage}
                itemName="customers"
              />
            )}
          </div>

          {/* ── OUTSTANDING BALANCES TABLE ── */}
          <div ref={outstandingRef} style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Outstanding Balances</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#F8FAFC', fontSize: 12, color: '#64748B', textTransform: 'uppercase' }}>
                  <tr>
                    <th style={{ padding: '16px 24px' }}>Customer</th>
                    <th style={{ padding: '16px 24px' }}>Phone</th>
                    <th style={{ padding: '16px 24px' }}>Bills</th>
                    <th style={{ padding: '16px 24px' }}>Total Due</th>
                    <th style={{ padding: '16px 24px' }}>Oldest Bill</th>
                    <th style={{ padding: '16px 24px' }}>Days Overdue</th>
                    <th style={{ padding: '16px 24px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOutstanding.map((o, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{o.customer}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{o.phone || '-'}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{o.bills}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#DC2626' }}>{formatCurrency(o.totalDue)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{new Date(o.oldestBill).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#DC2626', fontWeight: 600 }}>{o.daysOverdue} days</td>
                      <td style={{ padding: '16px 24px' }}>
                        <button 
                          onClick={() => sendReminder(o)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1D4ED8' }}
                        >
                          <MessageCircle size={14} /> Send Reminder
                        </button>
                      </td>
                    </tr>
                  ))}
                  {outstandingList.length === 0 && (
                    <tr><td colSpan="7" style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>No outstanding balances!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {outstandingList.length > 0 && (
              <Pagination
                currentPage={outstandingPage}
                totalPages={Math.ceil(outstandingList.length / itemsPerPage)}
                totalItems={outstandingList.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setOutstandingPage}
                itemName="customers"
              />
            )}
          </div>

        </div>
      )}

    </div>
  )
}

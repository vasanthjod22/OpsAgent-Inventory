import React, { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft, Download, Package, AlertTriangle, XCircle, Archive, Plus
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer, LabelList
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
const formatQty = (qty) => typeof qty === 'number' ? Number(qty.toFixed(2)) : qty

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

export default function InventoryReport({ onBack }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [period, setPeriod] = useState('month')
  const [customFrom, setCustomFrom] = useState(null)
  const [customTo, setCustomTo] = useState(null)
  
  const [lowStockPage, setLowStockPage] = useState(1)
  const [deadStockPage, setDeadStockPage] = useState(1)
  const itemsPerPage = 12
  
  const lowStockRef = useRef(null)
  const deadStockRef = useRef(null)

  useEffect(() => {
    fetchData()
  }, [period, customFrom, customTo])

  const fetchData = async () => {
    let from = ''

    if (period !== 'custom') {
      const range = getDateRange(period)
      from = range.from
    } else {
      if (!customFrom) {
        return
      }
      from = customFrom.toISOString()
    }

    setLoading(true)
    try {
      const res = await backendFetch(`/reports/inventory?from=${from}`)
      setData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = () => {
    if (!data) return
    const headers = ['HSN', 'Product', 'Category', 'Current Qty', 'Min Level', 'Value']
    const rows = data.lowStockItems.map(o => [
      o.hsn || '-', o.name, o.category || '-', o.qty, o.min || 0, formatCurrency(o.qty * o.rate)
    ])
    exportToPDF(`Inventory Low Stock - ${period}`, headers, rows, `Inventory_Low_Stock`)
  }

  const handleExportExcel = () => {
    if (!data) return
    
    // Create multiple sheets using xlsx library.
    // Assuming exportToExcel handles single arrays by default, but if the app supports multi-sheet in exportUtils, we can do it.
    // If exportToExcel doesn't support multiple sheets by default, we'll construct the array structure based on common utils.
    // I will try to export all inventory if the generic `exportToExcel` takes an array of sheets, otherwise I'll just export all data combined.
    // Let's pass an object where keys are sheet names. The `exportToExcel` from previous phases handles single arrays.
    // Wait, the prompt says "Excel has 3 sheets". We can do this using standard xlsx since it's installed.
    import('xlsx').then(XLSX => {
      const wb = XLSX.utils.book_new()
      
      // Sheet 1: Low Stock
      const wsLow = XLSX.utils.json_to_sheet(data.lowStockItems.map(i => ({
        HSN: i.hsn, Product: i.name, Category: i.category, Qty: i.qty, Min: i.min, Value: i.qty * i.rate
      })))
      XLSX.utils.book_append_sheet(wb, wsLow, "Low Stock")

      // Sheet 2: Dead Stock
      const wsDead = XLSX.utils.json_to_sheet(data.deadStockItems.map(i => ({
        HSN: i.hsn, Product: i.name, Category: i.category, Qty: i.qty, ValueLocked: i.valueLocked, DaysIdle: i.daysIdle
      })))
      XLSX.utils.book_append_sheet(wb, wsDead, "Dead Stock")

      // Sheet 3: Categories
      const wsCat = XLSX.utils.json_to_sheet(data.categoryValue.map(c => ({
        Category: c.category, Items: c.items, Value: c.value
      })))
      XLSX.utils.book_append_sheet(wb, wsCat, "Categories")

      XLSX.writeFile(wb, `Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`)
    })
  }

  const scrollToLowStock = () => {
    if (lowStockRef.current) {
      lowStockRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const scrollToDeadStock = () => {
    if (deadStockRef.current) {
      deadStockRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Pagination logic
  const lowStockItems = data?.lowStockItems || []
  const deadStockItems = data?.deadStockItems || []

  const paginatedLowStock = lowStockItems.slice((lowStockPage - 1) * itemsPerPage, lowStockPage * itemsPerPage)
  const paginatedDeadStock = deadStockItems.slice((deadStockPage - 1) * itemsPerPage, deadStockPage * itemsPerPage)

  return (
    <div className="inventory-report-page" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button 
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #E2E8F0', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#475569', transition: 'all 0.2s' }}
          >
            <ArrowLeft size={16} /> Back to Reports
          </button>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>Inventory Report</h2>
        </div>
      </div>

      <div style={{ padding: '12px 16px', background: '#EFF6FF', color: '#1E3A8A', borderRadius: 8, marginBottom: 24, fontSize: 13, border: '1px solid #BFDBFE' }}>
        <strong>Note:</strong> Total Inventory Value, Low Stock, and the Category chart represent your <strong>current stock snapshot</strong> and do not change with the date filter. The date filter applies to Fast/Slow Moving and Dead Stock analysis.
      </div>

      {loading || !data ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* ── KPI CARDS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                  <Package size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Total Inventory Value</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Current stock value</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#0F172A' }}>{formatCurrency(data.kpis.totalValue)}</div>
            </div>

            <div 
              onClick={scrollToLowStock}
              style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Low Stock Items</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Below reorder level</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#D97706' }}>{data.kpis.lowStockCount}</div>
            </div>

            <div 
              onClick={() => {
                sessionStorage.setItem('inventory_filter', 'out')
                window.location.hash = 'inventory'
              }}
              style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                  <XCircle size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Out of Stock Items</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Zero quantity items</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#DC2626' }}>{data.kpis.outOfStockCount}</div>
            </div>

            <div 
              onClick={scrollToDeadStock}
              style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
                  <Archive size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Dead Stock Items</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>No movement in 90 days</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#64748B' }}>{data.kpis.deadStockCount}</div>
            </div>
          </div>

          {/* ── CHARTS ── */}
          <div style={{ background: 'white', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Inventory Value by Category</h3>
            {data.categoryValue && data.categoryValue.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.categoryValue}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="category" {...axisStyle} />
                  <YAxis {...axisStyle} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [formatCurrency(v), 'Stock Value']} />
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {data.categoryValue.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 14, background: '#F8FAFC', borderRadius: 8, border: '1px dashed #E2E8F0' }}>
                No category data available
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            <ExportButton onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} />
            <DateRangePicker 
              value={period}
              onChange={setPeriod}
              customFrom={customFrom}
              customTo={customTo}
              onCustomChange={(type, date) => {
                if (type === 'from') setCustomFrom(date)
                else setCustomTo(date)
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            <div style={{ background: 'white', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Fast Moving Products</h3>
              {data.fastMoving && data.fastMoving.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.fastMoving} layout="vertical" margin={{ left: 0, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" {...axisStyle} />
                    <YAxis type="category" dataKey="name" width={120} {...axisStyle} />
                    <Tooltip {...tooltipStyle} formatter={(v) => [v, 'Qty Sold']} />
                    <Bar dataKey="qty" fill="#2563EB" radius={[0,4,4,0]} barSize={20}>
                      <LabelList dataKey="qty" position="right" fill="#64748B" fontSize={12} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 14, background: '#F8FAFC', borderRadius: 8, border: '1px dashed #E2E8F0' }}>
                  No fast moving products found
                </div>
              )}
            </div>

            <div style={{ background: 'white', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Slow Moving Products</h3>
              {data.slowMoving && data.slowMoving.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.slowMoving} layout="vertical" margin={{ left: 0, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" {...axisStyle} />
                    <YAxis type="category" dataKey="name" width={120} {...axisStyle} />
                    <Tooltip {...tooltipStyle} formatter={(v) => [v, 'Qty Sold']} />
                    <Bar dataKey="qty" fill="#EF4444" radius={[0,4,4,0]} barSize={20}>
                      <LabelList dataKey="qty" position="right" fill="#64748B" fontSize={12} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 14, background: '#F8FAFC', borderRadius: 8, border: '1px dashed #E2E8F0' }}>
                  No slow moving products found
                </div>
              )}
            </div>
          </div>

          {/* ── LOW STOCK TABLE ── */}
          <div ref={lowStockRef} style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Low Stock Products</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#F8FAFC', fontSize: 12, color: '#64748B', textTransform: 'uppercase' }}>
                  <tr>
                    <th style={{ padding: '16px 24px' }}>HSN</th>
                    <th style={{ padding: '16px 24px' }}>Product</th>
                    <th style={{ padding: '16px 24px' }}>Category</th>
                    <th style={{ padding: '16px 24px' }}>Current Qty</th>
                    <th style={{ padding: '16px 24px' }}>Min Level</th>
                    <th style={{ padding: '16px 24px' }}>Value at Risk</th>
                    <th style={{ padding: '16px 24px' }}>Status</th>
                    <th style={{ padding: '16px 24px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLowStock.map((o, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{o.hsn || '-'}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{o.name}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#374151' }}>{o.category || 'Steel Bars'}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 700, color: '#D97706' }}>{formatQty(o.qty)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{formatQty(o.min)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{formatCurrency(o.qty * o.rate)}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#D97706', background: '#FFFBEB', padding: '4px 8px', borderRadius: 4 }}>
                          Low Stock
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#2563EB' }}>
                          <Plus size={14} /> Create PO
                        </button>
                      </td>
                    </tr>
                  ))}
                  {lowStockItems.length === 0 && (
                    <tr><td colSpan="8" style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>No low stock items!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {lowStockItems.length > 0 && (
              <Pagination
                currentPage={lowStockPage}
                totalPages={Math.ceil(lowStockItems.length / itemsPerPage)}
                totalItems={lowStockItems.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setLowStockPage}
                itemName="products"
              />
            )}
          </div>

          {/* ── DEAD STOCK TABLE ── */}
          <div ref={deadStockRef} style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Dead Stock Products (90+ Days Idle)</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#F8FAFC', fontSize: 12, color: '#64748B', textTransform: 'uppercase' }}>
                  <tr>
                    <th style={{ padding: '16px 24px' }}>HSN</th>
                    <th style={{ padding: '16px 24px' }}>Product</th>
                    <th style={{ padding: '16px 24px' }}>Category</th>
                    <th style={{ padding: '16px 24px' }}>Qty</th>
                    <th style={{ padding: '16px 24px' }}>Value Locked</th>
                    <th style={{ padding: '16px 24px' }}>Last Moved</th>
                    <th style={{ padding: '16px 24px' }}>Days Idle</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDeadStock.map((o, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{o.hsn || '-'}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{o.name}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#374151' }}>{o.category || 'Steel Bars'}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 700, color: '#64748B' }}>{formatQty(o.qty)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#DC2626' }}>{formatCurrency(o.valueLocked)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{new Date(o.last_restocked || o.created_at || new Date()).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#64748B' }}>{o.daysIdle} days</td>
                    </tr>
                  ))}
                  {deadStockItems.length === 0 && (
                    <tr><td colSpan="7" style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>No dead stock items!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {deadStockItems.length > 0 && (
              <Pagination
                currentPage={deadStockPage}
                totalPages={Math.ceil(deadStockItems.length / itemsPerPage)}
                totalItems={deadStockItems.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setDeadStockPage}
                itemName="products"
              />
            )}
          </div>

        </div>
      )}

    </div>
  )
}

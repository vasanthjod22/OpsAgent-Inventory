import React, { useState, useEffect } from 'react'
import {
  ArrowLeft, Download, Package, TrendingUp, TrendingDown, DollarSign
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
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

export default function ProductReport({ onBack }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  
  const [dateRange, setDateRange] = useState('month')
  const [customFrom, setCustomFrom] = useState(null)
  const [customTo, setCustomTo] = useState(null)

  useEffect(() => {
    fetchData()
  }, [dateRange, customFrom, customTo])

  const fetchData = async () => {
    let f, t;
    if (dateRange !== 'custom') {
      const range = getDateRange(dateRange)
      f = range.from
      t = range.to
    } else {
      if (!customFrom || !customTo) {
        return
      }
      f = customFrom.toISOString()
      t = new Date(customTo.getTime() + 86399999).toISOString()
    }

    setLoading(true)
    try {
      const res = await backendFetch(`/reports/products?from=${f}&to=${t}`)
      setData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = () => {
    if (!data) return
    const headers = ['Product', 'SKU', 'Category', 'Qty Sold', 'Revenue', 'Avg Price', 'Margin %']
    const rows = data.performance.map(p => [
      p.name, p.sku, p.category, p.qtySold, formatCurrency(p.revenue), 
      formatCurrency(p.avgPrice), `${p.margin.toFixed(1)}%`
    ])
    exportToPDF('Product Performance', headers, rows, 'Product_Performance')
  }

  const handleExportExcel = () => {
    if (!data) return
    import('xlsx').then(XLSX => {
      const wb = XLSX.utils.book_new()
      
      const wsPerf = XLSX.utils.json_to_sheet(data.performance.map(p => ({
        Product: p.name, SKU: p.sku, Category: p.category, 
        QtySold: p.qtySold, Revenue: p.revenue, AvgPrice: p.avgPrice, 
        InStock: p.inStock, 'Margin%': p.margin.toFixed(1)
      })))
      XLSX.utils.book_append_sheet(wb, wsPerf, "Performance")

      const wsProfit = XLSX.utils.json_to_sheet(data.profitability.map(p => ({
        Product: p.name, CostPrice: p.costPrice, SellingPrice: p.sellingPrice,
        MarginPct: p.margin.toFixed(1), UnitsSold: p.qtySold, TotalProfit: p.totalProfit
      })))
      XLSX.utils.book_append_sheet(wb, wsProfit, "Profitability")

      XLSX.writeFile(wb, `Product_Report_${new Date().toISOString().split('T')[0]}.xlsx`)
    })
  }

  const getMarginColor = (margin) => {
    if (margin > 30) return '#2563EB'
    if (margin >= 15) return '#D97706'
    return '#DC2626'
  }

  return (
    <div className="product-report-page" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button 
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #E2E8F0', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#475569', transition: 'all 0.2s' }}
          >
            <ArrowLeft size={16} /> Back to Reports
          </button>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>Product Report</h2>
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
            <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                  <Package size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Total Products</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#0F172A' }}>{data.kpis.totalProducts}</div>
            </div>

            <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                  <TrendingUp size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Best Selling</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{data.kpis.bestSelling ? `${data.kpis.bestSelling.qtySold} sold - ${formatCurrency(data.kpis.bestSelling.revenue)}` : 'N/A'}</div>
                </div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#2563EB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {data.kpis.bestSelling?.name || 'N/A'}
              </div>
            </div>

            <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
                  <TrendingDown size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Least Selling</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{data.kpis.leastSelling ? `${data.kpis.leastSelling.qtySold} sold` : 'N/A'}</div>
                </div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#D97706', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {data.kpis.leastSelling?.name || 'N/A'}
              </div>
            </div>

            <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED' }}>
                  <DollarSign size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Total Revenue</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>From products</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#7C3AED' }}>{formatCurrency(data.kpis.totalRevenue)}</div>
            </div>
          </div>

          {/* ── CHARTS ── */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 500px', background: 'white', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Product Sales Ranking (Top 10)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.salesRanking} layout="vertical" margin={{ left: 0, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" {...axisStyle} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={120} {...axisStyle} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [formatCurrency(v), 'Revenue']} />
                  <Bar dataKey="revenue" fill="#38BDF8" radius={[0,4,4,0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ flex: '1 1 300px', background: 'white', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Revenue by Category</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.categoryRevenue}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="category" {...axisStyle} angle={-25} textAnchor="end" height={60} />
                  <YAxis {...axisStyle} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [formatCurrency(v), 'Revenue']} />
                  <Bar dataKey="revenue" radius={[4,4,0,0]}>
                    {data.categoryRevenue.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── PERFORMANCE TABLE ── */}
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Product Performance</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#F8FAFC', fontSize: 12, color: '#64748B', textTransform: 'uppercase' }}>
                  <tr>
                    <th style={{ padding: '16px 24px' }}>Product</th>
                    <th style={{ padding: '16px 24px' }}>SKU</th>
                    <th style={{ padding: '16px 24px' }}>Category</th>
                    <th style={{ padding: '16px 24px' }}>Qty Sold</th>
                    <th style={{ padding: '16px 24px' }}>Revenue</th>
                    <th style={{ padding: '16px 24px' }}>Avg Price</th>
                    <th style={{ padding: '16px 24px' }}>In Stock</th>
                    <th style={{ padding: '16px 24px' }}>Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.performance.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{p.name}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{p.sku}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{p.category}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{p.qtySold}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{formatCurrency(p.revenue)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{formatCurrency(p.avgPrice)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{p.inStock}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: getMarginColor(p.margin) }}>
                        {p.margin.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  {data.performance.length === 0 && (
                    <tr><td colSpan="8" style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>No products found!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── PROFITABILITY TABLE ── */}
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Product Profitability</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#F8FAFC', fontSize: 12, color: '#64748B', textTransform: 'uppercase' }}>
                  <tr>
                    <th style={{ padding: '16px 24px' }}>Product</th>
                    <th style={{ padding: '16px 24px' }}>Cost Price</th>
                    <th style={{ padding: '16px 24px' }}>Selling Price</th>
                    <th style={{ padding: '16px 24px' }}>Margin</th>
                    <th style={{ padding: '16px 24px' }}>Units Sold</th>
                    <th style={{ padding: '16px 24px' }}>Total Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.profitability.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{p.name}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{formatCurrency(p.costPrice)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{formatCurrency(p.sellingPrice)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: getMarginColor(p.margin) }}>
                        {p.margin.toFixed(1)}%
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{p.qtySold}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: p.totalProfit > 0 ? '#2563EB' : '#DC2626' }}>
                        {formatCurrency(p.totalProfit)}
                      </td>
                    </tr>
                  ))}
                  {data.profitability.length === 0 && (
                    <tr><td colSpan="6" style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>No profitability data!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  )
}

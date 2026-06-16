import React, { useState, useEffect } from 'react'
import {
  ArrowLeft, Download, TrendingUp, TrendingDown, Package, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { exportToPDF, exportToExcel } from '../../utils/exportUtils'
import ExportButton from '../ui/ExportButton'
import DateRangePicker, { getDateRange } from '../ui/DateRangePicker'

const axisStyle = { tick: { fontSize: 12, fill: '#64748B' }, axisLine: { stroke: '#E2E8F0' }, tickLine: false }
const gridStyle = { strokeDasharray: '3 3', stroke: '#F1F5F9', vertical: false }
const tooltipStyle = {
  contentStyle: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 8, color: '#0F172A', fontSize: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
  itemStyle: { color: '#0F172A', fontWeight: 600 }
}

const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`

export default function DemandAnalysis({ onBack }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  
  const [dateRange, setDateRange] = useState('all')
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
      const res = await backendFetch(`/reports/demand?from=${f}&to=${t}`)
      setData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = () => {
    if (!data) return
    const headers = ['Rank', 'Product', 'Category', 'Units Sold', 'Revenue', 'Demand Score']
    const rows = data.rankingTable.map(p => [
      p.rank, p.name, p.category, p.units, formatCurrency(p.revenue), p.demandScore
    ])
    exportToPDF('Demand Analysis', headers, rows, 'Demand_Analysis')
  }

  const handleExportExcel = () => {
    if (!data) return
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet(data.rankingTable.map(p => ({
        Rank: p.rank, Product: p.name, Category: p.category, 
        UnitsSold: p.units, Revenue: p.revenue, 
        DemandScore: p.demandScore, Trend: p.trend
      })))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Demand Data")
      XLSX.writeFile(wb, `Demand_Analysis_${new Date().toISOString().split('T')[0]}.xlsx`)
    })
  }

  return (
    <div className="demand-report-page" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button 
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #E2E8F0', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#475569', transition: 'all 0.2s' }}
          >
            <ArrowLeft size={16} /> Back to Reports
          </button>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>Product Demand Analysis</h2>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
            <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
                  <TrendingUp size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Highest Demand Product</div>
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {data.kpis.highestDemand?.name || 'N/A'}
              </div>
              <div style={{ fontSize: 13, color: '#16A34A', fontWeight: 500 }}>
                {data.kpis.highestDemand?.units || 0} units sold in period
              </div>
            </div>

            <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                  <TrendingDown size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Lowest Demand Product</div>
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {data.kpis.lowestDemand?.name || 'N/A'}
              </div>
              <div style={{ fontSize: 13, color: '#DC2626', fontWeight: 500 }}>
                {data.kpis.lowestDemand?.units || 0} units sold
              </div>
            </div>

            <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                  <Package size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Total Units Sold</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>All products combined</div>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#2563EB' }}>{data.kpis.totalUnits}</div>
            </div>
          </div>

          {/* ── CHARTS ── */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: '2 1 500px', background: 'white', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Top Demand Products</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.topDemand} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" {...axisStyle} />
                  <YAxis dataKey="name" type="category" width={120} {...axisStyle} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="units" fill="#2563EB" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ flex: '1 1 300px', background: 'white', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Lowest Demand Products</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.lowDemand} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" {...axisStyle} />
                  <YAxis dataKey="name" type="category" width={100} {...axisStyle} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="units" fill="#DC2626" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ background: 'white', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Monthly Demand Trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.monthlyTrend}>
                <defs>
                  <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="month" {...axisStyle} />
                <YAxis {...axisStyle} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="units" stroke="#2563EB" fillOpacity={1} fill="url(#colorUnits)" strokeWidth={3} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── RANKING TABLE ── */}
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Product Demand Ranking</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#F8FAFC', fontSize: 12, color: '#64748B', textTransform: 'uppercase' }}>
                  <tr>
                    <th style={{ padding: '16px 24px' }}>Rank</th>
                    <th style={{ padding: '16px 24px' }}>Product</th>
                    <th style={{ padding: '16px 24px' }}>Category</th>
                    <th style={{ padding: '16px 24px' }}>Units Sold</th>
                    <th style={{ padding: '16px 24px' }}>Revenue</th>
                    <th style={{ padding: '16px 24px' }}>Demand Score</th>
                    <th style={{ padding: '16px 24px' }}>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rankingTable.map((p, i) => {
                    const scoreColor = p.demandScore === 'High' ? '#16A34A' : p.demandScore === 'Medium' ? '#2563EB' : p.demandScore === 'Low' ? '#D97706' : '#64748B'
                    const scoreBg = p.demandScore === 'High' ? '#DCFCE7' : p.demandScore === 'Medium' ? '#DBEAFE' : p.demandScore === 'Low' ? '#FEF3C7' : '#F1F5F9'
                    
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#64748B' }}>#{p.rank}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 500, color: '#0F172A' }}>{p.name}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{p.category}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{p.units}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{formatCurrency(p.revenue)}</td>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{ 
                            fontSize: 12, fontWeight: 600, padding: '4px 8px', borderRadius: 4,
                            background: scoreBg, color: scoreColor
                          }}>
                            {p.demandScore}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          {p.trend === 'up' && <ArrowUpRight size={18} color="#16A34A" />}
                          {p.trend === 'down' && <ArrowDownRight size={18} color="#DC2626" />}
                          {p.trend === 'stable' && <Minus size={18} color="#64748B" />}
                          {p.trend === 'new' && <span style={{ fontSize: 12, color: '#2563EB', fontWeight: 600 }}>NEW</span>}
                        </td>
                      </tr>
                    )
                  })}
                  {data.rankingTable.length === 0 && (
                    <tr><td colSpan="7" style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>No demand data!</td></tr>
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

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  BarChart2, Calendar, Download, TrendingUp, AlertCircle,
  Package, Receipt, Users, FileText, CheckCircle, FileCheck,
  RefreshCw, Copy, Archive, Grid, ChevronDown, ChevronRight,
  Activity, Search, ArrowLeft, DollarSign, ShoppingCart
} from 'lucide-react'
import { backendFetch } from '../../utils/backend'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line } from 'recharts'
import { exportToPDF, exportToExcel } from '../../utils/exportUtils'
import DateRangePicker, { getDateRange } from '../ui/DateRangePicker'
import ExportButton from '../ui/ExportButton'

// Common Chart Styling
const CHART_COLORS = ['#38BDF8', '#8B5CF6', '#2563EB', '#F59E0B', '#EF4444', '#6366F1', '#EC4899', '#14B8A6'];
const axisStyle = { tick: { fontSize: 12, fill: '#64748B' }, axisLine: { stroke: '#E2E8F0' }, tickLine: false };
const gridStyle = { strokeDasharray: '3 3', stroke: '#F1F5F9', vertical: false };
const tooltipStyle = {
  contentStyle: {
    background: 'white',
    border: '1px solid #E2E8F0',
    borderRadius: 8,
    color: '#0F172A',
    fontSize: 12,
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
  },
  itemStyle: { color: '#0F172A', fontWeight: 600 }
};

const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

export default function SalesReport({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dateRange, setDateRange] = useState('month')
  const [customFrom, setCustomFrom] = useState(null)
  const [customTo, setCustomTo] = useState(null)
  const [category, setCategory] = useState('All Categories')
  const [categories, setCategories] = useState(['All Categories']);
  
  const reportRef = useRef(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const invRes = await backendFetch('/inventory');
        const cats = ['All Categories', ...new Set((invRes.items || []).map(i => i.category).filter(Boolean))].sort();
        setCategories(cats);
      } catch (err) { console.error('Failed to load categories', err); }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchData();
  }, [dateRange, customFrom, customTo, category]);

  const fetchData = async () => {
    let from, to;

    if (dateRange !== 'custom') {
      const range = getDateRange(dateRange)
      from = range.from
      to = range.to
    } else {
      if (!customFrom || !customTo) {
        return
      }
      from = customFrom.toISOString()
      to = new Date(customTo.getTime() + 86399999).toISOString()
    }

    setLoading(true);
    try {
      let query = `?from=${from}&to=${to}`;
      if (category !== 'All Categories') query += `&category=${encodeURIComponent(category)}`;
      const res = await backendFetch(`/reports/sales${query}`);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!data) return;
    const fromDate = dateRange === 'Custom' ? customFrom : dateRange;
    const headers = ['Customer', 'Orders', 'Total Value', 'Avg Order', 'Last Order', 'Status'];
    const rows = data.customerSummary.map(c => [c.customer, c.orders, formatCurrency(c.total), formatCurrency(c.avgOrder), c.lastOrder, c.status]);
    exportToPDF('Sales Report - ' + fromDate, headers, rows, `Sales_Report_${fromDate}`);
  };

  const handleExportExcel = () => {
    if (!data) return;
    const fromDate = dateRange === 'Custom' ? customFrom : dateRange;
    exportToExcel(data.customerSummary, `Sales_Report_${fromDate}`);
  };

  return (
    <div className="sales-report-page" ref={reportRef} style={{ animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button 
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #E2E8F0', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#475569', transition: 'all 0.2s' }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.color = '#0F172A'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#475569'; }}
          >
            <ArrowLeft size={16} /> Back to Reports
          </button>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>Sales Report</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, outline: 'none', background: 'white', color: '#0F172A', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

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

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>
          <RefreshCw className="spin" size={24} style={{ marginBottom: 12, color: '#38BDF8' }} />
          <div>Generating Report...</div>
        </div>
      ) : !data ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#EF4444' }}>Failed to load data.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* ── KPI CARDS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38BDF8' }}>
                  <TrendingUp size={20} />
                </div>
                <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Sales</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#0F172A' }}>{formatCurrency(data.kpis.totalSales)}</div>
            </div>

            <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6' }}>
                  <ShoppingCart size={20} />
                </div>
                <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Orders</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#0F172A' }}>{data.kpis.totalOrders}</div>
            </div>

            <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
                  <Activity size={20} />
                </div>
                <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Order Value</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#0F172A' }}>{formatCurrency(data.kpis.avgOrderValue)}</div>
            </div>

            <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                  <DollarSign size={20} />
                </div>
                <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Profit (Est)</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#0F172A' }}>{formatCurrency(data.kpis.totalProfit)}</div>
            </div>
          </div>

          {/* ── CHARTS GRID ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
            
            {/* Sales Trend (Full Width) */}
            <div style={{ background: 'white', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Sales Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.trend}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="date" {...axisStyle} />
                  <YAxis {...axisStyle} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <RechartsTooltip {...tooltipStyle} formatter={(v) => [formatCurrency(v), 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="#38BDF8" strokeWidth={3} dot={data?.trend?.length > 24 ? false : { fill: '#38BDF8', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
              {/* Sales by Category */}
              <div style={{ background: 'white', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Sales by Category</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.byCategory}>
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="category" {...axisStyle} tick={{ fontSize: 11, fill: '#64748B' }} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis {...axisStyle} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <RechartsTooltip {...tooltipStyle} formatter={(v) => [formatCurrency(v), 'Revenue']} cursor={{ fill: '#F1F5F9' }} />
                    <Bar dataKey="revenue" radius={[4,4,0,0]} maxBarSize={40}>
                      {data.byCategory.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top Products */}
              <div style={{ background: 'white', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Top Selling Products</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.topProducts} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid {...gridStyle} horizontal={false}/>
                    <XAxis type="number" {...axisStyle} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={120} {...axisStyle} tick={{ fontSize: 11, fill: '#374151', fontWeight: 500 }} />
                    <RechartsTooltip {...tooltipStyle} cursor={{ fill: '#F1F5F9' }} formatter={(v) => [formatCurrency(v), 'Revenue']} />
                    <Bar dataKey="revenue" radius={[0,4,4,0]} maxBarSize={28}>
                      {data.topProducts.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Payment Methods */}
              <div style={{ background: 'white', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Payment Methods</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={data.paymentMethods}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                    >
                      {data.paymentMethods.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip {...tooltipStyle} formatter={(v) => formatCurrency(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── TABLE ── */}
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Customer Sales Summary</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table id="sales_report_table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#F8FAFC', fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <tr>
                    <th style={{ padding: '16px 24px', fontWeight: 600 }}>Customer</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600 }}>Orders</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600 }}>Total Value</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600 }}>Avg Order</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600 }}>Last Order</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customerSummary.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#0F172A', fontWeight: 500 }}>{c.customer}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#374151' }}>{c.orders}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#0F172A', fontWeight: 600 }}>{formatCurrency(c.total)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{formatCurrency(c.avgOrder)}</td>
                      <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748B' }}>{c.lastOrder}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#DCFCE7', color: '#166534' }}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {data.customerSummary.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>No sales data found for this period.</td>
                    </tr>
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

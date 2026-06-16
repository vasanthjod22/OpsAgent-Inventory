import { formatDate } from '../../utils/dateUtils';
import React, { useState, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, Download,
  BarChart3, Receipt, PieChart as PieChartIcon, Search, ArrowUpDown, Calendar
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import SummaryCard from '../SummaryCard'
import { useAppStore } from '../../store/appStore'

import { ANIMATION_DEFAULTS } from '../../utils/chartTheme';

const COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2']

export default function FinancePanel() {
  const { bills = [], transactions = [], purchaseOrders = [], inventory = [] } = useAppStore();
  const [activeTab, setActiveTab] = useState('Overview')
  
  // Year & Custom Mode Selector for YoY Comparison
  const [overviewMode, setOverviewMode] = useState('Year') // 'Year' | 'Custom'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  
  // Search & Sort for Operations
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState('date') // 'date' | 'amount'
  const [sortOrder, setSortOrder] = useState('desc') // 'asc' | 'desc'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // Tax Summary — period + custom date range
  const [taxPeriod, setTaxPeriod] = useState('This Year')
  const [taxStart, setTaxStart] = useState('')
  const [taxEnd, setTaxEnd] = useState('')

  const fmtINR = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  // --- LOGIC: Calculate Revenue, Expenses, Gross Flow by Date Range ---
  const getDashboardData = (mode, year, startStr, endStr) => {
    let revenue = 0
    let expenses = 0
    const monthlyDataMap = {}
    const categoryMap = {}

    let startDate, endDate;

    if (mode === 'Year') {
      startDate = new Date(year, 0, 1).getTime()
      endDate = new Date(year, 11, 31, 23, 59, 59, 999).getTime()
      for(let i=1; i<=12; i++) {
         monthlyDataMap[i.toString().padStart(2, '0')] = { 
           name: new Date(year, i-1, 1).toLocaleString('default', {month:'short'}),
           Revenue: 0, 
           Expenses: 0,
           sortIndex: i
         }
      }
    } else {
      startDate = startStr ? new Date(startStr).getTime() : 0
      endDate = endStr ? new Date(endStr).setHours(23,59,59,999) : new Date().getTime()
    }

    const inRange = (dStr) => {
      if(!dStr) return false;
      const t = new Date(dStr).getTime()
      return t >= startDate && t <= endDate;
    }

    const processDate = (dStr, amt, isRev, category = null) => {
      const dt = new Date(dStr);
      const y = dt.getFullYear();
      const m = dt.getMonth() + 1;
      
      let key, name, sortIndex;
      if (mode === 'Year') {
        key = m.toString().padStart(2, '0')
        name = new Date(y, m-1, 1).toLocaleString('default', {month:'short'})
        sortIndex = m
      } else {
        key = `${y}-${m.toString().padStart(2, '0')}`
        name = `${new Date(y, m-1, 1).toLocaleString('default', {month:'short'})} ${y}`
        sortIndex = y * 100 + m
      }
      
      if (!monthlyDataMap[key]) {
        monthlyDataMap[key] = { name, Revenue: 0, Expenses: 0, sortIndex }
      }
      
      if (isRev) {
        revenue += amt;
        monthlyDataMap[key].Revenue += amt;
      } else {
        expenses += amt;
        monthlyDataMap[key].Expenses += amt;
        if (category) {
          categoryMap[category] = (categoryMap[category] || 0) + amt
        }
      }
    }

    bills?.forEach(b => {
      if (inRange(b.date || b.createdAt) && (b.paymentStatus === 'Paid' || b.amountPaid > 0)) {
        const amt = b.paymentStatus === 'Paid' ? parseFloat(b.grandTotal) : parseFloat(b.amountPaid);
        processDate(b.date || b.createdAt, amt, true)

        let cogs = 0;
        (b.items || []).forEach(item => {
          const invItem = inventory?.find(i => i.id === item.inventoryId || (i.name?.toLowerCase() === item.description?.toLowerCase()) || (i.sku && i.sku === item.inventorySku));
          const costPrice = invItem?.cost_price || 0;
          const qty = Number(item.quantity || 0);
          cogs += (costPrice * qty);
        });
        if (cogs > 0) {
          processDate(b.date || b.createdAt, cogs, false, 'Cost of Goods Sold');
        }
      }
    })

    purchaseOrders?.forEach(po => {
      if (inRange(po.createdAt) && ['Approved', 'Partially Received', 'Fully Received'].includes(po.status)) {
        const amt = parseFloat(po.grandTotal) || 0
        processDate(po.createdAt, amt, false, 'Purchases (POs)')
      }
    })

    transactions?.forEach(t => {
      if (inRange(t.date || t.createdAt)) {
        const amt = parseFloat(t.amount) || 0
        if (t.type === 'Expense') {
          processDate(t.date || t.createdAt, amt, false, t.category || 'Other Expenses')
        } else if (t.type === 'Income') {
          processDate(t.date || t.createdAt, amt, true)
        }
      }
    })
    
    const monthlyData = Object.values(monthlyDataMap).sort((a,b) => a.sortIndex - b.sortIndex)
    const categoryData = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value)
    
    return { revenue, expenses, net: revenue - expenses, monthlyData, categoryData }
  }

  const currentOverview = useMemo(() => getDashboardData(overviewMode, selectedYear, customStart, customEnd), 
    [bills, purchaseOrders, transactions, inventory, overviewMode, selectedYear, customStart, customEnd])

  const previousOverview = useMemo(() => {
    if (overviewMode === 'Year') {
      return getDashboardData('Year', selectedYear - 1, null, null)
    } else {
      if (!customStart && !customEnd) return getDashboardData('Custom', null, null, null);
      const s = customStart ? new Date(new Date(customStart).setFullYear(new Date(customStart).getFullYear() - 1)).toISOString().split('T')[0] : ''
      const e = customEnd ? new Date(new Date(customEnd).setFullYear(new Date(customEnd).getFullYear() - 1)).toISOString().split('T')[0] : ''
      return getDashboardData('Custom', null, s, e)
    }
  }, [bills, purchaseOrders, transactions, inventory, overviewMode, selectedYear, customStart, customEnd])

  const yoyDifference = currentOverview.net - previousOverview.net
  const isProfitGrowth = yoyDifference >= 0

  // --- LOGIC: Operations List ---
  const operationsList = useMemo(() => {
    let ops = []
    bills?.forEach(b => {
      if (b.paymentStatus === 'Paid' || b.amountPaid > 0) {
        const amt = b.paymentStatus === 'Paid' ? parseFloat(b.grandTotal) : parseFloat(b.amountPaid)
        ops.push({
          id: b.id, type: 'Revenue', source: 'Bill', description: b.customerName || 'Customer Bill',
          date: b.date || b.createdAt, amount: amt, status: b.paymentStatus
        })

        let cogs = 0;
        (b.items || []).forEach(item => {
          const invItem = inventory?.find(i => i.id === item.inventoryId || (i.name?.toLowerCase() === item.description?.toLowerCase()) || (i.sku && i.sku === item.inventorySku));
          const costPrice = invItem?.cost_price || 0;
          const qty = Number(item.quantity || 0);
          cogs += (costPrice * qty);
        });
        if (cogs > 0) {
          ops.push({
            id: b.id + '_cogs', type: 'Expense', source: 'COGS', description: `Cost of Goods Sold (${b.customerName || 'Bill'})`,
            date: b.date || b.createdAt, amount: cogs, status: 'Completed'
          })
        }
      }
    })
    purchaseOrders?.forEach(po => {
      if (['Approved', 'Partially Received', 'Fully Received'].includes(po.status)) {
        ops.push({
          id: po.id, type: 'Expense', source: 'PO', description: po.supplierName || 'Purchase Order',
          date: po.createdAt, amount: parseFloat(po.grandTotal) || 0, status: po.status
        })
      }
    })
    transactions?.forEach(t => {
      ops.push({
        id: t.id, type: t.type === 'Income' ? 'Revenue' : 'Expense', source: 'Transaction', 
        description: t.description || t.category || 'Manual Entry',
        date: t.date || t.createdAt, amount: parseFloat(t.amount) || 0, status: 'Completed'
      })
    })

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      ops = ops.filter(o => 
        o.description.toLowerCase().includes(q) || 
        o.source.toLowerCase().includes(q) || 
        o.type.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
      )
    }

    if (startDate) {
      const start = new Date(startDate).getTime()
      ops = ops.filter(o => new Date(o.date).getTime() >= start)
    }

    if (endDate) {
      const end = new Date(endDate).setHours(23, 59, 59, 999)
      ops = ops.filter(o => new Date(o.date).getTime() <= end)
    }

    ops.sort((a, b) => {
      let valA = a[sortField]
      let valB = b[sortField]
      if (sortField === 'date') {
        valA = new Date(valA).getTime()
        valB = new Date(valB).getTime()
      }
      if (sortOrder === 'asc') return valA > valB ? 1 : -1
      return valA < valB ? 1 : -1
    })

    return ops
  }, [bills, purchaseOrders, transactions, inventory, searchQuery, sortField, sortOrder, startDate, endDate])

  // --- LOGIC: Tax Summary ---
  const taxSummary = useMemo(() => {
    let totalTaxable = 0, totalCGST = 0, totalSGST = 0
    const rates = {}
    const hsnMap = {}

    const now = new Date()
    const periodBills = bills.filter(d => {
      if (!d.date && !d.createdAt) return false
      const dt = new Date(d.date || d.createdAt)
      if (taxPeriod === 'Custom Range') {
        const s = taxStart ? new Date(taxStart).getTime() : 0
        const e = taxEnd ? new Date(taxEnd).setHours(23,59,59,999) : now.getTime()
        const t = dt.getTime()
        return t >= s && t <= e
      }
      if (taxPeriod === 'This Month') return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()
      if (taxPeriod === 'This Year') return dt.getFullYear() === now.getFullYear()
      if (taxPeriod === 'All Time') return true
      return true
    })

    periodBills.forEach(b => {
      (b.items || []).forEach(it => {
        const qty = parseFloat(it.quantity) || 0
        const rate = parseFloat(it.rate) || 0
        const cP = parseFloat(it.cgstPercent) || 0
        const sP = parseFloat(it.sgstPercent) || 0
        const gstP = parseFloat(it.gstPercent) || (cP + sP)
        
        const taxable = qty * rate
        const cgst = taxable * cP / 100
        const sgst = taxable * sP / 100

        totalTaxable += taxable
        totalCGST += cgst
        totalSGST += sgst

        if (!rates[gstP]) rates[gstP] = { count: new Set(), taxable: 0, cgst: 0, sgst: 0 }
        rates[gstP].count.add(b.id)
        rates[gstP].taxable += taxable
        rates[gstP].cgst += cgst
        rates[gstP].sgst += sgst

        if (it.hsnCode) {
          if (!hsnMap[it.hsnCode]) hsnMap[it.hsnCode] = { desc: it.description, qty: 0, taxable: 0, gstP, tax: 0 }
          hsnMap[it.hsnCode].qty += qty
          hsnMap[it.hsnCode].taxable += taxable
          hsnMap[it.hsnCode].tax += (cgst + sgst)
        }
      })
    })
    return { totalTaxable, totalCGST, totalSGST, rates, hsnMap, count: periodBills.length }
  }, [bills, taxPeriod, taxStart, taxEnd])

  const TABS = [
    { id: 'Overview', icon: BarChart3 },
    { id: 'Operations', icon: Receipt },
    { id: 'Tax Summary', icon: PieChartIcon }
  ]

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '10px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <p style={{ fontWeight: 600, marginBottom: '4px' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color, fontSize: '13px' }}>
              {entry.name}: ₹{fmtINR(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const inputStyle = { padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', background: 'var(--bg-card)', fontSize: '13px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      
      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', borderRadius: '8px',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              background: activeTab === tab.id ? '#2563EB' : 'white',
              color: activeTab === tab.id ? 'white' : '#1E293B',
              border: activeTab === tab.id ? '1px solid #2563EB' : '1px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            <tab.icon size={16} /> {tab.id}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Financial Overview</h2>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <Calendar size={18} color="#334155"/>
               <select 
                 value={overviewMode === 'Year' ? selectedYear : 'Custom'} 
                 onChange={e => {
                   if (e.target.value === 'Custom') {
                     setOverviewMode('Custom');
                     if (!customStart) {
                       const d = new Date(); d.setDate(1);
                       setCustomStart(d.toISOString().split('T')[0])
                       setCustomEnd(new Date().toISOString().split('T')[0])
                     }
                   } else {
                     setOverviewMode('Year');
                     setSelectedYear(parseInt(e.target.value));
                   }
                 }} 
                 style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', background: 'var(--bg-card)', fontWeight: 600 }}
               >
                 <option value="Custom">Custom Range</option>
                 {[0, 1, 2, 3, 4].map(offset => {
                   const y = new Date().getFullYear() - offset;
                   return <option key={y} value={y}>{y}</option>
                 })}
               </select>

               {overviewMode === 'Custom' && (
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={inputStyle} />
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>to</span>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={inputStyle} />
                 </div>
               )}
             </div>
          </div>

          {/* Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <SummaryCard icon={TrendingUp} title="Total Revenue" value={`₹${fmtINR(currentOverview.revenue)}`} trend="neutral" trendValue={overviewMode === 'Year' ? `Year ${selectedYear}` : 'Custom Range'} colors={{ bg: '#F0FDF4', text: '#16A34A' }} />
            <SummaryCard icon={TrendingDown} title="Total Expenses" value={`₹${fmtINR(currentOverview.expenses)}`} trend="neutral" trendValue={overviewMode === 'Year' ? `Year ${selectedYear}` : 'Custom Range'} colors={{ bg: '#FEF2F2', text: '#DC2626' }} />
            <div style={{ padding: '24px', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: currentOverview.net >= 0 ? '#16A34A' : '#DC2626', textTransform: 'uppercase' }}>
                {currentOverview.net >= 0 ? 'Net Profit' : 'Net Loss'}
              </span>
              <span style={{ fontSize: '28px', fontWeight: 800, color: currentOverview.net >= 0 ? '#16A34A' : '#DC2626' }}>
                {currentOverview.net < 0 ? '-' : ''}₹{fmtINR(Math.abs(currentOverview.net))}
              </span>
            </div>
          </div>

          {/* YoY Comparison */}
          <div style={{ background: isProfitGrowth ? '#F0FDF4' : '#FEF2F2', borderRadius: '12px', border: `1px solid ${isProfitGrowth ? '#BBF7D0' : '#FECACA'}`, padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: isProfitGrowth ? '#15803D' : '#B91C1C', marginBottom: '4px' }}>
                  Year-over-Year (YoY) Performance
                </h3>
                <p style={{ fontSize: '14px', color: isProfitGrowth ? '#16A34A' : '#DC2626' }}>
                  Comparing Net Profit/Loss of {overviewMode === 'Year' ? selectedYear : 'selected range'} vs {overviewMode === 'Year' ? selectedYear - 1 : 'previous year'}.
                </p>
             </div>
             <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '24px', fontWeight: 800, color: isProfitGrowth ? '#15803D' : '#B91C1C' }}>
                   {isProfitGrowth ? '+' : '-'} ₹{fmtINR(Math.abs(yoyDifference))}
                </span>
             </div>
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px', minHeight: '350px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '24px', color: 'var(--text-primary)' }}>Monthly Cash Flow</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={currentOverview.monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#334155' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#334155' }} tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                  <Bar {...ANIMATION_DEFAULTS} dataKey="Revenue" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar {...ANIMATION_DEFAULTS} dataKey="Expenses" fill="#DC2626" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px', minHeight: '350px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '24px', color: 'var(--text-primary)' }}>Expenses Breakdown</h3>
              {currentOverview.categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie {...ANIMATION_DEFAULTS}
                      data={currentOverview.categoryData}
                      cx="50%" cy="45%"
                      innerRadius={60} outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {currentOverview.categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `₹${fmtINR(value)}`} />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                  No expenses recorded this year
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Operations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={16} color="#334155" style={{ position: 'absolute', left: '12px', top: '10px' }} />
              <input
                type="text"
                placeholder="Search transactions, POs, bills..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '36px', height: '36px' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="input-field"
                style={{ height: '36px', padding: '0 12px' }}
                title="Start Date"
              />
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>—</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="input-field"
                style={{ height: '36px', padding: '0 12px' }}
                title="End Date"
              />
              
              <div style={{ width: '1px', height: '24px', background: '#E2E8F0', margin: '0 8px' }} />

              <select value={sortField} onChange={e => setSortField(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', height: '36px' }}>
                <option value="date">Sort by Date</option>
                <option value="amount">Sort by Amount</option>
              </select>
              <button 
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                style={{ padding: '6px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <ArrowUpDown size={14} color="#334155" />
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{sortOrder.toUpperCase()}</span>
              </button>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 700 }}>Date</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 700 }}>Source</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 700 }}>Description</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 700, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {operationsList.map((op, i) => (
                  <tr key={`${op.id}-${i}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{formatDate(op.date)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
                        {op.source}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-primary)' }}>{op.description}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{op.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: op.type === 'Revenue' ? '#16A34A' : '#DC2626' }}>
                      {op.type === 'Revenue' ? '+' : '-'} ₹{fmtINR(op.amount)}
                    </td>
                  </tr>
                ))}
                {operationsList.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Tax Summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* ── Tax Period Controls ── */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} color="#334155" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Period:</span>
            </div>
            
            {/* Quick period buttons */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {['This Month', 'This Year', 'All Time', 'Custom Range'].map(p => (
                <button
                  key={p}
                  onClick={() => setTaxPeriod(p)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: `1.5px solid ${taxPeriod === p ? '#2563EB' : '#E2E8F0'}`,
                    background: taxPeriod === p ? '#EFF6FF' : 'white',
                    color: taxPeriod === p ? '#2563EB' : '#1E293B',
                    fontWeight: taxPeriod === p ? 700 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Custom date range pickers — show only when Custom Range selected */}
            {taxPeriod === 'Custom Range' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '4px' }}>
                <input
                  type="date"
                  value={taxStart}
                  onChange={e => setTaxStart(e.target.value)}
                  style={inputStyle}
                  title="From"
                />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }}>to</span>
                <input
                  type="date"
                  value={taxEnd}
                  onChange={e => setTaxEnd(e.target.value)}
                  style={inputStyle}
                  title="To"
                />
                {(taxStart || taxEnd) && (
                  <button
                    onClick={() => { setTaxStart(''); setTaxEnd('') }}
                    style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* Bill count badge */}
            <div style={{ marginLeft: 'auto', background: 'var(--bg-main)', borderRadius: '8px', padding: '4px 12px', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {taxSummary.count} bill{taxSummary.count !== 1 ? 's' : ''} in period
            </div>
          </div>

          {/* ── Summary Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <SummaryCard icon={DollarSign} title="Taxable Amount" value={`₹${fmtINR(taxSummary.totalTaxable)}`} trend="neutral" trendValue={taxPeriod} colors={{ bg: '#EFF6FF', text: '#2563EB' }} />
            <SummaryCard icon={Receipt} title="CGST Collected" value={`₹${fmtINR(taxSummary.totalCGST)}`} trend="neutral" trendValue={taxPeriod} colors={{ bg: '#F3E8FF', text: '#9333EA' }} />
            <SummaryCard icon={Receipt} title="SGST Collected" value={`₹${fmtINR(taxSummary.totalSGST)}`} trend="neutral" trendValue={taxPeriod} colors={{ bg: '#EEF2FF', text: '#4F46E5' }} />
            <SummaryCard icon={Receipt} title="Total GST Collected" value={`₹${fmtINR(taxSummary.totalCGST + taxSummary.totalSGST)}`} trend="neutral" trendValue={taxPeriod} colors={{ bg: '#F0FDF4', text: '#16A34A' }} />
          </div>

          {/* ── Rate Breakdown Table ── */}
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Tax Rate Breakdown</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left' }}>
                  {['GST Rate', 'No. of Bills', 'Taxable Amt', 'CGST', 'SGST', 'Total Tax'].map(h => (
                    <th key={h} style={{ padding: '10px 8px', color: 'var(--text-primary)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(taxSummary.rates).map(([r, v]) => (
                  <tr key={r} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <span style={{ background: '#EFF6FF', color: '#2563EB', padding: '3px 8px', borderRadius: '6px', fontSize: '12px' }}>{r}%</span>
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500 }}>{v.count.size}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500 }}>₹{fmtINR(v.taxable)}</td>
                    <td style={{ padding: '12px 8px', color: '#7C3AED', fontWeight: 600 }}>₹{fmtINR(v.cgst)}</td>
                    <td style={{ padding: '12px 8px', color: '#4F46E5', fontWeight: 600 }}>₹{fmtINR(v.sgst)}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 800, color: '#16A34A' }}>₹{fmtINR(v.cgst + v.sgst)}</td>
                  </tr>
                ))}
                {Object.keys(taxSummary.rates).length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No tax data for this period.</td>
                  </tr>
                )}
                <tr style={{ background: 'var(--bg-main)', borderTop: '2px solid #CBD5E1' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 800, color: 'var(--text-primary)' }}>TOTAL</td>
                  <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--text-primary)' }}>{taxSummary.count}</td>
                  <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--text-primary)' }}>₹{fmtINR(taxSummary.totalTaxable)}</td>
                  <td style={{ padding: '12px 8px', fontWeight: 700, color: '#7C3AED' }}>₹{fmtINR(taxSummary.totalCGST)}</td>
                  <td style={{ padding: '12px 8px', fontWeight: 700, color: '#4F46E5' }}>₹{fmtINR(taxSummary.totalSGST)}</td>
                  <td style={{ padding: '12px 8px', fontWeight: 800, color: '#16A34A', fontSize: '15px' }}>₹{fmtINR(taxSummary.totalCGST + taxSummary.totalSGST)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}

import { formatDate } from '../../utils/dateUtils';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShoppingCart, Plus, Download, Trash2, Search, Edit2, 
  CheckCircle, Clock, AlertTriangle, FileText, Check, DollarSign, X
} from 'lucide-react';

import SummaryCard from '../SummaryCard';
import { callAI } from '../../utils/api';
import { backendFetch } from '../../utils/backend';
import { useAppStore } from '../../store/appStore';

const STATUS_COLORS = {
  'Draft': '#64748B',
  'Sent': '#2563EB',
  'Acknowledged': '#7C3AED',
  'Partially Received': '#D97706',
  'Fully Received': '#16A34A',
  'Cancelled': '#DC2626'
};

const STATUS_BGS = {
  'Draft': '#F1F5F9',
  'Sent': '#EFF6FF',
  'Acknowledged': '#F5F3FF',
  'Partially Received': '#FFFBEB',
  'Fully Received': '#F0FDF4',
  'Cancelled': '#FEF2F2'
};

const INITIAL_ITEM = { description: '', hsn: '', qty: 1, unit: 'Nos', rate: 0, amount: 0 };

export default function PurchaseOrdersPanel({ refreshData }) {
  const { purchaseOrders = [], inventory = [] } = useAppStore();
  const [activeTab, setActiveTab] = useState('history');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [companySettings, setCompanySettings] = useState(null);

  // Form State
  const [poNumber, setPoNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [items, setItems] = useState([{ ...INITIAL_ITEM }]);
  const [taxAmount, setTaxAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30 days');

  // Supplier Autocomplete
  const [showSupplierSuggest, setShowSupplierSuggest] = useState(false);

  useEffect(() => {
    fetchCompanySettings();
  }, []);

  const fetchCompanySettings = async () => {
    try {
      const data = await backendFetch('/company');
      setCompanySettings(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const handleCreatePOFromAI = (e) => {
      const lowStockItems = e.detail?.items || [];
      if (lowStockItems.length > 0) {
        const newItems = lowStockItems.map(item => ({
          ...INITIAL_ITEM,
          description: item.name,
          unit: item.unit || 'Nos',
          qty: (item.min || 0) - (item.qty || 0) > 0 ? (item.min || 0) - (item.qty || 0) : 1
        }));
        setItems(newItems);
      } else {
        setItems([{ ...INITIAL_ITEM }]);
      }
      // Cannot call generatePONumber inside useEffect if it's missing deps, but it relies on purchaseOrders.length
      setPoNumber(`PO-${new Date().getFullYear()}-${String(purchaseOrders.length + 1).padStart(4, '0')}`);
      setActiveTab('create');
    };

    window.addEventListener('createPOFromAI', handleCreatePOFromAI);
    return () => window.removeEventListener('createPOFromAI', handleCreatePOFromAI);
  }, [purchaseOrders.length]);

  const generatePONumber = () => {
    const next = purchaseOrders.length + 1;
    const padded = String(next).padStart(4, '0');
    const year = new Date().getFullYear();
    return `PO-${year}-${padded}`;
  };

  const handleCreateNew = () => {
    document.getElementById('main-scroll-area')?.firstElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPoNumber(generatePONumber());
    setSupplierName('');
    setSupplierPhone('');
    setSupplierEmail('');
    setSupplierAddress('');
    setExpectedDate('');
    setItems([{ ...INITIAL_ITEM }]);
    setTaxAmount(0);
    setNotes('');
    setPaymentTerms('30 days');
    setActiveTab('create');
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.rate)), 0);
  const grandTotal = subtotal + Number(taxAmount);

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    if (field === 'qty' || field === 'rate') {
      newItems[index].amount = Number(newItems[index].qty) * Number(newItems[index].rate);
    }
    setItems(newItems);
  };

  const addItem = () => setItems([...items, { ...INITIAL_ITEM }]);
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  const handleSave = async (status = 'Draft') => {
    if (!supplierName) {
      alert('Supplier name is required');
      return;
    }

    const payload = {
      supplierName, supplierPhone, supplierEmail, supplierAddress,
      expectedDate, items, subtotal, taxAmount, grandTotal,
      notes, paymentTerms, status
    };

    try {
      await backendFetch('/purchase-orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      await refreshData();
      setActiveTab('history');
    } catch (err) {
      console.error(err);
      alert('Error saving PO: ' + err.message);
    }
  };

  const handleChangeStatus = async (id, newStatus) => {
    try {
      await backendFetch(`/purchase-orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    document.getElementById('main-scroll-area')?.firstElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!confirm('Are you sure you want to delete this PO?')) return;
    try {
      await backendFetch(`/purchase-orders/${id}`, {
        method: 'DELETE'
      });
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const generatePDF = async (poData, shouldDownload = true) => {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF();
    const data = poData || { poNumber, supplierName, supplierPhone, supplierEmail, supplierAddress, expectedDate, items, subtotal, taxAmount, grandTotal, notes, paymentTerms, createdAt: new Date() };
    
    // Header (dark navy)
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(companySettings?.companyName || 'YOUR COMPANY', 15, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(companySettings?.companyAddress || '', 15, 28);
    if (companySettings?.gstin) doc.text(`GSTIN: ${companySettings.gstin}`, 15, 34);

    // Right Side Header
    doc.setTextColor(56, 189, 248); // Light Blue
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('PURCHASE ORDER', 195, 20, { align: 'right' });
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`PO No: ${data.poNumber}`, 195, 28, { align: 'right' });
    doc.text(`Date: ${formatDate(data.createdAt)}`, 195, 34, { align: 'right' });

    // Supplier Box
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SUPPLIER:', 15, 55);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(data.supplierName || '', 15, 62);
    if (data.supplierAddress) doc.text(data.supplierAddress, 15, 68);
    if (data.supplierPhone) doc.text(`Phone: ${data.supplierPhone}`, 15, 74);
    if (data.supplierEmail) doc.text(`Email: ${data.email}`, 15, 80);

    // PO Details (Right side under header)
    doc.setFont('helvetica', 'bold');
    doc.text('Expected Delivery:', 120, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(data.expectedDate ? formatDate(data.expectedDate) : 'TBD', 120, 62);

    doc.setFont('helvetica', 'bold');
    doc.text('Payment Terms:', 120, 68);
    doc.setFont('helvetica', 'normal');
    doc.text(data.paymentTerms || '', 120, 74);

    // Items Table
    const tableData = data.items.map((item, index) => [
      index + 1,
      item.description,
      item.hsn || '',
      item.qty,
      item.unit,
      Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    ]);

    doc.autoTable({
      startY: 95,
      head: [['S.No', 'Description', 'HSN', 'Qty', 'Unit', 'Rate', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 25 },
        3: { cellWidth: 20, halign: 'right' },
        4: { cellWidth: 20 },
        5: { cellWidth: 30, halign: 'right' },
        6: { cellWidth: 30, halign: 'right' }
      }
    });

    const finalY = doc.lastAutoTable.finalY + 10;

    // Notes & Payment Terms
    if (data.notes) {
      doc.setFont('helvetica', 'bold');
      doc.text('Notes:', 15, finalY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const splitNotes = doc.splitTextToSize(data.notes, 100);
      doc.text(splitNotes, 15, finalY + 6);
    }

    // Totals Box (Right)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Subtotal:', 140, finalY);
    doc.text('Tax Amount:', 140, finalY + 8);
    doc.setFontSize(12);
    doc.text('Grand Total:', 140, finalY + 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(Number(data.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 195, finalY, { align: 'right' });
    doc.text(Number(data.taxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 195, finalY + 8, { align: 'right' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rs. ${Number(data.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 195, finalY + 18, { align: 'right' });

    // Footer
    const footerY = 270;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('For ' + (companySettings?.companyName || 'Company Name'), 195, footerY - 15, { align: 'right' });
    doc.text('Authorised Signatory', 195, footerY, { align: 'right' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('This is a computer generated Purchase Order', 105, 290, { align: 'center' });

    if (shouldDownload) {
      const dateStr = formatDate(new Date()).replace(/\//g, '');
      const cleanSupplier = (data.supplierName || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`${cleanSupplier}_PO_${dateStr}.pdf`);
    }
  };

  const handleGenerateAndDownload = async () => {
    await handleSave('Sent');
    generatePDF();
  };

  // Autocomplete helpers
  const uniqueSuppliers = useMemo(() => {
    const suppliers = purchaseOrders.map(p => ({
      name: p.supplierName, phone: p.supplierPhone, email: p.supplierEmail, address: p.supplierAddress
    }));
    return Array.from(new Map(suppliers.map(s => [s.name, s])).values()).filter(s => s.name);
  }, [purchaseOrders]);

  const filteredSuppliers = uniqueSuppliers.filter(s => s.name.toLowerCase().includes(supplierName.toLowerCase()));

  // Stats
  const today = new Date().toISOString().split('T')[0];
  const totalPOs = purchaseOrders.length;
  const pendingPOs = purchaseOrders.filter(p => ['Draft', 'Sent'].includes(p.status)).length;
  const overduePOs = purchaseOrders.filter(p => p.expectedDate && p.expectedDate < today && !['Fully Received', 'Cancelled'].includes(p.status)).length;
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const thisMonthValue = purchaseOrders.filter(p => {
    const d = new Date(p.createdAt);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear && p.status !== 'Cancelled';
  }).reduce((sum, p) => sum + Number(p.grandTotal), 0);

  const filteredPos = purchaseOrders.filter(p => {
    const matchesSearch = p.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()) || p.poNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      
      {/* SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <SummaryCard 
          icon={ShoppingCart} 
          title="Total POs" 
          value={totalPOs.toString()} 
          colors={{ bg: '#EFF6FF', text: '#2563EB' }} 
        />
        <SummaryCard 
          icon={Clock} 
          title="Pending" 
          value={pendingPOs.toString()} 
          colors={{ bg: '#FFFBEB', text: '#D97706' }} 
        />
        <SummaryCard 
          icon={AlertTriangle} 
          title="Overdue" 
          value={overduePOs.toString()} 
          colors={{ bg: '#FEF2F2', text: '#DC2626' }} 
        />
        <SummaryCard 
          icon={DollarSign} 
          title="This Month Value" 
          value={`₹${thisMonthValue.toLocaleString('en-IN')}`} 
          colors={{ bg: '#F0FDF4', text: '#16A34A' }} 
        />
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('history')}
          className={`btn-press ${activeTab === 'history' ? 'active-tab' : ''}`}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'history' ? '#2563EB' : 'transparent',
            color: activeTab === 'history' ? 'white' : '#64748B',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <FileText size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: '-3px' }} />
          PO History
        </button>
        <button
          onClick={handleCreateNew}
          className={`btn-press ${activeTab === 'create' ? 'active-tab' : ''}`}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'create' ? '#2563EB' : 'transparent',
            color: activeTab === 'create' ? 'white' : '#64748B',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <Plus size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: '-3px' }} />
          Create PO
        </button>
      </div>

      {activeTab === 'history' ? (
        <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input 
                type="text" 
                placeholder="Search POs..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ padding: '10px 16px 10px 36px', borderRadius: '8px', border: '1px solid var(--border)', width: '250px' }}
              />
            </div>
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
            >
              <option value="All">All Status</option>
              {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>PO No.</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Supplier</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Expected</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Items</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Amount</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Status</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPos.map((po) => (
                  <tr key={po.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover-bg">
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{po.poNumber}</td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>{po.supplierName}</td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {po.expectedDate ? formatDate(po.expectedDate) : '-'}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>{po.items.length}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                      ₹{Number(po.grandTotal).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '99px', 
                        fontSize: '11px', 
                        fontWeight: 600,
                        background: STATUS_BGS[po.status] || '#F1F5F9',
                        color: STATUS_COLORS[po.status] || '#64748B'
                      }}>
                        {po.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <select 
                          value={po.status}
                          onChange={(e) => handleChangeStatus(po.id, e.target.value)}
                          style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px' }}
                        >
                          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button 
                          onClick={() => generatePDF(po)}
                          className="btn-press" 
                          style={{ background: '#EFF6FF', color: '#2563EB', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                          title="Download PDF"
                        >
                          <Download size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(po.id)}
                          className="btn-press" 
                          style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPos.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                No Purchase Orders found.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '32px', borderRadius: '16px', maxWidth: '1000px', margin: '0 auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid #F1F5F9' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Create Purchase Order</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Issue a new PO to a supplier.</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>PO Number</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#2563EB' }}>{poNumber}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
            {/* Supplier Info */}
            <div style={{ background: 'var(--bg-main)', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '16px' }}>Supplier Details</h3>
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <input 
                  type="text" placeholder="Supplier Name *" 
                  value={supplierName} 
                  onChange={e => { setSupplierName(e.target.value); setShowSupplierSuggest(true); }}
                  onFocus={() => setShowSupplierSuggest(true)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
                {showSupplierSuggest && filteredSuppliers.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', zIndex: 10, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                    {filteredSuppliers.map((s, i) => (
                      <div 
                        key={i} 
                        onClick={() => {
                          setSupplierName(s.name); setSupplierPhone(s.phone); setSupplierEmail(s.email); setSupplierAddress(s.address);
                          setShowSupplierSuggest(false);
                        }}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                        className="hover-bg"
                      >
                        <div style={{ fontWeight: 500, fontSize: '13px' }}>{s.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.phone}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input 
                type="text" placeholder="Phone (Optional)" value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '12px' }}
              />
              <input 
                type="email" placeholder="Email (Optional)" value={supplierEmail} onChange={e => setSupplierEmail(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '12px' }}
              />
              <textarea 
                placeholder="Supplier Address (Optional)" value={supplierAddress} onChange={e => setSupplierAddress(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', minHeight: '60px' }}
              />
            </div>

            {/* PO Info */}
            <div style={{ background: 'var(--bg-main)', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '16px' }}>PO Details</h3>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Expected Delivery Date</label>
              <input 
                type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px' }}
              />
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Payment Terms</label>
              <select 
                value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}
              >
                <option value="Advance">Advance</option>
                <option value="On delivery">On delivery</option>
                <option value="15 days">15 days</option>
                <option value="30 days">30 days</option>
                <option value="45 days">45 days</option>
                <option value="60 days">60 days</option>
              </select>
            </div>
          </div>

          {/* Line Items */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Line Items</h3>
            
            <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--bg-main)' }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: 'var(--text-muted)', width: '40%' }}>Description</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: 'var(--text-muted)', width: '15%' }}>HSN</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: 'var(--text-muted)', width: '10%' }}>Qty</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: 'var(--text-muted)', width: '10%' }}>Unit</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: 'var(--text-muted)', width: '15%' }}>Rate</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: 'var(--text-muted)', width: '10%' }}>Amount</th>
                    <th style={{ padding: '12px', width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px' }}>
                        <input 
                          type="text" value={item.description}
                          onChange={e => handleItemChange(index, 'description', e.target.value)}
                          placeholder="Item description"
                          list="inv-items"
                          onBlur={(e) => {
                            const found = inventory.find(i => i.name === e.target.value);
                            if (found) {
                              handleItemChange(index, 'hsn', found.hsn || '');
                              handleItemChange(index, 'unit', found.unit || 'Nos');
                              // Rate usually fetched from last purchase or item cost, using 0 for now as inventory has qty not price generally unless price added
                            }
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px' }}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input 
                          type="text" value={item.hsn}
                          onChange={e => handleItemChange(index, 'hsn', e.target.value)}
                          style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px' }}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input 
                          type="number" min="1" value={item.qty}
                          onChange={e => handleItemChange(index, 'qty', e.target.value)}
                          style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input 
                          type="text" value={item.unit}
                          onChange={e => handleItemChange(index, 'unit', e.target.value)}
                          style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px' }}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input 
                          type="number" min="0" value={item.rate}
                          onChange={e => handleItemChange(index, 'rate', e.target.value)}
                          style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                        {Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        {items.length > 1 && (
                          <button onClick={() => removeItem(index)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer' }}>
                            <X size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '12px', background: 'var(--bg-main)', borderTop: '1px solid var(--border)' }}>
                <button 
                  onClick={addItem}
                  className="btn-press"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', color: '#2563EB', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                >
                  <Plus size={16} /> Add Line Item
                </button>
              </div>
            </div>

            <datalist id="inv-items">
              {inventory.map((inv, i) => <option key={i} value={inv.name} />)}
            </datalist>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '40px' }}>
            {/* Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Terms & Notes</label>
              <textarea 
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Additional terms and conditions..."
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', minHeight: '100px', fontSize: '13px' }}
              />
            </div>

            {/* Totals */}
            <div style={{ background: 'var(--bg-main)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px', color: 'var(--text-muted)' }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: 600 }}>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px', color: 'var(--text-muted)', alignItems: 'center' }}>
                <span>Tax Amount</span>
                <input 
                  type="number" value={taxAmount} onChange={e => setTaxAmount(e.target.value)}
                  style={{ width: '100px', padding: '6px 10px', textAlign: 'right', borderRadius: '6px', border: '1px solid var(--border)' }}
                />
              </div>
              <div style={{ height: '1px', background: '#E2E8F0', marginBottom: '16px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                <span>Grand Total</span>
                <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #F1F5F9' }}>
            <button 
              onClick={() => handleSave('Draft')}
              className="btn-press"
              style={{ padding: '12px 24px', background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
            >
              Save as Draft
            </button>
            <button 
              onClick={handleGenerateAndDownload}
              className="btn-press"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}
            >
              <CheckCircle size={18} />
              Generate & Download PDF
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

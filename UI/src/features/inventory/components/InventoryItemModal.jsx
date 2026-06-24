import React from 'react';
import { X } from 'lucide-react';
import { backendFetch } from '../../../utils/backend';

export default function InventoryItemModal({
  adding,
  setAdding,
  editingItemId,
  newItem,
  setNewItem,
  categories,
  units,
  handleAdd,
  fetchCategories,
  fetchUnits,
  FormAutocomplete
}) {
  if (!adding) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{editingItemId ? 'Edit Item' : 'Add New Item'}</h3>
          <button onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}><X size={20} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          {/* Row 1 */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>HSN / SKU</label>
            <input type="text" value={newItem.hsn || newItem.sku || ''} onChange={e => setNewItem({ ...newItem, hsn: e.target.value.toUpperCase() })} className="input-base" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>Item Name</label>
            <input type="text" value={newItem.name || ''} onChange={e => setNewItem({ ...newItem, name: e.target.value })} className="input-base" />
          </div>
          
          {/* Row 2 */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>Category</label>
            <FormAutocomplete
              value={newItem.category || ''}
              onChange={val => setNewItem({ ...newItem, category: val })}
              options={categories}
              placeholder="Select Category..."
              onAddOption={async (newCat) => {
                try {
                  await backendFetch('/inventory/categories', { method: 'POST', body: JSON.stringify({ name: newCat }) })
                  fetchCategories()
                } catch (e) { console.error(e) }
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>Supplier</label>
            <input type="text" value={newItem.supplier_name || ''} onChange={e => setNewItem({ ...newItem, supplier_name: e.target.value })} className="input-base" placeholder="Supplier Name" />
          </div>

          {/* Row 3 */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>Total / Opening Stock</label>
            <input type="number" value={newItem.total_qty ?? newItem.qty ?? ''} onChange={e => setNewItem({ ...newItem, total_qty: e.target.value, qty: e.target.value })} className="input-base" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>Unit</label>
            <FormAutocomplete
              value={newItem.unit || ''}
              onChange={val => setNewItem({ ...newItem, unit: val })}
              options={units}
              placeholder="Select Unit..."
              onAddOption={async (newUnit) => {
                try {
                  await backendFetch('/inventory/units', { method: 'POST', body: JSON.stringify({ name: newUnit }) })
                  fetchUnits()
                } catch (e) { console.error(e) }
              }}
            />
          </div>

          {/* Row 4 */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>Min Level</label>
            <input type="number" value={newItem.min ?? ''} onChange={e => setNewItem({ ...newItem, min: e.target.value })} className="input-base" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>Max Level</label>
            <input type="number" value={newItem.max ?? ''} onChange={e => setNewItem({ ...newItem, max: e.target.value })} className="input-base" />
          </div>

          {/* Row 5 */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>Reorder Qty</label>
            <input type="number" value={newItem.reorder_qty || ''} onChange={e => setNewItem({ ...newItem, reorder_qty: e.target.value })} className="input-base" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>Date Added</label>
            <input type="text" placeholder="DD-MM-YYYY or YYYY-MM-DD" value={newItem.date_added || ''} onChange={e => setNewItem({ ...newItem, date_added: e.target.value })} className="input-base" />
          </div>

          {/* Row 6 */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>Purchase Rate (₹)</label>
            <input type="number" step="any" value={newItem.rate || newItem.purchase_rate || ''} onChange={e => setNewItem({ ...newItem, rate: e.target.value, purchase_rate: e.target.value })} className="input-base" />
          </div>
          {/* Row 7 */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>CGST (%)</label>
            <input type="number" value={newItem.cgst_percent || ''} onChange={e => setNewItem({ ...newItem, cgst_percent: e.target.value, gst: Number(e.target.value || 0) + Number(newItem.sgst_percent || 0) })} className="input-base" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>SGST (%)</label>
            <input type="number" value={newItem.sgst_percent || ''} onChange={e => setNewItem({ ...newItem, sgst_percent: e.target.value, gst: Number(newItem.cgst_percent || 0) + Number(e.target.value || 0) })} className="input-base" />
          </div>

          {/* Row 8 */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>Total GST (%)</label>
            <select value={newItem.gst || ''} onChange={e => {
              const val = Number(e.target.value);
              setNewItem({ ...newItem, gst: val, cgst_percent: val/2, sgst_percent: val/2 });
            }} className="input-base">
              <option value="">None (0%)</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'var(--bg-main)', borderRadius: 8, padding: '8px 14px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Profit Calculator</div>
            {(() => {
              const profit = Number(newItem.selling_rate || 0) - Number(newItem.rate || newItem.purchase_rate || 0);
              const margin = Number(newItem.selling_rate || 0) > 0 ? (profit / Number(newItem.selling_rate)) * 100 : 0;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: profit > 0 ? '#16A34A' : '#DC2626' }}>₹{profit.toFixed(2)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>({margin.toFixed(1)}% margin)</span>
                </div>
              );
            })()}
          </div>
        </div>
        
        <div style={{ padding: '16px 24px', background: '#FAFBFC', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={() => setAdding(false)} style={{ padding: '0 20px', height: 40, borderRadius: 8, border: 'none', background: '#DC2626', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleAdd} style={{ padding: '0 20px', height: 40, borderRadius: 8, border: 'none', background: '#2563EB', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Save Item</button>
        </div>
      </div>
    </div>
  );
}

require('dotenv').config();
const supabase = require('./data/supabaseClient');
async function run() {
  const { data: inv } = await supabase.from('inventory').select('*').eq('supplier_name', "KHUMAR'S CERAMICS");
  let totalQty = 0;
  let totalVal = 0;
  inv.forEach(i => {
    const qty = Number(i.qty) || 0;
    const rate = Number(i.purchase_rate) || Number(i.rate) || 0;
    totalQty += qty;
    totalVal += qty * rate;
  });
  console.log('Total Inv Items:', inv.length, 'Total Qty:', totalQty, 'Raw Total Value (No discount):', totalVal);
  console.log('Total Value (15.25% discount):', totalVal * (1 - 0.1525));
  console.log('Total Value GST Inc (15.25% discount):', totalVal * (1 - 0.1525) * 1.18);
  
  const { data: grn } = await supabase.from('grn').select('*').eq('supplier', "KHUMAR'S CERAMICS");
  let grnTotal = 0;
  grn.forEach(g => {
    g.items.forEach(i => {
      grnTotal += Number(i.total_amount) || (Number(i.quantity) * Number(i.unit_price) * 1.18);
    });
  });
  console.log('Total GRN items:', grn.length, 'GRN Total Amount:', grnTotal);
  console.log('GRN Total Amount (15.25% discount):', grnTotal * (1 - 0.1525));
}
run();

const supabase = require('./Backend/data/supabaseClient');

async function backfillSuppliers() {
  console.log('Fetching inventory and GRNs...');
  
  // 1. Fetch all inventory
  const { data: inventory, error: invErr } = await supabase.from('inventory').select('*');
  if (invErr) {
    console.error('Error fetching inventory:', invErr);
    return;
  }
  
  // 2. Fetch all GRNs
  const { data: grns, error: grnErr } = await supabase.from('grn').select('*');
  if (grnErr) {
    console.error('Error fetching GRNs:', grnErr);
    return;
  }
  
  console.log(`Found ${inventory.length} inventory items and ${grns.length} GRNs.`);
  
  // 3. Match and update
  let updatedCount = 0;
  for (const item of inventory) {
    if (!item.supplier_name || item.supplier_name === '') {
      // Find a GRN with matching date
      // date_added in inventory could be 'YYYY-MM-DD' or 'D/M/YYYY' etc.
      // GRN date could be 'YYYY-MM-DD'.
      const matchingGrn = grns.find(g => {
        // Simple string match or parse match
        if (!g.date || !item.date_added) return false;
        
        // Normalize inventory date (it might be DD/MM/YYYY or YYYY-MM-DD)
        let invDate = item.date_added;
        if (invDate.includes('/')) {
            const parts = invDate.split('/');
            // DD/MM/YYYY -> YYYY-MM-DD
            if (parts[2] && parts[2].length === 4) {
                invDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        
        // Normalize GRN date
        let grnDate = g.date;
        if (grnDate.includes('/')) {
            const parts = grnDate.split('/');
            if (parts[2] && parts[2].length === 4) {
                grnDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        
        return invDate === grnDate || item.date_added === g.date;
      });
      
      if (matchingGrn && matchingGrn.supplier) {
        console.log(`Updating ${item.name} with supplier ${matchingGrn.supplier}`);
        const { error: updateErr } = await supabase
          .from('inventory')
          .update({ supplier_name: matchingGrn.supplier })
          .eq('id', item.id);
          
        if (updateErr) {
          console.error(`Failed to update ${item.name}:`, updateErr);
        } else {
          updatedCount++;
        }
      }
    }
  }
  
  console.log(`Successfully backfilled supplier_name for ${updatedCount} items.`);
}

backfillSuppliers();

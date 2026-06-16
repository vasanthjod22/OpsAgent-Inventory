const supabase = require('./data/supabaseClient');

async function fixInventoryLastRestocked() {
  console.log('Fetching inventory items...');
  const { data: inventory, error } = await supabase.from('inventory').select('*');
  if (error) {
    console.error('Error fetching inventory:', error);
    return;
  }

  console.log(`Found ${inventory.length} items. Fetching GRNs...`);
  const { data: grns, error: grnError } = await supabase.from('grn').select('*');
  if (grnError) {
    console.error('Error fetching GRNs:', grnError);
    return;
  }

  const grnMap = {};
  grns.forEach(g => {
    grnMap[g.id] = g.date || g.created_at;
  });

  console.log('Updating items...');
  let updatedCount = 0;

  for (const item of inventory) {
    let newDate = null;
    
    if (item.restock_source && item.restock_source.startsWith('GRN-')) {
      const gDate = grnMap[item.restock_source];
      if (gDate) {
        newDate = gDate.split('T')[0];
      }
    }

    if (!newDate && item.date_added) {
      newDate = item.date_added.split('T')[0];
    }
    
    if (!newDate) {
      newDate = item.created_at.split('T')[0];
    }

    if (item.last_restocked !== newDate) {
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ last_restocked: newDate })
        .eq('id', item.id);
        
      if (updateError) {
        console.error(`Error updating item ${item.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`Finished updating ${updatedCount} items.`);
}

fixInventoryLastRestocked();

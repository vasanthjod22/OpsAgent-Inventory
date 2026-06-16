const supabase = require('./data/supabaseClient');
async function run() {
  const { data, error } = await supabase.from('inventory').select('id, name, qty, rate, cost_price').eq('supplier_name', "KHUMAR'S CERAMICS");
  if (error) { console.error(error); return; }
  
  if (data.length === 0) {
    console.log("No matching items found for KHUMAR'S CERAMICS.");
    return;
  }
  
  console.log("Found " + data.length + " items for KHUMAR'S CERAMICS.");
  let promises = [];
  
  for (const item of data) {
    // Formula from user: (((total value - 15.25%) x 18%))  / quantity )))
    // Here, the current `rate` in the DB is actually the total value because of an import error.
    // So we apply the discount, then add the 18% tax, then divide by quantity.
    // total value = item.rate
    // minus 15.25% = item.rate * (1 - 0.1525)
    // plus 18% = ... * 1.18
    // divide by quantity = ... / item.qty
    
    if (item.qty > 0) {
      const discountedValue = item.rate * (1 - 0.1525);
      const withTax = discountedValue * 1.18;
      const newRate = Number((withTax / item.qty).toFixed(2));
      const newCostPrice = newRate; // Assuming cost price is the same
      
      promises.push(
        supabase.from('inventory')
          .update({ rate: newRate, cost_price: newCostPrice })
          .eq('id', item.id)
      );
    }
  }
  
  const results = await Promise.all(promises);
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.error('Some updates failed:', errors[0].error);
  } else {
    console.log('Successfully updated purchase prices for all ' + data.length + ' items.');
  }
}
run();

const supabase = require('../data/supabaseClient');

const ActivityService = {
  log: async (userId, {
    type,
    title,
    description = '',
    referenceId = '',
    referenceType = '',
    icon = '📋',
    color = '#2563EB'
  }) => {
    try {
      await supabase
        .from('activity_log')
        .insert([{
          user_id: userId,
          type,
          title,
          description,
          reference_id: referenceId,
          reference_type: referenceType,
          icon,
          color
        }])
    } catch (err) {
      console.error('Activity log error:', err)
      // Never throw - activity logging 
      // should never break main operations
    }
  },

  // Pre-built activity templates
  templates: {
    billCreated: (billNum, customer, amount) => ({
      type: 'bill_created',
      title: 'Invoice Created',
      description: `${billNum} for ${customer} — ₹${Number(amount).toLocaleString('en-IN')}`,
      icon: '🧾',
      color: '#16A34A'
    }),
    poCreated: (poNum, supplier) => ({
      type: 'po_created',
      title: 'Purchase Order Created',
      description: `${poNum} sent to ${supplier}`,
      icon: '🛒',
      color: '#2563EB'
    }),
    stockUpdated: (itemName, qty, source) => ({
      type: 'stock_updated',
      title: 'Stock Updated',
      description: `${itemName} +${qty} units from ${source}`,
      icon: '📦',
      color: '#7C3AED'
    }),
    customerAdded: (name) => ({
      type: 'customer_added',
      title: 'Customer Added',
      description: `${name} added to customers`,
      icon: '👤',
      color: '#0891B2'
    }),
    paymentReceived: (customer, amount) => ({
      type: 'payment_received',
      title: 'Payment Received',
      description: `₹${Number(amount).toLocaleString('en-IN')} from ${customer}`,
      icon: '💰',
      color: '#16A34A'
    }),
    grnApproved: (grnNum, supplier) => ({
      type: 'grn_approved',
      title: 'GRN Approved',
      description: `${grnNum} from ${supplier} — stock updated`,
      icon: '📥',
      color: '#EA580C'
    }),
    quotationCreated: (qtNum, customer) => ({
      type: 'quotation_created',
      title: 'Quotation Created',
      description: `${qtNum} for ${customer}`,
      icon: '📋',
      color: '#DB2777'
    }),
    expenseAdded: (title, amount) => ({
      type: 'expense_added',
      title: 'Expense Recorded',
      description: `${title} — ₹${Number(amount).toLocaleString('en-IN')}`,
      icon: '💸',
      color: '#DC2626'
    })
  }
};

module.exports = { ActivityService };

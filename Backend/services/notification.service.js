const supabase = require('../data/supabaseClient');

const NotificationService = {
  // Create a notification
  create: async (userId, { title, message, type = 'info', link = '', icon = '' }) => {
    const { data, error } = await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        title,
        message,
        type,
        link,
        icon
      }])
      .select();
    
    if (error) throw error;
    return data[0];
  },

  // Get all notifications for user
  getAll: async (userId, limit = 20) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  },

  // Get unread count
  getUnreadCount: async (userId) => {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    
    if (error) throw error;
    return count;
  },

  // Mark single as read
  markRead: async (id, userId) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) throw error;
  },

  // Mark all as read
  markAllRead: async (userId) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    
    if (error) throw error;
  },

  // Delete a notification
  delete: async (id, userId) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) throw error;
  },

  // Clear all notifications
  clearAll: async (userId) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);
    
    if (error) throw error;
  },

  // Pre-built notification templates
  templates: {
    billCreated: (billNumber, customer, amount) => ({
      title: 'Bill Generated',
      message: `${billNumber} for ${customer} — ₹${Number(amount).toLocaleString('en-IN')}`,
      type: 'success',
      icon: '🧾',
      link: '/billing'
    }),

    paymentReceived: (customer, amount) => ({
      title: 'Payment Received',
      message: `₹${Number(amount).toLocaleString('en-IN')} received from ${customer}`,
      type: 'success',
      icon: '💰',
      link: '/billing'
    }),

    lowStock: (itemName, qty, min, unit) => ({
      title: 'Low Stock Alert',
      message: `${itemName} is low — ${qty} ${unit} remaining (min: ${min})`,
      type: 'warning',
      icon: '📦',
      link: '/inventory'
    }),

    criticalStock: (itemName, qty, unit) => ({
      title: '🚨 Critical Stock',
      message: `${itemName} almost out — only ${qty} ${unit} left!`,
      type: 'danger',
      icon: '🚨',
      link: '/inventory'
    }),

    grnReceived: (grnNumber, supplier, count) => ({
      title: 'GRN Processed',
      message: `${count} items received from ${supplier} — ${grnNumber}`,
      type: 'info',
      icon: '📥',
      link: '/grn'
    }),

    paymentOverdue: (customer, amount, days) => ({
      title: 'Payment Overdue',
      message: `₹${Number(amount).toLocaleString('en-IN')} from ${customer} overdue by ${days} days`,
      type: 'danger',
      icon: '⚠️',
      link: '/billing'
    }),

    quotationExpiring: (qtNumber, customer, days) => ({
      title: 'Quotation Expiring',
      message: `${qtNumber} for ${customer} expires in ${days} days`,
      type: 'warning',
      icon: '📋',
      link: '/quotation'
    }),

    newCustomer: (customerName) => ({
      title: 'New Customer',
      message: `${customerName} added to your customer list`,
      type: 'info',
      icon: '👤',
      link: '/customers'
    }),

    poCreated: (poNumber, supplier) => ({
      title: 'Purchase Order Created',
      message: `${poNumber} sent to ${supplier}`,
      type: 'info',
      icon: '🛒',
      link: '/purchase-orders'
    }),

    poDelivered: (poNumber, supplier) => ({
      title: 'PO Delivered',
      message: `${poNumber} from ${supplier} fully received`,
      type: 'success',
      icon: '✅',
      link: '/purchase-orders'
    })
  }
};

module.exports = { NotificationService };

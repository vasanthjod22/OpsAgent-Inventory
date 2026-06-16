import { create } from 'zustand';

export const useAppStore = create((set) => ({
  theme: localStorage.getItem('opsagent_theme') || 'light',
  setTheme: (theme) => {
    localStorage.setItem('opsagent_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ theme });
  },

  inventory: [],
  setInventory: (inventory) => set({ inventory }),
  
  grnHistory: [],
  setGrnHistory: (grnHistory) => set({ grnHistory }),
  
  financeSummary: { totalRevenue: 0, totalExpenses: 0, balance: 0 },
  setFinanceSummary: (financeSummary) => set({ financeSummary }),
  
  transactions: [],
  setTransactions: (transactions) => set({ transactions }),
  
  quotations: [],
  setQuotations: (quotations) => set({ quotations }),
  
  breakdownQuotations: [],
  setBreakdownQuotations: (breakdownQuotations) => set({ breakdownQuotations }),
  
  finalizedQuotations: [],
  setFinalizedQuotations: (finalizedQuotations) => set({ finalizedQuotations }),
  
  bills: [],
  setBills: (bills) => set({ bills }),
  
  customers: [],
  setCustomers: (customers) => set({ customers }),
  
  purchaseOrders: [],
  setPurchaseOrders: (purchaseOrders) => set({ purchaseOrders }),
}));

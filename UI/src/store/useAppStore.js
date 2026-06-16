import { create } from 'zustand';

export const useAppStore = create((set) => ({
  theme: localStorage.getItem('opsagent_theme') || 'light',
  setTheme: (theme) => {
    localStorage.setItem('opsagent_theme', theme);
    set({ theme });
  },
  
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  activeNav: 'dashboard',
  setActiveNav: (nav) => set({ activeNav: nav }),
}));

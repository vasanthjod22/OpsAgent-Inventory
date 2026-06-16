import { create } from 'zustand';

export const useInventoryStore = create((set) => ({
  // Filters
  search: '',
  setSearch: (search) => set({ search, currentPage: 1 }),
  
  category: 'all',
  setCategory: (category) => set({ category, currentPage: 1 }),
  
  status: 'all',
  setStatus: (status) => set({ status, currentPage: 1 }),
  
  sortBy: 'name',
  setSortBy: (sortBy) => set({ sortBy, currentPage: 1 }),

  // Pagination
  currentPage: 1,
  setCurrentPage: (currentPage) => set({ currentPage }),
  
  itemsPerPage: 12,
  setItemsPerPage: (itemsPerPage) => set({ itemsPerPage, currentPage: 1 }),
  
  // Local edit states (for inline editing)
  editValues: {},
  setEditValue: (id, field, value) => set((state) => ({
    editValues: { ...state.editValues, [`${id}-${field}`]: value }
  })),
  clearEditValue: (id, field) => set((state) => {
    const newEdits = { ...state.editValues };
    delete newEdits[`${id}-${field}`];
    return { editValues: newEdits };
  })
}));

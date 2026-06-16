import { backendFetch } from '../../../utils/backend';

export const inventoryApi = {
  fetchInventory: async (params) => {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append('search', params.search);
    if (params.category && params.category !== 'all') queryParams.append('category', params.category);
    if (params.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    
    // sorting
    if (params.sort) {
      const [field, order] = params.sort.split('-');
      queryParams.append('sortBy', field);
      queryParams.append('order', order);
    }

    const queryStr = queryParams.toString();
    return backendFetch(`/inventory${queryStr ? `?${queryStr}` : ''}`);
  },

  updateInventoryItem: async ({ id, updates }) => {
    return backendFetch(`/inventory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  deleteInventoryItem: async (id) => {
    return backendFetch(`/inventory/${id}`, {
      method: 'DELETE',
    });
  },

  addInventoryItem: async (item) => {
    return backendFetch('/inventory', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  uploadGRN: async (formData) => {
    // GRN upload uses multipart/form-data, so we cannot use the standard backendFetch 
    // which forces Content-Type: application/json.
    // We will bypass it for form data or create a specific function.
    const token = localStorage.getItem('opsagent_token');
    const API_URL = import.meta.env.PROD ? 'https://opsagent-inventory-ui-backend.onrender.com/api' : 'http://localhost:3001/api';
    
    const response = await fetch(`${API_URL}/inventory/upload-grn`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    if (response.status === 401) {
      localStorage.removeItem('opsagent_token');
      window.dispatchEvent(new Event('opsagent_unauthorized'));
      throw new Error('Unauthorized');
    }

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || `HTTP Error ${response.status}`);
    return data;
  },

  finalizeGRN: async (grnData) => {
    return backendFetch('/inventory/finalize-grn', {
      method: 'POST',
      body: JSON.stringify(grnData),
    });
  }
};

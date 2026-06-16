const API_URL = import.meta.env.PROD ? 'https://opsagent-inventory-ui-backend.onrender.com/api' : 'http://localhost:3001/api';

/**
 * Standard fetch wrapper that automatically includes the JWT token
 * and handles common HTTP errors.
 */
export const backendFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('opsagent_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle unauthorized (token expired or invalid)
  if (response.status === 401) {
    localStorage.removeItem('opsagent_token');
    window.dispatchEvent(new Event('opsagent_unauthorized'));
    throw new Error('Unauthorized or session expired');
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `HTTP Error ${response.status}`);
  }

  return data;
};

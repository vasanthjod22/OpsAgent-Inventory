import { backendFetch } from './backend';

export const loginUser = async (usernameOrEmail, password) => {
  const data = await backendFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ usernameOrEmail, password }),
  });
  localStorage.setItem('opsagent_token', data.token);
  return data.user;
};

export const registerUser = async (userData) => {
  const data = await backendFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
  localStorage.setItem('opsagent_token', data.token);
  return data.user;
};

export const logoutUser = () => {
  localStorage.removeItem('opsagent_token');
  // Trigger re-render to kick user to auth page
  window.dispatchEvent(new Event('opsagent_unauthorized'));
};

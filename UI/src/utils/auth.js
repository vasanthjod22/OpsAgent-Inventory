// Get all users
export const getUsers = () => {
  try {
    return JSON.parse(
      localStorage.getItem('opsagent_users') || '[]'
    );
  } catch { return []; }
};

// Find user by username or email
export const findUser = (usernameOrEmail) => {
  const users = getUsers();
  return users.find(u => 
    u.username === usernameOrEmail || 
    u.email === usernameOrEmail
  );
};

// Verify password
export const verifyPassword = (user, password) => {
  return user.password === btoa(password);
};

// Register new user
export const registerUser = (userData) => {
  const users = getUsers();
  const newUser = {
    id: Date.now(),
    ...userData,
    password: btoa(userData.password),
    avatar: userData.fullName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2),
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  localStorage.setItem(
    'opsagent_users', 
    JSON.stringify(users)
  );
  return newUser;
};

// Update password
export const updatePassword = (username, newPassword) => {
  const users = getUsers();
  const idx = users.findIndex(u => 
    u.username === username
  );
  if (idx !== -1) {
    users[idx].password = btoa(newPassword);
    localStorage.setItem(
      'opsagent_users', 
      JSON.stringify(users)
    );
    return true;
  }
  return false;
};

// Initialize demo user if no users exist
export const initDemoUser = () => {
  const users = getUsers();
  if (users.length === 0) {
    registerUser({
      fullName: 'Demo User',
      username: 'demo',
      email: 'demo@opsagent.com',
      password: 'demo123',
      company: 'OpsAgent Demo'
    });
  }
};

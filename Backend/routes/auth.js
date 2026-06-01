const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID: uuidv4 } = require('crypto');
const store = require('../data/store');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/register
 * Body: { fullName, username, email, password, company? }
 */
router.post('/register', async (req, res) => {
  const { fullName, username, email, password, company } = req.body;

  if (!fullName || !username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const exists = store.users.find(
    u => u.username === username || u.email === email
  );
  if (exists) {
    return res.status(409).json({ error: 'Username or email already taken' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const avatar = fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const newUser = {
    id: uuidv4(),
    fullName,
    username,
    email,
    password: hashed,
    company: company || '',
    avatar,
    createdAt: new Date().toISOString(),
  };

  store.users.push(newUser);

  const { password: _, ...safeUser } = newUser;
  const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({ user: safeUser, token });
});

/**
 * POST /api/auth/login
 * Body: { usernameOrEmail, password }
 */
router.post('/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  if (!usernameOrEmail || !password) {
    return res.status(400).json({ error: 'Username/email and password are required' });
  }

  const user = store.users.find(
    u => u.username === usernameOrEmail || u.email === usernameOrEmail
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const { password: _, ...safeUser } = user;
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

  res.json({ user: safeUser, token });
});

/**
 * POST /api/auth/change-password
 * Body: { username, currentPassword, newPassword }
 */
router.post('/change-password', async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  const user = store.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  user.password = await bcrypt.hash(newPassword, 10);
  res.json({ message: 'Password updated successfully' });
});

module.exports = router;

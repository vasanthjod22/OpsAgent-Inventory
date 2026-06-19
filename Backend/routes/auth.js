const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { randomUUID: uuidv4 } = require('crypto');
const supabase = require('../data/supabaseClient');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const registerSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  company: z.string().optional()
});

const loginSchema = z.object({
  usernameOrEmail: z.string().min(3, "Username or email is required"),
  password: z.string().min(1, "Password is required")
});

const changePasswordSchema = z.object({
  username: z.string().min(3, "Username is required"),
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters")
});

/**
 * POST /api/auth/register
 * Body: { fullName, username, email, password, company? }
 */
router.post('/register', async (req, res) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { fullName, username, email, password, company } = validatedData;

  const { data: exists } = await supabase
    .from('users')
    .select('id')
    .or(`username.eq.${username},email.eq.${email}`)
    .single();

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
    full_name: fullName,
    username,
    email,
    password: hashed,
    company: company || '',
    avatar,
  };

  const { data: insertedUser, error } = await supabase
    .from('users')
    .insert([newUser])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const { password: _, ...safeUser } = insertedUser;
  // Map snake_case to camelCase for the frontend
  safeUser.fullName = safeUser.full_name;
  
  const token = jwt.sign({ id: safeUser.id, username: safeUser.username }, JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({ user: safeUser, token });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login
 * Body: { usernameOrEmail, password }
 */
router.post('/login', async (req, res) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { usernameOrEmail, password } = validatedData;

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .or(`username.eq.${usernameOrEmail},email.eq.${usernameOrEmail}`)
    .single();

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const { password: _, ...safeUser } = user;
  safeUser.fullName = safeUser.full_name;
  
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

  res.json({ user: safeUser, token });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/change-password
 * Body: { username, currentPassword, newPassword }
 */
router.post('/change-password', async (req, res) => {
  try {
    const validatedData = changePasswordSchema.parse(req.body);
    const { username, currentPassword, newPassword } = validatedData;
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single();
    
  if (error || !user) return res.status(404).json({ error: 'User not found' });

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const hashedNew = await bcrypt.hash(newPassword, 10);
  
  const { error: updateError } = await supabase
    .from('users')
    .update({ password: hashedNew })
    .eq('id', user.id);
    
  if (updateError) return res.status(500).json({ error: updateError.message });
  
  res.json({ message: 'Password updated successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

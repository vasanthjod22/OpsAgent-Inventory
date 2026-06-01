const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'opsagent_secret_key_change_in_prod';

/**
 * Middleware: verifies Bearer JWT token on protected routes.
 */
const auth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { auth, JWT_SECRET };

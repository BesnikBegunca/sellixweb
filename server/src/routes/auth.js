import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { beginAdminSession, endAdminSession, requireAuth } from '../auth.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' }
});

function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name, mustChangePassword: !!row.must_change_password };
}

authRouter.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const row = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email.trim().toLowerCase());
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  beginAdminSession(row, req, res);
  res.json({ user: publicUser(row) });
});

authRouter.post('/logout', (req, res) => {
  endAdminSession(req, res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.user.sub);
  if (!row) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: publicUser(row) });
});

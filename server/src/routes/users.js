import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    mustChangePassword: !!row.must_change_password,
    createdAt: row.created_at
  };
}

function generateTempPassword() {
  return crypto.randomBytes(9).toString('base64url');
}

usersRouter.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM admin_users ORDER BY created_at ASC').all();
  res.json({ users: rows.map(publicUser) });
});

usersRouter.post('/', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  const existing = db.prepare('SELECT id FROM admin_users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'A user with that email already exists' });

  const tempPassword = generateTempPassword();
  const hash = bcrypt.hashSync(tempPassword, 12);
  const info = db
    .prepare('INSERT INTO admin_users (email, name, password_hash, must_change_password) VALUES (?, ?, ?, 1)')
    .run(email, name, hash);
  const row = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ user: publicUser(row), tempPassword });
});

usersRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.sub) {
    return res.status(400).json({ error: 'You cannot remove your own account' });
  }
  const count = db.prepare('SELECT COUNT(*) AS n FROM admin_users').get().n;
  if (count <= 1) {
    return res.status(400).json({ error: 'Cannot remove the last remaining admin' });
  }
  const info = db.prepare('DELETE FROM admin_users WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

usersRouter.post('/:id/reset-password', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  const tempPassword = generateTempPassword();
  const hash = bcrypt.hashSync(tempPassword, 12);
  db.prepare('UPDATE admin_users SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(hash, id);
  res.json({ ok: true, tempPassword });
});

usersRouter.patch('/me/password', (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  const row = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.user.sub);
  if (!row) return res.status(401).json({ error: 'Not authenticated' });

  if (!row.must_change_password) {
    if (typeof currentPassword !== 'string' || !bcrypt.compareSync(currentPassword, row.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
  }

  const hash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE admin_users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hash, row.id);
  res.json({ ok: true });
});

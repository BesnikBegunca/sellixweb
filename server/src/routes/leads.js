import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

export const leadsRouter = Router();

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Try again later.' }
});

const STATUSES = ['new', 'contacted', 'closed'];

function clean(str, max) {
  return typeof str === 'string' ? str.trim().slice(0, max) : '';
}

leadsRouter.post('/', submitLimiter, (req, res) => {
  const name = clean(req.body?.name, 200);
  const business = clean(req.body?.business, 200);
  const phone = clean(req.body?.phone, 60);
  const category = clean(req.body?.category, 100);
  if (!name || !business || !phone || !category) {
    return res.status(400).json({ error: 'name, business, phone and category are required' });
  }
  const info = db
    .prepare('INSERT INTO leads (name, business, phone, category) VALUES (?, ?, ?, ?)')
    .run(name, business, phone, category);
  res.status(201).json({ id: info.lastInsertRowid });
});

leadsRouter.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  res.json({ leads: rows });
});

leadsRouter.patch('/:id/status', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
  }
  const info = db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, id);
  if (info.changes === 0) return res.status(404).json({ error: 'Lead not found' });
  res.json({ ok: true });
});

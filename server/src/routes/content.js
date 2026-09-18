import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

export const contentRouter = Router();

contentRouter.get('/', (req, res) => {
  const row = db.prepare('SELECT data, updated_at FROM site_content WHERE id = 1').get();
  if (!row) return res.status(404).json({ error: 'Content not seeded yet' });
  res.json({ content: JSON.parse(row.data), updatedAt: row.updated_at });
});

contentRouter.put('/', requireAuth, (req, res) => {
  const { content } = req.body || {};
  if (!content || typeof content !== 'object') {
    return res.status(400).json({ error: 'content object is required' });
  }
  db.prepare("UPDATE site_content SET data = ?, updated_at = datetime('now') WHERE id = 1").run(
    JSON.stringify(content)
  );
  const row = db.prepare('SELECT data, updated_at FROM site_content WHERE id = 1').get();
  res.json({ content: JSON.parse(row.data), updatedAt: row.updated_at });
});

import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { sendToBusinesses } from '../push.js';

// Admin → business owners. The admin writes a title and a message and picks
// every business or a hand-picked list; each device that turned notifications
// on in the portal receives it like a normal app notification.
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

function recipients() {
  return db
    .prepare(
      `SELECT b.id, b.name, b.city, b.portal_email,
              (SELECT COUNT(*) FROM push_subscriptions p WHERE p.business_id = b.id) AS devices
       FROM businesses b
       WHERE b.deleted_at IS NULL
       ORDER BY b.name COLLATE NOCASE`
    )
    .all()
    .map((b) => ({ id: b.id, name: b.name, city: b.city, hasPortal: !!b.portal_email, devices: b.devices }));
}

function history() {
  return db
    .prepare('SELECT * FROM admin_notifications ORDER BY id DESC LIMIT 50')
    .all()
    .map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      url: n.url,
      target: n.target,
      businessesCount: n.businesses_count,
      delivered: n.delivered,
      failed: n.failed,
      createdBy: n.created_by,
      createdAt: n.created_at
    }));
}

notificationsRouter.get('/', (req, res) => {
  res.json({ businesses: recipients(), history: history() });
});

notificationsRouter.post('/', async (req, res) => {
  const title = String(req.body?.title || '').trim().slice(0, 80);
  const body = String(req.body?.body || '').trim().slice(0, 300);
  const rawUrl = String(req.body?.url || '').trim();
  const target = req.body?.target === 'selected' ? 'selected' : 'all';
  if (!title) return res.status(400).json({ error: 'Shkruaj titullin e njoftimit.' });
  if (!body) return res.status(400).json({ error: 'Shkruaj mesazhin e njoftimit.' });
  // Only in-app paths: a push that opens an arbitrary site would be a phishing vector.
  const url = rawUrl && /^\/[a-zA-Z0-9/_\-?=&.]*$/.test(rawUrl) ? rawUrl : '/portal';

  const live = new Set(recipients().map((b) => b.id));
  let ids;
  if (target === 'all') {
    ids = [...live];
  } else {
    ids = (Array.isArray(req.body?.businessIds) ? req.body.businessIds : [])
      .map(Number)
      .filter((id) => live.has(id));
    ids = [...new Set(ids)];
    if (!ids.length) return res.status(400).json({ error: 'Zgjidh së paku një biznes.' });
  }

  const result = await sendToBusinesses(ids, { title, body, url, tag: `admin-${Date.now()}` });
  db.prepare(
    `INSERT INTO admin_notifications (title, body, url, target, business_ids, businesses_count, delivered, failed, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(title, body, url, target, JSON.stringify(ids), ids.length, result.delivered, result.failed, req.user?.email || '');

  res.json({ ok: true, businesses: ids.length, ...result, history: history() });
});

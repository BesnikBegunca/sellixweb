import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { uniqueLicenseKey, nowSql, addMonths, publicBusiness } from '../licenses.js';

export const businessesRouter = Router();
businessesRouter.use(requireAuth);

const TEXT_FIELDS = [
  'name', 'fiscal_number', 'vat_number', 'address', 'city', 'zip_code',
  'country', 'contact_person', 'phone', 'email', 'sector', 'notes'
];

const BODY_TO_COLUMN = {
  name: 'name',
  fiscalNumber: 'fiscal_number',
  vatNumber: 'vat_number',
  address: 'address',
  city: 'city',
  zipCode: 'zip_code',
  country: 'country',
  contactPerson: 'contact_person',
  phone: 'phone',
  email: 'email',
  sector: 'sector',
  notes: 'notes'
};

function clean(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function parseSeats(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(1, Math.trunc(n)));
}

function getBusiness(id) {
  return db.prepare('SELECT * FROM businesses WHERE id = ?').get(Number(id));
}

businessesRouter.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM businesses ORDER BY created_at DESC').all();
  res.json({ businesses: rows.map(publicBusiness) });
});

businessesRouter.post('/', (req, res) => {
  const nui = clean(req.body?.nui, 50);
  const name = clean(req.body?.name);
  if (!nui) return res.status(400).json({ error: 'NUI is required' });
  if (!name) return res.status(400).json({ error: 'Business name is required' });

  const taken = db.prepare('SELECT 1 FROM businesses WHERE nui = ?').get(nui);
  if (taken) return res.status(409).json({ error: 'A business with that NUI already exists' });

  const months = Math.min(60, Math.max(1, Number(req.body?.licenseMonths) || 12));
  const issuedAt = nowSql();
  const values = {
    nui,
    seats: parseSeats(req.body?.seats),
    license_key: uniqueLicenseKey(),
    license_issued_at: issuedAt,
    license_expires_at: addMonths(issuedAt, months)
  };
  for (const [bodyKey, column] of Object.entries(BODY_TO_COLUMN)) {
    values[column] = clean(req.body?.[bodyKey], column === 'notes' ? 2000 : 200);
  }
  if (!values.country) values.country = 'Kosovë';

  const columns = ['nui', 'seats', 'license_key', 'license_issued_at', 'license_expires_at', ...TEXT_FIELDS];
  const info = db
    .prepare(
      `INSERT INTO businesses (${columns.join(', ')}) VALUES (${columns.map((c) => `@${c}`).join(', ')})`
    )
    .run(values);

  res.status(201).json({ business: publicBusiness(getBusiness(info.lastInsertRowid)) });
});

businessesRouter.patch('/:id', (req, res) => {
  const row = getBusiness(req.params.id);
  if (!row) return res.status(404).json({ error: 'Business not found' });

  const updates = {};
  if (req.body?.nui !== undefined) {
    const nui = clean(req.body.nui, 50);
    if (!nui) return res.status(400).json({ error: 'NUI is required' });
    const taken = db.prepare('SELECT id FROM businesses WHERE nui = ? AND id != ?').get(nui, row.id);
    if (taken) return res.status(409).json({ error: 'A business with that NUI already exists' });
    updates.nui = nui;
  }
  for (const [bodyKey, column] of Object.entries(BODY_TO_COLUMN)) {
    if (req.body?.[bodyKey] !== undefined) {
      updates[column] = clean(req.body[bodyKey], column === 'notes' ? 2000 : 200);
    }
  }
  if (updates.name === '') return res.status(400).json({ error: 'Business name is required' });
  if (req.body?.seats !== undefined) updates.seats = parseSeats(req.body.seats, row.seats);

  if (Object.keys(updates).length > 0) {
    const setSql = Object.keys(updates).map((c) => `${c} = @${c}`).join(', ');
    db.prepare(`UPDATE businesses SET ${setSql}, updated_at = datetime('now') WHERE id = @id`).run({
      ...updates,
      id: row.id
    });
  }
  res.json({ business: publicBusiness(getBusiness(row.id)) });
});

businessesRouter.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM businesses WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: 'Business not found' });
  res.json({ ok: true });
});

businessesRouter.post('/:id/license/extend', (req, res) => {
  const row = getBusiness(req.params.id);
  if (!row) return res.status(404).json({ error: 'Business not found' });

  const months = Math.min(60, Math.max(1, Number(req.body?.months) || 1));
  const now = nowSql();
  // Extending an already-lapsed licence runs from today, not from the old
  // expiry date, so the business gets the full period it paid for.
  const base = row.license_expires_at > now ? row.license_expires_at : now;
  db.prepare(
    "UPDATE businesses SET license_expires_at = ?, license_status = 'active', updated_at = datetime('now') WHERE id = ?"
  ).run(addMonths(base, months), row.id);

  res.json({ business: publicBusiness(getBusiness(row.id)) });
});

businessesRouter.post('/:id/license/revoke', (req, res) => {
  const row = getBusiness(req.params.id);
  if (!row) return res.status(404).json({ error: 'Business not found' });
  db.prepare("UPDATE businesses SET license_status = 'revoked', updated_at = datetime('now') WHERE id = ?").run(row.id);
  res.json({ business: publicBusiness(getBusiness(row.id)) });
});

businessesRouter.post('/:id/license/reactivate', (req, res) => {
  const row = getBusiness(req.params.id);
  if (!row) return res.status(404).json({ error: 'Business not found' });
  db.prepare("UPDATE businesses SET license_status = 'active', updated_at = datetime('now') WHERE id = ?").run(row.id);
  res.json({ business: publicBusiness(getBusiness(row.id)) });
});

businessesRouter.post('/:id/license/regenerate', (req, res) => {
  const row = getBusiness(req.params.id);
  if (!row) return res.status(404).json({ error: 'Business not found' });
  // The old key stops working immediately, so every bound device has to
  // activate again with the new one.
  db.prepare('DELETE FROM license_activations WHERE business_id = ?').run(row.id);
  db.prepare("UPDATE businesses SET license_key = ?, updated_at = datetime('now') WHERE id = ?").run(
    uniqueLicenseKey(),
    row.id
  );
  res.json({ business: publicBusiness(getBusiness(row.id)) });
});

businessesRouter.get('/:id/devices', (req, res) => {
  const row = getBusiness(req.params.id);
  if (!row) return res.status(404).json({ error: 'Business not found' });
  const devices = db
    .prepare('SELECT * FROM license_activations WHERE business_id = ? ORDER BY activated_at ASC')
    .all(row.id);
  res.json({
    devices: devices.map((d) => ({
      id: d.id,
      deviceId: d.device_id,
      deviceName: d.device_name,
      activatedAt: d.activated_at,
      lastSeenAt: d.last_seen_at
    }))
  });
});

businessesRouter.delete('/:id/devices/:deviceId', (req, res) => {
  const info = db
    .prepare('DELETE FROM license_activations WHERE business_id = ? AND id = ?')
    .run(Number(req.params.id), Number(req.params.deviceId));
  if (info.changes === 0) return res.status(404).json({ error: 'Device not found' });
  res.json({ ok: true });
});

// --- Owner portal account --------------------------------------------------
// The shop owner signs in to /portal with these credentials to watch their own
// takings. The admin sets the email and gets a one-time temporary password to
// pass on; the owner is forced to replace it on first login.

function generateTempPassword() {
  return crypto.randomBytes(9).toString('base64url');
}

businessesRouter.post('/:id/portal-account', (req, res) => {
  const row = getBusiness(req.params.id);
  if (!row) return res.status(404).json({ error: 'Business not found' });

  // Falls back to the business's existing contact email so the common case is
  // one click, but an explicit email wins — the owner who reads the reports is
  // often not the contact person on file.
  const email = (clean(req.body?.email, 200) || row.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email is required' });
  }

  const taken = db
    .prepare("SELECT id FROM businesses WHERE portal_email = ? AND portal_email <> '' AND id <> ?")
    .get(email, row.id);
  if (taken) return res.status(409).json({ error: 'Another business already uses that portal email' });

  const tempPassword = generateTempPassword();
  db.prepare(
    `UPDATE businesses
        SET portal_email = ?, portal_password_hash = ?, portal_must_change_password = 1,
            updated_at = datetime('now')
      WHERE id = ?`
  ).run(email, bcrypt.hashSync(tempPassword, 12), row.id);

  res.json({ business: publicBusiness(getBusiness(row.id)), tempPassword });
});

businessesRouter.delete('/:id/portal-account', (req, res) => {
  const row = getBusiness(req.params.id);
  if (!row) return res.status(404).json({ error: 'Business not found' });
  // Clearing the hash is what actually revokes access; the email goes too so
  // it can be reused for another business.
  db.prepare(
    `UPDATE businesses
        SET portal_email = '', portal_password_hash = '', portal_must_change_password = 0,
            updated_at = datetime('now')
      WHERE id = ?`
  ).run(row.id);
  res.json({ business: publicBusiness(getBusiness(row.id)) });
});

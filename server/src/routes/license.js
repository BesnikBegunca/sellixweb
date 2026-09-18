import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { effectiveStatus, deviceCount } from '../licenses.js';

export const licenseRouter = Router();

// The licence key is the desktop app's API key, so these endpoints are public.
// Rate limiting keeps them from being used to guess keys.
const licenseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { valid: false, reason: 'rate_limited' }
});

licenseRouter.use(licenseLimiter);

function readKey(req) {
  const header = req.get('x-license-key');
  const body = typeof req.body?.licenseKey === 'string' ? req.body.licenseKey : '';
  return (header || body).trim().toUpperCase();
}

function readDeviceId(req) {
  return typeof req.body?.deviceId === 'string' ? req.body.deviceId.trim().slice(0, 200) : '';
}

function licensePayload(row) {
  return {
    business: { name: row.name, nui: row.nui, sector: row.sector, city: row.city },
    license: {
      status: effectiveStatus(row),
      expiresAt: row.license_expires_at,
      seats: row.seats,
      devicesUsed: deviceCount(row.id)
    }
  };
}

licenseRouter.post('/activate', (req, res) => {
  const key = readKey(req);
  const deviceId = readDeviceId(req);
  const deviceName = typeof req.body?.deviceName === 'string' ? req.body.deviceName.trim().slice(0, 200) : '';

  if (!key) return res.status(400).json({ valid: false, reason: 'missing_license_key' });
  if (!deviceId) return res.status(400).json({ valid: false, reason: 'missing_device_id' });

  const row = db.prepare('SELECT * FROM businesses WHERE license_key = ?').get(key);
  if (!row) return res.status(404).json({ valid: false, reason: 'not_found' });

  const status = effectiveStatus(row);
  if (status !== 'active') return res.status(403).json({ valid: false, reason: status });

  const existing = db
    .prepare('SELECT * FROM license_activations WHERE business_id = ? AND device_id = ?')
    .get(row.id, deviceId);

  if (existing) {
    db.prepare("UPDATE license_activations SET last_seen_at = datetime('now'), device_name = ? WHERE id = ?").run(
      deviceName || existing.device_name,
      existing.id
    );
  } else {
    if (deviceCount(row.id) >= row.seats) {
      return res.status(403).json({ valid: false, reason: 'seat_limit', seats: row.seats });
    }
    db.prepare('INSERT INTO license_activations (business_id, device_id, device_name) VALUES (?, ?, ?)').run(
      row.id,
      deviceId,
      deviceName
    );
  }

  res.json({ valid: true, ...licensePayload(row) });
});

licenseRouter.post('/check', (req, res) => {
  const key = readKey(req);
  const deviceId = readDeviceId(req);
  if (!key) return res.status(400).json({ valid: false, reason: 'missing_license_key' });
  if (!deviceId) return res.status(400).json({ valid: false, reason: 'missing_device_id' });

  const row = db.prepare('SELECT * FROM businesses WHERE license_key = ?').get(key);
  if (!row) return res.status(404).json({ valid: false, reason: 'not_found' });

  const status = effectiveStatus(row);
  if (status !== 'active') return res.status(403).json({ valid: false, reason: status });

  const activation = db
    .prepare('SELECT * FROM license_activations WHERE business_id = ? AND device_id = ?')
    .get(row.id, deviceId);
  if (!activation) return res.status(403).json({ valid: false, reason: 'not_activated' });

  db.prepare("UPDATE license_activations SET last_seen_at = datetime('now') WHERE id = ?").run(activation.id);
  res.json({ valid: true, ...licensePayload(row) });
});

// --- Offline-first registration -------------------------------------------
// A shop set up without internet runs on a locally generated install code.
// Synchronize posts its business details here; the row waits for an admin to
// approve it, and only then does the server issue a real licence key. The
// install code is a claim ticket, never a licence — approving is what grants
// one.

const TEXT_FIELDS = {
  nui: 50,
  name: 200,
  fiscalNumber: 200,
  vatNumber: 200,
  address: 200,
  city: 200,
  zipCode: 200,
  country: 200,
  contactPerson: 200,
  phone: 200,
  email: 200,
  sector: 200,
  notes: 2000
};

const FIELD_TO_COLUMN = {
  nui: 'nui',
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

function cleanField(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

licenseRouter.post('/register', (req, res) => {
  const installCode = cleanField(req.body?.installCode, 100).toUpperCase();
  const deviceId = readDeviceId(req);
  if (!installCode) return res.status(400).json({ status: 'error', reason: 'missing_install_code' });
  if (!deviceId) return res.status(400).json({ status: 'error', reason: 'missing_device_id' });

  const name = cleanField(req.body?.name, 200);
  const nui = cleanField(req.body?.nui, 50);
  if (!name) return res.status(400).json({ status: 'error', reason: 'missing_business_name' });
  if (!nui) return res.status(400).json({ status: 'error', reason: 'missing_nui' });

  const existing = db.prepare('SELECT * FROM pending_registrations WHERE install_code = ?').get(installCode);

  // Already approved: hand back the key so the app can finish activating.
  // Synchronize is meant to be pressed repeatedly until it succeeds.
  if (existing?.status === 'approved' && existing.business_id) {
    const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(existing.business_id);
    if (business) {
      return res.json({
        status: 'approved',
        licenseKey: business.license_key,
        business: { name: business.name, nui: business.nui, sector: business.sector, city: business.city }
      });
    }
  }
  if (existing?.status === 'rejected') {
    return res.status(403).json({ status: 'rejected' });
  }

  const values = { install_code: installCode, device_id: deviceId };
  values.device_name = cleanField(req.body?.deviceName, 200);
  values.app_kind = cleanField(req.body?.appKind, 50);
  for (const [field, max] of Object.entries(TEXT_FIELDS)) {
    values[FIELD_TO_COLUMN[field]] = cleanField(req.body?.[field], max);
  }
  if (!values.country) values.country = 'Kosovë';

  if (existing) {
    // Still pending — refresh what the app sent, but keep anything it left
    // out. Synchronize gets pressed repeatedly, sometimes from a screen that
    // only carries part of the details, and a later press must not blank out
    // fields an earlier one already supplied.
    for (const key of Object.keys(values)) {
      if (values[key] === '' && existing[key]) values[key] = existing[key];
    }
    const setSql = Object.keys(values).map((c) => `${c} = @${c}`).join(', ');
    db.prepare(`UPDATE pending_registrations SET ${setSql}, updated_at = datetime('now') WHERE id = @id`).run({
      ...values,
      id: existing.id
    });
  } else {
    const columns = Object.keys(values);
    db.prepare(
      `INSERT INTO pending_registrations (${columns.join(', ')}) VALUES (${columns.map((c) => `@${c}`).join(', ')})`
    ).run(values);
  }

  res.status(202).json({ status: 'pending' });
});

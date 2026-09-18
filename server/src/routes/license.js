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

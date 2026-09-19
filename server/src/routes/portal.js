import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import {
  signPortalToken,
  setPortalCookie,
  clearPortalCookie,
  requirePortal
} from '../auth.js';
import { effectiveStatus } from '../licenses.js';
import {
  readAsOf,
  readPeriod,
  overviewPayload,
  breakdownPayload,
  tableTotals,
  listSales,
  isRestaurantSector
} from '../reports.js';

export const portalRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Shumë përpjekje hyrjeje. Provoni përsëri më vonë.' }
});

function publicBusiness(row) {
  return {
    id: row.id,
    name: row.name,
    nui: row.nui,
    city: row.city,
    sector: row.sector,
    email: row.portal_email,
    mustChangePassword: !!row.portal_must_change_password,
    isRestaurant: isRestaurantSector(row.sector),
    licenseStatus: effectiveStatus(row),
    licenseExpiresAt: row.license_expires_at
  };
}

function loadBusiness(req) {
  return db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.businessId);
}

function requireActivePortal(req, res) {
  const row = loadBusiness(req);
  if (!row || !row.portal_email) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  if (effectiveStatus(row) !== 'active') {
    res.status(403).json({ error: 'Licenca juaj nuk është aktive. Kontaktoni SelliX.' });
    return null;
  }
  return row;
}

portalRouter.post('/login', loginLimiter, (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Email-i dhe fjalëkalimi janë të detyrueshëm' });
  }

  const row = db.prepare("SELECT * FROM businesses WHERE portal_email = ? AND portal_email <> ''").get(email);
  if (!row || !row.portal_password_hash || !bcrypt.compareSync(password, row.portal_password_hash)) {
    return res.status(401).json({ error: 'Email ose fjalëkalim i pasaktë' });
  }

  const status = effectiveStatus(row);
  if (status !== 'active') {
    return res.status(403).json({ error: 'Licenca juaj nuk është aktive. Kontaktoni SelliX.', reason: status });
  }

  db.prepare("UPDATE businesses SET portal_last_login_at = datetime('now') WHERE id = ?").run(row.id);
  setPortalCookie(res, signPortalToken(row));
  res.json({ business: publicBusiness(row) });
});

portalRouter.post('/logout', (req, res) => {
  clearPortalCookie(res);
  res.json({ ok: true });
});

portalRouter.get('/me', requirePortal, (req, res) => {
  const row = requireActivePortal(req, res);
  if (!row) return;
  res.json({ business: publicBusiness(row) });
});

portalRouter.patch('/me/password', requirePortal, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Fjalëkalimi i ri duhet të ketë së paku 8 karaktere' });
  }
  const row = loadBusiness(req);
  if (!row || !row.portal_email) return res.status(401).json({ error: 'Not authenticated' });

  if (!row.portal_must_change_password) {
    if (typeof currentPassword !== 'string' || !bcrypt.compareSync(currentPassword, row.portal_password_hash)) {
      return res.status(401).json({ error: 'Fjalëkalimi aktual është i pasaktë' });
    }
  }

  db.prepare(
    'UPDATE businesses SET portal_password_hash = ?, portal_must_change_password = 0 WHERE id = ?'
  ).run(bcrypt.hashSync(newPassword, 12), row.id);
  res.json({ ok: true });
});

portalRouter.get('/overview', requirePortal, (req, res) => {
  const row = requireActivePortal(req, res);
  if (!row) return;
  res.json(overviewPayload(row, readAsOf(req)));
});

portalRouter.get('/breakdown', requirePortal, (req, res) => {
  const row = requireActivePortal(req, res);
  if (!row) return;
  res.json(breakdownPayload(row.id, readPeriod(req, 'today'), readAsOf(req)));
});

portalRouter.get('/tables', requirePortal, (req, res) => {
  const row = requireActivePortal(req, res);
  if (!row) return;
  const asOf = readAsOf(req);
  const period = readPeriod(req, 'today');
  res.json({
    asOf,
    period,
    tables: tableTotals(row.id, period, asOf)
  });
});

portalRouter.get('/sales', requirePortal, (req, res) => {
  const row = requireActivePortal(req, res);
  if (!row) return;
  const asOf = readAsOf(req);
  const period = readPeriod(req, 'today');
  const limit = Number(req.query?.limit) || 50;
  res.json({
    asOf,
    period,
    sales: listSales(row.id, period, asOf, limit)
  });
});

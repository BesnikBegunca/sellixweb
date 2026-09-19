import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import {
  signPortalToken,
  setPortalCookie,
  clearPortalCookie,
  requirePortal
} from '../auth.js';
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
  message: { error: 'Too many login attempts. Try again later.' }
});

function publicBusiness(row) {
  return {
    id: row.id,
    name: row.name,
    nui: row.nui,
    city: row.city,
    sector: row.sector,
    isRestaurant: isRestaurantSector(row.sector)
  };
}

function loadBusiness(req) {
  return db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.businessId);
}

portalRouter.post('/login', loginLimiter, (req, res) => {
  const header = req.get('x-license-key');
  const body = typeof req.body?.licenseKey === 'string' ? req.body.licenseKey : '';
  const key = (header || body).trim().toUpperCase();
  if (!key) return res.status(400).json({ error: 'License key is required' });

  const row = db.prepare('SELECT * FROM businesses WHERE license_key = ?').get(key);
  if (!row) return res.status(401).json({ error: 'Unknown license key' });

  const token = signPortalToken(row);
  setPortalCookie(res, token);
  res.json({ business: publicBusiness(row) });
});

portalRouter.post('/logout', (req, res) => {
  clearPortalCookie(res);
  res.json({ ok: true });
});

portalRouter.get('/me', requirePortal, (req, res) => {
  const row = loadBusiness(req);
  if (!row) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ business: publicBusiness(row) });
});

portalRouter.get('/overview', requirePortal, (req, res) => {
  const row = loadBusiness(req);
  if (!row) return res.status(401).json({ error: 'Not authenticated' });
  res.json(overviewPayload(row, readAsOf(req)));
});

portalRouter.get('/breakdown', requirePortal, (req, res) => {
  const row = loadBusiness(req);
  if (!row) return res.status(401).json({ error: 'Not authenticated' });
  res.json(breakdownPayload(row.id, readPeriod(req, 'today'), readAsOf(req)));
});

portalRouter.get('/tables', requirePortal, (req, res) => {
  const row = loadBusiness(req);
  if (!row) return res.status(401).json({ error: 'Not authenticated' });
  const asOf = readAsOf(req);
  const period = readPeriod(req, 'today');
  res.json({
    asOf,
    period,
    tables: tableTotals(row.id, period, asOf)
  });
});

portalRouter.get('/sales', requirePortal, (req, res) => {
  const row = loadBusiness(req);
  if (!row) return res.status(401).json({ error: 'Not authenticated' });
  const asOf = readAsOf(req);
  const period = readPeriod(req, 'today');
  const limit = Number(req.query?.limit) || 50;
  res.json({
    asOf,
    period,
    sales: listSales(row.id, period, asOf, limit)
  });
});

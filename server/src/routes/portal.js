import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import {
  signBusinessToken,
  setBusinessSessionCookie,
  clearBusinessSessionCookie,
  requireBusinessAuth
} from '../auth.js';
import { effectiveStatus } from '../licenses.js';
import {
  salesSummary,
  dailySeries,
  monthlySeries,
  paymentBreakdown,
  topProducts,
  tableTotals,
  periodClause,
  PERIOD_KEYS,
  shopNow,
  toAmount
} from '../reports.js';

export const portalRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Shumë përpjekje hyrjeje. Provoni përsëri më vonë.' }
});

// Restaurants and bars/cafés are the sectors that run table service, so they
// are the ones that get the Tables tab. The sector is free text typed by an
// admin, so this matches loosely and in both languages rather than demanding
// an exact value.
const TABLE_SECTOR_PATTERN = /restaurant|restorant|bar|kafe|caf|pub|bistro|pizzer/i;

function hasTables(row) {
  return TABLE_SECTOR_PATTERN.test(row.sector || '');
}

function publicPortalBusiness(row) {
  return {
    id: row.id,
    name: row.name,
    nui: row.nui,
    city: row.city,
    sector: row.sector,
    email: row.portal_email,
    mustChangePassword: !!row.portal_must_change_password,
    hasTables: hasTables(row),
    licenseStatus: effectiveStatus(row),
    licenseExpiresAt: row.license_expires_at
  };
}

function getBusiness(id) {
  return db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
}

portalRouter.post('/login', loginLimiter, (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Email-i dhe fjalëkalimi janë të detyrueshëm' });
  }

  const row = db.prepare("SELECT * FROM businesses WHERE portal_email = ? AND portal_email <> ''").get(email);
  // One message for both a wrong email and a wrong password, so this endpoint
  // cannot be used to discover which businesses have portal accounts.
  if (!row || !row.portal_password_hash || !bcrypt.compareSync(password, row.portal_password_hash)) {
    return res.status(401).json({ error: 'Email ose fjalëkalim i pasaktë' });
  }

  // A revoked or expired licence must not keep opening the portal — the same
  // rule the till is held to.
  const status = effectiveStatus(row);
  if (status !== 'active') {
    return res.status(403).json({ error: 'Licenca juaj nuk është aktive. Kontaktoni SelliX.', reason: status });
  }

  db.prepare("UPDATE businesses SET portal_last_login_at = datetime('now') WHERE id = ?").run(row.id);
  setBusinessSessionCookie(res, signBusinessToken(row));
  res.json({ business: publicPortalBusiness(row) });
});

portalRouter.post('/logout', (req, res) => {
  clearBusinessSessionCookie(res);
  res.json({ ok: true });
});

portalRouter.get('/me', requireBusinessAuth, (req, res) => {
  const row = getBusiness(req.businessId);
  if (!row || !row.portal_email) return res.status(401).json({ error: 'Not authenticated' });
  if (effectiveStatus(row) !== 'active') {
    return res.status(403).json({ error: 'Licenca juaj nuk është aktive.' });
  }
  res.json({ business: publicPortalBusiness(row) });
});

portalRouter.patch('/me/password', requireBusinessAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Fjalëkalimi i ri duhet të ketë së paku 8 karaktere' });
  }
  const row = getBusiness(req.businessId);
  if (!row) return res.status(401).json({ error: 'Not authenticated' });

  // Skipped only while the account is still on the admin-issued temporary
  // password, which the owner has just proven they hold by signing in with it.
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

// --- Reporting -------------------------------------------------------------
// Every endpoint below scopes on req.businessId from the session cookie, never
// on an id from the request, so one shop can never read another's takings.

portalRouter.use(requireBusinessAuth);

function requireActiveBusiness(req, res) {
  const row = getBusiness(req.businessId);
  if (!row) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  if (effectiveStatus(row) !== 'active') {
    res.status(403).json({ error: 'Licenca juaj nuk është aktive.' });
    return null;
  }
  return row;
}

portalRouter.get('/overview', (req, res) => {
  const business = requireActiveBusiness(req, res);
  if (!business) return;

  const now = shopNow();
  const lastSale = db
    .prepare('SELECT sold_at, synced_at FROM sales WHERE business_id = ? ORDER BY sold_at DESC LIMIT 1')
    .get(business.id);

  res.json({
    business: publicPortalBusiness(business),
    summary: salesSummary(business.id, now),
    daily: dailySeries(business.id, now),
    monthly: monthlySeries(business.id, now),
    lastSaleAt: lastSale?.sold_at || null,
    lastSyncAt: lastSale?.synced_at || null
  });
});

function readPeriod(req) {
  const period = typeof req.query.period === 'string' ? req.query.period : 'today';
  return PERIOD_KEYS.includes(period) ? period : 'today';
}

portalRouter.get('/breakdown', (req, res) => {
  const business = requireActiveBusiness(req, res);
  if (!business) return;

  const period = readPeriod(req);
  const now = shopNow();
  const clause = periodClause(period);
  res.json({
    period,
    payments: paymentBreakdown(business.id, clause, now),
    products: topProducts(business.id, clause, now)
  });
});

portalRouter.get('/tables', (req, res) => {
  const business = requireActiveBusiness(req, res);
  if (!business) return;

  const period = readPeriod(req);
  const now = shopNow();
  const tables = tableTotals(business.id, periodClause(period), now);
  const total = tables.reduce((sum, t) => sum + t.total, 0);
  res.json({
    period,
    tables,
    // Rounded once at the end: summing already-rounded euro amounts is exact
    // here, but this keeps the header total from ever showing 1234.5600000001.
    total: Math.round(total * 100) / 100,
    orders: tables.reduce((sum, t) => sum + t.orders, 0)
  });
});

portalRouter.get('/sales', (req, res) => {
  const business = requireActiveBusiness(req, res);
  if (!business) return;

  const period = readPeriod(req);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const rows = db
    .prepare(
      `SELECT * FROM sales
        WHERE business_id = @businessId AND ${periodClause(period)}
        ORDER BY sold_at DESC
        LIMIT @limit`
    )
    .all({ businessId: business.id, now: shopNow(), limit });

  res.json({
    period,
    sales: rows.map((r) => ({
      id: r.id,
      receiptNo: r.receipt_no,
      total: toAmount(r.total_cents),
      currency: r.currency,
      paymentMethod: r.payment_method,
      tableName: r.table_name,
      staffName: r.staff_name,
      soldAt: r.sold_at
    }))
  });
});

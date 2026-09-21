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
import { effectiveStatus, parseTickColor, DEFAULT_TICK_COLOR } from '../licenses.js';
import {
  readAsOf,
  readPeriod,
  overviewPayload,
  breakdownPayload,
  liveTables,
  deviceTotals,
  listSales,
  listShiftCloses,
  isRestaurantSector
} from '../reports.js';
import { subscribe } from '../events.js';
import {
  parseReportKind,
  parseReportPeriod,
  previewReport,
  listSavedReports,
  createSavedReport,
  readSavedReport,
  deleteSavedReport,
  sendPdf
} from '../savedReports.js';

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
    licenseExpiresAt: row.license_expires_at,
    licenseNoticeAt: row.license_notice_at || null,
    verified: !!row.verified,
    verifiedColor: parseTickColor(row.verified_color, DEFAULT_TICK_COLOR)
  };
}

function loadBusiness(req) {
  return db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.businessId);
}

function requireActivePortal(req, res) {
  const row = loadBusiness(req);
  if (!row || row.deleted_at || !row.portal_email) {
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
  if (!row || row.deleted_at || !row.portal_password_hash || !bcrypt.compareSync(password, row.portal_password_hash)) {
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
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.json({ business: publicBusiness(row) });
});

portalRouter.patch('/me/password', requirePortal, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Fjalëkalimi i ri duhet të ketë së paku 8 karaktere' });
  }
  const row = loadBusiness(req);
  if (!row || row.deleted_at || !row.portal_email) return res.status(401).json({ error: 'Not authenticated' });

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

portalRouter.patch('/me/goal', requirePortal, (req, res) => {
  const row = requireActivePortal(req, res);
  if (!row) return;
  const euros = Number(req.body?.goal);
  if (!Number.isFinite(euros) || euros < 0 || euros > 10000000) {
    return res.status(400).json({ error: 'Objektivi duhet të jetë një shumë valide.' });
  }
  const cents = Math.round(euros * 100);
  db.prepare("UPDATE businesses SET daily_goal_cents = ?, updated_at = datetime('now') WHERE id = ?").run(cents, row.id);
  res.json({ goal: cents / 100 });
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
  res.json(liveTables(row.id));
});

// Held open by the browser. It carries no data — it only tells the page that
// this business has new sales, and the page refetches the endpoints above.
// The market counterpart of /tables: takings per till, for shops that have
// computers at the counter instead of tables on a floor.
portalRouter.get('/devices', requirePortal, (req, res) => {
  const row = requireActivePortal(req, res);
  if (!row) return;
  res.json(deviceTotals(row.id, readPeriod(req, 'today'), readAsOf(req)));
});

portalRouter.get('/stream', requirePortal, (req, res) => {
  const row = requireActivePortal(req, res);
  if (!row) return;
  if (typeof res.setTimeout === 'function') res.setTimeout(0);
  subscribe(row.id, req, res);
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

portalRouter.get('/shifts', requirePortal, (req, res) => {
  const row = requireActivePortal(req, res);
  if (!row) return;
  res.json(listShiftCloses(row.id));
});

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Shumë raporte. Provoni përsëri pas një ore.' }
});

portalRouter.get('/reports/preview', requirePortal, (req, res) => {
  const row = requireActivePortal(req, res);
  if (!row) return;
  const kind = parseReportKind(req.query?.kind);
  const period = parseReportPeriod(kind, req.query?.period);
  if (!kind || !period) return res.status(400).json({ error: 'Zgjidh 1 muaj ose 1 vit.' });
  const snapshot = previewReport(row, kind, period);
  if (!snapshot) return res.status(400).json({ error: 'Periudha e zgjedhur nuk është valide.' });
  res.json({
    kind: snapshot.kind,
    period: snapshot.periodKey,
    from: snapshot.from,
    to: snapshot.to,
    title: snapshot.title,
    total: snapshot.total,
    count: snapshot.count
  });
});

portalRouter.get('/reports', requirePortal, (req, res) => {
  const row = requireActivePortal(req, res);
  if (!row) return;
  res.json({ reports: listSavedReports(row.id) });
});

portalRouter.post('/reports', requirePortal, reportLimiter, (req, res) => {
  const row = requireActivePortal(req, res);
  if (!row) return;
  const kind = parseReportKind(req.body?.kind);
  const period = parseReportPeriod(kind, req.body?.period);
  if (!kind || !period) return res.status(400).json({ error: 'Zgjidh 1 muaj ose 1 vit nga lista.' });
  try {
    const { report } = createSavedReport(row, kind, period);
    res.json({ report });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Raporti nuk u krijua.' });
  }
});

portalRouter.get('/reports/:id/file', requirePortal, (req, res) => {
  const row = requireActivePortal(req, res);
  if (!row) return;
  const file = readSavedReport(row.id, req.params.id);
  if (!file || file.missing) return res.status(404).json({ error: 'Raporti nuk u gjet.' });
  sendPdf(res, file.buffer, file.row.file_name);
});

portalRouter.delete('/reports/:id', requirePortal, (req, res) => {
  const row = requireActivePortal(req, res);
  if (!row) return;
  if (!deleteSavedReport(row.id, req.params.id)) return res.status(404).json({ error: 'Raporti nuk u gjet.' });
  res.json({ ok: true });
});

const renewalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Kërkesa u dërgua tashmë. Provoni përsëri pas një ore.' }
});

portalRouter.post('/renewal-request', requirePortal, renewalLimiter, (req, res) => {
  const row = requireActivePortal(req, res);
  if (!row) return;
  const name = String(row.contact_person || row.portal_email || row.name || 'Biznes').slice(0, 200);
  const phone = String(row.phone || row.portal_email || 'portal').slice(0, 60);
  db.prepare('INSERT INTO leads (name, business, phone, category) VALUES (?, ?, ?, ?)').run(
    name,
    row.name,
    phone,
    'Vazhdim licence'
  );
  db.prepare(
    "UPDATE businesses SET license_notice_at = NULL, updated_at = datetime('now') WHERE id = ?"
  ).run(row.id);
  res.json({ ok: true });
});

portalRouter.post('/notice/ack', requirePortal, (req, res) => {
  const row = requireActivePortal(req, res);
  if (!row) return;
  db.prepare(
    "UPDATE businesses SET license_notice_at = NULL, updated_at = datetime('now') WHERE id = ?"
  ).run(row.id);
  res.json({ ok: true });
});

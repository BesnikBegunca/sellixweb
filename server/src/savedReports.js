import fs from 'node:fs';
import path from 'node:path';
import { db, dataDir } from './db.js';
import { shopToday, reportSnapshot, reportTitle, toCents } from './reports.js';
import { buildSalesReportPdf } from './reportPdf.js';

const reportsRoot = path.join(dataDir, 'reports');
fs.mkdirSync(reportsRoot, { recursive: true });

const MAX_PER_BUSINESS = 40;

function dirFor(businessId) {
  const dir = path.join(reportsRoot, String(businessId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function filePath(businessId, fileName) {
  return path.join(dirFor(businessId), fileName);
}

export function publicReport(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    period: row.period_key,
    from: row.period_from,
    to: row.period_to,
    title: row.title,
    total: Math.round(Number(row.total_cents) || 0) / 100,
    count: row.sale_count,
    createdAt: row.created_at,
    fileName: row.file_name
  };
}

export function listSavedReports(businessId) {
  return db
    .prepare(
      `SELECT * FROM saved_reports
       WHERE business_id = ?
       ORDER BY created_at DESC, id DESC`
    )
    .all(businessId)
    .map(publicReport);
}

export function parseReportKind(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'year' || v === 'vit' || v === '1vit' || v === 'vjetor') return 'year';
  if (v === 'month' || v === 'muaj' || v === '1muaj' || v === 'mujor') return 'month';
  return null;
}

export function parseReportPeriod(kind, raw) {
  const v = String(raw || '').trim();
  if (kind === 'year' && /^\d{4}$/.test(v)) return v;
  if (kind === 'month' && /^\d{4}-\d{2}$/.test(v)) return v;
  return null;
}

export function previewReport(business, kind, periodKey) {
  return reportSnapshot(business, kind, periodKey, shopToday());
}

function pruneOldest(businessId) {
  const extras = db
    .prepare(
      `SELECT id, file_name FROM saved_reports
       WHERE business_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT -1 OFFSET ?`
    )
    .all(businessId, MAX_PER_BUSINESS);
  const del = db.prepare('DELETE FROM saved_reports WHERE id = ?');
  for (const row of extras) {
    try {
      fs.unlinkSync(filePath(businessId, row.file_name));
    } catch {
      /* already gone */
    }
    del.run(row.id);
  }
}

export function createSavedReport(business, kind, periodKey) {
  const snapshot = reportSnapshot(business, kind, periodKey, shopToday());
  if (!snapshot) {
    const err = new Error('Periudha e zgjedhur nuk është valide.');
    err.status = 400;
    throw err;
  }
  const pdf = buildSalesReportPdf(snapshot);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `raport-${kind}-${snapshot.periodKey}-${stamp}.pdf`;
  const full = filePath(business.id, fileName);
  fs.writeFileSync(full, pdf);

  const info = db
    .prepare(
      `INSERT INTO saved_reports (
         business_id, kind, period_key, period_from, period_to, title, total_cents, sale_count, file_name
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      business.id,
      kind,
      snapshot.periodKey,
      snapshot.from,
      snapshot.to,
      snapshot.title,
      toCents(snapshot.total) || 0,
      snapshot.count,
      fileName
    );

  pruneOldest(business.id);
  const row = db.prepare('SELECT * FROM saved_reports WHERE id = ?').get(info.lastInsertRowid);
  return { report: publicReport(row), pdf, fileName };
}

export function readSavedReport(businessId, reportId) {
  const row = db
    .prepare('SELECT * FROM saved_reports WHERE id = ? AND business_id = ?')
    .get(Number(reportId), businessId);
  if (!row) return null;
  const full = filePath(businessId, row.file_name);
  if (!fs.existsSync(full)) return { row, missing: true };
  return { row, buffer: fs.readFileSync(full), missing: false };
}

export function deleteSavedReport(businessId, reportId) {
  const row = db
    .prepare('SELECT * FROM saved_reports WHERE id = ? AND business_id = ?')
    .get(Number(reportId), businessId);
  if (!row) return false;
  try {
    fs.unlinkSync(filePath(businessId, row.file_name));
  } catch {
    /* ignore */
  }
  db.prepare('DELETE FROM saved_reports WHERE id = ?').run(row.id);
  return true;
}

/** Wipe all saved PDF reports for a business (files + DB rows). */
export function deleteAllSavedReports(businessId) {
  const rows = db
    .prepare('SELECT id, file_name FROM saved_reports WHERE business_id = ?')
    .all(Number(businessId));
  for (const row of rows) {
    try {
      fs.unlinkSync(filePath(businessId, row.file_name));
    } catch {
      /* ignore */
    }
  }
  const info = db.prepare('DELETE FROM saved_reports WHERE business_id = ?').run(Number(businessId));
  return { reports: info.changes, files: rows.length };
}

export function sendPdf(res, buffer, fileName) {
  const safe = String(fileName || 'raport.pdf').replace(/[^\w.\-]+/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}

export { reportTitle };

import crypto from 'node:crypto';
import { db } from './db.js';

export const DEVICE_COOKIE = 'sellix_did';
const ACTIVE_SQL = `revoked_at IS NULL AND datetime(last_seen_at) > datetime('now', '-12 hours')`;

export function deviceLabel(userAgent) {
  const s = String(userAgent || '');
  let browser = 'Browser';
  if (/Edg\//i.test(s)) browser = 'Edge';
  else if (/Chrome\//i.test(s) && !/Edg/i.test(s)) browser = 'Chrome';
  else if (/Firefox\//i.test(s)) browser = 'Firefox';
  else if (/Safari\//i.test(s) && !/Chrome/i.test(s)) browser = 'Safari';
  let os = 'pajisje';
  if (/iPhone|iPad/i.test(s)) os = 'iPhone';
  else if (/Android/i.test(s)) os = 'Android';
  else if (/Windows/i.test(s)) os = 'Windows';
  else if (/Mac OS|Macintosh/i.test(s)) os = 'Mac';
  else if (/Linux/i.test(s)) os = 'Linux';
  return `${browser} · ${os}`;
}

export function ensureDeviceCookie(req, res, cookieOptions) {
  let id = typeof req.cookies?.[DEVICE_COOKIE] === 'string' ? req.cookies[DEVICE_COOKIE] : '';
  if (!/^[a-f0-9]{32}$/i.test(id)) {
    id = crypto.randomBytes(16).toString('hex');
    res.cookie(DEVICE_COOKIE, id, { ...cookieOptions, maxAge: 400 * 24 * 60 * 60 * 1000 });
  }
  return id.toLowerCase();
}

export function startSession(kind, accountId, req, res, cookieOptions) {
  const deviceId = ensureDeviceCookie(req, res, cookieOptions);
  const jti = crypto.randomBytes(16).toString('hex');
  const ua = String(req.headers['user-agent'] || '').slice(0, 400);
  const ip = String(req.ip || req.socket?.remoteAddress || '').slice(0, 80);
  const label = deviceLabel(ua);
  const existing = db
    .prepare(
      `SELECT id FROM login_sessions
       WHERE kind = ? AND account_id = ? AND device_id = ? AND revoked_at IS NULL`
    )
    .get(kind, accountId, deviceId);
  if (existing) {
    db.prepare(
      `UPDATE login_sessions
          SET jti = ?, device_label = ?, user_agent = ?, ip = ?, last_seen_at = datetime('now')
        WHERE id = ?`
    ).run(jti, label, ua, ip, existing.id);
  } else {
    db.prepare(
      `INSERT INTO login_sessions (kind, account_id, jti, device_id, device_label, user_agent, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(kind, accountId, jti, deviceId, label, ua, ip);
  }
  return jti;
}

export function isSessionActive(jti) {
  if (!jti) return true;
  const row = db
    .prepare(`SELECT 1 FROM login_sessions WHERE jti = ? AND ${ACTIVE_SQL}`)
    .get(jti);
  return Boolean(row);
}

export function touchSession(jti) {
  if (!jti) return;
  db.prepare(
    `UPDATE login_sessions SET last_seen_at = datetime('now') WHERE jti = ? AND revoked_at IS NULL`
  ).run(jti);
}

export function revokeSession(jti) {
  if (!jti) return;
  db.prepare(`UPDATE login_sessions SET revoked_at = datetime('now') WHERE jti = ? AND revoked_at IS NULL`).run(jti);
}

export function revokeAccountSessions(kind, accountId) {
  db.prepare(
    `UPDATE login_sessions SET revoked_at = datetime('now')
     WHERE kind = ? AND account_id = ? AND revoked_at IS NULL`
  ).run(kind, accountId);
}

export function countActiveDevices(kind, accountId) {
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT device_id) AS n
       FROM login_sessions
       WHERE kind = ? AND account_id = ? AND ${ACTIVE_SQL}`
    )
    .get(kind, accountId);
  return row?.n || 0;
}

export function listActiveDevices(kind, accountId) {
  return db
    .prepare(
      `SELECT device_id AS deviceId,
              device_label AS label,
              ip,
              MIN(created_at) AS createdAt,
              MAX(last_seen_at) AS lastSeenAt
       FROM login_sessions
       WHERE kind = ? AND account_id = ? AND ${ACTIVE_SQL}
       GROUP BY device_id
       ORDER BY lastSeenAt DESC`
    )
    .all(kind, accountId)
    .map((row) => ({
      deviceId: row.deviceId,
      label: row.label || 'Pajisje',
      ip: row.ip || '',
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt
    }));
}

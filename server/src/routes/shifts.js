import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { effectiveStatus, findLiveByLicenseKey } from '../licenses.js';
import { toCents } from '../reports.js';
import { publish } from '../events.js';
import { notifyGjendjaEvents } from '../push.js';

export const shiftsRouter = Router();

const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'rate_limited' }
});

shiftsRouter.use(syncLimiter);

const MAX_SHIFTS = 200;

function readKey(req) {
  const header = req.get('x-license-key');
  const body = typeof req.body?.licenseKey === 'string' ? req.body.licenseKey : '';
  return (header || body).trim().toUpperCase();
}

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

function asString(value, max = 200) {
  if (value == null) return '';
  return String(value).trim().slice(0, max);
}

function normalizeLocalAt(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : null;
}

function parseWaiters(raw) {
  let list = raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    list = Object.entries(raw).map(([name, w]) => ({
      name,
      ...(w && typeof w === 'object' ? w : { total: w })
    }));
  }
  if (!Array.isArray(list)) return [];
  return list.slice(0, 80).map((row) => {
    if (!row || typeof row !== 'object') return null;
    const name = asString(pick(row, 'name', 'staffName', 'waiter'), 200);
    if (!name) return null;
    const total = toCents(pick(row, 'total', 'grandTotal') ?? 0) ?? 0;
    const paid = toCents(pick(row, 'paid', 'paidTotal') ?? 0) ?? 0;
    const open = toCents(pick(row, 'open', 'openTotal') ?? 0) ?? 0;
    return { name, total: total / 100, paid: paid / 100, open: open / 100 };
  }).filter(Boolean);
}

function parseShift(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const eventUid = asString(pick(raw, 'eventUid', 'event_uid', 'shiftUid', 'shift_uid', 'uid'), 200);
  if (!eventUid) return null;
  const openedAt = normalizeLocalAt(pick(raw, 'openedAt', 'opened_at'));
  const closedAt = normalizeLocalAt(pick(raw, 'closedAt', 'closed_at', 'printedAt', 'printed_at', 'eventAt'));
  if (!openedAt || !closedAt) return null;
  const total = toCents(pick(raw, 'total', 'totalSales', 'total_sales') ?? 0);
  if (total == null) return null;
  const kindRaw = asString(pick(raw, 'kind', 'type'), 20).toLowerCase();
  return {
    event_uid: eventUid,
    shift_uid: asString(pick(raw, 'shiftUid', 'shift_uid'), 200) || eventUid,
    kind: kindRaw === 'printed' || kindRaw === 'print' ? 'printed' : 'closed',
    opened_at: openedAt,
    closed_at: closedAt,
    closed_by: asString(pick(raw, 'closedBy', 'closed_by', 'staffName'), 200),
    total_cents: total,
    paid_cents: toCents(pick(raw, 'paid', 'paidTotal', 'grandPaid') ?? 0) ?? 0,
    open_cents: toCents(pick(raw, 'open', 'openTotal', 'grandOpen') ?? 0) ?? 0,
    expenses_cents: toCents(pick(raw, 'expenses', 'totalExpenses') ?? 0) ?? 0,
    waiters_json: JSON.stringify(parseWaiters(pick(raw, 'waiters', 'byWaiter')))
  };
}

const upsertShift = db.prepare(`
  INSERT INTO shift_closes (
    business_id, event_uid, shift_uid, kind, device_id, opened_at, closed_at, closed_by,
    total_cents, paid_cents, open_cents, expenses_cents, waiters_json, synced_at
  ) VALUES (
    @business_id, @event_uid, @shift_uid, @kind, @device_id, @opened_at, @closed_at, @closed_by,
    @total_cents, @paid_cents, @open_cents, @expenses_cents, @waiters_json, datetime('now')
  )
  ON CONFLICT (business_id, event_uid) DO UPDATE SET
    shift_uid = excluded.shift_uid,
    kind = excluded.kind,
    device_id = excluded.device_id,
    opened_at = excluded.opened_at,
    closed_at = excluded.closed_at,
    closed_by = excluded.closed_by,
    total_cents = excluded.total_cents,
    paid_cents = excluded.paid_cents,
    open_cents = excluded.open_cents,
    expenses_cents = excluded.expenses_cents,
    waiters_json = excluded.waiters_json,
    synced_at = datetime('now')
`);

const syncBatch = db.transaction((businessId, deviceId, rawShifts) => {
  let accepted = 0;
  let rejected = 0;
  const events = [];
  for (const raw of rawShifts) {
    const shift = parseShift(raw);
    if (!shift) {
      rejected += 1;
      continue;
    }
    upsertShift.run({ business_id: businessId, device_id: deviceId, ...shift });
    events.push({
      kind: shift.kind,
      totalCents: shift.total_cents,
      eventUid: shift.event_uid
    });
    accepted += 1;
  }
  return { accepted, rejected, events };
});

shiftsRouter.post('/sync', (req, res) => {
  const key = readKey(req);
  if (!key) return res.status(400).json({ ok: false, error: 'missing_license_key' });

  const row = findLiveByLicenseKey(key);
  if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
  if (effectiveStatus(row) === 'revoked') return res.status(403).json({ ok: false, error: 'revoked' });

  const shifts = Array.isArray(req.body?.shifts) ? req.body.shifts : null;
  if (!shifts) return res.status(400).json({ ok: false, error: 'shifts_required' });
  if (shifts.length > MAX_SHIFTS) return res.status(400).json({ ok: false, error: 'too_many_shifts', max: MAX_SHIFTS });

  const deviceId = asString(pick(req.body, 'deviceId', 'device_id'), 200);
  const result = syncBatch(row.id, deviceId, shifts);
  if (result.accepted > 0) {
    publish(row.id, { shifts: result.accepted });
    setImmediate(() => {
      notifyGjendjaEvents(row, result.events || [])
        .then((r) => {
          if (r && r.ok === false) console.warn('gjendja notify skip', row.id, r.reason || r);
          else if (r && !r.delivered) console.warn('gjendja notify no delivery', row.id, r);
        })
        .catch((err) => console.warn('gjendja notify', err?.message));
    });
  }
  res.json({ ok: true, accepted: result.accepted, rejected: result.rejected });
});

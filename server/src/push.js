// Web Push for the business portal.
//
// The portal is installed as a home-screen app (PWA). Each phone or browser
// that turns notifications on stores one subscription here, and the server
// pushes to it through the browser vendor's push service (Apple on iOS 16.4+,
// Google/Mozilla elsewhere). Two things send pushes: a business reaching its
// daily goal, and a message an admin writes on the Notifications page.
import webpush from 'web-push';
import { db } from './db.js';
import { shopToday, dayBarTotal } from './reports.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_sent_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_push_subscriptions_business ON push_subscriptions (business_id);

  -- One goal push per business per shop day, however many syncs follow.
  CREATE TABLE IF NOT EXISTS goal_pushes (
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    total_cents INTEGER NOT NULL DEFAULT 0,
    goal_cents INTEGER NOT NULL DEFAULT 0,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (business_id, day)
  );

  -- Tracks last notified total / milestone so Always / Customize don't spam.
  CREATE TABLE IF NOT EXISTS notify_state (
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    last_total_cents INTEGER NOT NULL DEFAULT 0,
    last_milestone INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (business_id, day)
  );

  CREATE TABLE IF NOT EXISTS admin_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    url TEXT NOT NULL DEFAULT '',
    target TEXT NOT NULL DEFAULT 'all',
    business_ids TEXT NOT NULL DEFAULT '[]',
    businesses_count INTEGER NOT NULL DEFAULT 0,
    delivered INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// VAPID keys identify this server to the push services. Set them in the
// environment for production; otherwise a pair is generated once and kept in
// the database, so subscriptions survive restarts either way. Changing the
// keys invalidates every existing subscription.
function loadVapid() {
  const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  if (envPublic && envPrivate) return { publicKey: envPublic, privateKey: envPrivate };

  const get = db.prepare('SELECT value FROM app_settings WHERE key = ?');
  const savedPublic = get.get('vapid_public_key')?.value;
  const savedPrivate = get.get('vapid_private_key')?.value;
  if (savedPublic && savedPrivate) return { publicKey: savedPublic, privateKey: savedPrivate };

  const keys = webpush.generateVAPIDKeys();
  const put = db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)');
  put.run('vapid_public_key', keys.publicKey);
  put.run('vapid_private_key', keys.privateKey);
  return keys;
}

const vapid = loadVapid();
webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:info@sellix.software', vapid.publicKey, vapid.privateKey);

export const vapidPublicKey = vapid.publicKey;

export function saveSubscription(businessId, sub, userAgent = '') {
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint.trim() : '';
  const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : '';
  const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : '';
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth) return false;
  // An endpoint belongs to one browser; if another business logs in on the
  // same phone the subscription moves to that business.
  db.prepare(
    `INSERT INTO push_subscriptions (business_id, endpoint, p256dh, auth, user_agent)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET business_id = excluded.business_id, p256dh = excluded.p256dh,
       auth = excluded.auth, user_agent = excluded.user_agent`
  ).run(businessId, endpoint, p256dh, auth, String(userAgent).slice(0, 300));
  return true;
}

export function removeSubscription(businessId, endpoint) {
  db.prepare('DELETE FROM push_subscriptions WHERE business_id = ? AND endpoint = ?').run(businessId, String(endpoint || ''));
}

export function subscriptionCount(businessId) {
  return db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE business_id = ?').get(businessId).n;
}

/** Sends one notification to every device of the given businesses. */
export async function sendToBusinesses(businessIds, message) {
  if (!businessIds.length) return { delivered: 0, failed: 0 };
  const placeholders = businessIds.map(() => '?').join(',');
  const subs = db
    .prepare(`SELECT * FROM push_subscriptions WHERE business_id IN (${placeholders})`)
    .all(...businessIds);

  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url || '/portal',
    tag: message.tag || undefined,
  });
  const drop = db.prepare('DELETE FROM push_subscriptions WHERE id = ?');
  const touch = db.prepare("UPDATE push_subscriptions SET last_sent_at = datetime('now') WHERE id = ?");

  let delivered = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 24, urgency: 'high' }
        );
        touch.run(s.id);
        delivered++;
      } catch (err) {
        failed++;
        // 404/410: the user removed the app or turned notifications off.
        if (err?.statusCode === 404 || err?.statusCode === 410) drop.run(s.id);
        else console.warn('push failed', err?.statusCode || '', err?.body || err?.message);
      }
    })
  );
  return { delivered, failed };
}

function todayNotifyCents(businessId) {
  const day = shopToday();
  const bar = dayBarTotal(businessId, day);
  return Math.max(0, Math.round(Number(bar.total || 0) * 100));
}

function readNotifyPrefs(business) {
  const mode = String(business.notify_mode || 'customize').toLowerCase();
  const threshold =
    business.notify_threshold_cents > 0
      ? business.notify_threshold_cents
      : business.daily_goal_cents > 0
        ? business.daily_goal_cents
        : 10000;
  if (mode === 'always' || mode === 'off' || mode === 'customize') {
    return { mode, thresholdCents: threshold };
  }
  return { mode: 'customize', thresholdCents: threshold };
}

function getNotifyState(businessId, day) {
  return (
    db.prepare('SELECT * FROM notify_state WHERE business_id = ? AND day = ?').get(businessId, day) || {
      last_total_cents: 0,
      last_milestone: 0
    }
  );
}

function upsertNotifyState(businessId, day, lastTotalCents, lastMilestone) {
  db.prepare(
    `INSERT INTO notify_state (business_id, day, last_total_cents, last_milestone)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(business_id, day) DO UPDATE SET
       last_total_cents = excluded.last_total_cents,
       last_milestone = excluded.last_milestone`
  ).run(businessId, day, lastTotalCents, lastMilestone);
}

function euroPlain(cents) {
  const v = Math.max(0, Number(cents) || 0) / 100;
  return Number.isInteger(v) ? `${v} EURO` : `${v.toFixed(2)} EURO`;
}

function notifyPayload(business, printedCents, totalCents, tag) {
  const name = String(business.name || 'SelliX').trim() || 'SelliX';
  return {
    title: name,
    body: `PRINTUAR ${euroPlain(printedCents)}\nTOTALI : ${euroPlain(totalCents)}`,
    url: '/portal',
    tag
  };
}

/**
 * After till sync (sales or gjendja). Sends push based on portal notify settings:
 * - always: every time today's total goes up
 * - customize: when total crosses the user threshold (100€, 200€, …)
 * - off: no automatic total pushes
 */
export async function checkSalesNotify(business) {
  const prefs = readNotifyPrefs(business);
  if (prefs.mode === 'off') return;

  const day = shopToday();
  const total = todayNotifyCents(business.id);
  if (total <= 0) return;

  const state = getNotifyState(business.id, day);
  const printed = Math.max(0, total - (state.last_total_cents || 0));

  if (prefs.mode === 'always') {
    if (total <= state.last_total_cents) return;
    upsertNotifyState(business.id, day, total, state.last_milestone);
    await sendToBusinesses(
      [business.id],
      notifyPayload(business, printed, total, `total-${day}-${total}`)
    );
    return;
  }

  // customize — milestone every N euros (e.g. 100, 200, 300…)
  const step = prefs.thresholdCents;
  if (step <= 0) return;
  const milestone = Math.floor(total / step);
  if (milestone < 1 || milestone <= state.last_milestone) return;

  upsertNotifyState(business.id, day, total, milestone);
  await sendToBusinesses(
    [business.id],
    notifyPayload(business, printed || step, total, `threshold-${day}-${milestone}`)
  );
}

/** @deprecated use checkSalesNotify — kept so older call sites still work */
export async function checkDailyGoal(business) {
  return checkSalesNotify(business);
}

/** Keeps every admin-originated push in the Notifications history. */
export function logAdminNotification({ title, body, url, target, businessIds, result, createdBy }) {
  db.prepare(
    `INSERT INTO admin_notifications (title, body, url, target, business_ids, businesses_count, delivered, failed, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(title, body, url || '/portal', target, JSON.stringify(businessIds), businessIds.length, result.delivered, result.failed, createdBy || '');
}

/** Push that accompanies the in-portal "license expiring" popup. */
export async function sendLicenseNotice(business, createdBy) {
  const expires = new Date(`${String(business.license_expires_at).replace(' ', 'T')}Z`);
  const days = Math.ceil((expires.getTime() - Date.now()) / 86400000);
  const date = Number.isNaN(expires.getTime())
    ? ''
    : `${String(expires.getUTCDate()).padStart(2, '0')}.${String(expires.getUTCMonth() + 1).padStart(2, '0')}.${expires.getUTCFullYear()}`;
  const expired = days < 0;
  const title = expired ? 'Licenca juaj ka skaduar' : 'Licenca juaj skadon së shpejti';
  const when = expired ? `skadoi më ${date}` : days === 0 ? 'skadon sot' : `skadon edhe ${days} ditë${date ? ` (${date})` : ''}`;
  const body = `Licenca e SelliX për ${business.name} ${when}. Hapni aplikacionin për të kërkuar vazhdimin.`;
  const result = await sendToBusinesses([business.id], { title, body, url: '/portal', tag: `license-${business.id}` });
  logAdminNotification({ title, body, url: '/portal', target: 'license', businessIds: [business.id], result, createdBy });
  return { ...result, devices: subscriptionCount(business.id) };
}

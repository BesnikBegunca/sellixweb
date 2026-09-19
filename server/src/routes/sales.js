import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { effectiveStatus } from '../licenses.js';

export const salesRouter = Router();

// Same shape of trust as the licence endpoints: the till authenticates with its
// licence key, not a cookie. The limit is higher than the licence limiter's
// because a shop reconnecting after a long offline stretch legitimately pushes
// many batches back to back.
const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, reason: 'rate_limited' }
});

salesRouter.use(syncLimiter);

function readKey(req) {
  const header = req.get('x-license-key');
  const body = typeof req.body?.licenseKey === 'string' ? req.body.licenseKey : '';
  return (header || body).trim().toUpperCase();
}

function clean(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

// Accepts either minor units (`totalCents`) or a decimal amount (`total`), so a
// till can send whichever it already has. Rounding at the boundary is what
// keeps 19.99 from ever becoming 1998 cents.
function readCents(source, centsKey, amountKey) {
  const cents = source?.[centsKey];
  if (typeof cents === 'number' && Number.isFinite(cents)) return Math.round(cents);
  const amount = source?.[amountKey];
  if (typeof amount === 'number' && Number.isFinite(amount)) return Math.round(amount * 100);
  // Tills that serialise money as a string still land on a number here rather
  // than silently reporting zero takings.
  if (typeof amount === 'string' && amount.trim() !== '') {
    const parsed = Number(amount);
    if (Number.isFinite(parsed)) return Math.round(parsed * 100);
  }
  return 0;
}

// `soldAt` decides which day/week/month a sale counts in, so a malformed or
// missing value must not quietly become "now" — that would move real takings
// onto the wrong day. Anything unparseable rejects the sale instead.
function readSoldAt(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  // Already a local 'YYYY-MM-DD HH:MM:SS' (or with a T) — keep it verbatim so
  // no timezone maths shifts the shop's own clock.
  const local = raw.replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2}([ ]\d{2}:\d{2}(:\d{2})?)?$/.test(local)) {
    return local.length === 10 ? `${local} 00:00:00` : local.padEnd(19, ':00').slice(0, 19);
  }
  // An instant with an explicit offset (…Z, +02:00): convert to the offset the
  // till stated, so the sale still lands on the shop's own calendar day.
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}

salesRouter.post('/sync', (req, res) => {
  const key = readKey(req);
  if (!key) return res.status(400).json({ ok: false, reason: 'missing_license_key' });

  const business = db.prepare('SELECT * FROM businesses WHERE license_key = ?').get(key);
  if (!business) return res.status(404).json({ ok: false, reason: 'not_found' });

  const status = effectiveStatus(business);
  if (status !== 'active') return res.status(403).json({ ok: false, reason: status });

  const sales = Array.isArray(req.body?.sales) ? req.body.sales : null;
  if (!sales) return res.status(400).json({ ok: false, reason: 'missing_sales' });
  if (sales.length > 500) return res.status(400).json({ ok: false, reason: 'batch_too_large' });

  const deviceId = clean(req.body?.deviceId, 200);

  const upsertSale = db.prepare(`
    INSERT INTO sales (
      business_id, sale_uid, device_id, receipt_no, total_cents, tax_cents,
      discount_cents, currency, payment_method, table_name, staff_name, sold_at, synced_at
    ) VALUES (
      @business_id, @sale_uid, @device_id, @receipt_no, @total_cents, @tax_cents,
      @discount_cents, @currency, @payment_method, @table_name, @staff_name, @sold_at, datetime('now')
    )
    ON CONFLICT (business_id, sale_uid) DO UPDATE SET
      device_id = excluded.device_id,
      receipt_no = excluded.receipt_no,
      total_cents = excluded.total_cents,
      tax_cents = excluded.tax_cents,
      discount_cents = excluded.discount_cents,
      currency = excluded.currency,
      payment_method = excluded.payment_method,
      table_name = excluded.table_name,
      staff_name = excluded.staff_name,
      sold_at = excluded.sold_at,
      synced_at = datetime('now')
  `);

  const findSale = db.prepare('SELECT id FROM sales WHERE business_id = ? AND sale_uid = ?');
  const clearItems = db.prepare('DELETE FROM sale_items WHERE sale_id = ?');
  const insertItem = db.prepare(`
    INSERT INTO sale_items (sale_id, name, sku, category, quantity, unit_price_cents, total_cents)
    VALUES (@sale_id, @name, @sku, @category, @quantity, @unit_price_cents, @total_cents)
  `);

  const rejected = [];

  // One transaction for the whole batch: a till that drops mid-push either has
  // all of its sales recorded or none, never a half-counted day.
  const runBatch = db.transaction(() => {
    let accepted = 0;
    for (const [index, sale] of sales.entries()) {
      const saleUid = clean(sale?.saleUid || sale?.id, 120);
      if (!saleUid) {
        rejected.push({ index, reason: 'missing_sale_uid' });
        continue;
      }
      const soldAt = readSoldAt(sale?.soldAt || sale?.closedAt);
      if (!soldAt) {
        rejected.push({ index, saleUid, reason: 'invalid_sold_at' });
        continue;
      }

      upsertSale.run({
        business_id: business.id,
        sale_uid: saleUid,
        device_id: clean(sale?.deviceId, 200) || deviceId,
        receipt_no: clean(sale?.receiptNo, 60),
        total_cents: readCents(sale, 'totalCents', 'total'),
        tax_cents: readCents(sale, 'taxCents', 'tax'),
        discount_cents: readCents(sale, 'discountCents', 'discount'),
        currency: clean(sale?.currency, 8).toUpperCase() || 'EUR',
        payment_method: clean(sale?.paymentMethod, 40).toLowerCase(),
        table_name: clean(sale?.tableName || sale?.table, 60),
        staff_name: clean(sale?.staffName, 120),
        sold_at: soldAt
      });

      const saleId = findSale.get(business.id, saleUid).id;

      // Items are replaced rather than appended, so re-syncing a corrected sale
      // cannot leave the superseded lines behind and double the product totals.
      if (Array.isArray(sale?.items)) {
        clearItems.run(saleId);
        for (const item of sale.items.slice(0, 200)) {
          const quantity = Number(item?.quantity);
          insertItem.run({
            sale_id: saleId,
            name: clean(item?.name, 200),
            sku: clean(item?.sku, 80),
            category: clean(item?.category, 120),
            quantity: Number.isFinite(quantity) ? quantity : 1,
            unit_price_cents: readCents(item, 'unitPriceCents', 'unitPrice'),
            total_cents: readCents(item, 'totalCents', 'total')
          });
        }
      }
      accepted++;
    }
    return accepted;
  });

  const accepted = runBatch();
  res.json({ ok: true, accepted, rejected });
});

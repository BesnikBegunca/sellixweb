import { db } from './db.js';

// Every total in the portal is computed straight from the `sales` rows the
// tills pushed up. Nothing here is precomputed or cached: a shop that re-syncs
// a corrected sale sees the corrected figure on the next page load.

// Money is stored in cents and only ever divided on the way out, so summing
// thousands of sales never accumulates floating point drift.
export function toAmount(cents) {
  return Math.round(cents || 0) / 100;
}

// The till reports `sold_at` in the shop's own local time, and every bucket
// below is cut with SQLite's local-time-naive string comparison on that same
// column. So "today" means the shop's today, not the server's UTC day — which
// is the whole point for a bar that closes at 2am.
const PERIODS = {
  today: "date(sold_at) = date(@now)",
  yesterday: "date(sold_at) = date(@now, '-1 day')",
  // Monday-based week, matching how the shops actually report. SQLite's %w is
  // Sunday-based (0=Sun), so shifting by 6 days rolls Sunday into the week
  // that just ended rather than starting a new one.
  week: "date(sold_at) >= date(@now, 'weekday 1', '-7 days') AND date(sold_at) <= date(@now)",
  month: "strftime('%Y-%m', sold_at) = strftime('%Y-%m', @now)",
  year: "strftime('%Y', sold_at) = strftime('%Y', @now)",
  all: '1 = 1'
};

function periodSummary(businessId, clause, now) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS orders,
              COALESCE(SUM(total_cents), 0) AS total_cents,
              COALESCE(SUM(tax_cents), 0) AS tax_cents,
              COALESCE(SUM(discount_cents), 0) AS discount_cents
         FROM sales
        WHERE business_id = @businessId AND ${clause}`
    )
    .get({ businessId, now });

  const orders = row.orders || 0;
  return {
    orders,
    total: toAmount(row.total_cents),
    tax: toAmount(row.tax_cents),
    discount: toAmount(row.discount_cents),
    // An empty period must report 0, not NaN from dividing by zero orders.
    average: orders ? toAmount(row.total_cents / orders) : 0
  };
}

export function salesSummary(businessId, now) {
  const summary = {};
  for (const [key, clause] of Object.entries(PERIODS)) {
    summary[key] = periodSummary(businessId, clause, now);
  }
  return summary;
}

// The last 14 days, every day present even when the shop took nothing — a gap
// in a chart reads as "no data", but a zero reads as "a closed day", which is
// the truth the owner needs.
export function dailySeries(businessId, now, days = 14) {
  const rows = db
    .prepare(
      `SELECT date(sold_at) AS day,
              COUNT(*) AS orders,
              COALESCE(SUM(total_cents), 0) AS total_cents
         FROM sales
        WHERE business_id = @businessId
          AND date(sold_at) > date(@now, @offset)
          AND date(sold_at) <= date(@now)
        GROUP BY day`
    )
    .all({ businessId, now, offset: `-${days} days` });

  const byDay = new Map(rows.map((r) => [r.day, r]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = db.prepare("SELECT date(@now, @offset) AS d").get({ now, offset: `-${i} days` }).d;
    const hit = byDay.get(day);
    series.push({ date: day, orders: hit?.orders || 0, total: toAmount(hit?.total_cents || 0) });
  }
  return series;
}

// Calendar months of the current year, so the yearly tab has something to plot.
export function monthlySeries(businessId, now) {
  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', sold_at) AS month,
              COUNT(*) AS orders,
              COALESCE(SUM(total_cents), 0) AS total_cents
         FROM sales
        WHERE business_id = @businessId
          AND strftime('%Y', sold_at) = strftime('%Y', @now)
        GROUP BY month`
    )
    .all({ businessId, now });

  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const year = db.prepare("SELECT strftime('%Y', @now) AS y").get({ now }).y;
  const series = [];
  for (let m = 1; m <= 12; m++) {
    const month = `${year}-${String(m).padStart(2, '0')}`;
    const hit = byMonth.get(month);
    series.push({ month, orders: hit?.orders || 0, total: toAmount(hit?.total_cents || 0) });
  }
  return series;
}

export function paymentBreakdown(businessId, clause, now) {
  return db
    .prepare(
      `SELECT CASE WHEN payment_method = '' THEN 'other' ELSE payment_method END AS method,
              COUNT(*) AS orders,
              COALESCE(SUM(total_cents), 0) AS total_cents
         FROM sales
        WHERE business_id = @businessId AND ${clause}
        GROUP BY method
        ORDER BY total_cents DESC`
    )
    .all({ businessId, now })
    .map((r) => ({ method: r.method, orders: r.orders, total: toAmount(r.total_cents) }));
}

export function topProducts(businessId, clause, now, limit = 10) {
  return db
    .prepare(
      `SELECT i.name AS name,
              COALESCE(SUM(i.quantity), 0) AS quantity,
              COALESCE(SUM(i.total_cents), 0) AS total_cents
         FROM sale_items i
         JOIN sales s ON s.id = i.sale_id
        WHERE s.business_id = @businessId AND ${clause.replaceAll('sold_at', 's.sold_at')}
          AND i.name <> ''
        GROUP BY i.name
        ORDER BY total_cents DESC
        LIMIT @limit`
    )
    .all({ businessId, now, limit })
    .map((r) => ({ name: r.name, quantity: r.quantity, total: toAmount(r.total_cents) }));
}

// --- Restaurant tables -----------------------------------------------------
// Takings grouped by the table the sale was rung up on. Sales with no table
// (takeaway, bar counter) are excluded rather than lumped into one blank row,
// which would otherwise dominate the list and mean nothing to the owner.
export function tableTotals(businessId, clause, now) {
  return db
    .prepare(
      `SELECT table_name,
              COUNT(*) AS orders,
              COALESCE(SUM(total_cents), 0) AS total_cents,
              MAX(sold_at) AS last_sale_at
         FROM sales
        WHERE business_id = @businessId AND table_name <> '' AND ${clause}
        GROUP BY table_name
        ORDER BY total_cents DESC`
    )
    .all({ businessId, now })
    .map((r) => ({
      tableName: r.table_name,
      orders: r.orders,
      total: toAmount(r.total_cents),
      average: r.orders ? toAmount(r.total_cents / r.orders) : 0,
      lastSaleAt: r.last_sale_at
    }));
}

export function periodClause(period) {
  return PERIODS[period] || PERIODS.today;
}

export const PERIOD_KEYS = Object.keys(PERIODS);

// The shop's local "now". Everything above is cut relative to this one value,
// so a single timezone offset moves every bucket together and the numbers stay
// mutually consistent.
export function shopNow() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

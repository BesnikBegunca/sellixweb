import { db } from './db.js';

// Sector names in the dashboard are Albanian ("Restorante", "Kafene & bar")
// or English ("restaurant", "pizzeria"). One regex covers both so the tables
// tab appears for the businesses the till is actually used in.
export const RESTAURANT_SECTOR = /restaurant|restorant|bar|kafe|caf|pub|bistro|pizzer/i;

export function isRestaurantSector(sector) {
  return RESTAURANT_SECTOR.test(String(sector || ''));
}

const PERIODS = new Set(['today', 'yesterday', 'week', 'month', 'year', 'all']);

const PERIOD_ALIASES = {
  sot: 'today',
  dje: 'yesterday',
  jave: 'week',
  javë: 'week',
  muaj: 'month',
  vit: 'year',
  gjithsej: 'all',
  total: 'all'
};

export function shopToday(timeZone = 'Europe/Belgrade') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

export function readAsOf(req) {
  const q = typeof req.query?.date === 'string' ? req.query.date.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : shopToday();
}

export function readPeriod(req, fallback = 'today') {
  const raw = typeof req.query?.period === 'string' ? req.query.period.trim().toLowerCase() : '';
  const mapped = PERIOD_ALIASES[raw] || raw;
  return PERIODS.has(mapped) ? mapped : fallback;
}

export function toCents(value) {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function fromCents(cents) {
  return Math.round(Number(cents) || 0) / 100;
}

function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function periodBounds(period, asOf) {
  switch (period) {
    case 'today':
      return { from: asOf, to: asOf };
    case 'yesterday': {
      const y = addDays(asOf, -1);
      return { from: y, to: y };
    }
    case 'week':
      return { from: addDays(asOf, -6), to: asOf };
    case 'month':
      return { from: addDays(asOf, -29), to: asOf };
    case 'year':
      return { from: addDays(asOf, -364), to: asOf };
    case 'all':
    default:
      return null;
  }
}

function periodFilter(period, asOf, column = 'sold_at') {
  const bounds = periodBounds(period, asOf);
  if (!bounds) return { sql: '', params: [] };
  return {
    sql: ` AND date(${column}) >= ? AND date(${column}) <= ?`,
    params: [bounds.from, bounds.to]
  };
}

function sumSales(businessId, period, asOf) {
  const filter = periodFilter(period, asOf);
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(total_cents), 0) AS total_cents, COUNT(*) AS count
       FROM sales
       WHERE business_id = ?${filter.sql}`
    )
    .get(businessId, ...filter.params);
  return { total: fromCents(row.total_cents), count: row.count };
}

export function periodTotals(businessId, asOf) {
  return {
    today: sumSales(businessId, 'today', asOf),
    yesterday: sumSales(businessId, 'yesterday', asOf),
    week: sumSales(businessId, 'week', asOf),
    month: sumSales(businessId, 'month', asOf),
    year: sumSales(businessId, 'year', asOf),
    all: sumSales(businessId, 'all', asOf)
  };
}

const TABLE_NAME_RE = /(?:tavolina|table)\s*(\d+)/i;

function tableNumber(name) {
  const match = String(name || '').match(TABLE_NAME_RE);
  return match ? Number(match[1]) : null;
}

function openTableRows(businessId) {
  return db
    .prepare(
      `SELECT table_name AS name,
              COALESCE(SUM(total_cents), 0) AS total_cents,
              COUNT(*) AS count,
              TRIM(COALESCE(staff_name, '')) AS staff_name
       FROM sales
       WHERE business_id = ?
         AND TRIM(table_name) != ''
         AND LOWER(COALESCE(status, 'paid')) = 'open'
       GROUP BY table_name, TRIM(COALESCE(staff_name, ''))`
    )
    .all(businessId);
}

function mapTableRow(row, occupied = true) {
  return {
    name: row.name,
    occupied,
    total: occupied ? fromCents(row.total_cents) : 0,
    count: occupied ? (row.count || 1) : 0,
    staffName: String(row.staff_name || '').trim()
  };
}

function sortTables(tables) {
  return tables.sort(
    (a, b) =>
      (tableNumber(a.name) || 0) - (tableNumber(b.name) || 0) ||
      a.name.localeCompare(b.name, 'sq', { sensitivity: 'base' }) ||
      a.staffName.localeCompare(b.staffName, 'sq', { sensitivity: 'base' })
  );
}

/** Live floor from the till snapshot; falls back to open printed sales. */
export function liveTables(businessId) {
  const snapshot = db
    .prepare(
      `SELECT table_name AS name, occupied, total_cents, staff_name
       FROM restaurant_tables
       WHERE business_id = ?
       ORDER BY table_name COLLATE NOCASE ASC, staff_name COLLATE NOCASE ASC`
    )
    .all(businessId);

  let tables;
  if (snapshot.length > 0) {
    tables = sortTables(
      snapshot
        .map((row) => mapTableRow(row, Number(row.occupied) === 1))
        .filter((t) => t.occupied)
    );
  } else {
    const occupied = [];
    for (const row of openTableRows(businessId)) {
      const number = tableNumber(row.name);
      occupied.push(mapTableRow({ ...row, name: number ? `Tavolina ${number}` : row.name }));
    }
    tables = sortTables(occupied);
  }

  return {
    occupied: tables.length,
    free: 0,
    openTotal: tables.reduce((sum, t) => sum + t.total, 0),
    tables
  };
}

export function tableTotals(businessId, period, asOf) {
  return liveTables(businessId).tables;
}

export function dailySeries(businessId, asOf, days = 14) {
  const from = addDays(asOf, -(days - 1));
  const rows = db
    .prepare(
      `SELECT date(sold_at) AS day,
              COALESCE(SUM(total_cents), 0) AS total_cents,
              COUNT(*) AS count
       FROM sales
       WHERE business_id = ?
         AND date(sold_at) >= ?
         AND date(sold_at) <= ?
       GROUP BY date(sold_at)`
    )
    .all(businessId, from, asOf);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(asOf, -i);
    const row = byDay.get(day);
    series.push({
      date: day,
      total: fromCents(row?.total_cents),
      count: row?.count || 0
    });
  }
  return series;
}

export function monthlySeries(businessId, asOf, months = 12) {
  const [y, m] = asOf.split('-').map(Number);
  const keys = [];
  for (let i = months - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1 - i, 1));
    keys.push(dt.toISOString().slice(0, 7));
  }
  const fromMonth = keys[0];
  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', sold_at) AS month,
              COALESCE(SUM(total_cents), 0) AS total_cents,
              COUNT(*) AS count
       FROM sales
       WHERE business_id = ?
         AND strftime('%Y-%m', sold_at) >= ?
         AND strftime('%Y-%m', sold_at) <= ?
       GROUP BY strftime('%Y-%m', sold_at)`
    )
    .all(businessId, fromMonth, asOf.slice(0, 7));
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return keys.map((month) => {
    const row = byMonth.get(month);
    return {
      month,
      total: fromCents(row?.total_cents),
      count: row?.count || 0
    };
  });
}

export function paymentBreakdown(businessId, period, asOf) {
  const filter = periodFilter(period, asOf);
  const rows = db
    .prepare(
      `SELECT CASE WHEN TRIM(payment_method) = '' THEN 'unknown' ELSE payment_method END AS method,
              COALESCE(SUM(total_cents), 0) AS total_cents,
              COUNT(*) AS count
       FROM sales
       WHERE business_id = ?${filter.sql}
       GROUP BY CASE WHEN TRIM(payment_method) = '' THEN 'unknown' ELSE payment_method END
       ORDER BY total_cents DESC`
    )
    .all(businessId, ...filter.params);
  return rows.map((r) => ({
    method: r.method,
    total: fromCents(r.total_cents),
    count: r.count
  }));
}

export function topProducts(businessId, period, asOf, limit = 12) {
  const filter = periodFilter(period, asOf, 's.sold_at');
  const rows = db
    .prepare(
      `SELECT i.name AS name,
              COALESCE(SUM(i.quantity), 0) AS quantity,
              COALESCE(SUM(i.total_cents), 0) AS total_cents
       FROM sale_items i
       JOIN sales s ON s.id = i.sale_id
       WHERE s.business_id = ?${filter.sql}
       GROUP BY i.name
       ORDER BY total_cents DESC, quantity DESC
       LIMIT ?`
    )
    .all(businessId, ...filter.params, limit);
  return rows.map((r) => ({
    name: r.name,
    quantity: Number(r.quantity) || 0,
    total: fromCents(r.total_cents)
  }));
}

export function listSales(businessId, period, asOf, limit = 50) {
  const filter = periodFilter(period, asOf);
  const cap = Math.min(200, Math.max(1, Number(limit) || 50));
  const rows = db
    .prepare(
      `SELECT * FROM sales
       WHERE business_id = ?${filter.sql}
       ORDER BY sold_at DESC, id DESC
       LIMIT ?`
    )
    .all(businessId, ...filter.params, cap);

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const items = db
    .prepare(`SELECT * FROM sale_items WHERE sale_id IN (${placeholders}) ORDER BY id ASC`)
    .all(...ids);
  const bySale = new Map();
  for (const item of items) {
    const list = bySale.get(item.sale_id) || [];
    list.push({
      name: item.name,
      quantity: Number(item.quantity) || 0,
      unitPrice: fromCents(item.unit_price_cents),
      total: fromCents(item.total_cents),
      category: item.category
    });
    bySale.set(item.sale_id, list);
  }

  return rows.map((r) => ({
    saleUid: r.sale_uid,
    soldAt: r.sold_at,
    total: fromCents(r.total_cents),
    tax: fromCents(r.tax_cents),
    discount: fromCents(r.discount_cents),
    paymentMethod: r.payment_method,
    tableName: r.table_name,
    receiptNo: r.receipt_no,
    staffName: r.staff_name,
    items: bySale.get(r.id) || []
  }));
}

export function overviewPayload(business, asOf) {
  return {
    business: {
      id: business.id,
      name: business.name,
      sector: business.sector,
      isRestaurant: isRestaurantSector(business.sector)
    },
    asOf,
    totals: periodTotals(business.id, asOf)
  };
}

export function breakdownPayload(businessId, period, asOf) {
  return {
    asOf,
    period,
    days: dailySeries(businessId, asOf, 14),
    months: monthlySeries(businessId, asOf, 12),
    payments: paymentBreakdown(businessId, period, asOf),
    products: topProducts(businessId, period, asOf)
  };
}

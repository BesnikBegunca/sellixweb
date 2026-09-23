import { db } from './db.js';

// Sector names in the dashboard are Albanian ("Restorante", "Kafene & bar")
// or English ("restaurant", "pizzeria"). One regex covers both so the tables
// tab appears for the businesses the till is actually used in.
export const RESTAURANT_SECTOR = /restaurant|restorant|bar|kafe|caf|pub|bistro|pizzer/i;

export function isRestaurantSector(sector) {
  return RESTAURANT_SECTOR.test(String(sector || ''));
}

const PERIODS = new Set(['today', 'yesterday', 'week', 'month', 'month3', 'month6', 'month9', 'year', 'all']);

const PERIOD_ALIASES = {
  sot: 'today',
  dje: 'yesterday',
  jave: 'week',
  javë: 'week',
  muaj: 'month',
  '3muaj': 'month3',
  '6muaj': 'month6',
  '9muaj': 'month9',
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

// Orders that count on the bar / totals. Void = admin/manager deleted on the till.
const ACTIVE_SALE_SQL = `AND LOWER(COALESCE(status, 'paid')) NOT IN ('void', 'deleted', 'cancelled', 'canceled')`;

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
    case 'month3':
      return { from: addDays(asOf, -89), to: asOf };
    case 'month6':
      return { from: addDays(asOf, -179), to: asOf };
    case 'month9':
      return { from: addDays(asOf, -269), to: asOf };
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

export function rangeFilter(from, to, column = 'sold_at') {
  return {
    sql: ` AND date(${column}) >= ? AND date(${column}) <= ?`,
    params: [from, to]
  };
}

const MONTHS_SQ = [
  'Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor',
  'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'
];

export function calendarMonthBounds(ym, asOf) {
  const match = String(ym || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (m < 1 || m > 12) return null;
  const from = `${match[1]}-${match[2]}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let to = `${match[1]}-${match[2]}-${String(last).padStart(2, '0')}`;
  if (asOf && to > asOf) to = asOf;
  if (asOf && from > asOf) return null;
  return { from, to };
}

export function calendarYearBounds(year, asOf) {
  const y = String(year || '').trim();
  if (!/^\d{4}$/.test(y)) return null;
  const from = `${y}-01-01`;
  let to = `${y}-12-31`;
  if (asOf && to > asOf) to = asOf;
  if (asOf && from > asOf) return null;
  return { from, to };
}

export function reportTitle(kind, periodKey) {
  if (kind === 'year') return `Raport vjetor · ${periodKey}`;
  const [y, m] = String(periodKey).split('-');
  const month = MONTHS_SQ[Number(m) - 1] || m;
  return `Raport mujor · ${month} ${y}`;
}

export function staffBreakdown(businessId, from, to) {
  const filter = rangeFilter(from, to);
  const rows = db
    .prepare(
      `SELECT CASE WHEN TRIM(COALESCE(staff_name, '')) = '' THEN 'Pa emër' ELSE TRIM(staff_name) END AS name,
              COALESCE(SUM(total_cents), 0) AS total_cents,
              COUNT(*) AS count
       FROM sales
       WHERE business_id = ?${filter.sql}
       GROUP BY CASE WHEN TRIM(COALESCE(staff_name, '')) = '' THEN 'Pa emër' ELSE TRIM(staff_name) END
       ORDER BY total_cents DESC`
    )
    .all(businessId, ...filter.params);
  return rows.map((r) => ({
    name: r.name,
    total: fromCents(r.total_cents),
    count: r.count
  }));
}

export function sumRange(businessId, from, to) {
  const filter = rangeFilter(from, to);
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(total_cents), 0) AS total_cents, COUNT(*) AS count
       FROM sales
       WHERE business_id = ?
         ${ACTIVE_SALE_SQL}${filter.sql}`
    )
    .get(businessId, ...filter.params);
  return { total: fromCents(row.total_cents), count: row.count };
}

export function dailySeriesRange(businessId, from, to) {
  const rows = db
    .prepare(
      `SELECT date(sold_at) AS day,
              COALESCE(SUM(total_cents), 0) AS total_cents,
              COUNT(*) AS count
       FROM sales
       WHERE business_id = ?
         ${ACTIVE_SALE_SQL}
         AND date(sold_at) >= ?
         AND date(sold_at) <= ?
       GROUP BY date(sold_at)
       ORDER BY day ASC`
    )
    .all(businessId, from, to);
  return rows.map((r) => ({
    date: r.day,
    total: fromCents(r.total_cents),
    count: r.count
  }));
}

export function monthlySeriesRange(businessId, from, to) {
  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', sold_at) AS month,
              COALESCE(SUM(total_cents), 0) AS total_cents,
              COUNT(*) AS count
       FROM sales
       WHERE business_id = ?
         ${ACTIVE_SALE_SQL}
         AND date(sold_at) >= ?
         AND date(sold_at) <= ?
       GROUP BY strftime('%Y-%m', sold_at)
       ORDER BY month ASC`
    )
    .all(businessId, from, to);
  return rows.map((r) => ({
    month: r.month,
    total: fromCents(r.total_cents),
    count: r.count
  }));
}

function paymentsInRange(businessId, from, to) {
  const filter = rangeFilter(from, to);
  const rows = db
    .prepare(
      `SELECT CASE WHEN TRIM(payment_method) = '' THEN 'unknown' ELSE payment_method END AS method,
              COALESCE(SUM(total_cents), 0) AS total_cents,
              COUNT(*) AS count
       FROM sales
       WHERE business_id = ?
         ${ACTIVE_SALE_SQL}${filter.sql}
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

function productsInRange(businessId, from, to, limit = 15) {
  const filter = rangeFilter(from, to, 's.sold_at');
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

export function reportSnapshot(business, kind, periodKey, asOf = shopToday()) {
  const bounds = kind === 'year'
    ? calendarYearBounds(periodKey, asOf)
    : calendarMonthBounds(periodKey, asOf);
  if (!bounds) return null;
  const { from, to } = bounds;
  const totals = sumRange(business.id, from, to);
  return {
    business: {
      name: business.name,
      nui: business.nui,
      city: business.city,
      sector: business.sector
    },
    kind,
    periodKey,
    from,
    to,
    title: reportTitle(kind, periodKey),
    total: totals.total,
    count: totals.count,
    staff: staffBreakdown(business.id, from, to),
    payments: paymentsInRange(business.id, from, to),
    products: productsInRange(business.id, from, to),
    days: kind === 'month' ? dailySeriesRange(business.id, from, to) : [],
    months: kind === 'year' ? monthlySeriesRange(business.id, from, to) : []
  };
}

// Orders that count on the bar / totals. Void = admin/manager deleted on the till.
/** Total of active orders (open + paid). Paguaj does not shrink this; only void does. */
function sumSales(businessId, period, asOf) {
  const filter = periodFilter(period, asOf);
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(total_cents), 0) AS total_cents, COUNT(*) AS count
       FROM sales
       WHERE business_id = ?
         ${ACTIVE_SALE_SQL}${filter.sql}`
    )
    .get(businessId, ...filter.params);
  return { total: fromCents(row.total_cents), count: row.count };
}

export function periodTotals(businessId, asOf) {
  return {
    today: dayBarTotal(businessId, asOf),
    yesterday: sumSales(businessId, 'yesterday', asOf),
    week: sumSales(businessId, 'week', asOf),
    month: sumSales(businessId, 'month', asOf),
    month3: sumSales(businessId, 'month3', asOf),
    month6: sumSales(businessId, 'month6', asOf),
    month9: sumSales(businessId, 'month9', asOf),
    year: sumSales(businessId, 'year', asOf),
    all: sumSales(businessId, 'all', asOf)
  };
}

/**
 * Bar from Shtyp/Mbyll — latest event per shift for the day.
 */
export function shiftDayBar(businessId, asOf) {
  const rows = db
    .prepare(
      `SELECT s.total_cents AS total_cents
       FROM shift_closes s
       INNER JOIN (
         SELECT CASE
                  WHEN TRIM(COALESCE(shift_uid, '')) = '' THEN event_uid
                  ELSE shift_uid
                END AS sk,
                MAX(id) AS max_id
         FROM shift_closes
         WHERE business_id = ?
           AND date(closed_at) = ?
         GROUP BY sk
       ) latest ON latest.max_id = s.id`
    )
    .all(businessId, asOf);
  const cents = rows.reduce((sum, r) => sum + (Number(r.total_cents) || 0), 0);
  return { total: fromCents(cents), count: rows.length };
}

/**
 * Live day bar: follows gjendja live (open + paid invoices) as the till syncs.
 * Printo / floor sync raises it immediately; Paguaj only flips open→paid so the
 * amount stays. Shtyp/Mbyll is used when it is higher (or before any invoice).
 */
export function dayBarTotal(businessId, asOf) {
  const live = dayOrdersTotal(businessId, asOf);
  const printed = shiftDayBar(businessId, asOf);
  if (live.total >= printed.total) return live;
  return printed;
}

/** Day's active orders (open + paid). Drops only when the till voids an order. */
export function dayOrdersTotal(businessId, asOf) {
  return sumSales(businessId, 'today', asOf);
}

const TABLE_NAME_RE = /(?:tavolina|table)\s*(\d+)/i;

function tableNumber(name) {
  const match = String(name || '').match(TABLE_NAME_RE);
  return match ? Number(match[1]) : null;
}

function openTableRows(businessId) {
  // One open invoice per table+staff (latest). Never SUM — duplicates from
  // floor:* + POS open used to show 30€ when the till had 20€.
  return db
    .prepare(
      `SELECT s.table_name AS name,
              s.total_cents AS total_cents,
              1 AS count,
              TRIM(COALESCE(s.staff_name, '')) AS staff_name
       FROM sales s
       INNER JOIN (
         SELECT TRIM(table_name) AS tn,
                TRIM(COALESCE(staff_name, '')) AS sn,
                MAX(id) AS max_id
         FROM sales
         WHERE business_id = ?
           AND TRIM(table_name) != ''
           AND LOWER(COALESCE(status, 'paid')) = 'open'
         GROUP BY TRIM(table_name), TRIM(COALESCE(staff_name, ''))
       ) latest ON latest.max_id = s.id`
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

/**
 * Live tavolina + waiter print bar for today.
 *
 * Bar = paid today + open tabs (deduped). Paguaj moves open→paid so the bar
 * never drops — only the table leaves the grid when the till marks it free.
 */
export function liveTables(businessId, asOf = shopToday()) {
  const snapshot = db
    .prepare(
      `SELECT table_name AS name, occupied, total_cents, staff_name
       FROM restaurant_tables
       WHERE business_id = ?
       ORDER BY table_name COLLATE NOCASE ASC, staff_name COLLATE NOCASE ASC`
    )
    .all(businessId);

  const freeTableNames = new Set();
  const hasFloor = snapshot.length > 0;
  for (const row of snapshot) {
    if (Number(row.occupied) === 1) continue;
    const number = tableNumber(row.name);
    const name = number ? `Tavolina ${number}` : row.name;
    freeTableNames.add(name.trim().toLowerCase());
  }

  const byKey = new Map();
  for (const row of openTableRows(businessId)) {
    const number = tableNumber(row.name);
    const name = number ? `Tavolina ${number}` : row.name;
    // Till already freed the table — hide it from the grid, but openSalesLatestSum
    // still counts the invoice until Paguaj lands (bar must not drop).
    if (hasFloor && freeTableNames.has(name.trim().toLowerCase())) continue;
    const staffName = String(row.staff_name || '').trim();
    byKey.set(
      `${name}\0${staffName}`,
      mapTableRow({ ...row, name, staff_name: staffName })
    );
  }

  for (const row of snapshot) {
    if (Number(row.occupied) !== 1) continue;
    const number = tableNumber(row.name);
    const name = number ? `Tavolina ${number}` : row.name;
    const staffName = String(row.staff_name || '').trim();
    const key = `${name}\0${staffName}`;
    if (byKey.has(key)) continue;
    byKey.set(key, mapTableRow({ ...row, name, staff_name: staffName }, true));
  }

  const tables = sortTables([...byKey.values()]);
  // What is sitting on the floor right now — falls when a table is paid/freed.
  const openTotal = tables.reduce((sum, t) => sum + t.total, 0);
  const printed = dayBarTotal(businessId, asOf);
  const orders = dayOrdersTotal(businessId, asOf);

  return {
    occupied: tables.length,
    free: 0,
    openTotal,
    orders,
    asOf,
    bar: {
      total: printed.total,
      count: printed.count
    },
    tables
  };
}

export function tableTotals(businessId, period, asOf) {
  return liveTables(businessId).tables;
}

// --- Tills ("kompjuterat") ------------------------------------------------
//
// A market has no tables, so the split an owner asks for is per till: how much
// did computer 1 take, how much did computer 2. The till already stamps every
// receipt with its `deviceId` on POST /api/sales/sync, and the same id is what
// it activated the licence with, so the two join up without any new field.
//
// The number is the order the tills were activated in, which keeps "Kompjuteri
// 2" meaning the same machine tomorrow as it does today.
export function deviceNumbers(businessId) {
  const rows = db
    .prepare(
      `SELECT device_id
         FROM license_activations
        WHERE business_id = ? AND TRIM(device_id) != ''
        ORDER BY activated_at ASC, id ASC`
    )
    .all(businessId);
  const numbers = new Map();
  rows.forEach((row, index) => numbers.set(String(row.device_id), index + 1));
  return numbers;
}

export function deviceTotals(businessId, period, asOf) {
  const activations = db
    .prepare(
      `SELECT device_id, device_name, activated_at, last_seen_at
         FROM license_activations
        WHERE business_id = ? AND TRIM(device_id) != ''
        ORDER BY activated_at ASC, id ASC`
    )
    .all(businessId);

  const filter = periodFilter(period, asOf);
  const sold = db
    .prepare(
      `SELECT device_id,
              COALESCE(SUM(total_cents), 0) AS total_cents,
              COUNT(*) AS count,
              MAX(sold_at) AS last_sold_at
         FROM sales
        WHERE business_id = ?
          ${ACTIVE_SALE_SQL}${filter.sql}
        GROUP BY device_id`
    )
    .all(businessId, ...filter.params);

  const byDevice = new Map(sold.map((r) => [String(r.device_id || ''), r]));

  const devices = [];
  activations.forEach((row, index) => {
    const key = String(row.device_id);
    const sale = byDevice.get(key);
    byDevice.delete(key);
    devices.push({
      deviceId: key,
      // A till that sold nothing this period still belongs on the page —
      // "that one took nothing today" is exactly what the owner is checking.
      number: index + 1,
      machineName: String(row.device_name || '').trim(),
      total: fromCents(sale?.total_cents),
      count: sale?.count || 0,
      lastSoldAt: sale?.last_sold_at || null,
      lastSeenAt: row.last_seen_at || null,
      activated: true
    });
  });

  // Receipts whose till was never activated, or was activated and later
  // released. Without these the cards would not add up to the day's total.
  // Receipts that carry no device id at all are grouped last, since there is
  // no till to point at.
  const leftovers = [...byDevice.entries()].sort(([a], [b]) => {
    if (a === b) return 0;
    if (a === '') return 1;
    if (b === '') return -1;
    return a.localeCompare(b);
  });
  let extra = activations.length;
  for (const [key, sale] of leftovers) {
    devices.push({
      deviceId: key,
      number: key ? ++extra : null,
      machineName: '',
      total: fromCents(sale.total_cents),
      count: sale.count || 0,
      lastSoldAt: sale.last_sold_at || null,
      lastSeenAt: null,
      activated: false
    });
  }

  const total = devices.reduce((sum, d) => sum + d.total, 0);
  const count = devices.reduce((sum, d) => sum + d.count, 0);
  for (const device of devices) {
    device.share = total > 0 ? Math.round((device.total / total) * 1000) / 10 : 0;
  }

  return {
    asOf,
    period,
    total: Math.round(total * 100) / 100,
    count,
    devices
  };
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
         ${ACTIVE_SALE_SQL}
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
         ${ACTIVE_SALE_SQL}
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
       WHERE business_id = ?
         ${ACTIVE_SALE_SQL}${filter.sql}
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
       WHERE s.business_id = ?
         AND LOWER(COALESCE(s.status, 'paid')) NOT IN ('void', 'deleted', 'cancelled', 'canceled')${filter.sql}
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
       WHERE business_id = ?
         ${ACTIVE_SALE_SQL}${filter.sql}
       ORDER BY sold_at DESC, id DESC
       LIMIT ?`
    )
    .all(businessId, ...filter.params, cap);

  if (rows.length === 0) return [];

  // Markets label a receipt by the till that rang it up, the way a restaurant
  // labels one by its table.
  const numbers = deviceNumbers(businessId);
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
    deviceId: r.device_id || '',
    deviceNumber: numbers.get(String(r.device_id || '')) || null,
    receiptNo: r.receipt_no,
    staffName: r.staff_name,
    status: String(r.status || 'paid').toLowerCase() === 'open' ? 'open' : 'paid',
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
    totals: periodTotals(business.id, asOf),
    goal: fromCents(business.daily_goal_cents) || 200
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

function parseWaiters(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((w) => ({
        name: String(w?.name || '').trim(),
        total: Number(w?.total) || 0,
        paid: Number(w?.paid) || 0,
        open: Number(w?.open) || 0
      }))
      .filter((w) => w.name);
  } catch {
    return [];
  }
}

/** Closed gjendja rows posted by the restaurant till. */
export function listShiftCloses(businessId) {
  const rows = db.prepare(`
    SELECT * FROM shift_closes
    WHERE business_id = ?
    ORDER BY closed_at ASC, id ASC
  `).all(businessId);

  // Pair Shtyp → Mbyll per shift_uid so the portal can show:
  // - deri te Shtyp (printed.total)
  // - nga Shtyp deri Mbyll (closed.total - printed.total)
  const byShift = new Map();
  for (const r of rows) {
    const sk =
      String(r.shift_uid || '').trim() ||
      String(r.event_uid || '').trim() ||
      String(r.id);
    const list = byShift.get(sk) || [];
    list.push(r);
    byShift.set(sk, list);
  }

  const shifts = [];
  let untilPrintSum = 0;
  let printToCloseSum = 0;
  let closedCount = 0;
  let closedTotal = 0;

  for (const [, events] of byShift) {
    let lastPrinted = null;
    for (const r of events) {
      const kind = r.kind === 'printed' ? 'printed' : 'closed';
      const total = fromCents(r.total_cents);
      const base = {
        uid: r.event_uid,
        shiftUid: r.shift_uid,
        kind,
        openedAt: r.opened_at,
        closedAt: r.closed_at,
        closedBy: r.closed_by || '',
        total,
        paid: fromCents(r.paid_cents),
        open: fromCents(r.open_cents),
        waiters: parseWaiters(r.waiters_json),
        untilPrint: null,
        printToClose: null
      };

      if (kind === 'printed') {
        lastPrinted = r;
        base.untilPrint = total;
        untilPrintSum += total;
        shifts.push(base);
        continue;
      }

      // closed
      closedCount += 1;
      closedTotal += total;
      if (lastPrinted) {
        const printedTotal = fromCents(lastPrinted.total_cents);
        base.untilPrint = printedTotal;
        base.printToClose = Math.max(0, total - printedTotal);
        printToCloseSum += base.printToClose;
        lastPrinted = null;
      } else {
        // No Shtyp before this Mbyll — whole close counts as "deri te mbyllja".
        base.untilPrint = total;
        base.printToClose = 0;
        untilPrintSum += total;
      }
      shifts.push(base);
    }
  }

  // Newest first for the UI.
  shifts.sort((a, b) => String(b.closedAt).localeCompare(String(a.closedAt)));

  return {
    count: closedCount,
    total: closedTotal,
    untilPrint: untilPrintSum,
    printToClose: printToCloseSum,
    shifts
  };
}

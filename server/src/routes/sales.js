import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { effectiveStatus, findLiveByLicenseKey } from '../licenses.js';
import { toCents } from '../reports.js';
import { publish } from '../events.js';

export const salesRouter = Router();

// A busy lunch service can post after every closed table, plus a catch-up
// burst when the till comes back online. 60/15min (the license limiter)
// would drop real receipts.
const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'rate_limited' }
});

salesRouter.use(syncLimiter);

const MAX_SALES = 500;
const MAX_ITEMS = 200;

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

function normalizeSoldAt(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : null;
}

function parseItem(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const name = asString(pick(raw, 'name', 'productName', 'product_name'), 200);
  if (!name) return null;
  const quantityRaw = pick(raw, 'quantity', 'qty');
  const quantity = quantityRaw == null || quantityRaw === '' ? 1 : Number(quantityRaw);
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  const unitPrice = toCents(pick(raw, 'unitPrice', 'unit_price', 'price') ?? 0);
  if (unitPrice == null) return null;
  const lineTotalRaw = pick(raw, 'total', 'lineTotal', 'line_total');
  const total = lineTotalRaw == null || lineTotalRaw === '' ? Math.round(quantity * unitPrice) : toCents(lineTotalRaw);
  if (total == null) return null;
  return {
    name,
    quantity,
    unit_price_cents: unitPrice,
    total_cents: total,
    category: asString(pick(raw, 'category'), 200)
  };
}

function optionalString(raw, keys, max) {
  const value = pick(raw, ...keys);
  if (value === undefined) return undefined;
  return asString(value, max);
}

function optionalCents(raw, keys, fallback) {
  const value = pick(raw, ...keys);
  if (value === undefined) return undefined;
  return toCents(value ?? fallback);
}

function parseSale(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const saleUid = asString(pick(raw, 'saleUid', 'sale_uid', 'uid', 'id'), 200);
  if (!saleUid) return null;
  const soldAt = normalizeSoldAt(pick(raw, 'soldAt', 'sold_at', 'soldAtLocal'));
  if (!soldAt) return null;

  const itemsRaw = pick(raw, 'items', 'lines');
  const hasItems = Array.isArray(itemsRaw);
  const items = hasItems ? itemsRaw.slice(0, MAX_ITEMS).map(parseItem).filter(Boolean) : [];

  const total = toCents(pick(raw, 'total', 'totalAmount', 'total_amount'));
  const tax = optionalCents(raw, ['tax', 'taxAmount', 'tax_amount'], 0);
  const discount = optionalCents(raw, ['discount', 'discountAmount', 'discount_amount'], 0);
  if (total == null || tax === null || discount === null) return null;

  const summed = items.reduce((acc, item) => acc + item.total_cents, 0);
  return {
    sale_uid: saleUid,
    sold_at: soldAt,
    total_cents: total === 0 && summed ? summed : total,
    tax_cents: tax,
    discount_cents: discount,
    payment_method: optionalString(raw, ['paymentMethod', 'payment_method', 'payment'], 50),
    table_name: optionalString(raw, ['tableName', 'table_name', 'table'], 200),
    receipt_no: optionalString(raw, ['receiptNo', 'receipt_no', 'receipt'], 50),
    staff_name: optionalString(raw, ['staffName', 'staff_name', 'staff', 'waiter'], 200),
    status: parseTableStatus(raw),
    hasItems,
    items
  };
}

function parseTableStatus(raw) {
  const value = asString(pick(raw, 'status', 'tableStatus', 'state'), 20).toLowerCase();
  if (value === 'open' || value === 'printed' || value === 'occupied') return 'open';
  if (value === 'paid' || value === 'closed' || value === 'completed') return 'paid';
  // Admin / manager deleted or cancelled the order on the till — drops the bar.
  if (value === 'void' || value === 'deleted' || value === 'cancelled' || value === 'canceled') {
    return 'void';
  }
  return undefined;
}

const insertSale = db.prepare(`
  INSERT INTO sales (
    business_id, sale_uid, device_id, sold_at, total_cents, tax_cents, discount_cents,
    payment_method, table_name, receipt_no, staff_name, status, synced_at
  ) VALUES (
    @business_id, @sale_uid, @device_id, @sold_at, @total_cents, @tax_cents, @discount_cents,
    @payment_method, @table_name, @receipt_no, @staff_name, @status, datetime('now')
  )
`);

const updateSale = db.prepare(`
  UPDATE sales SET
    device_id = @device_id,
    sold_at = @sold_at,
    total_cents = @total_cents,
    tax_cents = @tax_cents,
    discount_cents = @discount_cents,
    payment_method = @payment_method,
    table_name = @table_name,
    receipt_no = @receipt_no,
    staff_name = @staff_name,
    status = @status,
    synced_at = datetime('now')
  WHERE id = @id
`);

const findSale = db.prepare('SELECT * FROM sales WHERE business_id = ? AND sale_uid = ?');
const findOpenOnTable = db.prepare(`
  SELECT * FROM sales
  WHERE business_id = ?
    AND TRIM(table_name) = TRIM(?)
    AND LOWER(COALESCE(status, 'paid')) = 'open'
  ORDER BY
    CASE WHEN TRIM(COALESCE(staff_name, '')) = TRIM(?) THEN 0 ELSE 1 END,
    id DESC
  LIMIT 1
`);
// Never DELETE order amounts on Paguaj — void duplicates only. Bar stays unless
// the till later sends status=void for an admin/manager delete.
const voidAllFloorOpensOnTable = db.prepare(`
  UPDATE sales SET status = 'void', synced_at = datetime('now')
  WHERE business_id = ?
    AND TRIM(table_name) = TRIM(?)
    AND LOWER(COALESCE(status, 'paid')) = 'open'
    AND sale_uid LIKE 'floor:%'
`);
const voidOpensOnTableExceptUid = db.prepare(`
  UPDATE sales SET status = 'void', synced_at = datetime('now')
  WHERE business_id = ?
    AND TRIM(table_name) = TRIM(?)
    AND LOWER(COALESCE(status, 'paid')) = 'open'
    AND sale_uid != ?
`);
const voidOtherOpensOnTable = db.prepare(`
  UPDATE sales SET status = 'void', synced_at = datetime('now')
  WHERE business_id = ?
    AND TRIM(table_name) = TRIM(?)
    AND LOWER(COALESCE(status, 'paid')) = 'open'
    AND id != ?
`);
const deleteItems = db.prepare('DELETE FROM sale_items WHERE sale_id = ?');
const insertItem = db.prepare(`
  INSERT INTO sale_items (sale_id, name, quantity, unit_price_cents, total_cents, category)
  VALUES (@sale_id, @name, @quantity, @unit_price_cents, @total_cents, @category)
`);

function shopNowLocal(timeZone = 'Europe/Belgrade') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}


function upsertSale(businessId, deviceId, sale) {
  const existing = findSale.get(businessId, sale.sale_uid);
  let saleId;
  if (existing) {
    updateSale.run({
      id: existing.id,
      device_id: deviceId || existing.device_id,
      sold_at: sale.sold_at,
      total_cents: sale.total_cents,
      tax_cents: sale.tax_cents ?? existing.tax_cents,
      discount_cents: sale.discount_cents ?? existing.discount_cents,
      payment_method: sale.payment_method ?? existing.payment_method,
      table_name: sale.table_name ?? existing.table_name,
      receipt_no: sale.receipt_no ?? existing.receipt_no,
      staff_name: sale.staff_name ?? existing.staff_name,
      status: sale.status ?? existing.status ?? 'paid'
    });
    saleId = existing.id;
    if (sale.hasItems) deleteItems.run(saleId);
  } else {
    const info = insertSale.run({
      business_id: businessId,
      device_id: deviceId,
      sale_uid: sale.sale_uid,
      sold_at: sale.sold_at,
      total_cents: sale.total_cents,
      tax_cents: sale.tax_cents ?? 0,
      discount_cents: sale.discount_cents ?? 0,
      payment_method: sale.payment_method ?? '',
      table_name: sale.table_name ?? '',
      receipt_no: sale.receipt_no ?? '',
      staff_name: sale.staff_name ?? '',
      status: sale.status ?? 'paid'
    });
    saleId = info.lastInsertRowid;
  }
  if (sale.hasItems || !existing) {
    for (const item of sale.items) {
      insertItem.run({ sale_id: saleId, ...item });
    }
  }
}

const syncBatch = db.transaction((businessId, deviceId, rawSales) => {
  let accepted = 0;
  let rejected = 0;
  const paidTables = new Set();
  const openTables = new Set();
  const parsed = [];
  for (const raw of rawSales) {
    const sale = parseSale(raw);
    if (!sale) {
      rejected += 1;
      continue;
    }
    if ((sale.status ?? 'paid') === 'paid' && sale.table_name) {
      paidTables.add(sale.table_name);
    }
    if ((sale.status ?? 'paid') === 'open' && sale.table_name) {
      openTables.add(sale.table_name);
    }
    parsed.push(sale);
  }
  for (const sale of parsed) {
    upsertSale(businessId, deviceId, sale);
    if ((sale.status ?? 'paid') === 'paid' && sale.table_name) {
      // Printo→Paguaj: same uid becomes paid; void only duplicate opens (floor:*).
      // Amounts stay in the bar — void rows are excluded, paid row keeps the total.
      voidOpensOnTableExceptUid.run(businessId, sale.table_name, sale.sale_uid);
    }
    if ((sale.status ?? 'paid') === 'open' && sale.table_name) {
      voidAllFloorOpensOnTable.run(businessId, sale.table_name);
      const kept = findOpenOnTable.get(
        businessId,
        sale.table_name,
        sale.staff_name || ''
      );
      if (kept) voidOtherOpensOnTable.run(businessId, sale.table_name, kept.id);
    }
    // A void needs nothing else: upsertSale already flipped that one invoice,
    // and reports leave void rows out, so the bar drops by exactly its amount.
    // Other invoices on the same table belong to other orders and stay.
    accepted += 1;
  }
  return { accepted, rejected, paidTables: [...paidTables], openTables: [...openTables] };
});

/**
 * Keeps the open invoice of an occupied table in step with the floor total.
 * Never mints invoices and never deletes amounts: Paguaj must neither shrink
 * the bar nor add to it.
 */
function syncOpenSalesFromFloor(businessId, deviceId, tables, paidTables = [], openTables = []) {
  const now = shopNowLocal();
  const normalize = (value) => String(value || '').trim().toLowerCase();
  const paid = new Set(paidTables.map(normalize));

  for (const table of tables) {
    const tableName = table.table_name;
    const staffName = table.staff_name || '';
    const justPaid = paid.has(normalize(tableName));

    // Freed on till, or paid in this same batch — do not touch sales rows.
    if (!table.occupied || table.total_cents <= 0 || justPaid) {
      continue;
    }

    const existingOpen = findOpenOnTable.get(businessId, tableName, staffName);
    if (existingOpen) {
      updateSale.run({
        id: existingOpen.id,
        device_id: deviceId || existingOpen.device_id,
        sold_at: existingOpen.sold_at || now,
        total_cents: table.total_cents,
        tax_cents: existingOpen.tax_cents ?? 0,
        discount_cents: existingOpen.discount_cents ?? 0,
        payment_method: existingOpen.payment_method || 'cash',
        table_name: tableName,
        receipt_no: existingOpen.receipt_no || '',
        staff_name: staffName || existingOpen.staff_name || '',
        status: 'open'
      });
      const uid = String(existingOpen.sale_uid || '');
      if (!uid.startsWith('floor:')) {
        voidAllFloorOpensOnTable.run(businessId, tableName);
      }
      voidOtherOpensOnTable.run(businessId, tableName, existingOpen.id);
      continue;
    }

    // No invoice for this table yet (items added but nothing printed). The
    // grid still shows it from the floor snapshot, so nothing is minted here:
    // a synthetic open row would be counted again next to the real invoice
    // once Paguaj lands, which is what used to inflate the bar.
    voidAllFloorOpensOnTable.run(businessId, tableName);
  }
}

const insertFloor = db.prepare(`
  INSERT INTO restaurant_tables (
    business_id, table_name, occupied, total_cents, staff_name, updated_at
  ) VALUES (
    @business_id, @table_name, @occupied, @total_cents, @staff_name, datetime('now')
  )
  ON CONFLICT (business_id, table_name, staff_name) DO UPDATE SET
    occupied = excluded.occupied,
    total_cents = excluded.total_cents,
    updated_at = datetime('now')
`);
const clearFloor = db.prepare('DELETE FROM restaurant_tables WHERE business_id = ?');

function parseFloorTable(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const tableName = asString(pick(raw, 'tableName', 'table_name', 'name'), 200);
  if (!tableName) return null;
  const occupiedRaw = pick(raw, 'occupied', 'isOccupied', 'busy');
  const occupied =
    occupiedRaw === true || occupiedRaw === 1 || occupiedRaw === '1' || occupiedRaw === 'true';
  const total = toCents(pick(raw, 'total', 'currentTotal', 'current_total') ?? 0) ?? 0;
  return {
    table_name: tableName,
    occupied: occupied ? 1 : 0,
    total_cents: occupied ? total : 0,
    staff_name: asString(pick(raw, 'staffName', 'staff_name', 'waiterName', 'waiter'), 200)
  };
}

const replaceFloor = db.transaction((businessId, deviceId, rawTables, paidTables, openTables) => {
  const byKey = new Map();
  for (const raw of Array.isArray(rawTables) ? rawTables : []) {
    const table = parseFloorTable(raw);
    if (!table) continue;
    byKey.set(`${table.table_name}\0${table.staff_name}`, table);
  }
  const parsed = [...byKey.values()].slice(0, 200);
  clearFloor.run(businessId);
  for (const table of parsed) {
    insertFloor.run({ business_id: businessId, ...table });
  }
  syncOpenSalesFromFloor(businessId, deviceId, parsed, paidTables, openTables);
  return parsed.length;
});

salesRouter.post('/sync', (req, res) => {
  const key = readKey(req);
  if (!key) return res.status(400).json({ ok: false, error: 'missing_license_key' });

  const row = findLiveByLicenseKey(key);
  if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
  if (effectiveStatus(row) === 'revoked') return res.status(403).json({ ok: false, error: 'revoked' });

  const sales = Array.isArray(req.body?.sales) ? req.body.sales : [];
  const floor = req.body?.tables;
  if (!Array.isArray(req.body?.sales) && !Array.isArray(floor)) {
    return res.status(400).json({ ok: false, error: 'sales_required' });
  }
  if (sales.length > MAX_SALES) return res.status(400).json({ ok: false, error: 'too_many_sales', max: MAX_SALES });

  const deviceId = asString(pick(req.body, 'deviceId', 'device_id'), 200);
  const result = syncBatch(row.id, deviceId, sales);
  let tables = 0;
  if (Array.isArray(floor)) {
    tables = replaceFloor(row.id, deviceId, floor, result.paidTables || [], result.openTables || []);
  }
  // Tell every open portal and admin tab for this business to refetch. A sync
  // that accepted nothing changed nothing, so it stays quiet.
  if (result.accepted > 0 || Array.isArray(floor)) {
    publish(row.id, { accepted: result.accepted, tables });
  }
  res.json({ ok: true, accepted: result.accepted, rejected: result.rejected, tables });
});

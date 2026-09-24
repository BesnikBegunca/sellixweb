import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { effectiveStatus, findLiveByLicenseKey } from '../licenses.js';
import { toCents } from '../reports.js';
import { publish } from '../events.js';
import { checkSalesNotify } from '../push.js';

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
  const deltaRaw = pick(raw, 'printDelta', 'print_delta', 'printedDelta', 'delta');
  let printDeltaCents = null;
  if (deltaRaw !== undefined && deltaRaw !== null && deltaRaw !== '') {
    printDeltaCents = toCents(deltaRaw);
  }
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
    is_fiscal: parseFiscalFlag(raw) ? 1 : 0,
    print_delta_cents: printDeltaCents,
    hasItems,
    items
  };
}

function parseFiscalFlag(raw) {
  const truthy = (v) =>
    v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
  if (truthy(pick(raw, 'fiscalCoupon', 'fiscal_coupon', 'isFiscal', 'is_fiscal', 'isFiscalCoupon'))) {
    return true;
  }
  const kind = asString(
    pick(raw, 'kind', 'receiptType', 'receipt_type', 'receiptKind', 'saleType', 'type'),
    40
  ).toLowerCase();
  if (['fiscal', 'fiscal_coupon', 'kupon_fiskal', 'kuponfiskal', 'atk'].includes(kind)) {
    return true;
  }
  const status = asString(pick(raw, 'status', 'tableStatus', 'state'), 40).toLowerCase();
  return status === 'fiscal' || status === 'kupon_fiskal' || status === 'kuponfiskal';
}

function parseTableStatus(raw) {
  const value = asString(pick(raw, 'status', 'tableStatus', 'state'), 20).toLowerCase();
  if (value === 'open' || value === 'printed' || value === 'occupied') return 'open';
  if (
    value === 'paid' ||
    value === 'closed' ||
    value === 'completed' ||
    value === 'fiscal' ||
    value === 'kupon_fiskal' ||
    value === 'kuponfiskal'
  ) {
    return 'paid';
  }
  // Admin / manager deleted, cancelled, or refunded the order on the till.
  if (
    value === 'void' ||
    value === 'deleted' ||
    value === 'cancelled' ||
    value === 'canceled' ||
    value === 'refund' ||
    value === 'refunded'
  ) {
    return 'void';
  }
  return undefined;
}

const insertSale = db.prepare(`
  INSERT INTO sales (
    business_id, sale_uid, device_id, sold_at, total_cents, tax_cents, discount_cents,
    payment_method, table_name, receipt_no, staff_name, status, is_fiscal, synced_at
  ) VALUES (
    @business_id, @sale_uid, @device_id, @sold_at, @total_cents, @tax_cents, @discount_cents,
    @payment_method, @table_name, @receipt_no, @staff_name, @status, @is_fiscal, datetime('now')
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
    is_fiscal = CASE WHEN @is_fiscal = 1 THEN 1 ELSE COALESCE(is_fiscal, 0) END,
    synced_at = datetime('now')
  WHERE id = @id
`);

const findSale = db.prepare('SELECT * FROM sales WHERE business_id = ? AND sale_uid = ?');
// One open tab per (table + waiter) — never pick another waiter's open on the same table.
const findOpenOnTable = db.prepare(`
  SELECT * FROM sales
  WHERE business_id = ?
    AND TRIM(table_name) = TRIM(?)
    AND TRIM(COALESCE(staff_name, '')) = TRIM(?)
    AND LOWER(COALESCE(status, 'paid')) = 'open'
  ORDER BY id DESC
  LIMIT 1
`);
// Never DELETE order amounts on Paguaj — void duplicates only. Bar stays unless
// the till later sends status=void for an admin/manager delete.
const voidAllFloorOpensOnTable = db.prepare(`
  UPDATE sales SET status = 'void', synced_at = datetime('now')
  WHERE business_id = ?
    AND TRIM(table_name) = TRIM(?)
    AND TRIM(COALESCE(staff_name, '')) = TRIM(?)
    AND LOWER(COALESCE(status, 'paid')) = 'open'
    AND sale_uid LIKE 'floor:%'
`);
const voidOpensOnTableExceptUid = db.prepare(`
  UPDATE sales SET status = 'void', synced_at = datetime('now')
  WHERE business_id = ?
    AND TRIM(table_name) = TRIM(?)
    AND TRIM(COALESCE(staff_name, '')) = TRIM(?)
    AND LOWER(COALESCE(status, 'paid')) = 'open'
    AND sale_uid != ?
`);
const voidOtherOpensOnTable = db.prepare(`
  UPDATE sales SET status = 'void', synced_at = datetime('now')
  WHERE business_id = ?
    AND TRIM(table_name) = TRIM(?)
    AND TRIM(COALESCE(staff_name, '')) = TRIM(?)
    AND LOWER(COALESCE(status, 'paid')) = 'open'
    AND id != ?
`);
const freeFloorOnTable = db.prepare(`
  UPDATE restaurant_tables
  SET occupied = 0, total_cents = 0, updated_at = datetime('now')
  WHERE business_id = ?
    AND TRIM(table_name) = TRIM(?)
    AND TRIM(COALESCE(staff_name, '')) = TRIM(?)
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
      status: sale.status ?? existing.status ?? 'paid',
      is_fiscal: sale.is_fiscal ? 1 : 0
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
      status: sale.status ?? 'paid',
      is_fiscal: sale.is_fiscal ? 1 : 0
    });
    saleId = info.lastInsertRowid;
  }
  if (sale.hasItems || !existing) {
    for (const item of sale.items) {
      insertItem.run({ sale_id: saleId, ...item });
    }
  }
}

const selectItemsBySaleId = db.prepare(
  `SELECT name, quantity, unit_price_cents, total_cents, category
   FROM sale_items WHERE sale_id = ? ORDER BY id ASC`
);

function loadSaleItems(saleId) {
  if (!saleId) return [];
  return selectItemsBySaleId.all(saleId);
}

function itemKey(item) {
  return `${String(item.name || '')
    .trim()
    .toLowerCase()}\0${Number(item.unit_price_cents) || 0}`;
}

/** Lines added since the last print (qty/total delta per product). */
function diffPrintItems(newItems, prevItems) {
  if (!Array.isArray(newItems) || newItems.length === 0) return [];
  if (!Array.isArray(prevItems) || prevItems.length === 0) {
    return newItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      total_cents: item.total_cents,
      category: item.category || ''
    }));
  }

  const prevMap = new Map();
  for (const p of prevItems) {
    const k = itemKey(p);
    const cur = prevMap.get(k) || {
      quantity: 0,
      total_cents: 0,
      unit_price_cents: p.unit_price_cents,
      name: p.name,
      category: p.category || ''
    };
    cur.quantity += Number(p.quantity) || 0;
    cur.total_cents += Number(p.total_cents) || 0;
    prevMap.set(k, cur);
  }

  const out = [];
  for (const n of newItems) {
    const k = itemKey(n);
    const prev = prevMap.get(k);
    const prevQty = prev ? Number(prev.quantity) || 0 : 0;
    const prevTotal = prev ? Number(prev.total_cents) || 0 : 0;
    const qty = (Number(n.quantity) || 0) - prevQty;
    const total = (Number(n.total_cents) || 0) - prevTotal;
    if (qty > 0.0001 || total > 0) {
      out.push({
        name: n.name,
        quantity: qty > 0 ? qty : Number(n.quantity) || 1,
        unit_price_cents: n.unit_price_cents,
        total_cents: Math.max(0, total),
        category: n.category || ''
      });
      if (prev) {
        prev.quantity = 0;
        prev.total_cents = 0;
      }
    }
  }
  return out;
}

/**
 * One row per kitchen print for "Faturat e fundit". Does not affect bar/totals
 * (status=print is excluded from ACTIVE_SALE_SQL). Amount = this print's delta.
 */
function insertPrintSlice(businessId, deviceId, sale, deltaCents, prevItems = []) {
  if (!deltaCents || deltaCents <= 0) return;
  const stamp = String(sale.sold_at || '').replace(/[^\d]/g, '') || String(Date.now());
  const uid = `print:${sale.sale_uid}:${stamp}:${deltaCents}`;
  // Idempotent: same print re-synced after a failed mark must not duplicate.
  if (findSale.get(businessId, uid)) return;
  const info = insertSale.run({
    business_id: businessId,
    device_id: deviceId || '',
    sale_uid: uid,
    sold_at: sale.sold_at,
    total_cents: deltaCents,
    tax_cents: 0,
    discount_cents: 0,
    payment_method: sale.payment_method || 'cash',
    table_name: sale.table_name || '',
    receipt_no: sale.receipt_no || '',
    staff_name: sale.staff_name || '',
    status: 'print',
    is_fiscal: 0
  });
  const saleId = info.lastInsertRowid;
  if (!sale.hasItems || !sale.items?.length) return;

  let lines = diffPrintItems(sale.items, prevItems);
  // If we cannot split (same lines resent), still show what the till sent.
  if (!lines.length) {
    lines = sale.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      total_cents: item.total_cents,
      category: item.category || ''
    }));
  }
  for (const item of lines) {
    insertItem.run({ sale_id: saleId, ...item });
  }
}

const syncBatch = db.transaction((businessId, deviceId, rawSales) => {
  let accepted = 0;
  let rejected = 0;
  let printedDeltaCents = 0;
  let fiscalInvoiceCents = 0;
  let refundCents = 0;
  const paidTables = new Set();
  const openTables = new Set();
  const voidSlots = []; // { table, staff }
  const tableStaffKey = (table, staff) =>
    `${String(table || '').trim().toLowerCase()}\0${String(staff || '').trim().toLowerCase()}`;
  const parsed = [];
  for (const raw of rawSales) {
    const sale = parseSale(raw);
    if (!sale) {
      rejected += 1;
      continue;
    }
    const staff = sale.staff_name || '';
    if ((sale.status ?? 'paid') === 'paid' && sale.table_name) {
      paidTables.add(tableStaffKey(sale.table_name, staff));
    }
    if ((sale.status ?? 'paid') === 'open' && sale.table_name) {
      openTables.add(tableStaffKey(sale.table_name, staff));
    }
    if ((sale.status ?? 'paid') === 'void' && sale.table_name) {
      voidSlots.push({ table: sale.table_name, staff });
    }
    parsed.push(sale);
  }
  for (const sale of parsed) {
    const before = findSale.get(businessId, sale.sale_uid);
    const staff = sale.staff_name || '';
    // Previous amount for THIS waiter on this table only.
    let prevCents = Number(before?.total_cents) || 0;
    let prevOpen = before;
    if ((sale.status ?? 'paid') === 'open' && sale.table_name) {
      const existingOpen = findOpenOnTable.get(businessId, sale.table_name, staff);
      if (existingOpen) {
        prevCents = Math.max(prevCents, Number(existingOpen.total_cents) || 0);
        if (!prevOpen || existingOpen.id !== before?.id) {
          // Prefer the live open tab's lines for print-item diff.
          if ((Number(existingOpen.total_cents) || 0) >= (Number(before?.total_cents) || 0)) {
            prevOpen = existingOpen;
          }
        }
      }
    }
    // Snapshot lines before upsert replaces them.
    const prevItems =
      (sale.status ?? 'paid') === 'open' && prevOpen ? loadSaleItems(prevOpen.id) : [];

    const explicitDelta =
      sale.print_delta_cents != null && Number.isFinite(sale.print_delta_cents)
        ? Math.max(0, sale.print_delta_cents)
        : null;
    const computedDelta = Math.max(0, (sale.total_cents || 0) - prevCents);
    const delta = explicitDelta != null ? explicitDelta : computedDelta;

    upsertSale(businessId, deviceId, sale);
    if ((sale.status ?? 'paid') === 'paid' && sale.table_name) {
      // Only this waiter's opens — other waiters on the same table stay.
      voidOpensOnTableExceptUid.run(businessId, sale.table_name, staff, sale.sale_uid);
    }
    if ((sale.status ?? 'paid') === 'paid') {
      if (sale.is_fiscal) {
        // Fiscal coupon: notify even when open→paid leaves the bar unchanged.
        const amt = delta > 0 ? delta : Math.max(0, sale.total_cents || 0);
        if (amt > 0) {
          fiscalInvoiceCents += amt;
          printedDeltaCents += amt;
        }
      } else if (delta > 0) {
        printedDeltaCents += delta;
      }
    }
    if ((sale.status ?? 'paid') === 'open' && sale.table_name) {
      voidAllFloorOpensOnTable.run(businessId, sale.table_name, staff);
      const kept = findOpenOnTable.get(businessId, sale.table_name, staff);
      if (kept) voidOtherOpensOnTable.run(businessId, sale.table_name, staff, kept.id);
      if (delta > 0) {
        printedDeltaCents += delta;
        // Separate invoice row per print (e.g. +10 then +5), not one merged tab.
        insertPrintSlice(businessId, deviceId, sale, delta, prevItems);
      }
    }
    if ((sale.status ?? 'paid') === 'void') {
      const amount = sale.total_cents || before?.total_cents || 0;
      refundCents += Math.max(0, amount);
      if (sale.table_name) freeFloorOnTable.run(businessId, sale.table_name, staff);
    }
    accepted += 1;
  }
  return {
    accepted,
    rejected,
    paidTables: [...paidTables],
    openTables: [...openTables],
    voidSlots,
    lastInvoiceCents: printedDeltaCents,
    fiscalInvoiceCents,
    refundCents
  };
});

/**
 * Keeps the open invoice of an occupied table+waiter in step with the floor.
 * Never touches another waiter's tab on the same table number.
 */
function syncOpenSalesFromFloor(businessId, deviceId, tables, paidTables = []) {
  const now = shopNowLocal();
  const normalize = (value) => String(value || '').trim().toLowerCase();
  const paid = new Set(paidTables.map(normalize));

  for (const table of tables) {
    const tableName = table.table_name;
    const staffName = table.staff_name || '';
    const key = `${normalize(tableName)}\0${normalize(staffName)}`;
    const justPaid = paid.has(key);

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
        status: 'open',
        is_fiscal: 0
      });
      const uid = String(existingOpen.sale_uid || '');
      if (!uid.startsWith('floor:')) {
        voidAllFloorOpensOnTable.run(businessId, tableName, staffName);
      }
      voidOtherOpensOnTable.run(businessId, tableName, staffName, existingOpen.id);
      continue;
    }

    voidAllFloorOpensOnTable.run(businessId, tableName, staffName);
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
  let result;
  try {
    result = syncBatch(row.id, deviceId, sales);
  } catch (err) {
    console.warn('sales syncBatch', err?.message || err);
    return res.status(500).json({ ok: false, error: 'sync_failed' });
  }

  // Notify as soon as sales land — do not wait on floor sync (a floor error
  // used to skip every PRINTUAR / KUPON FISKAL push).
  if (result.accepted > 0) {
    setImmediate(() => {
      checkSalesNotify(row, {
        lastInvoiceCents: result.lastInvoiceCents,
        fiscalInvoiceCents: result.fiscalInvoiceCents,
        refundCents: result.refundCents
      })
        .then((r) => {
          if (r && r.ok === false) console.warn('notify skip', row.id, r.reason || r);
          else if (r && !r.delivered) console.warn('notify no delivery', row.id, r);
        })
        .catch((err) => console.warn('notify push', err?.message));
    });
  }

  let tables = 0;
  if (Array.isArray(floor)) {
    try {
      tables = replaceFloor(row.id, deviceId, floor, result.paidTables || [], result.openTables || []);
    } catch (err) {
      console.warn('sales floor sync', err?.message || err);
    }
  }
  // Voids free the floor for that waiter+table only.
  for (const slot of result.voidSlots || []) {
    try {
      freeFloorOnTable.run(row.id, slot.table, slot.staff || '');
    } catch (_) {}
  }
  // Tell every open portal and admin tab for this business to refetch.
  if (result.accepted > 0 || Array.isArray(floor) || (result.voidSlots || []).length) {
    publish(row.id, {
      accepted: result.accepted,
      tables,
      refund: result.refundCents > 0,
      fiscal: (result.fiscalInvoiceCents || 0) > 0
    });
  }
  res.json({ ok: true, accepted: result.accepted, rejected: result.rejected, tables });
});

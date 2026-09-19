import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// On Railway the container filesystem is wiped on every deploy, so the database
// lives on a mounted volume instead. DATA_DIR points at that mount in
// production and falls back to ../data for local development.
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'sellix.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    business TEXT NOT NULL,
    phone TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS site_content (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nui TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    fiscal_number TEXT NOT NULL DEFAULT '',
    vat_number TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    zip_code TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT 'Kosovë',
    contact_person TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    sector TEXT NOT NULL DEFAULT '',
    seats INTEGER NOT NULL DEFAULT 1,
    notes TEXT NOT NULL DEFAULT '',
    license_key TEXT NOT NULL UNIQUE,
    license_status TEXT NOT NULL DEFAULT 'active',
    license_issued_at TEXT NOT NULL DEFAULT (datetime('now')),
    license_expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- A shop that was set up without internet registers itself here when it
  -- first gets online. Nothing in this table grants a licence: an admin
  -- approves a row, which creates the business and issues the real key.
  CREATE TABLE IF NOT EXISTS pending_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    install_code TEXT NOT NULL UNIQUE,
    device_id TEXT NOT NULL,
    device_name TEXT NOT NULL DEFAULT '',
    app_kind TEXT NOT NULL DEFAULT '',
    nui TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    fiscal_number TEXT NOT NULL DEFAULT '',
    vat_number TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    zip_code TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    contact_person TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    sector TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS license_activations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT NOT NULL DEFAULT '',
    activated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (business_id, device_id)
  );

  -- Till-synced receipts. sold_at is the shop's local clock (YYYY-MM-DD HH:MM:SS),
  -- not UTC and not the moment the row arrived here. Period totals (today /
  -- yesterday / week / month / year) group on this field. sale_uid is the till's
  -- id: a later POST /api/sales/sync with the same uid updates the row.
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    sale_uid TEXT NOT NULL,
    device_id TEXT NOT NULL DEFAULT '',
    sold_at TEXT NOT NULL,
    total_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    discount_cents INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT '',
    table_name TEXT NOT NULL DEFAULT '',
    receipt_no TEXT NOT NULL DEFAULT '',
    staff_name TEXT NOT NULL DEFAULT '',
    synced_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (business_id, sale_uid)
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    quantity REAL NOT NULL DEFAULT 1,
    unit_price_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_sales_business_sold_at ON sales (business_id, sold_at);
  CREATE INDEX IF NOT EXISTS idx_sales_business_table ON sales (business_id, table_name);
  CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items (sale_id);
`);

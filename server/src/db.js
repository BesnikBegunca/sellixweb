import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// On Railway the container filesystem is wiped on every deploy, so the database
// lives on a mounted volume instead. DATA_DIR points at that mount in
// production and falls back to ../data for local development.
export const dataDir = process.env.DATA_DIR
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
    status TEXT NOT NULL DEFAULT 'paid',
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

// Owner-portal login columns. `businesses` already exists on deployed volumes,
// so these are added by ALTER rather than in CREATE TABLE above.
const businessColumns = new Set(db.prepare('PRAGMA table_info(businesses)').all().map((c) => c.name));
const BUSINESS_MIGRATIONS = [
  ['portal_email', "ALTER TABLE businesses ADD COLUMN portal_email TEXT NOT NULL DEFAULT ''"],
  ['portal_password_hash', "ALTER TABLE businesses ADD COLUMN portal_password_hash TEXT NOT NULL DEFAULT ''"],
  ['portal_must_change_password', 'ALTER TABLE businesses ADD COLUMN portal_must_change_password INTEGER NOT NULL DEFAULT 0'],
  ['portal_last_login_at', 'ALTER TABLE businesses ADD COLUMN portal_last_login_at TEXT'],
  ['verified', 'ALTER TABLE businesses ADD COLUMN verified INTEGER NOT NULL DEFAULT 0'],
  ['verified_color', "ALTER TABLE businesses ADD COLUMN verified_color TEXT NOT NULL DEFAULT '#1D9BF0'"],
  ['deleted_at', 'ALTER TABLE businesses ADD COLUMN deleted_at TEXT'],
  ['daily_goal_cents', 'ALTER TABLE businesses ADD COLUMN daily_goal_cents INTEGER NOT NULL DEFAULT 0'],
  ['license_notice_at', 'ALTER TABLE businesses ADD COLUMN license_notice_at TEXT'],
  ['portal_password_plain', "ALTER TABLE businesses ADD COLUMN portal_password_plain TEXT NOT NULL DEFAULT ''"],
  ["notify_mode", "ALTER TABLE businesses ADD COLUMN notify_mode TEXT NOT NULL DEFAULT 'always'"],
  ['notify_threshold_cents', 'ALTER TABLE businesses ADD COLUMN notify_threshold_cents INTEGER NOT NULL DEFAULT 10000'],
  ['notify_gjendja_print', 'ALTER TABLE businesses ADD COLUMN notify_gjendja_print INTEGER NOT NULL DEFAULT 1'],
  ['notify_gjendja_close', 'ALTER TABLE businesses ADD COLUMN notify_gjendja_close INTEGER NOT NULL DEFAULT 1']
];
for (const [column, sql] of BUSINESS_MIGRATIONS) {
  if (!businessColumns.has(column)) db.exec(sql);
}

const adminColumns = new Set(db.prepare('PRAGMA table_info(admin_users)').all().map((c) => c.name));
if (!adminColumns.has('password_plain')) {
  db.exec("ALTER TABLE admin_users ADD COLUMN password_plain TEXT NOT NULL DEFAULT ''");
}

const salesColumns = new Set(db.prepare('PRAGMA table_info(sales)').all().map((c) => c.name));
if (salesColumns.size && !salesColumns.has('status')) {
  db.exec("ALTER TABLE sales ADD COLUMN status TEXT NOT NULL DEFAULT 'paid'");
}
db.exec('CREATE INDEX IF NOT EXISTS idx_sales_business_status ON sales (business_id, status)');

db.exec(`
  CREATE TABLE IF NOT EXISTS restaurant_tables (
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    occupied INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    staff_name TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (business_id, table_name, staff_name)
  )
`);

const restaurantTablePk = db
  .prepare('PRAGMA table_info(restaurant_tables)')
  .all()
  .filter((c) => c.pk > 0)
  .sort((a, b) => a.pk - b.pk)
  .map((c) => c.name)
  .join(',');
if (restaurantTablePk && restaurantTablePk !== 'business_id,table_name,staff_name') {
  db.pragma('foreign_keys = OFF');
  db.exec(`
    CREATE TABLE restaurant_tables_v2 (
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      table_name TEXT NOT NULL,
      occupied INTEGER NOT NULL DEFAULT 0,
      total_cents INTEGER NOT NULL DEFAULT 0,
      staff_name TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (business_id, table_name, staff_name)
    );
    INSERT INTO restaurant_tables_v2 (
      business_id, table_name, occupied, total_cents, staff_name, updated_at
    )
    SELECT business_id, table_name, occupied, total_cents, staff_name, updated_at
    FROM restaurant_tables;
    DROP TABLE restaurant_tables;
    ALTER TABLE restaurant_tables_v2 RENAME TO restaurant_tables;
  `);
  db.pragma('foreign_keys = ON');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS shift_closes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    event_uid TEXT NOT NULL,
    shift_uid TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'closed',
    device_id TEXT NOT NULL DEFAULT '',
    opened_at TEXT NOT NULL,
    closed_at TEXT NOT NULL,
    closed_by TEXT NOT NULL DEFAULT '',
    total_cents INTEGER NOT NULL DEFAULT 0,
    paid_cents INTEGER NOT NULL DEFAULT 0,
    open_cents INTEGER NOT NULL DEFAULT 0,
    expenses_cents INTEGER NOT NULL DEFAULT 0,
    waiters_json TEXT NOT NULL DEFAULT '[]',
    synced_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (business_id, event_uid)
  )
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_shift_closes_business_closed ON shift_closes (business_id, closed_at)');

db.exec(`
  CREATE TABLE IF NOT EXISTS saved_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    period_key TEXT NOT NULL,
    period_from TEXT NOT NULL,
    period_to TEXT NOT NULL,
    title TEXT NOT NULL,
    total_cents INTEGER NOT NULL DEFAULT 0,
    sale_count INTEGER NOT NULL DEFAULT 0,
    file_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_saved_reports_business ON saved_reports (business_id, created_at DESC)');

db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_portal_email ON businesses (portal_email) WHERE portal_email <> ''"
);

db.exec(`
  CREATE TABLE IF NOT EXISTS login_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    account_id INTEGER NOT NULL,
    jti TEXT NOT NULL UNIQUE,
    device_id TEXT NOT NULL DEFAULT '',
    device_label TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at TEXT
  )
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_login_sessions_account ON login_sessions (kind, account_id, revoked_at)');

db.exec(`
  CREATE TABLE IF NOT EXISTS app_setup (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    file_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    download_count INTEGER NOT NULL DEFAULT 0,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    uploaded_by TEXT NOT NULL DEFAULT ''
  )
`);

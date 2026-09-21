import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { DEFAULT_CONTENT } from './content-seed.js';

// Idempotent: safe to run on every boot. Railway has no separate release step,
// so the server calls this at startup instead of relying on a manual command.
export function seed({ quiet = false } = {}) {
  const log = quiet ? () => {} : (...args) => console.log(...args);
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  const contentRow = db.prepare('SELECT data FROM site_content WHERE id = 1').get();
  if (contentRow) {
    try {
      const data = JSON.parse(contentRow.data);
      data.cats = DEFAULT_CONTENT.cats;
      delete data.quotes;
      if (data.t?.sq) {
        delete data.t.sq.submit;
        delete data.t.sq.sent;
        delete data.t.sq.ph;
      }
      if (data.t?.en) {
        delete data.t.en.submit;
        delete data.t.en.sent;
        delete data.t.en.ph;
      }
      db.prepare(`UPDATE site_content SET data = ?, updated_at = datetime('now') WHERE id = 1`).run(JSON.stringify(data));
      log('Synced landing categories (restorante, kafene, markete, butique, këpucë).');
    } catch (err) {
      log(`Could not sync site content: ${err.message}`);
    }
  } else {
    db.prepare('INSERT INTO site_content (id, data) VALUES (1, ?)').run(JSON.stringify(DEFAULT_CONTENT));
    log('Seeded default site content.');
  }

  if (!email || !password) {
    log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin user seed.');
    return;
  }

  const existing = db.prepare('SELECT id FROM admin_users WHERE email = ?').get(email);
  if (existing) {
    log(`Admin user ${email} already exists (id ${existing.id}) — skipping user seed.`);
    return;
  }

  const hash = bcrypt.hashSync(password, 12);
  db.prepare(
    'INSERT INTO admin_users (email, name, password_hash, password_plain, must_change_password) VALUES (?, ?, ?, ?, 1)'
  ).run(email, 'Admin', hash, password);
  log(`Created admin user ${email}. They must change their password on first login.`);
}

// `npm run seed` runs this file directly; importing it just exposes seed().
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD) {
    console.error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set (see .env.example)');
    process.exit(1);
  }
  seed();
}

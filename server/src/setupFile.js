import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataDir, db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const setupsDir = path.join(dataDir, 'setups');
fs.mkdirSync(setupsDir, { recursive: true });

const STORED_NAME = 'current-setup.bin';

export function setupFilePath() {
  return path.join(setupsDir, STORED_NAME);
}

export function getSetupMeta() {
  return db.prepare('SELECT * FROM app_setup WHERE id = 1').get() || null;
}

export function setupAvailable() {
  const meta = getSetupMeta();
  if (!meta) return false;
  return fs.existsSync(path.join(setupsDir, meta.stored_name));
}

export function publicSetupInfo() {
  const meta = getSetupMeta();
  if (!meta || !fs.existsSync(path.join(setupsDir, meta.stored_name))) {
    return { available: false };
  }
  return {
    available: true,
    fileName: meta.file_name,
    sizeBytes: meta.size_bytes,
    uploadedAt: meta.uploaded_at
  };
}

export function adminSetupInfo() {
  const pub = publicSetupInfo();
  const meta = getSetupMeta();
  if (!pub.available) {
    return { available: false, downloadCount: meta?.download_count || 0 };
  }
  return {
    ...pub,
    downloadCount: meta.download_count || 0,
    uploadedBy: meta.uploaded_by || ''
  };
}

export function sanitizeFileName(name) {
  const base = path.basename(String(name || '')).replace(/[^\w.\- ()[\]]+/g, '_').trim();
  return base.slice(0, 180);
}

export function saveSetupFromPath(sourcePath, originalName, uploadedBy = '') {
  if (!fs.existsSync(sourcePath)) {
    throw new Error('Setup file not found');
  }
  const dest = setupFilePath();
  // Prefer rename so a 60MB upload does not need 2× free disk.
  try {
    if (path.resolve(sourcePath) !== path.resolve(dest) && fs.existsSync(dest)) {
      fs.unlinkSync(dest);
    }
    fs.renameSync(sourcePath, dest);
  } catch {
    fs.copyFileSync(sourcePath, dest);
  }
  const size = fs.statSync(dest).size;
  const safeName = sanitizeFileName(originalName) || 'Sellix-Setup.exe';
  const existing = getSetupMeta();
  if (existing) {
    db.prepare(
      `UPDATE app_setup
       SET file_name = ?, stored_name = ?, size_bytes = ?, uploaded_at = datetime('now'), uploaded_by = ?
       WHERE id = 1`
    ).run(safeName, STORED_NAME, size, uploadedBy);
  } else {
    db.prepare(
      `INSERT INTO app_setup (id, file_name, stored_name, size_bytes, download_count, uploaded_by)
       VALUES (1, ?, ?, ?, 0, ?)`
    ).run(safeName, STORED_NAME, size, uploadedBy);
  }
  return adminSetupInfo();
}

export function incrementDownloadCount() {
  db.prepare(`UPDATE app_setup SET download_count = download_count + 1 WHERE id = 1`).run();
}

export function resetDownloadCount() {
  const meta = getSetupMeta();
  if (!meta) {
    db.prepare(
      `INSERT INTO app_setup (id, file_name, stored_name, size_bytes, download_count, uploaded_by)
       VALUES (1, '', '', 0, 0, '')`
    ).run();
  } else {
    db.prepare(`UPDATE app_setup SET download_count = 0 WHERE id = 1`).run();
  }
  return adminSetupInfo();
}

export function trySeedSetupFromDisk(log = console.log) {
  if (setupAvailable()) {
    log('App setup already present — skipping seed.');
    return false;
  }

  const candidates = [
    process.env.SETUP_SEED_PATH,
    path.join(__dirname, '..', '..', '..', 'sellix-restaurant', 'scripts', 'Sellix Setup.exe'),
    path.join(process.cwd(), '..', 'sellix-restaurant', 'scripts', 'Sellix Setup.exe')
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        saveSetupFromPath(candidate, 'Sellix Setup.exe', 'seed');
        log(`Seeded app setup from ${candidate}`);
        return true;
      }
    } catch (err) {
      log(`Setup seed failed for ${candidate}: ${err.message}`);
    }
  }
  log('No setup seed file found — upload one from Admin → Setup.');
  return false;
}

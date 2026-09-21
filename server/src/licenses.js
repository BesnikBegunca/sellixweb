import crypto from 'node:crypto';
import { db } from './db.js';
import { isRestaurantSector } from './reports.js';

// 32 unambiguous characters — no O/0, I/1 — so keys can be read off a phone
// call or a printed invoice without confusion. 256 % 32 === 0, so indexing
// random bytes into it stays uniform.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GROUPS = 4;
const GROUP_LEN = 5;

export function generateLicenseKey() {
  const bytes = crypto.randomBytes(GROUPS * GROUP_LEN);
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]);
  const groups = [];
  for (let i = 0; i < GROUPS; i++) {
    groups.push(chars.slice(i * GROUP_LEN, (i + 1) * GROUP_LEN).join(''));
  }
  return `SLX-${groups.join('-')}`;
}

export const DEFAULT_TICK_COLOR = '#1D9BF0';

export function isDeleted(row) {
  return Boolean(row?.deleted_at);
}

export function findLiveByLicenseKey(key) {
  const row = db.prepare('SELECT * FROM businesses WHERE license_key = ?').get(key);
  if (!row || isDeleted(row)) return null;
  return row;
}

export function parseTickColor(value, fallback = DEFAULT_TICK_COLOR) {
  if (typeof value !== 'string') return fallback;
  const color = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color.toUpperCase() : fallback;
}

export function uniqueLicenseKey() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const key = generateLicenseKey();
    const taken = db.prepare('SELECT 1 FROM businesses WHERE license_key = ?').get(key);
    if (!taken) return key;
  }
  throw new Error('Could not generate a unique license key');
}

export function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export function addMonths(sqlDate, months) {
  const d = new Date(`${sqlDate.replace(' ', 'T')}Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // Rolling Jan 31 forward a month lands in March; clamp back to month end.
  if (d.getUTCDate() !== day) d.setUTCDate(0);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export function isExpired(sqlDate) {
  return new Date(`${sqlDate.replace(' ', 'T')}Z`).getTime() < Date.now();
}

// A license is revoked by an admin, or expired by time. Everything else is active.
export function effectiveStatus(row) {
  if (row.license_status === 'revoked') return 'revoked';
  if (isExpired(row.license_expires_at)) return 'expired';
  return 'active';
}

export function deviceCount(businessId) {
  return db.prepare('SELECT COUNT(*) AS n FROM license_activations WHERE business_id = ?').get(businessId).n;
}

export function publicBusiness(row) {
  return {
    id: row.id,
    nui: row.nui,
    name: row.name,
    fiscalNumber: row.fiscal_number,
    vatNumber: row.vat_number,
    address: row.address,
    city: row.city,
    zipCode: row.zip_code,
    country: row.country,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    sector: row.sector,
    seats: row.seats,
    notes: row.notes,
    licenseKey: row.license_key,
    licenseStatus: effectiveStatus(row),
    licenseIssuedAt: row.license_issued_at,
    licenseExpiresAt: row.license_expires_at,
    licenseNoticeAt: row.license_notice_at || null,
    devicesUsed: deviceCount(row.id),
    isRestaurant: isRestaurantSector(row.sector),
    portalEmail: row.portal_email || '',
    portalEnabled: !!row.portal_password_hash,
    portalLastLoginAt: row.portal_last_login_at || null,
    verified: !!row.verified,
    verifiedColor: parseTickColor(row.verified_color),
    deletedAt: row.deleted_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

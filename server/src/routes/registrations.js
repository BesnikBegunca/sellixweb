import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { uniqueLicenseKey, nowSql, addMonths, publicBusiness } from '../licenses.js';

export const registrationsRouter = Router();
registrationsRouter.use(requireAuth);

function publicRegistration(row) {
  return {
    id: row.id,
    installCode: row.install_code,
    deviceId: row.device_id,
    deviceName: row.device_name,
    appKind: row.app_kind,
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
    notes: row.notes,
    status: row.status,
    businessId: row.business_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

registrationsRouter.get('/', (req, res) => {
  // Pending first — those are the ones waiting on someone.
  const rows = db
    .prepare(
      `SELECT * FROM pending_registrations
       ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC`
    )
    .all();
  res.json({ registrations: rows.map(publicRegistration) });
});

registrationsRouter.post('/:id/approve', (req, res) => {
  const row = db.prepare('SELECT * FROM pending_registrations WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Registration not found' });
  if (row.status === 'approved') return res.status(409).json({ error: 'Already approved' });

  const existingNui = db.prepare('SELECT id, deleted_at FROM businesses WHERE nui = ?').get(row.nui);
  if (existingNui) {
    return res.status(409).json({
      error: existingNui.deleted_at
        ? 'A deleted business with that NUI is in Recycle bin. Restore it or delete it forever first.'
        : 'A business with that NUI already exists. Link the device from that business instead.'
    });
  }

  const months = Math.min(60, Math.max(1, Number(req.body?.licenseMonths) || 12));
  const seats = Math.min(100, Math.max(1, Math.trunc(Number(req.body?.seats)) || 1));
  const issuedAt = nowSql();

  // Creating the business, binding the device that asked, and marking the
  // request approved have to happen together — a half-applied approval would
  // leave a shop holding a key for a business that does not exist.
  const approve = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO businesses (
           nui, name, fiscal_number, vat_number, address, city, zip_code, country,
           contact_person, phone, email, sector, notes, seats,
           license_key, license_issued_at, license_expires_at
         ) VALUES (
           @nui, @name, @fiscal_number, @vat_number, @address, @city, @zip_code, @country,
           @contact_person, @phone, @email, @sector, @notes, @seats,
           @license_key, @license_issued_at, @license_expires_at
         )`
      )
      .run({
        nui: row.nui,
        name: row.name,
        fiscal_number: row.fiscal_number,
        vat_number: row.vat_number,
        address: row.address,
        city: row.city,
        zip_code: row.zip_code,
        country: row.country || 'Kosovë',
        contact_person: row.contact_person,
        phone: row.phone,
        email: row.email,
        sector: row.sector,
        notes: row.notes,
        seats,
        license_key: uniqueLicenseKey(),
        license_issued_at: issuedAt,
        license_expires_at: addMonths(issuedAt, months)
      });

    const businessId = Number(info.lastInsertRowid);

    // The device that registered is already running the shop, so bind it now
    // instead of making it call activate separately.
    db.prepare(
      'INSERT OR IGNORE INTO license_activations (business_id, device_id, device_name) VALUES (?, ?, ?)'
    ).run(businessId, row.device_id, row.device_name);

    db.prepare(
      "UPDATE pending_registrations SET status = 'approved', business_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(businessId, row.id);

    return businessId;
  });

  const businessId = approve();
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  res.status(201).json({ business: publicBusiness(business) });
});

registrationsRouter.post('/:id/reject', (req, res) => {
  const info = db
    .prepare("UPDATE pending_registrations SET status = 'rejected', updated_at = datetime('now') WHERE id = ?")
    .run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: 'Registration not found' });
  res.json({ ok: true });
});

registrationsRouter.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM pending_registrations WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: 'Registration not found' });
  res.json({ ok: true });
});

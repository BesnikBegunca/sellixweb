# SelliX

Marketing website for SelliX, a POS software product for restaurants, markets,
boutiques, shoe stores, medical bookings, cafés/bars, barbershops and
pharmacies. Implemented from the Claude Design handoff bundle in
`project/Sellix Website.dc.html` (see `chats/chat1.md` for the original brief).

Includes a public landing page (bilingual SQ/EN), an admin login and dashboard
for managing contact-form leads, site content/pricing and admin accounts, and a
separate owner portal where each licensed business signs in to watch its own
sales.

## Structure

- `web/` — React + Vite frontend: the public landing page, the admin dashboard
  and the business owner portal
- `server/` — Node/Express + SQLite backend: auth, leads, site content, admin users
- `deploy/` — deployment guides: [`RAILWAY.md`](deploy/RAILWAY.md) (recommended),
  [`DEPLOY.md`](deploy/DEPLOY.md) for a self-managed nginx VPS, and
  [`DESKTOP-API.md`](deploy/DESKTOP-API.md) for wiring the desktop app to the
  license API
- `project/`, `chats/` — the original Claude Design export this was built from

## Running locally

**Backend**

```
cd server
npm install
cp .env.example .env   # edit JWT_SECRET / SEED_ADMIN_PASSWORD
npm run seed            # creates the first admin user + default site content
npm run dev              # http://localhost:4000
```

The seeded admin must set a real password on first login (the seed password
is a one-time temporary password).

**Frontend**

```
cd web
npm install
npm run dev               # http://localhost:5173
```

Visit `http://localhost:5173` for the public site, or `/admin/login` for the
admin dashboard.

## Admin dashboard

- **Leads** — contact-form submissions with a status (new/contacted/closed)
- **Businesses** — the licensed customers: NUI, business name, fiscal/VAT number,
  address, city, ZIP, country, contact person, phone, email, sector, allowed
  devices and notes. Creating a business issues its license key. Per row you can
  extend the license, revoke or reactivate it, issue a new key, and see or
  release the devices that activated it
- **Site content** — price, the 8 sector cards, the comparison table, plan
  inclusions and testimonials, all editable and reflected live on the site
- **Admin users** — invite new admins (a one-time temporary password is shown
  once), reset a password, or remove an account

Authentication is a real backend: bcrypt-hashed passwords, an httpOnly
session cookie, and rate-limited login/lead-submission endpoints.

## Business owner portal

Each business can be given its own login at `/portal/login`, separate from the
admin dashboard — a different session cookie, and access to nothing but that
one shop's figures. In **Businesses → Portal**, *Give access* sets the owner's
email and shows a one-time temporary password to pass on; they must replace it
on first sign-in.

Once in, the owner sees:

- **Shitjet** — totals for today, yesterday, this week, this month, this year
  and all time, with a 14-day and a 12-month chart, a payment-method breakdown
  and the top-selling products
- **Tavolinat** — takings per table (`Tavolina 1 · 177.00 €`), shown only for
  table-service sectors: restaurants, bars, cafés, pubs, pizzerias. Sales with
  no table (takeaway, counter) count in the day's total but not here
- **Llogaria** — the business details on file, and a password change

The whole portal is in Albanian and works on a phone.

These numbers come from the tills: the desktop app posts closed sales to
`POST /api/sales/sync`, documented in
[`deploy/DESKTOP-API.md`](deploy/DESKTOP-API.md). Until a till syncs, a new
shop's dashboard is empty — there is no sample data. Syncing is idempotent on
the till's own `saleUid`, so re-sending a batch after a dropped connection
never double-counts.

## Deploying

[`deploy/RAILWAY.md`](deploy/RAILWAY.md) walks through Railway: a single service
where Express serves the built frontend and the API on one domain, with SQLite
on a mounted volume. The schema and the first admin user are created
automatically on boot, so there is no separate migration or seed step.

## License API (for the Sellix desktop app)

Each business gets one key in the form `SLX-XXXXX-XXXXX-XXXXX-XXXXX`. The
desktop app uses that key as its API key to activate and stay activated. Both
endpoints are public and rate limited; the key goes in the JSON body as
`licenseKey` or in an `x-license-key` header. Full integration notes, including
offline handling, are in [`deploy/DESKTOP-API.md`](deploy/DESKTOP-API.md).

**`POST /api/license/activate`** — run once per machine, on first setup.
Binds `deviceId` to the license and consumes one of the allowed devices.

```
POST /api/license/activate
{ "licenseKey": "SLX-...", "deviceId": "machine-uuid", "deviceName": "Arka kryesore" }

200 { "valid": true,
      "business": { "name": "...", "nui": "...", "sector": "...", "city": "..." },
      "license": { "status": "active", "expiresAt": "...", "seats": 2, "devicesUsed": 1 } }
```

**`POST /api/license/check`** — run on every launch (and periodically) to
confirm the license is still good.

```
POST /api/license/check
{ "licenseKey": "SLX-...", "deviceId": "machine-uuid" }
```

A refused call returns `valid: false` with a `reason` the app should act on:

| reason | meaning |
| --- | --- |
| `not_found` | no such key — wrong key typed, or the key was regenerated |
| `revoked` | an admin revoked the license — block the app |
| `expired` | the license period ran out — prompt to renew |
| `seat_limit` | all allowed devices are in use — an admin must release one |
| `not_activated` | this device was never activated (or was released) — run activate |
| `rate_limited` | too many calls — back off and retry later |

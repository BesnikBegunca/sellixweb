# License API — integration notes for the SelliX desktop app

Base URL: `https://<your-app>.up.railway.app`

The license key issued when an admin creates a business in the dashboard is the
desktop app's API key. There is no separate account or token: the key
identifies the business, and `deviceId` identifies the installation.

Both endpoints are public (no cookie, no auth header) and rate limited to
**60 requests per 15 minutes per IP**.

The key can go in the JSON body as `licenseKey` or in an `x-license-key`
header — pick one, they behave identically.

---

## `POST /api/license/activate`

Run once per machine, during first-time setup, after the user types their key.
Binds `deviceId` to the license and consumes one of the allowed devices.

Request:

```json
{
  "licenseKey": "SLX-3K5S2-KJH4D-4DXTE-KK6CJ",
  "deviceId": "machine-uuid",
  "deviceName": "Arka kryesore"
}
```

- `deviceId` — a stable per-machine identifier you generate once and store
  locally. It must survive app restarts and updates, or the app will burn a
  seat on every launch. Max 200 characters.
- `deviceName` — optional, shown to the admin in the Businesses → Devices list
  so they can tell installations apart.

Response `200`:

```json
{
  "valid": true,
  "business": {
    "nui": "810123456",
    "name": "Market Dardania",
    "fiscalNumber": "600123456",
    "vatNumber": "330123456",
    "address": "Rr. Nëna Terezë 12",
    "city": "Prishtinë",
    "zipCode": "10000",
    "country": "Kosovë",
    "contactPerson": "Arben Krasniqi",
    "phone": "044123456",
    "email": "info@dardania.com",
    "sector": "market",
    "notes": "Klient nga viti 2024"
  },
  "license": { "status": "active", "expiresAt": "2027-09-18 14:08:04", "seats": 2, "devicesUsed": 1 }
}
```

Calling activate again with the same `deviceId` is safe — it refreshes the
device name and `last_seen_at` instead of consuming another seat.

`business` carries every field the admin dashboard holds — the same thirteen,
by the same names. Entering the key is therefore enough to fill the app's
business settings, including the fiscal and VAT numbers a receipt needs. The
shop never retypes what the admin already entered. Fields left blank in the
dashboard come back as `""`, not missing.

---

## `POST /api/license/check`

Run on every launch, and periodically while the app is open (once every few
hours is plenty — the rate limit is 60 per 15 minutes).

```json
{ "licenseKey": "SLX-...", "deviceId": "machine-uuid" }
```

A valid response is the same shape as activate. Note `expiresAt`: warn the user
as the date approaches so the license does not lapse mid-shift.

---

## Failure reasons

A refused call returns `valid: false` with a `reason`:

| reason | HTTP | meaning | what the app should do |
| --- | --- | --- | --- |
| `missing_license_key` | 400 | no key in body or header | bug in the request |
| `missing_device_id` | 400 | no `deviceId` | bug in the request |
| `not_found` | 404 | no such key — mistyped, or an admin regenerated it | ask for the key again |
| `revoked` | 403 | an admin revoked the license | block the app, show support contact |
| `expired` | 403 | the license period ran out | block, prompt to renew |
| `seat_limit` | 403 | all allowed devices are in use | tell the user an admin must release a device (the response also carries `seats`) |
| `not_activated` | 403 | this device was never activated, or was released | run activate again |
| `rate_limited` | 429 | too many calls | back off and retry later |

---

## Offline behaviour

The API is the source of truth, but a POS terminal cannot stop selling because
the internet dropped. Suggested handling:

- Cache the last successful `check` response locally, with its timestamp.
- On a **network error** (no response at all), keep running on the cached
  result for a grace period — a few days is typical — then degrade.
- On an explicit `revoked` / `expired` / `not_activated` answer, act on it
  immediately. Those are decisions from the server, not connectivity problems,
  so distinguish them from a failed request in your code.

---

## Trying it from the command line

```bash
BASE=https://<your-app>.up.railway.app
KEY=SLX-3K5S2-KJH4D-4DXTE-KK6CJ

# activate
curl -X POST $BASE/api/license/activate \
  -H 'Content-Type: application/json' \
  -d "{\"licenseKey\":\"$KEY\",\"deviceId\":\"dev-machine-1\",\"deviceName\":\"Test\"}"

# check
curl -X POST $BASE/api/license/check \
  -H 'Content-Type: application/json' \
  -H "x-license-key: $KEY" \
  -d '{"deviceId":"dev-machine-1"}'
```

---

## `POST /api/license/register` — shops set up without internet

For an installation that was configured before it had a connection. The app
generates a local install code, the shop starts trading on it, and Synchronize
posts the business details here. **The install code is not a licence** — it is
a claim ticket. An admin approves the request in the dashboard, and only then
does the server create the business and issue a real key.

```json
{
  "installCode": "PENDING-7Q4M",
  "deviceId": "machine-uuid",
  "deviceName": "Arka kryesore",
  "appKind": "restaurant",
  "nui": "810999888",
  "name": "Restorant Tirana",
  "city": "Prishtinë",
  "sector": "restaurant",
  "phone": "044111222",
  "email": "info@example.com",
  "contactPerson": "...", "address": "...", "zipCode": "...",
  "fiscalNumber": "...", "vatNumber": "...", "notes": "..."
}
```

`installCode`, `deviceId`, `name` and `nui` are required; the rest are
optional and fill in the business record. `appKind` tells the admin which
product asked — send `restaurant` or `market`.

Responses carry `valid` like the other two endpoints, so a client can branch
on that one field everywhere:

| status | HTTP | valid | meaning |
| --- | --- | --- | --- |
| `pending` | 202 | false | received, waiting for an admin |
| `approved` | 200 | true | carries `licenseKey`, `business` and `license` |
| `rejected` | 403 | false | an admin refused it; stop asking |
| `error` | 400 | false | with `reason`: `missing_install_code`, `missing_device_id`, `missing_business_name`, `missing_nui` |

An approved response looks like this — the same `business` and `license`
blocks that check returns, so the expiry and seat count are available without
a second call:

```json
{
  "valid": true,
  "status": "approved",
  "licenseKey": "SLX-JTFL9-DPN5A-WMM9G-XF6M9",
  "business": { "name": "Butik Zana", "nui": "860111222", "sector": "boutique", "city": "Ferizaj" },
  "license": { "status": "active", "expiresAt": "2027-09-18 15:46:58", "seats": 2, "devicesUsed": 1 }
}
```

Press Synchronize again periodically until it stops returning `pending`.
Re-posting is safe: the request is matched on `installCode`, so it updates the
existing row rather than creating a second one, and fields left out keep the
values an earlier call supplied.

Once approved, the device that registered is already bound to the licence — go
straight to `/api/license/check`, no separate activate needed.

---

## `POST /api/sales/sync` — restaurant till receipts

The desktop POS posts closed sales here (after payment, and again when the
internet returns). The web portal reads **only** these rows. Do not invent a
second endpoint for the same data.

```
POST /api/sales/sync
x-license-key: SLX-XXXXX-XXXXX-XXXXX-XXXXX
Content-Type: application/json

{
  "licenseKey": "SLX-...",
  "deviceId": "machine-uuid",
  "sales": [
    {
      "saleUid": "uuid-i-shitjes-ne-sqlite",
      "soldAt": "2026-09-19 20:14:03",
      "total": 42.50,
      "tax": 0,
      "discount": 0,
      "paymentMethod": "cash",
      "tableName": "Tavolina 4",
      "receiptNo": "481",
      "staffName": "Arta",
      "items": [
        { "name": "Pizza", "quantity": 2, "unitPrice": 6.00, "total": 12.00, "category": "Ushqim" }
      ]
    }
  ]
}
```

- Auth is the license key (`x-license-key` or `licenseKey` in the body), not
  an admin cookie.
- `saleUid` is the till's id. Re-posting the same uid **updates** the row
  instead of duplicating it.
- `soldAt` is the shop's local clock: `YYYY-MM-DD HH:MM:SS` (not UTC). Today /
  yesterday / week / month / year on the portal group on this field.
- `tableName` comes as `"Tavolina 1"`, `"Tavolina 2"`, … Takeaway / counter
  sales omit it (or send empty). They count in the day's total, not in the
  tables list.
- Up to **500** sales per request.
- Response: `{ "ok": true, "accepted": 1, "rejected": 0 }`

The business portal is `/portal` (license-key login). Restaurant / bar / café
sectors also see **Tavolinat**. Admins can open the same figures from
**Businesses → Shitjet** for those sectors; both views read the `sales` table.

---

## Admin-side endpoints

Everything under `/api/businesses` is cookie-authenticated and meant for the web
dashboard, not the desktop app. The desktop app only ever calls
`/api/license/*`. If an admin needs to free a seat, they do it from
**Businesses → Devices** in the dashboard.

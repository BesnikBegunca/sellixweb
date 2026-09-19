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

## Pushing sales up: `POST /api/sales/sync`

The owner portal (`/portal`) shows each shop its own takings — daily, weekly,
monthly, yearly and all-time, plus per-table totals for restaurants and bars.
Those figures come from this endpoint and nowhere else: **until the till posts
its sales here, the owner's dashboard is empty.**

Authentication is the licence key, exactly like activate and check — in an
`x-license-key` header or as `licenseKey` in the body. No cookie is involved.

```
POST /api/sales/sync
x-license-key: SLX-...
Content-Type: application/json

{
  "deviceId": "machine-uuid",
  "sales": [
    {
      "saleUid": "2026-000481",
      "soldAt": "2026-09-19 20:14:00",
      "total": 42.50,
      "tax": 3.86,
      "discount": 0,
      "paymentMethod": "cash",
      "tableName": "Tavolina 4",
      "receiptNo": "481",
      "staffName": "Arta",
      "items": [
        { "name": "Pizza", "quantity": 2, "unitPrice": 6.00, "total": 12.00 },
        { "name": "Birrë", "quantity": 4, "unitPrice": 2.00, "total": 8.00 }
      ]
    }
  ]
}

200 { "ok": true, "accepted": 1, "rejected": [] }
```

### The two fields that matter most

**`saleUid`** — the till's own id for the sale, unique within that shop. This is
what makes syncing idempotent: re-posting a sale with the same `saleUid`
updates it instead of adding a second copy. So a till that loses its connection
mid-push can simply send the whole batch again without inflating the takings,
and a corrected sale is fixed by re-sending it under the same id.

**`soldAt`** — when the sale was rung up, **in the shop's own local time**
(`YYYY-MM-DD HH:MM:SS`). Every daily/weekly/monthly total is grouped on this,
not on when the batch arrived, so a night's sales uploaded the next morning
still count on the night they belong to. A missing or unparseable `soldAt`
rejects that sale rather than silently dating it "now" — which would move real
takings onto the wrong day.

### The rest

| field | notes |
| --- | --- |
| `total`, `tax`, `discount` | decimal euros. Send `totalCents` etc. instead if the till already holds minor units — either is accepted |
| `tableName` | the table the sale was rung up on. **Required for the Tables tab**; leave empty for takeaway or counter sales, which are counted in the day's total but excluded from table totals |
| `paymentMethod` | `cash`, `card`, `bank`, `voucher` … drives the payment breakdown |
| `items` | optional. Without them the totals still work; with them the owner also gets a top-products list. Items are replaced on re-sync, so corrections cannot double-count |
| `receiptNo`, `staffName`, `currency` | optional, shown in the sales list |

Up to **500 sales per request**; send more in several batches. The whole batch
is written in one transaction, so it either all lands or none of it does.
Rejected sales come back individually in `rejected` with a reason — the rest of
the batch is still accepted.

Refusals use the same reasons as the licence endpoints: `not_found`, `revoked`,
`expired` (a shop whose licence lapsed stops reporting), plus `missing_sales`
and `batch_too_large`.

### When to call it

After each sale if the till is online, or in a batch when it reconnects —
whichever suits the app. Since re-posting is safe, the simplest correct
strategy is to keep a local "not yet synced" flag, post everything still
flagged, and clear the flag on a `200`.

---

## Admin-side endpoints

Everything under `/api/businesses` is cookie-authenticated and meant for the web
dashboard, not the desktop app. The desktop app only ever calls
`/api/license/*` and `/api/sales/sync`. If an admin needs to free a seat, they do it from
**Businesses → Devices** in the dashboard.

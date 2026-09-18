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
  "business": { "name": "Market Testi", "nui": "810123456", "sector": "market", "city": "Prishtinë" },
  "license": { "status": "active", "expiresAt": "2027-09-18 14:08:04", "seats": 2, "devicesUsed": 1 }
}
```

Calling activate again with the same `deviceId` is safe — it refreshes the
device name and `last_seen_at` instead of consuming another seat.

Use `business` to prefill the business details in the app (name, NUI, city,
sector) so the user does not retype what the admin already entered.

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

## Admin-side endpoints

Everything under `/api/businesses` is cookie-authenticated and meant for the web
dashboard, not the desktop app. The desktop app only ever calls
`/api/license/*`. If an admin needs to free a seat, they do it from
**Businesses → Devices** in the dashboard.

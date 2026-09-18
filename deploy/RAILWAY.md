# Deploying SelliX to Railway

One Railway service runs everything: Express serves the built React site and the
API from the same domain, so the admin session cookie stays same-origin and no
CORS setup is needed. The SQLite database lives on a mounted volume so it
survives redeploys.

## 1. Push the repo to GitHub

Railway deploys from a Git repository. From the repo root:

```
git init
git add .
git commit -m "SelliX web + API"
git remote add origin git@github.com:<you>/sellix.git
git push -u origin main
```

`.gitignore` already excludes `node_modules/`, `dist/`, `data/` and `.env`.

## 2. Create the service

In Railway: **New Project → Deploy from GitHub repo**, and pick the repo.
Railway reads `railway.json` and `nixpacks.toml` from the root, so the build and
start commands are already configured — leave them empty in the UI.

## 3. Add the volume (do this before the first successful deploy)

**Service → Variables → + Volume**, mount path `/data`.

Without it the SQLite file sits on the container filesystem and every redeploy
wipes all businesses, licenses and leads.

## 4. Set the variables

**Service → Variables → Raw editor**:

```
JWT_SECRET=<paste a long random string>
DATA_DIR=/data
COOKIE_SECURE=true
TRUST_PROXY=1
CLIENT_ORIGIN=https://<your-app>.up.railway.app
SEED_ADMIN_EMAIL=admin@sellix.software
SEED_ADMIN_PASSWORD=<a strong one-time password>
```

Generate the secret with `openssl rand -hex 32` (or
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

Do **not** set `PORT` — Railway injects it, and the server already reads it.

`CLIENT_ORIGIN` is only used for CORS. Since the site and API share a domain
the browser sends no cross-origin requests, but set it correctly anyway so a
misconfigured origin is rejected. Multiple domains go in comma-separated.

## 5. Generate the domain

**Settings → Networking → Generate Domain**. Railway gives you
`https://<your-app>.up.railway.app`. Put that value into `CLIENT_ORIGIN` and
redeploy.

For a custom domain: **Settings → Networking → Custom Domain**, add
`sellix.software`, create the CNAME Railway shows at your DNS provider, then add
it to `CLIENT_ORIGIN` as well.

## 6. First login

Go to `https://<your-app>.up.railway.app/admin/login` and sign in with
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. The app forces a password change on
that first login.

After that, remove `SEED_ADMIN_PASSWORD` from the variables — the seed skips an
existing user, so it is no longer needed and should not sit in the dashboard.

## What happens on each deploy

1. Nixpacks installs `web/` and `server/` dependencies and runs `vite build`
2. `npm --prefix server start` boots Express
3. `db.js` opens `/data/sellix.db` and creates any missing tables
4. `seed()` inserts the default site content and the first admin user if they
   are not there yet — both steps no-op afterwards
5. Express serves `web/dist` for everything that is not `/api/*`

`/api/health` is the healthcheck endpoint Railway polls.

## Checking a deploy

```
curl https://<your-app>.up.railway.app/api/health
# {"ok":true,"uptime":12.3}
```

Logs are under **Deployments → View Logs**. A successful boot prints
`Serving frontend from …` followed by `Sellix API listening on port …`. If it
says `serving the API only`, the frontend build did not run — check the build
logs for a `vite build` failure.

## Backing up the database

The volume is not backed up automatically. To pull a copy down:

```
railway login
railway link
railway run cat /data/sellix.db > sellix-backup.db
```

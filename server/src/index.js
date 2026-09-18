import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { contentRouter } from './routes/content.js';
import { leadsRouter } from './routes/leads.js';
import { usersRouter } from './routes/users.js';
import { businessesRouter } from './routes/businesses.js';
import { licenseRouter } from './routes/license.js';
import { seed } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The schema is created on import of db.js; this tops it up with the default
// site content and the first admin user. Both steps no-op once they have run.
seed();

const app = express();
const PORT = process.env.PORT || 4000;
// Comma-separated so a staging domain or a separately hosted frontend can be
// allowed alongside the main one.
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Behind nginx or Railway's edge the client IP arrives in X-Forwarded-For;
// without this every request looks like it came from the proxy and rate
// limiting counts them all as one.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

app.use(
  cors({
    // No Origin header means a non-browser caller (the desktop app, curl) —
    // those are authenticated by license key, not by cookie, so let them past.
    origin(origin, callback) {
      // Refusing by omitting the CORS headers rather than by throwing: the
      // browser blocks the response either way, and the server answers with a
      // plain status instead of a 500 from the error handler.
      callback(null, !origin || CLIENT_ORIGINS.includes(origin));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.use('/api/auth', authRouter);
app.use('/api/content', contentRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/users', usersRouter);
app.use('/api/businesses', businessesRouter);
app.use('/api/license', licenseRouter);

// In production the built frontend ships inside the same container, so one
// service serves both the site and the API and the session cookie stays
// same-origin. Locally the Vite dev server handles this instead.
const webDist = process.env.WEB_DIST
  ? path.resolve(process.env.WEB_DIST)
  : path.join(__dirname, '..', '..', 'web', 'dist');

if (fs.existsSync(path.join(webDist, 'index.html'))) {
  app.use(express.static(webDist, { index: false }));
  // Client-side routing: anything that is not an API call renders the SPA.
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
  console.log(`Serving frontend from ${webDist}`);
} else {
  console.log(`No frontend build at ${webDist} — serving the API only.`);
}

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Railway routes traffic to the container's external interface, so binding to
// localhost would make the service unreachable.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sellix API listening on port ${PORT}`);
});

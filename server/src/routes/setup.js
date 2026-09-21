import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { requireAuth } from '../auth.js';
import {
  adminSetupInfo,
  getSetupMeta,
  incrementDownloadCount,
  publicSetupInfo,
  resetDownloadCount,
  sanitizeFileName,
  saveSetupFromPath,
  setupsDir,
  setupAvailable
} from '../setupFile.js';

export const setupRouter = Router();

const MAX_BYTES = 400 * 1024 * 1024;

setupRouter.get('/', (_req, res) => {
  res.json(publicSetupInfo());
});

setupRouter.get('/admin', requireAuth, (_req, res) => {
  res.json(adminSetupInfo());
});

setupRouter.post('/downloads/reset', requireAuth, (_req, res) => {
  res.json(resetDownloadCount());
});

setupRouter.get('/download', (req, res) => {
  if (!setupAvailable()) {
    return res.status(404).json({ error: 'Setup nuk është i disponueshëm ende.' });
  }
  const meta = getSetupMeta();
  const filePath = path.join(setupsDir, meta.stored_name);
  incrementDownloadCount();
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', meta.size_bytes);
  const downloadName = sanitizeFileName(meta.file_name) || 'Sellix-Setup.exe';
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${downloadName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`
  );
  res.setHeader('Cache-Control', 'no-store');
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
    else res.end();
  });
  stream.pipe(res);
});

// Raw binary body (not multipart) — more reliable for large .exe uploads behind proxies.
setupRouter.put('/upload', requireAuth, (req, res) => {
  const length = Number(req.headers['content-length'] || 0);
  if (!Number.isFinite(length) || length <= 0) {
    return res.status(400).json({ error: 'Content-Length mungon.' });
  }
  if (length > MAX_BYTES) {
    return res.status(413).json({ error: 'Skedari është shumë i madh (max 400 MB).' });
  }

  let originalName = 'Sellix Setup.exe';
  try {
    originalName = decodeURIComponent(String(req.headers['x-filename'] || originalName));
  } catch {
    originalName = String(req.headers['x-filename'] || originalName);
  }
  const lower = originalName.toLowerCase();
  if (!/\.(exe|msi|dmg|pkg|zip)$/.test(lower)) {
    return res.status(400).json({ error: 'Allowed types: .exe, .msi, .dmg, .pkg, .zip' });
  }

  const tmp = path.join(setupsDir, `upload-${Date.now()}-${process.pid}.tmp`);
  const ws = fs.createWriteStream(tmp);
  let settled = false;

  const fail = (status, message) => {
    if (settled) return;
    settled = true;
    try {
      ws.destroy();
    } catch {
      /* ignore */
    }
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    if (!res.headersSent) res.status(status).json({ error: message });
  };

  ws.on('error', () => fail(500, 'Nuk u shkrua skedari në disk.'));
  req.on('aborted', () => fail(499, 'Upload u ndërpre.'));
  req.on('error', () => fail(500, 'Upload failed'));

  req.pipe(ws);

  ws.on('finish', () => {
    if (settled) return;
    settled = true;
    try {
      const stat = fs.statSync(tmp);
      if (stat.size <= 0) {
        try {
          fs.unlinkSync(tmp);
        } catch {
          /* ignore */
        }
        return res.status(400).json({ error: 'Skedari bosh.' });
      }
      const info = saveSetupFromPath(tmp, originalName, req.user?.email || '');
      try {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
      res.json(info);
    } catch (e) {
      try {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
      res.status(500).json({ error: e.message || 'Upload failed' });
    }
  });
});

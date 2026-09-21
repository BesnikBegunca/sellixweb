import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../auth.js';
import {
  adminSetupInfo,
  getSetupMeta,
  incrementDownloadCount,
  publicSetupInfo,
  sanitizeFileName,
  saveSetupFromPath,
  setupsDir,
  setupAvailable
} from '../setupFile.js';

export const setupRouter = Router();

const upload = multer({
  dest: setupsDir,
  limits: { fileSize: 400 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const name = (file.originalname || '').toLowerCase();
    if (name.endsWith('.exe') || name.endsWith('.msi') || name.endsWith('.dmg') || name.endsWith('.pkg') || name.endsWith('.zip')) {
      cb(null, true);
      return;
    }
    cb(new Error('Allowed types: .exe, .msi, .dmg, .pkg, .zip'));
  }
});

setupRouter.get('/', (_req, res) => {
  res.json(publicSetupInfo());
});

setupRouter.get('/admin', requireAuth, (_req, res) => {
  res.json(adminSetupInfo());
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

setupRouter.post('/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Zgjidh një skedar setup.' });
    }
    try {
      const info = saveSetupFromPath(
        req.file.path,
        req.file.originalname || 'Sellix Setup.exe',
        req.user?.email || ''
      );
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* temp already moved/replaced */
      }
      // saveSetupFromPath copies; remove multer temp if still there under different name
      res.json(info);
    } catch (e) {
      try {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
      res.status(500).json({ error: e.message || 'Upload failed' });
    }
  });
});

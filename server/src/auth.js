import jwt from 'jsonwebtoken';
import { startSession, touchSession, isSessionActive, revokeSession, ensureDeviceCookie } from './sessions.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set (see .env.example)');
}

const COOKIE_NAME = 'sellix_session';
const PORTAL_COOKIE_NAME = 'sellix_portal';
const TOKEN_TTL = '12h';

export function signToken(user, jti) {
  const payload = { sub: user.id, email: user.email, typ: 'admin' };
  if (jti) payload.jti = jti;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function signPortalToken(business, jti) {
  const payload = { sub: business.id, typ: 'portal' };
  if (jti) payload.jti = jti;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// 'lax' is right when the API and the site share a domain. A frontend hosted
// elsewhere needs COOKIE_SAMESITE=none, which browsers only accept together
// with Secure — so that combination also forces COOKIE_SECURE on.
const SAME_SITE = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
const SECURE = process.env.COOKIE_SECURE === 'true' || SAME_SITE === 'none';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: SAME_SITE,
  secure: SECURE,
  path: '/'
};

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: 12 * 60 * 60 * 1000 });
}

export function clearSessionCookie(res) {
  // The attributes must match the ones the cookie was set with or the browser
  // keeps it.
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
}

export function setPortalCookie(res, token) {
  res.cookie(PORTAL_COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: 12 * 60 * 60 * 1000 });
}

export function clearPortalCookie(res) {
  res.clearCookie(PORTAL_COOKIE_NAME, COOKIE_OPTIONS);
}

export function beginAdminSession(user, req, res) {
  ensureDeviceCookie(req, res, COOKIE_OPTIONS);
  const jti = startSession('admin', user.id, req, res, COOKIE_OPTIONS);
  const token = signToken(user, jti);
  setSessionCookie(res, token);
  return token;
}

export function beginPortalSession(business, req, res) {
  ensureDeviceCookie(req, res, COOKIE_OPTIONS);
  const jti = startSession('portal', business.id, req, res, COOKIE_OPTIONS);
  const token = signPortalToken(business, jti);
  setPortalCookie(res, token);
  return token;
}

function readToken(req, name) {
  const token = req.cookies?.[name];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function endAdminSession(req, res) {
  const payload = readToken(req, COOKIE_NAME);
  if (payload?.jti) revokeSession(payload.jti);
  clearSessionCookie(res);
}

export function endPortalSession(req, res) {
  const payload = readToken(req, PORTAL_COOKIE_NAME);
  if (payload?.jti) revokeSession(payload.jti);
  clearPortalCookie(res);
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.typ === 'portal') return res.status(401).json({ error: 'Not authenticated' });
    if (payload.jti && !isSessionActive(payload.jti)) {
      return res.status(401).json({ error: 'Session expired' });
    }
    if (payload.jti) touchSession(payload.jti);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired' });
  }
}

export function requirePortal(req, res, next) {
  const token = req.cookies?.[PORTAL_COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.typ !== 'portal') return res.status(401).json({ error: 'Not authenticated' });
    if (payload.jti && !isSessionActive(payload.jti)) {
      return res.status(401).json({ error: 'Session expired' });
    }
    if (payload.jti) touchSession(payload.jti);
    req.businessId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired' });
  }
}

export { COOKIE_NAME, PORTAL_COOKIE_NAME };

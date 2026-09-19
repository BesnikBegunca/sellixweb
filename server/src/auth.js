import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set (see .env.example)');
}

const COOKIE_NAME = 'sellix_session';
const TOKEN_TTL = '12h';

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
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

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const claims = jwt.verify(token, JWT_SECRET);
    // A business token is signed with the same secret, so without this check a
    // shop owner's cookie would verify here and open every admin route.
    if (claims.kind === BUSINESS_TOKEN_KIND) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    req.user = claims;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired' });
  }
}

// --- Business portal sessions ---------------------------------------------
// A shop owner's session is deliberately a different cookie under a different
// name, so signing in to the portal never disturbs an admin session in the
// same browser, and neither token can be replayed against the other's routes.

const BUSINESS_COOKIE_NAME = 'sellix_business_session';
const BUSINESS_TOKEN_KIND = 'business';

export function signBusinessToken(business) {
  return jwt.sign({ sub: business.id, kind: BUSINESS_TOKEN_KIND }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function setBusinessSessionCookie(res, token) {
  res.cookie(BUSINESS_COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: 12 * 60 * 60 * 1000 });
}

export function clearBusinessSessionCookie(res) {
  res.clearCookie(BUSINESS_COOKIE_NAME, COOKIE_OPTIONS);
}

export function requireBusinessAuth(req, res, next) {
  const token = req.cookies?.[BUSINESS_COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const claims = jwt.verify(token, JWT_SECRET);
    if (claims.kind !== BUSINESS_TOKEN_KIND) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    req.businessId = claims.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired' });
  }
}

export { COOKIE_NAME, BUSINESS_COOKIE_NAME };

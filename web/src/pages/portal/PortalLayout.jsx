import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { usePortal } from '../../lib/PortalContext';
import { api } from '../../lib/api';
import { parseLicenseExpiry } from '../../lib/sales';
import VerifiedBadge from './VerifiedBadge';
import '../admin/admin.css';
import './portal.css';

const RENEWAL_HOUR_MS = 60 * 60 * 1000;

function renewalKey(id) {
  return `sellix_renewal_prompt_${id}`;
}

function LicenseRenewalPrompt({ business }) {
  const { setBusiness } = usePortal();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const info = parseLicenseExpiry(business?.licenseExpiresAt);
  const adminNotice = Boolean(business?.licenseNoticeAt);

  useEffect(() => {
    if (!business?.id) return undefined;
    if (adminNotice) {
      setOpen(true);
      setError('');
      return undefined;
    }
    const expiry = parseLicenseExpiry(business.licenseExpiresAt);
    if (!expiry || expiry.days > 7 || expiry.days < 0) {
      setOpen(false);
      return undefined;
    }
    const tick = () => {
      let last = 0;
      try {
        last = Number(window.localStorage.getItem(renewalKey(business.id))) || 0;
      } catch {
        last = 0;
      }
      if (!last || Date.now() - last >= RENEWAL_HOUR_MS) setOpen(true);
    };
    tick();
    const timer = setInterval(tick, 15000);
    return () => clearInterval(timer);
  }, [business?.id, business?.licenseExpiresAt, business?.licenseNoticeAt, adminNotice]);

  const snooze = async () => {
    if (adminNotice) {
      try {
        await api.portalAckNotice();
        setBusiness({ ...business, licenseNoticeAt: null });
      } catch {
        /* still close locally */
      }
    }
    try {
      window.localStorage.setItem(renewalKey(business.id), String(Date.now()));
    } catch {
      /* ignore */
    }
    setOpen(false);
    setError('');
  };

  const send = async () => {
    setSending(true);
    setError('');
    try {
      await api.portalRenewalRequest();
      setBusiness({ ...business, licenseNoticeAt: null });
      try {
        window.localStorage.setItem(renewalKey(business.id), String(Date.now()));
      } catch {
        /* ignore */
      }
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const daysLeft = info && info.days < 0 ? 0 : (info?.days ?? 0);
  const message = !info || info.days < 0
    ? 'Licenca juaj ka skaduar. Dërgo kërkesën për vazhdim.'
    : info.days === 0
      ? 'Licenca juaj skadon sot. Dërgo kërkesën për vazhdim.'
      : `Licenca juaj skadon edhe ${daysLeft} ditë. Dërgo kërkesën për vazhdim.`;

  return (
    <div className="pt-modal-back" role="dialog" aria-modal="true" aria-labelledby="pt-renewal-title">
      <div className="ad-card pt-modal">
        <h2 id="pt-renewal-title" className="ad-heading pt-h" style={{ marginBottom: 8 }}>Licenca skadon</h2>
        <p className="ad-hint" style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
          {message}
        </p>
        {error && <div className="ad-error" style={{ marginBottom: 12 }}>{error}</div>}
        <div className="pt-modal-actions">
          <button type="button" className="ad-btn-ghost" onClick={snooze} disabled={sending}>Cancel</button>
          <button type="button" className="ad-btn" onClick={send} disabled={sending}>
            {sending ? 'Duke dërguar…' : 'Dërgo kërkesën për vazhdim'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ForcedPasswordChange() {
  const { business, setBusiness } = usePortal();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) return setError('Fjalëkalimi i ri duhet të ketë së paku 8 karaktere.');
    if (newPassword !== confirm) return setError('Fjalëkalimet nuk përputhen.');
    setSubmitting(true);
    try {
      await api.portalChangePassword(newPassword);
      setBusiness({ ...business, mustChangePassword: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ad pt-login">
      <div className="ad-card" style={{ padding: 28, width: '100%', maxWidth: 400 }}>
        <div className="ad-mono" style={{ fontSize: 11, letterSpacing: '.14em', color: 'oklch(0.82 0.12 195)', marginBottom: 8 }}>KËRKOHET</div>
        <h1 className="ad-heading" style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.02em' }}>Vendos fjalëkalim të ri</h1>
        <p style={{ fontSize: 14, color: '#8FA0B2', margin: '0 0 20px', lineHeight: 1.5 }}>
          Kjo llogari po përdor fjalëkalimin e përkohshëm. Zgjidh një të ri për të vazhduar te portali.
        </p>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="ad-field" type="password" required autoComplete="new-password" placeholder="Fjalëkalimi i ri" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <input className="ad-field" type="password" required autoComplete="new-password" placeholder="Përsërit fjalëkalimin" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <div className="ad-error">{error}</div>}
          <button className="ad-btn" type="submit" disabled={submitting}>{submitting ? 'Duke ruajtur…' : 'Ruaj fjalëkalimin'}</button>
        </form>
      </div>
    </div>
  );
}

export default function PortalLayout() {
  const { business, logout } = usePortal();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/portal/login', { replace: true });
  };

  if (business?.mustChangePassword) return <ForcedPasswordChange />;

  return (
    <div className="ad pt-shell">
      <header className="pt-top">
        <div className="pt-brand">
          <span className="pt-mark">
            <span></span>
          </span>
          <div>
            <div className="ad-heading pt-name">
              <span className="pt-name-text">{business?.name || 'SelliX'}</span>
              {business?.verified && <VerifiedBadge color={business.verifiedColor} />}
            </div>
            <div className="ad-hint">{business?.city ? `${business.city} · ` : ''}Portal i biznesit</div>
          </div>
        </div>
        <div className="pt-header-actions">
          <button type="button" className="ad-btn-ghost" onClick={() => window.location.reload()}>
            Rifresko
          </button>
          <button type="button" className="pt-btn-dil" onClick={onLogout}>Dil</button>
        </div>
      </header>

      <nav className="pt-tabs" aria-label="Portal">
        <NavLink to="/portal" end className={({ isActive }) => `pt-tab${isActive ? ' active' : ''}`}>
          Shitjet
        </NavLink>
        {business?.isRestaurant ? (
          <NavLink to="/portal/tables" className={({ isActive }) => `pt-tab${isActive ? ' active' : ''}`}>
            Tavolinat
          </NavLink>
        ) : (
          <NavLink to="/portal/registers" className={({ isActive }) => `pt-tab${isActive ? ' active' : ''}`}>
            Kompjuterët
          </NavLink>
        )}
        {business?.isRestaurant && (
          <NavLink to="/portal/gjendja" className={({ isActive }) => `pt-tab${isActive ? ' active' : ''}`}>
            Gjendja
          </NavLink>
        )}
        <NavLink to="/portal/reports" className={({ isActive }) => `pt-tab${isActive ? ' active' : ''}`}>
          Raportet
        </NavLink>
        <NavLink to="/portal/account" className={({ isActive }) => `pt-tab${isActive ? ' active' : ''}`}>
          Llogaria
        </NavLink>
      </nav>

      <main className="pt-main">
        <Outlet />
      </main>

      <div className="pt-foot">
        <Link to="/" className="ad-hint" style={{ textDecoration: 'underline' }}>← Faqja e SelliX</Link>
      </div>
      <LicenseRenewalPrompt business={business} />
    </div>
  );
}

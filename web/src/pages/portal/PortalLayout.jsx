import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { usePortal } from '../../lib/PortalContext';
import { api } from '../../lib/api';
import VerifiedBadge from './VerifiedBadge';
import '../admin/admin.css';
import './portal.css';

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
      await api.portalChangePassword(undefined, newPassword);
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
          <button type="button" className="ad-btn-ghost" onClick={onLogout}>Dil</button>
        </div>
      </header>

      <nav className="pt-tabs" aria-label="Portal">
        <NavLink to="/portal" end className={({ isActive }) => `pt-tab${isActive ? ' active' : ''}`}>
          Shitjet
        </NavLink>
        {business?.isRestaurant && (
          <NavLink to="/portal/tables" className={({ isActive }) => `pt-tab${isActive ? ' active' : ''}`}>
            Tavolinat
          </NavLink>
        )}
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
    </div>
  );
}

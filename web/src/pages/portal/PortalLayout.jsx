import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../../lib/PortalAuthContext';
import { api } from '../../lib/api';
import '../admin/admin.css';
import './portal.css';

function ForcedPasswordChange() {
  const { business, setBusiness } = usePortalAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) return setError('Fjalëkalimi duhet të ketë së paku 8 karaktere.');
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
    <div className="ad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="ad-card" style={{ padding: 28, width: '100%', maxWidth: 400 }}>
        <div className="ad-mono" style={{ fontSize: 11, letterSpacing: '.14em', color: 'oklch(0.82 0.12 195)', marginBottom: 8 }}>
          HAPI I PARË
        </div>
        <h1 className="ad-heading" style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
          Vendosni një fjalëkalim të ri
        </h1>
        <p style={{ fontSize: 14, color: '#8FA0B2', margin: '0 0 20px', lineHeight: 1.5 }}>
          Kjo llogari po përdor një fjalëkalim të përkohshëm. Zgjidhni një të ri për të vazhduar.
        </p>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="ad-field"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Fjalëkalimi i ri"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            className="ad-field"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Përsërit fjalëkalimin"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <div className="ad-error">{error}</div>}
          <button className="ad-btn" type="submit" disabled={submitting}>
            {submitting ? 'Duke ruajtur…' : 'Ruaj fjalëkalimin'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PortalLayout() {
  const { business, logout } = usePortalAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    navigate('/portal/login', { replace: true });
  };

  if (business?.mustChangePassword) return <ForcedPasswordChange />;

  const closeMenu = () => setMobileMenuOpen(false);
  const navClass = ({ isActive }) => `ad-nav-link${isActive ? ' active' : ''}`;

  return (
    <div className={`ad ad-shell ${mobileMenuOpen ? 'menu-open' : ''}`} style={{ display: 'flex' }}>
      <div className="ad-backdrop" onClick={closeMenu} />

      <div className="ad-mobile-topbar">
        <button className="ad-menu-toggle" aria-label="Hap menynë" onClick={() => setMobileMenuOpen((v) => !v)}>
          ☰
        </button>
        <div className="ad-heading" style={{ fontSize: 16, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {business?.name || 'SelliX'}
        </div>
      </div>

      <aside
        className="ad-sidebar"
        style={{ width: 220, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,.07)', padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100vh' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'block', width: 28, height: 20, border: '2px solid #F2F6FA', borderRadius: 5, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 2, right: 2, top: 3, height: 2, background: '#F2F6FA' }}></span>
            </span>
            <span className="ad-heading" style={{ fontWeight: 700, fontSize: 17 }}>SelliX</span>
          </div>
          <button className="ad-close-menu" aria-label="Mbyll menynë" onClick={closeMenu}>×</button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NavLink to="/portal/shitjet" className={navClass} onClick={closeMenu}>Shitjet</NavLink>
          {/* Only table-service sectors get this tab — a pharmacy has no tables. */}
          {business?.hasTables && (
            <NavLink to="/portal/tavolinat" className={navClass} onClick={closeMenu}>Tavolinat</NavLink>
          )}
          <NavLink to="/portal/llogaria" className={navClass} onClick={closeMenu}>Llogaria</NavLink>
        </nav>

        <div style={{ flex: 1 }} />

        <div style={{ padding: '0 6px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#D5DFE8', marginBottom: 2, overflowWrap: 'anywhere' }}>
            {business?.name}
          </div>
          <div style={{ fontSize: 12, color: '#61707F', marginBottom: 12, wordBreak: 'break-all' }}>{business?.email}</div>
          <button className="ad-btn-ghost" onClick={onLogout} style={{ width: '100%' }}>Dil</button>
        </div>

        <Link to="/" className="ad-hint" style={{ textAlign: 'center', textDecoration: 'underline' }} onClick={closeMenu}>
          ← Kthehu në faqe
        </Link>
      </aside>

      <main className="ad-main" style={{ flex: 1, padding: '28px 32px', minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}

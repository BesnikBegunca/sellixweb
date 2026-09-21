import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';
import './admin.css';

function ForcedPasswordChange() {
  const { setUser, user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) return setError('Password must be at least 8 characters.');
    if (newPassword !== confirm) return setError('Passwords do not match.');
    setSubmitting(true);
    try {
      await api.changeOwnPassword(newPassword);
      setUser({ ...user, mustChangePassword: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ad ad-login">
      <div className="ad-card" style={{ padding: 28, width: '100%', maxWidth: 400 }}>
        <div className="ad-mono" style={{ fontSize: 11, letterSpacing: '.14em', color: 'oklch(0.82 0.12 195)', marginBottom: 8 }}>SETUP REQUIRED</div>
        <h1 className="ad-heading" style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.02em' }}>Set a new password</h1>
        <p style={{ fontSize: 14, color: '#8FA0B2', margin: '0 0 20px', lineHeight: 1.5 }}>
          This account is using a temporary password. Choose a new one to continue to the dashboard.
        </p>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="ad-field" type="password" required placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <input className="ad-field" type="password" required placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <div className="ad-error">{error}</div>}
          <button className="ad-btn" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Set password'}</button>
        </form>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  if (user?.mustChangePassword) return <ForcedPasswordChange />;

  return (
    <div className={`ad ad-shell ${mobileMenuOpen ? 'menu-open' : ''}`} style={{ display: 'flex' }}>
      <div className="ad-backdrop" onClick={() => setMobileMenuOpen(false)} />

      <div className="ad-mobile-topbar">
        <button className="ad-menu-toggle" aria-label="Open menu" onClick={() => setMobileMenuOpen((v) => !v)}>
          ☰
        </button>
        <div className="ad-heading" style={{ fontSize: 18, fontWeight: 700 }}>SelliX</div>
      </div>

      <aside className="ad-sidebar" style={{ width: 220, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,.07)', padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'block', width: 28, height: 20, border: '2px solid #F2F6FA', borderRadius: 5, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 2, right: 2, top: 3, height: 2, background: '#F2F6FA' }}></span>
            </span>
            <span className="ad-heading" style={{ fontWeight: 700, fontSize: 17 }}>SelliX</span>
          </div>
          <button className="ad-close-menu" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}>×</button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NavLink to="/admin/leads" className={({ isActive }) => `ad-nav-link${isActive ? ' active' : ''}`} onClick={() => setMobileMenuOpen(false)}>Leads</NavLink>
          <NavLink to="/admin/businesses" className={({ isActive }) => `ad-nav-link${isActive ? ' active' : ''}`} onClick={() => setMobileMenuOpen(false)}>Businesses</NavLink>
          <NavLink to="/admin/licenses" className={({ isActive }) => `ad-nav-link${isActive ? ' active' : ''}`} onClick={() => setMobileMenuOpen(false)}>Licencat</NavLink>
          <NavLink to="/admin/recycle-bin" className={({ isActive }) => `ad-nav-link${isActive ? ' active' : ''}`} onClick={() => setMobileMenuOpen(false)}>Recycle bin</NavLink>
          <NavLink to="/admin/registrations" className={({ isActive }) => `ad-nav-link${isActive ? ' active' : ''}`} onClick={() => setMobileMenuOpen(false)}>Registrations</NavLink>
          <NavLink to="/admin/content" className={({ isActive }) => `ad-nav-link${isActive ? ' active' : ''}`} onClick={() => setMobileMenuOpen(false)}>Site content</NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => `ad-nav-link${isActive ? ' active' : ''}`} onClick={() => setMobileMenuOpen(false)}>Admin users</NavLink>
        </nav>

        <div style={{ flex: 1 }} />

        <div style={{ padding: '0 6px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#D5DFE8', marginBottom: 2 }}>{user?.name || user?.email}</div>
          <div style={{ fontSize: 12, color: '#61707F', marginBottom: 12, wordBreak: 'break-all' }}>{user?.email}</div>
          <button className="ad-btn-ghost" onClick={() => window.location.reload()} style={{ width: '100%', marginBottom: 8 }}>Reload</button>
          <button className="ad-btn-ghost" onClick={onLogout} style={{ width: '100%' }}>Log out</button>
        </div>

        <Link to="/" className="ad-hint" style={{ textAlign: 'center', textDecoration: 'underline' }} onClick={() => setMobileMenuOpen(false)}>← Back to website</Link>
      </aside>

      <main className="ad-main" style={{ flex: 1, padding: '28px 32px', minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}

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
      await api.changeOwnPassword(undefined, newPassword);
      setUser({ ...user, mustChangePassword: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
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

  const onLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  if (user?.mustChangePassword) return <ForcedPasswordChange />;

  return (
    <div className="ad" style={{ display: 'flex' }}>
      <aside style={{ width: 220, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,.07)', padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px' }}>
          <span style={{ display: 'block', width: 28, height: 20, border: '2px solid #F2F6FA', borderRadius: 5, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 2, right: 2, top: 3, height: 2, background: '#F2F6FA' }}></span>
          </span>
          <span className="ad-heading" style={{ fontWeight: 700, fontSize: 17 }}>SelliX</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NavLink to="/admin/leads" className={({ isActive }) => `ad-nav-link${isActive ? ' active' : ''}`}>Leads</NavLink>
          <NavLink to="/admin/businesses" className={({ isActive }) => `ad-nav-link${isActive ? ' active' : ''}`}>Businesses</NavLink>
          <NavLink to="/admin/content" className={({ isActive }) => `ad-nav-link${isActive ? ' active' : ''}`}>Site content</NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => `ad-nav-link${isActive ? ' active' : ''}`}>Admin users</NavLink>
        </nav>

        <div style={{ flex: 1 }} />

        <div style={{ padding: '0 6px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#D5DFE8', marginBottom: 2 }}>{user?.name || user?.email}</div>
          <div style={{ fontSize: 12, color: '#61707F', marginBottom: 12, wordBreak: 'break-all' }}>{user?.email}</div>
          <button className="ad-btn-ghost" onClick={onLogout} style={{ width: '100%' }}>Log out</button>
        </div>

        <Link to="/" className="ad-hint" style={{ textAlign: 'center', textDecoration: 'underline' }}>← Back to website</Link>
      </aside>

      <main style={{ flex: 1, padding: '28px 32px', minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}

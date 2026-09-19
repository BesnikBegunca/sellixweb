import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { usePortal } from '../../lib/PortalContext';
import '../admin/admin.css';
import './portal.css';

export default function PortalLogin() {
  const { business, loading, login } = usePortal();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && business) {
    const dest = location.state?.from?.pathname || '/portal';
    return <Navigate to={dest} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email, password);
      navigate('/portal', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ad pt-login">
      <div style={{ width: '100%', maxWidth: 400 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 34, justifyContent: 'center' }}>
          <span style={{ display: 'block', width: 30, height: 21, border: '2px solid #F2F6FA', borderRadius: 5, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 2, right: 2, top: 3, height: 2, background: '#F2F6FA' }}></span>
          </span>
          <span className="ad-heading" style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>SelliX</span>
        </Link>

        <div className="ad-card" style={{ padding: 28 }}>
          <div className="ad-mono" style={{ fontSize: 11, letterSpacing: '.14em', color: 'oklch(0.82 0.12 195)', marginBottom: 8 }}>BIZNESI IM</div>
          <h1 className="ad-heading" style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Hyni në llogarinë tuaj</h1>
          <p style={{ fontSize: 14, color: '#8FA0B2', margin: '0 0 22px', lineHeight: 1.5 }}>
            Shikoni shitjet e biznesit tuaj — ditore, javore, mujore dhe vjetore.
          </p>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label htmlFor="pt-email" style={{ display: 'block', fontSize: 12, color: '#8FA0B2', marginBottom: 6 }}>Email</label>
              <input
                id="pt-email"
                className="ad-field"
                type="email"
                required
                autoFocus
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="pt-password" style={{ display: 'block', fontSize: 12, color: '#8FA0B2', marginBottom: 6 }}>Fjalëkalimi</label>
              <input
                id="pt-password"
                className="ad-field"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <div className="ad-error">{error}</div>}
            <button className="ad-btn" type="submit" disabled={submitting} style={{ marginTop: 8 }}>
              {submitting ? 'Duke hyrë…' : 'Hyr'}
            </button>
          </form>

          <p className="ad-hint" style={{ marginTop: 18, lineHeight: 1.5 }}>
            Nuk keni qasje? Kontaktoni SelliX për t’ju hapur llogarinë e biznesit.
          </p>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <Link to="/" className="ad-hint" style={{ textDecoration: 'underline' }}>Kthehu te faqja</Link>
        </div>
      </div>
    </div>
  );
}

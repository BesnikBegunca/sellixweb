import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import './admin.css';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    const dest = location.state?.from?.pathname || '/admin';
    return <Navigate to={dest} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email, password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 34, justifyContent: 'center' }}>
          <span style={{ display: 'block', width: 30, height: 21, border: '2px solid #F2F6FA', borderRadius: 5, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 2, right: 2, top: 3, height: 2, background: '#F2F6FA' }}></span>
          </span>
          <span className="ad-heading" style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>SelliX</span>
        </Link>

        <div className="ad-card" style={{ padding: 28 }}>
          <div className="ad-mono" style={{ fontSize: 11, letterSpacing: '.14em', color: 'oklch(0.82 0.12 195)', marginBottom: 8 }}>ADMIN</div>
          <h1 className="ad-heading" style={{ fontSize: 24, fontWeight: 700, margin: '0 0 22px', letterSpacing: '-0.02em' }}>Sign in to your dashboard</h1>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: 12, color: '#8FA0B2', marginBottom: 6 }}>Email</label>
              <input id="email" className="ad-field" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="password" style={{ display: 'block', fontSize: 12, color: '#8FA0B2', marginBottom: 6 }}>Password</label>
              <input id="password" className="ad-field" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="ad-error">{error}</div>}
            <button className="ad-btn" type="submit" disabled={submitting} style={{ marginTop: 8 }}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <Link to="/" className="ad-hint" style={{ textDecoration: 'underline' }}>Back to the website</Link>
        </div>
      </div>
    </div>
  );
}

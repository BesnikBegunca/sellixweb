import { useState } from 'react';
import { api } from '../../lib/api';
import { usePortalAuth } from '../../lib/PortalAuthContext';
import { formatDateTime } from './format';
import './portal.css';

function Row({ label, value }) {
  return (
    <div className="pt-list-row">
      <span className="pt-name">{label}</span>
      <span className="pt-amount" style={{ fontWeight: 600 }}>{value || '—'}</span>
    </div>
  );
}

export default function Account() {
  const { business } = usePortalAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setDone('');
    if (newPassword.length < 8) return setError('Fjalëkalimi i ri duhet të ketë së paku 8 karaktere.');
    if (newPassword !== confirm) return setError('Fjalëkalimet nuk përputhen.');
    setSubmitting(true);
    try {
      await api.portalChangePassword(currentPassword, newPassword);
      setDone('Fjalëkalimi u ndryshua.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="pt-page-head">
        <div>
          <h1 className="pt-title">Llogaria</h1>
          <p className="pt-sub">Të dhënat e biznesit dhe fjalëkalimi juaj.</p>
        </div>
      </div>

      <div className="pt-split">
        <div className="ad-card" style={{ padding: 20 }}>
          <h2 className="pt-section-title">Biznesi</h2>
          <Row label="Emri" value={business?.name} />
          <Row label="NUI" value={business?.nui} />
          <Row label="Qyteti" value={business?.city} />
          <Row label="Sektori" value={business?.sector} />
          <Row label="Email" value={business?.email} />
          <Row label="Licenca skadon" value={formatDateTime(business?.licenseExpiresAt)} />
        </div>

        <div className="ad-card" style={{ padding: 20 }}>
          <h2 className="pt-section-title">Ndrysho fjalëkalimin</h2>
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              className="ad-field"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Fjalëkalimi aktual"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
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
              placeholder="Përsërit fjalëkalimin e ri"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {error && <div className="ad-error">{error}</div>}
            {done && <div style={{ color: 'oklch(0.86 0.12 195)', fontSize: 13 }}>{done}</div>}
            <button className="ad-btn" type="submit" disabled={submitting}>
              {submitting ? 'Duke ruajtur…' : 'Ruaj'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

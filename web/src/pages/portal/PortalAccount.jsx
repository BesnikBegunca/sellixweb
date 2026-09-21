import { useState } from 'react';
import { api } from '../../lib/api';
import { usePortal } from '../../lib/PortalContext';
import { parseLicenseExpiry } from '../../lib/sales';
import VerifiedBadge from './VerifiedBadge';
import './portal.css';

function Row({ label, value }) {
  return (
    <div className="pt-list li" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      <span className="ad-hint">{label}</span>
      <span style={{ fontWeight: 600 }}>{value || '—'}</span>
    </div>
  );
}

export default function PortalAccount() {
  const { business } = usePortal();
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
    <div className="pt-page">
      <div className="pt-page-head">
        <h1 className="ad-heading pt-title">Llogaria</h1>
      </div>

      <div className="pt-split">
        <div className="ad-card pt-panel">
          <h2 className="ad-heading pt-h">Biznesi</h2>
          <Row
            label="Emri"
            value={
              business?.name && (
                <span className="pt-verified-name">
                  {business.name}
                  {business.verified && <VerifiedBadge color={business.verifiedColor} />}
                </span>
              )
            }
          />
          <Row label="NUI" value={business?.nui} />
          <Row label="Qyteti" value={business?.city} />
          <Row label="Sektori" value={business?.sector} />
          <Row label="Email" value={business?.email} />
          <Row
            label="Licenca skadon"
            value={
              (() => {
                const info = parseLicenseExpiry(business?.licenseExpiresAt);
                if (!info) return '—';
                const daysText = info.days < 0
                  ? 'Ka skaduar'
                  : info.days === 0
                    ? 'Skadon sot'
                    : info.days === 1
                      ? '1 ditë'
                      : `${info.days} ditë`;
                return (
                  <span style={{ display: 'block', textAlign: 'right', lineHeight: 1.4 }}>
                    <span style={{ display: 'block' }}>{daysText}</span>
                    <span className="ad-hint">{info.date} · {info.time}</span>
                  </span>
                );
              })()
            }
          />
        </div>

        <div className="ad-card pt-panel">
          <h2 className="ad-heading pt-h">Ndrysho fjalëkalimin</h2>
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input className="ad-field" type="password" required autoComplete="current-password" placeholder="Fjalëkalimi aktual" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            <input className="ad-field" type="password" required autoComplete="new-password" placeholder="Fjalëkalimi i ri" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <input className="ad-field" type="password" required autoComplete="new-password" placeholder="Përsërit fjalëkalimin e ri" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
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

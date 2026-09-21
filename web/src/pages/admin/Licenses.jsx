import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { parseLicenseExpiry } from '../../lib/sales';
import './admin.css';

function daysLabel(days) {
  if (days == null) return '—';
  if (days < 0) return 'Ka skaduar';
  if (days === 0) return 'Skadon sot';
  if (days === 1) return '1 ditë';
  return `${days} ditë`;
}

export default function Licenses() {
  const [businesses, setBusinesses] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [sentId, setSentId] = useState(null);

  const load = () => {
    api.getBusinesses().then(({ businesses }) => setBusinesses(businesses)).catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const cards = useMemo(() => {
    if (!businesses) return [];
    return businesses.slice().sort((a, b) => {
      const ae = parseLicenseExpiry(a.licenseExpiresAt);
      const be = parseLicenseExpiry(b.licenseExpiresAt);
      return (ae?.expires?.getTime() || 0) - (be?.expires?.getTime() || 0);
    });
  }, [businesses]);

  const sendNotice = async (b) => {
    setBusyId(b.id);
    setError('');
    try {
      const r = await api.notifyLicense(b.id);
      const devices = r.push?.delivered || 0;
      setSentId({ id: b.id, text: devices ? `✓ Njoftimi u dërgua · ${devices} pajisje` : '✓ U dërgua (pa pajisje me njoftime — shfaqet në portal)' });
      setTimeout(() => setSentId((cur) => (cur?.id === b.id ? null : cur)), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="ad-page-head">
        <h1 className="ad-heading">Licencat</h1>
        <span className="ad-hint">{cards.length ? `${cards.length} biznese` : ''}</span>
      </div>
      <p className="ad-hint" style={{ marginTop: -8, marginBottom: 18, lineHeight: 1.5 }}>
        Çdo kartë tregon sa i skadon licenca. “Dërgo njoftimin” i dërgon pronarit një njoftim në telefon (push) dhe ia hap popup-in në portal: sa ditë kanë mbetur dhe butonin për kërkesë vazhdimi. Çdo njoftim ruhet te Notifications.
      </p>

      {error && <div className="ad-error" style={{ marginBottom: 14 }}>{error}</div>}

      {businesses === null ? (
        <div className="ad-hint">Loading…</div>
      ) : cards.length === 0 ? (
        <div className="ad-card" style={{ padding: 24 }}>
          <div className="ad-hint">Nuk ka biznese ende.</div>
        </div>
      ) : (
        <div className="ad-lic-grid">
          {cards.map((b) => {
            const info = parseLicenseExpiry(b.licenseExpiresAt);
            const days = info?.days;
            const urgent = days != null && days <= 7;
            const expired = days != null && days < 0;
            const status = b.licenseStatus || (expired ? 'expired' : 'active');
            return (
              <div key={b.id} className={`ad-card ad-lic-card${urgent ? ' urgent' : ''}${expired ? ' expired' : ''}`}>
                <div className="ad-lic-top">
                  <div>
                    <div className="ad-heading ad-lic-name">{b.name}</div>
                    <div className="ad-hint">{[b.city, b.sector].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  <span className={`ad-badge ${status === 'active' ? 'ad-badge-new' : status === 'revoked' ? 'ad-badge-danger' : 'ad-badge-contacted'}`}>
                    {status}
                  </span>
                </div>
                <div className="ad-lic-days">{daysLabel(days)}</div>
                <div className="ad-hint">
                  {info ? `${info.date} · ${info.time}` : 'Pa datë skadimi'}
                </div>
                {!b.portalEnabled && (
                  <div className="ad-hint" style={{ marginTop: 8 }}>Nuk ka llogari portali — njoftimi pret derisa të hyjnë.</div>
                )}
                <button
                  type="button"
                  className="ad-btn"
                  style={{ width: '100%', marginTop: 14 }}
                  disabled={busyId === b.id}
                  onClick={() => sendNotice(b)}
                >
                  {busyId === b.id ? 'Duke dërguar…' : sentId?.id === b.id ? sentId.text : 'Dërgo njoftimin për vazhdim licence'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

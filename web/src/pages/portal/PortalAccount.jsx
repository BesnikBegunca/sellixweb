import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { usePortal } from '../../lib/PortalContext';
import { parseLicenseExpiry } from '../../lib/sales';
import VerifiedBadge from './VerifiedBadge';
import PushCard from './PushCard';
import './portal.css';

function Row({ label, value }) {
  return (
    <div className="pt-list li" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      <span className="ad-hint">{label}</span>
      <span style={{ fontWeight: 600 }}>{value || '—'}</span>
    </div>
  );
}

function AccountTab({ business }) {
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
      await api.portalChangePassword(newPassword);
      setDone('Fjalëkalimi u ndryshua.');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
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
            <input className="ad-field" type="password" required autoComplete="new-password" placeholder="Fjalëkalimi i ri" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <input className="ad-field" type="password" required autoComplete="new-password" placeholder="Përsërit fjalëkalimin e ri" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {error && <div className="ad-error">{error}</div>}
            {done && <div style={{ color: '#8FD8B8', fontSize: 13 }}>{done}</div>}
            <button className="ad-btn" type="submit" disabled={submitting}>
              {submitting ? 'Duke ruajtur…' : 'Ruaj'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function ToggleRow({ label, hint, checked, onChange, disabled }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 14,
        padding: '12px 0',
        borderBottom: '1px solid rgba(255,255,255,.06)',
        cursor: disabled ? 'default' : 'pointer'
      }}
    >
      <span>
        <span style={{ display: 'block', fontWeight: 600 }}>{label}</span>
        {hint && <span className="ad-hint" style={{ display: 'block', marginTop: 4, lineHeight: 1.45 }}>{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
      />
    </label>
  );
}

function NotificationsTab() {
  const [mode, setMode] = useState('always');
  const [threshold, setThreshold] = useState('100');
  const [gjendjaPrint, setGjendjaPrint] = useState(true);
  const [gjendjaClose, setGjendjaClose] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    let alive = true;
    api.portalNotifySettings()
      .then((s) => {
        if (!alive) return;
        setMode(s.mode || 'always');
        setThreshold(String(s.threshold || 100));
        setGjendjaPrint(s.gjendjaPrint !== false);
        setGjendjaClose(s.gjendjaClose !== false);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const save = async (patch = {}) => {
    const nextMode = patch.mode ?? mode;
    const nextThreshold = patch.threshold ?? threshold;
    const nextPrint = patch.gjendjaPrint ?? gjendjaPrint;
    const nextClose = patch.gjendjaClose ?? gjendjaClose;
    setSaving(true);
    setError('');
    setNote('');
    try {
      const euros = Number(String(nextThreshold).replace(',', '.'));
      const s = await api.portalSetNotifySettings({
        mode: nextMode,
        threshold: Number.isFinite(euros) ? euros : 100,
        gjendjaPrint: nextPrint,
        gjendjaClose: nextClose
      });
      setMode(s.mode);
      setThreshold(String(s.threshold));
      setGjendjaPrint(s.gjendjaPrint !== false);
      setGjendjaClose(s.gjendjaClose !== false);
      setNote('Cilësimet e njoftimeve u ruajtën.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="ad-hint">Duke ngarkuar…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="ad-card pt-panel">
        <h2 className="ad-heading pt-h">Gjendja</h2>
        <p className="ad-hint" style={{ margin: '0 0 8px', lineHeight: 1.5 }}>
          Njoftime vetëm për Shtyp / Mbyll gjendjen — mund t’i lësh aktive edhe nëse shitjet janë Off.
        </p>
        <ToggleRow
          label="Gjendja e shtypur"
          hint="Kur shtypet Shtyp gjendjen në POS"
          checked={gjendjaPrint}
          disabled={saving}
          onChange={(v) => { setGjendjaPrint(v); save({ gjendjaPrint: v }); }}
        />
        <ToggleRow
          label="Gjendja e mbyllur"
          hint="Kur shtypet Mbyll gjendjen në POS"
          checked={gjendjaClose}
          disabled={saving}
          onChange={(v) => { setGjendjaClose(v); save({ gjendjaClose: v }); }}
        />
      </div>

      <div className="ad-card pt-panel">
        <h2 className="ad-heading pt-h">Shitjet / printimet</h2>
        <p className="ad-hint" style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
          Njoftim për çdo printim tavoline (PRINTUAR). Zgjidh Off nëse do vetëm njoftimet e gjendjes lart.
        </p>

        <div className="pt-pills" role="tablist" aria-label="Mënyra e njoftimit" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className={`pt-pill${mode === 'always' ? ' active' : ''}`}
            onClick={() => { setMode('always'); save({ mode: 'always' }); }}
            disabled={saving}
          >
            Always notify
          </button>
          <button
            type="button"
            className={`pt-pill${mode === 'customize' ? ' active' : ''}`}
            onClick={() => { setMode('customize'); save({ mode: 'customize' }); }}
            disabled={saving}
          >
            Customize notify
          </button>
          <button
            type="button"
            className={`pt-pill${mode === 'off' ? ' active' : ''}`}
            onClick={() => { setMode('off'); save({ mode: 'off' }); }}
            disabled={saving}
          >
            Off
          </button>
        </div>

        {mode === 'always' && (
          <p className="ad-hint" style={{ lineHeight: 1.5, margin: '0 0 12px' }}>
            Njoftim për çdo printim të ri (vetëm shuma e shtuar, p.sh. +5 € jo totali i tavolinës).
          </p>
        )}

        {mode === 'customize' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save({ mode: 'customize', threshold });
            }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 160px' }}>
              <span className="ad-hint">Njoftim kur totali kalon (€)</span>
              <input
                className="ad-field"
                type="number"
                min="1"
                step="1"
                inputMode="decimal"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="p.sh. 100"
                aria-label="Shuma e njoftimit në euro"
              />
            </label>
            <button className="ad-btn" type="submit" disabled={saving}>
              {saving ? 'Duke ruajtur…' : 'Ruaj shumën'}
            </button>
            <p className="ad-hint" style={{ flex: '1 1 100%', margin: 0, lineHeight: 1.5 }}>
              P.sh. 100 € — njoftim në 100 €, 200 €, 300 €…
            </p>
          </form>
        )}

        {mode === 'off' && (
          <p className="ad-hint" style={{ lineHeight: 1.5, margin: '0 0 12px' }}>
            Njoftimet e printimeve të tavolinave janë fikur. Gjendja (lart) mbetet sipas zgjedhjes sate.
          </p>
        )}

        {error && <div className="ad-error">{error}</div>}
        {note && <div style={{ color: '#8FD8B8', fontSize: 13 }}>{note}</div>}
      </div>

      <PushCard />
    </div>
  );
}

export default function PortalAccount() {
  const { business } = usePortal();
  const [tab, setTab] = useState('account');

  return (
    <div className="pt-page">
      <div className="pt-page-head">
        <h1 className="ad-heading pt-title">Llogaria</h1>
      </div>

      <div className="pt-pills" role="tablist" aria-label="Llogaria" style={{ marginBottom: 16 }}>
        <button type="button" className={`pt-pill${tab === 'account' ? ' active' : ''}`} onClick={() => setTab('account')}>
          Llogaria
        </button>
        <button type="button" className={`pt-pill${tab === 'notifications' ? ' active' : ''}`} onClick={() => setTab('notifications')}>
          Notifications
        </button>
      </div>

      {tab === 'account' ? <AccountTab business={business} /> : <NotificationsTab />}
    </div>
  );
}

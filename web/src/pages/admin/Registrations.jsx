import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import './admin.css';

// Shops that were set up without internet register themselves here. Nothing on
// this page grants a licence until someone approves a row — approving is what
// creates the business and issues its key.
export default function Registrations() {
  const [registrations, setRegistrations] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [form, setForm] = useState({});

  const load = () => {
    api
      .getRegistrations()
      .then(({ registrations }) => setRegistrations(registrations))
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const seatsFor = (id) => form[id]?.seats ?? 1;
  const monthsFor = (id) => form[id]?.licenseMonths ?? 12;

  const setField = (id, key, value) =>
    setForm((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));

  const onApprove = async (reg) => {
    setError('');
    setBusy(reg.id);
    try {
      const { business } = await api.approveRegistration(reg.id, {
        seats: Number(seatsFor(reg.id)),
        licenseMonths: Number(monthsFor(reg.id))
      });
      // The shop is still waiting on its key, so show it here rather than
      // making someone go and look it up under Businesses.
      window.alert(
        `Approved.\n\n${business.name}\nLicense key: ${business.licenseKey}\n\n` +
          'The shop receives it the next time it presses Synchronize.'
      );
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const onReject = async (reg) => {
    if (!window.confirm(`Reject the registration from ${reg.name}?`)) return;
    setError('');
    setBusy(reg.id);
    try {
      await api.rejectRegistration(reg.id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async (reg) => {
    if (!window.confirm(`Remove the registration from ${reg.name} from this list?`)) return;
    setError('');
    setBusy(reg.id);
    try {
      await api.deleteRegistration(reg.id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const pendingCount = registrations?.filter((r) => r.status === 'pending').length ?? 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="ad-heading" style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Registrations</h1>
        <span className="ad-hint">{registrations ? `${pendingCount} waiting` : ''}</span>
      </div>

      <p className="ad-hint" style={{ marginTop: -8, marginBottom: 18 }}>
        Shops installed without internet appear here when they first press Synchronize.
        Approving one creates the business and issues its license key.
      </p>

      {error && <div className="ad-error" style={{ marginBottom: 14 }}>{error}</div>}

      {registrations === null ? (
        <div className="ad-card" style={{ padding: 24, color: '#8FA0B2' }}>Loading…</div>
      ) : registrations.length === 0 ? (
        <div className="ad-card" style={{ padding: 24, color: '#8FA0B2' }}>
          No registration requests yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {registrations.map((reg) => (
            <div key={reg.id} className="ad-card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{reg.name || '(no business name)'}</div>
                  <div className="ad-hint" style={{ marginTop: 4 }}>
                    NUI {reg.nui || '—'}
                    {reg.city ? ` · ${reg.city}` : ''}
                    {reg.sector ? ` · ${reg.sector}` : ''}
                    {reg.appKind ? ` · ${reg.appKind}` : ''}
                  </div>
                  <div className="ad-hint" style={{ marginTop: 2 }}>
                    {reg.contactPerson || '—'}
                    {reg.phone ? ` · ${reg.phone}` : ''}
                    {reg.email ? ` · ${reg.email}` : ''}
                  </div>
                  <div className="ad-hint" style={{ marginTop: 2 }}>
                    Install code {reg.installCode} · device {reg.deviceName || reg.deviceId} · first seen {reg.createdAt}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className={`ad-badge ad-badge-${reg.status === 'pending' ? 'new' : reg.status === 'approved' ? 'closed' : 'contacted'}`}>
                    {reg.status}
                  </span>
                </div>
              </div>

              {reg.notes && (
                <div className="ad-hint" style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{reg.notes}</div>
              )}

              {reg.status === 'pending' && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 14, flexWrap: 'wrap' }}>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span className="ad-hint">Devices</span>
                    <input
                      className="ad-field"
                      type="number"
                      min="1"
                      max="100"
                      style={{ width: 90 }}
                      value={seatsFor(reg.id)}
                      onChange={(e) => setField(reg.id, 'seats', e.target.value)}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span className="ad-hint">Months</span>
                    <input
                      className="ad-field"
                      type="number"
                      min="1"
                      max="60"
                      style={{ width: 90 }}
                      value={monthsFor(reg.id)}
                      onChange={(e) => setField(reg.id, 'licenseMonths', e.target.value)}
                    />
                  </label>
                  <button className="ad-btn" disabled={busy === reg.id} onClick={() => onApprove(reg)}>
                    {busy === reg.id ? 'Working…' : 'Approve & issue key'}
                  </button>
                  <button className="ad-btn ad-btn-ghost" disabled={busy === reg.id} onClick={() => onReject(reg)}>
                    Reject
                  </button>
                </div>
              )}

              {reg.status !== 'pending' && (
                <div style={{ marginTop: 12 }}>
                  <button className="ad-btn ad-btn-ghost" disabled={busy === reg.id} onClick={() => onDelete(reg)}>
                    Remove from list
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import './admin.css';

function formatWhen(raw) {
  if (!raw) return '—';
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return raw.slice(0, 16);
  return `${m[3]}.${m[2]}.${m[1]} · ${m[4]}:${m[5]}`;
}

function SessionsPanel({ title, devices, onClose }) {
  return (
    <div className="ad-card" style={{ padding: 16, marginBottom: 16 }}>
      <div className="ad-page-head" style={{ marginBottom: 10 }}>
        <h2 className="ad-heading" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h2>
        <button type="button" className="ad-btn-ghost" onClick={onClose}>Close</button>
      </div>
      {!devices?.length ? (
        <div className="ad-hint">Nuk ka pajisje të kyçura tani.</div>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Pajisja</th>
                <th>Hyrë</th>
                <th>Aktiv</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.deviceId}>
                  <td data-label="Pajisja">{d.label}</td>
                  <td data-label="Hyrë" className="ad-hint">{formatWhen(d.createdAt)}</td>
                  <td data-label="Aktiv" className="ad-hint">{formatWhen(d.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [tempCred, setTempCred] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [sessionsFor, setSessionsFor] = useState(null);
  const [sessionDevices, setSessionDevices] = useState(null);

  const load = () => {
    api.getUsers().then(({ users }) => setUsers(users)).catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const onCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    setTempCred(null);
    try {
      const { user, tempPassword } = await api.createUser(email, name);
      setUsers((prev) => [...prev, user]);
      setTempCred({ email: user.email, tempPassword });
      setEmail('');
      setName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const onDelete = async (id) => {
    if (!confirm('Remove this admin account? This cannot be undone.')) return;
    setBusyId(id);
    setError('');
    try {
      await api.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const onReset = async (id) => {
    setBusyId(id);
    setError('');
    setTempCred(null);
    try {
      const { tempPassword } = await api.resetUserPassword(id);
      const u = users.find((x) => x.id === id);
      setTempCred({ email: u.email, tempPassword });
      setUsers((prev) => prev.map((x) => (x.id === id ? { ...x, password: tempPassword, mustChangePassword: true, loginDevices: 0 } : x)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const openSessions = async (user) => {
    setSessionsFor(user);
    setSessionDevices(null);
    try {
      const { devices } = await api.getUserSessions(user.id);
      setSessionDevices(devices || []);
    } catch (err) {
      setError(err.message);
      setSessionDevices([]);
    }
  };

  return (
    <div>
      <div className="ad-page-head">
        <h1 className="ad-heading">Admin users</h1>
      </div>

      {error && <div className="ad-error" style={{ marginBottom: 14 }}>{error}</div>}
      {tempCred && (
        <div className="ad-card" style={{ padding: 16, marginBottom: 20, borderColor: 'rgba(94, 199, 154, 0.4)' }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>
            Temporary password for <strong>{tempCred.email}</strong> — share it securely:
          </div>
          <code className="ad-mono" style={{ fontSize: 14, background: 'rgba(0,0,0,.3)', padding: '6px 10px', borderRadius: 8, display: 'inline-block' }}>
            {tempCred.tempPassword}
          </code>
        </div>
      )}

      {sessionsFor && (
        <SessionsPanel
          title={`Pajisjet — ${sessionsFor.name || sessionsFor.email}`}
          devices={sessionDevices}
          onClose={() => { setSessionsFor(null); setSessionDevices(null); }}
        />
      )}

      <div className="ad-card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 className="ad-heading" style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>Invite admin</h2>
        <form onSubmit={onCreate} className="ad-inline-form">
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: 12, color: '#8DA396', marginBottom: 6 }}>Email</label>
            <input className="ad-field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ display: 'block', fontSize: 12, color: '#8DA396', marginBottom: 6 }}>Name</label>
            <input className="ad-field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="ad-btn" type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create account'}</button>
        </form>
      </div>

      <div className="ad-card" style={{ overflow: 'hidden' }}>
        {users === null ? (
          <div style={{ padding: 24, color: '#8DA396' }}>Loading…</div>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Password</th>
                  <th>Pajisje</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Name">{u.name || '—'}{u.id === me?.id && <span className="ad-hint"> (you)</span>}</td>
                    <td data-label="Email">{u.email}</td>
                    <td data-label="Password">
                      {u.password ? (
                        <code className="ad-mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>{u.password}</code>
                      ) : (
                        <span className="ad-hint">I panjohur — Reset për ta parë</span>
                      )}
                    </td>
                    <td data-label="Pajisje">
                      <button type="button" className="ad-btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => openSessions(u)}>
                        {u.loginDevices || 0} pajisje
                      </button>
                    </td>
                    <td data-label="Created" className="ad-hint">{u.createdAt}</td>
                    <td data-label="Status">
                      {u.mustChangePassword ? (
                        <span className="ad-badge ad-badge-contacted">Pending setup</span>
                      ) : (
                        <span className="ad-badge ad-badge-closed">Active</span>
                      )}
                    </td>
                    <td data-label="Actions" className="ad-actions-cell">
                      <div className="ad-actions">
                        <button className="ad-btn-ghost" disabled={busyId === u.id} onClick={() => onReset(u.id)}>Reset password</button>
                        {u.id !== me?.id && (
                          <button className="ad-btn-danger" disabled={busyId === u.id} onClick={() => onDelete(u.id)}>Remove</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

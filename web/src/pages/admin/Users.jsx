import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import './admin.css';

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [tempCred, setTempCred] = useState(null);
  const [busyId, setBusyId] = useState(null);

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
      setUsers((prev) => prev.map((x) => (x.id === id ? { ...x, mustChangePassword: true } : x)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="ad-page-head">
        <h1 className="ad-heading">Admin users</h1>
      </div>

      {error && <div className="ad-error" style={{ marginBottom: 14 }}>{error}</div>}
      {tempCred && (
        <div className="ad-card" style={{ padding: 16, marginBottom: 20, borderColor: 'oklch(0.82 0.12 195 / 0.4)' }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>
            Temporary password for <strong>{tempCred.email}</strong> — share it securely, it won't be shown again:
          </div>
          <code className="ad-mono" style={{ fontSize: 14, background: 'rgba(0,0,0,.3)', padding: '6px 10px', borderRadius: 8, display: 'inline-block' }}>
            {tempCred.tempPassword}
          </code>
        </div>
      )}

      <div className="ad-card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 className="ad-heading" style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>Invite admin</h2>
        <form onSubmit={onCreate} className="ad-inline-form">
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: 12, color: '#8FA0B2', marginBottom: 6 }}>Email</label>
            <input className="ad-field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ display: 'block', fontSize: 12, color: '#8FA0B2', marginBottom: 6 }}>Name</label>
            <input className="ad-field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="ad-btn" type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create account'}</button>
        </form>
      </div>

      <div className="ad-card" style={{ overflow: 'hidden' }}>
        {users === null ? (
          <div style={{ padding: 24, color: '#8FA0B2' }}>Loading…</div>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
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

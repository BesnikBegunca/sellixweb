import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import './admin.css';

function formatDate(sqlDate) {
  if (!sqlDate) return '—';
  return sqlDate.slice(0, 16).replace('T', ' ');
}

export default function RecycleBin() {
  const [businesses, setBusinesses] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    api.getTrash().then(({ businesses }) => setBusinesses(businesses)).catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const onRestore = async (b) => {
    setBusyId(b.id);
    setError('');
    try {
      await api.restoreBusiness(b.id);
      setBusinesses((prev) => prev.filter((x) => x.id !== b.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const onPurge = async (b) => {
    if (!confirm(`Delete ${b.name} forever? Sales, devices and the license key are gone and cannot be recovered.`)) return;
    setBusyId(b.id);
    setError('');
    try {
      await api.purgeBusiness(b.id);
      setBusinesses((prev) => prev.filter((x) => x.id !== b.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="ad-page-head">
        <h1 className="ad-heading">Recycle bin</h1>
        <span className="ad-hint">{businesses ? `${businesses.length} deleted` : ''}</span>
      </div>
      <p className="ad-hint" style={{ marginTop: -8, marginBottom: 18 }}>
        Businesses you delete land here. Restore puts them back with the same license, sales and portal login.
        {' '}
        <Link to="/admin/businesses" style={{ textDecoration: 'underline' }}>Back to businesses</Link>
      </p>

      {error && <div className="ad-error" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="ad-card" style={{ overflow: 'hidden' }}>
        {businesses === null ? (
          <div style={{ padding: 24, color: '#8FA0B2' }}>Loading…</div>
        ) : businesses.length === 0 ? (
          <div style={{ padding: 24, color: '#8FA0B2' }}>Recycle bin is empty.</div>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>NUI</th>
                  <th>Sector</th>
                  <th>Deleted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((b) => (
                  <tr key={b.id}>
                    <td data-label="Business">
                      <div className="ad-cell-stack">
                        <div style={{ fontWeight: 600 }}>{b.name}</div>
                        {b.contactPerson && <div className="ad-hint">{b.contactPerson}</div>}
                      </div>
                    </td>
                    <td data-label="NUI" className="ad-mono" style={{ fontSize: 12 }}>{b.nui}</td>
                    <td data-label="Sector">{b.sector || '—'}</td>
                    <td data-label="Deleted" className="ad-hint">{formatDate(b.deletedAt)}</td>
                    <td data-label="Actions" className="ad-actions-cell">
                      <div className="ad-actions">
                        <button className="ad-btn" disabled={busyId === b.id} onClick={() => onRestore(b)}>
                          Restore
                        </button>
                        <button className="ad-btn-danger" disabled={busyId === b.id} onClick={() => onPurge(b)}>
                          Delete forever
                        </button>
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

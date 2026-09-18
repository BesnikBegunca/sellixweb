import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import './admin.css';

const STATUSES = ['new', 'contacted', 'closed'];

export default function Leads() {
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(null);

  const load = () => {
    api.getLeads().then(({ leads }) => setLeads(leads)).catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const onStatusChange = async (id, status) => {
    setUpdating(id);
    try {
      await api.updateLeadStatus(id, status);
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="ad-heading" style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Leads</h1>
        <span className="ad-hint">{leads ? `${leads.length} total` : ''}</span>
      </div>

      {error && <div className="ad-error" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="ad-card" style={{ overflow: 'hidden' }}>
        {leads === null ? (
          <div style={{ padding: 24, color: '#8FA0B2' }}>Loading…</div>
        ) : leads.length === 0 ? (
          <div style={{ padding: 24, color: '#8FA0B2' }}>No submissions yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Business</th>
                  <th>Phone</th>
                  <th>Sector</th>
                  <th>Submitted</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td data-label="Name">{lead.name}</td>
                    <td data-label="Business">{lead.business}</td>
                    <td data-label="Phone">{lead.phone}</td>
                    <td data-label="Sector">{lead.category}</td>
                    <td data-label="Submitted" className="ad-hint">{lead.created_at}</td>
                    <td data-label="Status">
                      <select
                        className="ad-field"
                        style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
                        value={lead.status}
                        disabled={updating === lead.id}
                        onChange={(e) => onStatusChange(lead.id, e.target.value)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
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

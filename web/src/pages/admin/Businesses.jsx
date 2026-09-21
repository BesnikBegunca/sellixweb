import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { localDate, periodQuery } from '../../lib/sales';
import { useLiveRefresh } from '../../lib/useLiveRefresh';
import VerifiedBadge from '../portal/VerifiedBadge';
import {
  PeriodPills, TotalsGrid, SalesCharts, PaymentsList, ProductsList, SalesList, TablesGrid, RegistersGrid,
  LiveBadge, TodayRing, GjendjaTable
} from '../portal/SalesReport';
import '../portal/portal.css';
import './admin.css';

const EMPTY = {
  nui: '', name: '', fiscalNumber: '', vatNumber: '', address: '', city: '', zipCode: '',
  country: 'Kosovë', contactPerson: '', phone: '', email: '', sector: '', seats: 1, notes: '',
  licenseMonths: 12
};
const DEFAULT_TICK = '#1D9BF0';

function formatDate(sqlDate) {
  if (!sqlDate) return '—';
  return sqlDate.slice(0, 10);
}

function StatusBadge({ status }) {
  const cls = status === 'active' ? 'ad-badge-new' : status === 'revoked' ? 'ad-badge-danger' : 'ad-badge-contacted';
  return <span className={`ad-badge ${cls}`}>{status}</span>;
}

function Field({ label, children, span = 1 }) {
  return (
    <div className={span > 1 ? 'ad-span-2' : undefined}>
      <label style={{ display: 'block', fontSize: 12, color: '#8FA0B2', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function BusinessForm({ initial, sectors, onCancel, onSubmit, submitting }) {
  const [form, setForm] = useState(initial);
  const isEdit = Boolean(initial.id);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <form
      className="ad-card"
      style={{ padding: 20, marginBottom: 20 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <h2 className="ad-heading" style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>
        {isEdit ? `Edit ${initial.name}` : 'New business'}
      </h2>

      <div className="ad-form-grid">
        <Field label="NUI *">
          <input className="ad-field" required value={form.nui} onChange={set('nui')} placeholder="811000000" />
        </Field>
        <Field label="Business name *">
          <input className="ad-field" required value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Fiscal number">
          <input className="ad-field" value={form.fiscalNumber} onChange={set('fiscalNumber')} />
        </Field>
        <Field label="VAT number">
          <input className="ad-field" value={form.vatNumber} onChange={set('vatNumber')} />
        </Field>
        <Field label="Address" span={2}>
          <input className="ad-field" value={form.address} onChange={set('address')} placeholder="Rr. UÇK, nr. 12" />
        </Field>
        <Field label="City">
          <input className="ad-field" value={form.city} onChange={set('city')} placeholder="Prishtinë" />
        </Field>
        <Field label="ZIP code">
          <input className="ad-field" value={form.zipCode} onChange={set('zipCode')} placeholder="10000" />
        </Field>
        <Field label="Country">
          <input className="ad-field" value={form.country} onChange={set('country')} />
        </Field>
        <Field label="Contact person">
          <input className="ad-field" value={form.contactPerson} onChange={set('contactPerson')} />
        </Field>
        <Field label="Phone">
          <input className="ad-field" value={form.phone} onChange={set('phone')} placeholder="+383 44 000 000" />
        </Field>
        <Field label="Email">
          <input className="ad-field" type="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Sector">
          <select className="ad-field" value={form.sector} onChange={set('sector')}>
            <option value="">—</option>
            {sectors.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Devices allowed">
          <input className="ad-field" type="number" min="1" max="100" value={form.seats} onChange={set('seats')} />
        </Field>
        {!isEdit && (
          <Field label="License length (months)">
            <input className="ad-field" type="number" min="1" max="60" value={form.licenseMonths} onChange={set('licenseMonths')} />
          </Field>
        )}
        <Field label="Notes" span={2}>
          <textarea className="ad-field" rows={2} value={form.notes} onChange={set('notes')} />
        </Field>
      </div>

      <div className="ad-form-actions">
        <button className="ad-btn" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create business & license'}
        </button>
        <button className="ad-btn-ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function DevicesPanel({ business, onClose, onChanged }) {
  const [devices, setDevices] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getBusinessDevices(business.id).then(({ devices }) => setDevices(devices)).catch((e) => setError(e.message));
  }, [business.id]);

  const release = async (deviceRowId) => {
    try {
      await api.releaseBusinessDevice(business.id, deviceRowId);
      setDevices((prev) => prev.filter((d) => d.id !== deviceRowId));
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="ad-card" style={{ padding: 20, marginBottom: 20 }}>
      <div className="ad-page-head" style={{ marginBottom: 14 }}>
        <h2 className="ad-heading" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
          Activated devices — {business.name}
        </h2>
        <button className="ad-btn-ghost" onClick={onClose}>Close</button>
      </div>
      {error && <div className="ad-error" style={{ marginBottom: 10 }}>{error}</div>}
      {devices === null ? (
        <div style={{ color: '#8FA0B2' }}>Loading…</div>
      ) : devices.length === 0 ? (
        <div style={{ color: '#8FA0B2', fontSize: 14 }}>
          No device has activated this license yet. The desktop app binds a device the first time it calls the
          activation endpoint with this key.
        </div>
      ) : (
        <table className="ad-table">
          <thead>
            <tr><th>Device</th><th>Device ID</th><th>Activated</th><th>Last seen</th><th></th></tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id}>
                <td data-label="Device">{d.deviceName || '—'}</td>
                <td data-label="Device ID" className="ad-mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>{d.deviceId}</td>
                <td data-label="Activated" className="ad-hint">{formatDate(d.activatedAt)}</td>
                <td data-label="Last seen" className="ad-hint">{formatDate(d.lastSeenAt)}</td>
                <td data-label="Actions" className="ad-actions-cell">
                  <div className="ad-actions">
                    <button className="ad-btn-danger ad-span-2" onClick={() => release(d.id)}>Release</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SalesPanel({ business, onClose }) {
  const date = localDate();
  const [period, setPeriod] = useState('today');
  const [chartMode, setChartMode] = useState('days');
  const [tab, setTab] = useState('sales');
  const [overview, setOverview] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [tables, setTables] = useState(null);
  const [devices, setDevices] = useState(null);
  const [sales, setSales] = useState(null);
  const [shifts, setShifts] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // Only the newest load may write state: switching period or business fires a
  // new one before the previous has landed.
  const requestId = useRef(0);

  const businessId = business.id;
  const isRestaurant = business.isRestaurant;

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const q = periodQuery(period, date);
    const requests = [
      api.getBusinessSalesOverview(businessId, date),
      api.getBusinessSalesBreakdown(businessId, q),
      api.getBusinessSales(businessId, q)
    ];
    // A restaurant's fourth call is its floor; a market's is its tills.
    requests.push(isRestaurant ? api.getBusinessSalesTables(businessId) : api.getBusinessSalesDevices(businessId, q));
    if (isRestaurant) requests.push(api.getBusinessSalesShifts(businessId));
    try {
      const results = await Promise.all(requests);
      if (id !== requestId.current) return;
      setOverview(results[0]);
      setBreakdown(results[1]);
      setSales(results[2].sales);
      setTables(isRestaurant ? results[3].tables : []);
      setDevices(isRestaurant ? null : results[3]);
      setShifts(isRestaurant ? results[4] : null);
      setError('');
    } catch (e) {
      if (id === requestId.current) setError(e.message);
      throw e;
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [businessId, isRestaurant, period, date]);

  const { lastUpdated, live } = useLiveRefresh(load, {
    deps: [businessId, isRestaurant, period, date],
    stream: `/businesses/${businessId}/sales/stream`
  });

  return (
    <div className="ad-card" style={{ padding: 20, marginBottom: 20 }}>
      <div className="ad-page-head" style={{ marginBottom: 14 }}>
        <div className="pt-live-row">
          <h2 className="ad-heading" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            Shitjet — {business.name}
          </h2>
          <LiveBadge live={live} lastUpdated={lastUpdated} />
        </div>
        <button type="button" className="ad-btn-ghost" onClick={onClose}>Close</button>
      </div>
      {error && <div className="ad-error" style={{ marginBottom: 10 }}>{error}</div>}
      {loading && !overview ? (
        <div style={{ color: '#8FA0B2' }}>Loading…</div>
      ) : (
        <>
          <div className="pt-page-head" style={{ marginBottom: 14 }}>
            {/* The floor is live rather than period-based, so the period
                pills stay hidden there; per-till takings do depend on it. */}
            {tab !== 'tables' && tab !== 'gjendja' && <PeriodPills period={period} onChange={setPeriod} />}
            <div className="pt-pills pt-pills-sm">
              <button type="button" className={`pt-pill${tab === 'sales' ? ' active' : ''}`} onClick={() => setTab('sales')}>
                Shitjet
              </button>
              {isRestaurant ? (
                <button type="button" className={`pt-pill${tab === 'tables' ? ' active' : ''}`} onClick={() => setTab('tables')}>
                  Tavolinat
                </button>
              ) : (
                <button type="button" className={`pt-pill${tab === 'registers' ? ' active' : ''}`} onClick={() => setTab('registers')}>
                  Kompjuterët
                </button>
              )}
              {isRestaurant && (
                <button type="button" className={`pt-pill${tab === 'gjendja' ? ' active' : ''}`} onClick={() => setTab('gjendja')}>
                  Gjendja
                </button>
              )}
            </div>
          </div>
          {tab === 'tables' ? (
            <>
              <TodayRing totals={overview?.totals} goal={overview?.goal} />
              <TablesGrid tables={tables} />
            </>
          ) : tab === 'registers' ? (
            <RegistersGrid data={devices} />
          ) : tab === 'gjendja' ? (
            <GjendjaTable data={shifts} />
          ) : (
            <>
              <TodayRing totals={overview?.totals} goal={overview?.goal} period={period} />
              <TotalsGrid totals={overview?.totals} />
              <SalesCharts breakdown={breakdown} chartMode={chartMode} onChartModeChange={setChartMode} />
              <div className="pt-split">
                <PaymentsList payments={breakdown?.payments} />
                <ProductsList products={breakdown?.products} />
              </div>
              <SalesList sales={sales} isRestaurant={isRestaurant} />
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function Businesses() {
  const [businesses, setBusinesses] = useState(null);
  const [sectors, setSectors] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [devicesFor, setDevicesFor] = useState(null);
  const [salesFor, setSalesFor] = useState(null);
  const [copied, setCopied] = useState(null);
  const [extendMonths, setExtendMonths] = useState({});
  const [tickColors, setTickColors] = useState({});
  const [portalCredential, setPortalCredential] = useState(null);

  const load = () => {
    api.getBusinesses().then(({ businesses }) => setBusinesses(businesses)).catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    api.getContent()
      .then(({ content }) => setSectors(content.cats.map((c) => c.sq.n)))
      .catch(() => setSectors([]));
  }, []);

  const save = async (form) => {
    setSubmitting(true);
    setError('');
    try {
      if (form.id) {
        const { business } = await api.updateBusiness(form.id, form);
        setBusinesses((prev) => prev.map((b) => (b.id === business.id ? business : b)));
      } else {
        const { business } = await api.createBusiness(form);
        setBusinesses((prev) => [business, ...prev]);
      }
      setEditing(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (id, fn) => {
    setBusyId(id);
    setError('');
    try {
      const { business } = await fn();
      setBusinesses((prev) => prev.map((b) => (b.id === business.id ? business : b)));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (b) => {
    if (!confirm(`Move ${b.name} to Recycle bin? You can restore it later. The license and portal login stop until then.`)) return;
    setBusyId(b.id);
    try {
      await api.deleteBusiness(b.id);
      setBusinesses((prev) => prev.filter((x) => x.id !== b.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const colorFor = (b) => tickColors[b.id] || b.verifiedColor || DEFAULT_TICK;

  const onTickColor = async (b, color) => {
    setTickColors((prev) => ({ ...prev, [b.id]: color }));
    if (!b.verified) return;
    setBusyId(b.id);
    setError('');
    try {
      const { business } = await api.setVerifiedColor(b.id, color);
      setBusinesses((prev) => prev.map((x) => (x.id === business.id ? business : x)));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const copyKey = async (key) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  const createPortalAccount = async (b) => {
    const email = prompt(
      `Email për hyrjen e biznesit "${b.name}" në portalin e shitjeve:`,
      b.portalEmail || b.email || ''
    );
    if (email === null) return;
    setBusyId(b.id);
    setError('');
    try {
      const { business, tempPassword } = await api.createPortalAccount(b.id, email.trim());
      setBusinesses((prev) => prev.map((x) => (x.id === business.id ? business : x)));
      setPortalCredential({ name: business.name, email: business.portalEmail, tempPassword });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const removePortalAccount = async (b) => {
    if (!confirm(`Hiq qasjen e portalit për ${b.name}? Nuk do të mund të hyjnë më.`)) return;
    await runAction(b.id, () => api.deletePortalAccount(b.id));
  };

  return (
    <div>
      <div className="ad-page-head">
        <h1 className="ad-heading">Businesses</h1>
        <div className="ad-page-tools">
          <span className="ad-hint">{businesses ? `${businesses.length} total` : ''}</span>
          {!editing && (
            <button className="ad-btn" onClick={() => setEditing({ ...EMPTY })}>+ New business</button>
          )}
        </div>
      </div>

      {error && <div className="ad-error" style={{ marginBottom: 14 }}>{error}</div>}

      {editing && (
        <BusinessForm
          key={editing.id || 'new'}
          initial={editing}
          sectors={sectors}
          submitting={submitting}
          onCancel={() => setEditing(null)}
          onSubmit={save}
        />
      )}

      {devicesFor && (
        <DevicesPanel business={devicesFor} onClose={() => setDevicesFor(null)} onChanged={load} />
      )}

      {salesFor && (
        <SalesPanel business={salesFor} onClose={() => setSalesFor(null)} />
      )}

      {portalCredential && (
        <div className="ad-card" style={{ padding: 20, marginBottom: 16, borderColor: 'oklch(0.82 0.12 195 / 0.45)' }}>
          <div className="ad-mono" style={{ fontSize: 11, letterSpacing: '.14em', color: 'oklch(0.82 0.12 195)', marginBottom: 8 }}>
            PORTAL ACCOUNT CREATED
          </div>
          <p style={{ fontSize: 14, color: '#D5DFE8', margin: '0 0 14px', lineHeight: 1.5 }}>
            Jepia <strong>{portalCredential.name}</strong>. Fjalëkalimi i përkohshëm shfaqet vetëm tani — duhet ta ndryshojnë në hyrjen e parë te <code>/portal/login</code>.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 16 }}>
            <div>
              <div className="ad-hint" style={{ marginBottom: 4 }}>Email</div>
              <div className="ad-mono" style={{ fontSize: 14 }}>{portalCredential.email}</div>
            </div>
            <div>
              <div className="ad-hint" style={{ marginBottom: 4 }}>Temporary password</div>
              <div className="ad-mono" style={{ fontSize: 14, color: 'oklch(0.86 0.12 195)' }}>{portalCredential.tempPassword}</div>
            </div>
          </div>
          <button className="ad-btn-ghost" onClick={() => setPortalCredential(null)}>Done</button>
        </div>
      )}

      <div className="ad-card" style={{ overflow: 'hidden' }}>
        {businesses === null ? (
          <div style={{ padding: 24, color: '#8FA0B2' }}>Loading…</div>
        ) : businesses.length === 0 ? (
          <div style={{ padding: 24, color: '#8FA0B2' }}>No businesses yet. Add one to issue its license key.</div>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>NUI</th>
                  <th>Location</th>
                  <th>Sector</th>
                  <th>License key</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Devices</th>
                  <th>Portal</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((b) => (
                  <tr key={b.id}>
                    <td data-label="Business">
                      <div className="ad-cell-stack">
                        <div className="ad-name-row">
                          <span style={{ fontWeight: 600 }}>{b.name}</span>
                          {b.verified && <VerifiedBadge color={colorFor(b)} />}
                        </div>
                        {b.contactPerson && <div className="ad-hint">{b.contactPerson}</div>}
                      </div>
                    </td>
                    <td data-label="NUI" className="ad-mono" style={{ fontSize: 12 }}>{b.nui}</td>
                    <td data-label="Location">
                      <div className="ad-cell-stack">
                        <div>{b.city || '—'}</div>
                        <div className="ad-hint">{[b.zipCode, b.country].filter(Boolean).join(' · ')}</div>
                      </div>
                    </td>
                    <td data-label="Sector">{b.sector || '—'}</td>
                    <td data-label="License key">
                      <button
                        className="ad-btn-ghost ad-mono ad-key-btn"
                        title="Copy license key"
                        onClick={() => copyKey(b.licenseKey)}
                      >
                        {copied === b.licenseKey ? 'Copied!' : b.licenseKey}
                      </button>
                    </td>
                    <td data-label="Status"><StatusBadge status={b.licenseStatus} /></td>
                    <td data-label="Expires" className="ad-hint">{formatDate(b.licenseExpiresAt)}</td>
                    <td data-label="Devices">
                      <button className="ad-btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setDevicesFor(b)}>
                        {b.devicesUsed} / {b.seats}
                      </button>
                    </td>
                    <td data-label="Portal">
                      {b.portalEnabled ? (
                        <div className="ad-cell-stack">
                          <span className="ad-badge ad-badge-new">Active</span>
                          <span className="ad-hint" style={{ wordBreak: 'break-all' }}>{b.portalEmail}</span>
                          <div className="ad-mini-actions">
                            <button
                              className="ad-btn-ghost"
                              disabled={busyId === b.id}
                              onClick={() => createPortalAccount(b)}
                            >
                              Reset
                            </button>
                            <button
                              className="ad-btn-danger"
                              disabled={busyId === b.id}
                              onClick={() => removePortalAccount(b)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="ad-btn-ghost"
                          disabled={busyId === b.id}
                          onClick={() => createPortalAccount(b)}
                        >
                          Give access
                        </button>
                      )}
                    </td>
                    <td data-label="Actions" className="ad-actions-cell">
                      <div className="ad-actions">
                        <div className="ad-extend">
                          <select
                            className="ad-field"
                            aria-label="Extend months"
                            value={extendMonths[b.id] || 1}
                            onChange={(e) => setExtendMonths({ ...extendMonths, [b.id]: Number(e.target.value) })}
                          >
                            {[1, 3, 6, 12, 24].map((m) => (
                              <option key={m} value={m}>{m} mo</option>
                            ))}
                          </select>
                          <button
                            className="ad-btn"
                            disabled={busyId === b.id}
                            onClick={() => runAction(b.id, () => api.extendLicense(b.id, extendMonths[b.id] || 1))}
                          >
                            Extend
                          </button>
                        </div>
                        <div className="ad-verify">
                          <input
                            type="color"
                            className="ad-color"
                            aria-label="Ngjyra e tick-ut"
                            value={colorFor(b).toLowerCase()}
                            disabled={busyId === b.id}
                            onChange={(e) => onTickColor(b, e.target.value)}
                          />
                          {b.verified ? (
                            <button
                              className="ad-btn-ghost"
                              disabled={busyId === b.id}
                              onClick={() => runAction(b.id, () => api.unverifyBusiness(b.id))}
                            >
                              Hiq tick
                            </button>
                          ) : (
                            <button
                              className="ad-btn"
                              disabled={busyId === b.id}
                              onClick={() => runAction(b.id, () => api.verifyBusiness(b.id, colorFor(b)))}
                            >
                              Verifiko
                            </button>
                          )}
                        </div>
                        {/* Every business has sales to look at: a restaurant
                            splits them by table, a market by till. */}
                        <button className="ad-btn-ghost ad-span-2" onClick={() => setSalesFor(b)}>
                          Shitjet
                        </button>
                        {b.licenseStatus === 'revoked' ? (
                          <button className="ad-btn-ghost" disabled={busyId === b.id} onClick={() => runAction(b.id, () => api.reactivateLicense(b.id))}>
                            Reactivate
                          </button>
                        ) : (
                          <button className="ad-btn-danger" disabled={busyId === b.id} onClick={() => runAction(b.id, () => api.revokeLicense(b.id))}>
                            Revoke
                          </button>
                        )}
                        <button
                          className="ad-btn-ghost"
                          disabled={busyId === b.id}
                          onClick={() => {
                            if (confirm('Issue a new key? The current key stops working and every device must activate again.')) {
                              runAction(b.id, () => api.regenerateLicense(b.id));
                            }
                          }}
                        >
                          New key
                        </button>
                        <button className="ad-btn-ghost" onClick={() => setEditing({ ...b })}>Edit</button>
                        <button className="ad-btn-danger" disabled={busyId === b.id} onClick={() => onDelete(b)}>Delete</button>
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

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { usePortalAuth } from '../../lib/PortalAuthContext';
import { formatMoney, formatDateTime, PERIOD_LABELS } from './format';
import './portal.css';

export default function Tables() {
  const { business } = usePortalAuth();
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .portalTables(period)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [period]);

  // The tab is hidden for non-table sectors, but the route is still reachable
  // by typing the URL — send those shops back to the sales page.
  if (business && !business.hasTables) return <Navigate to="/portal/shitjet" replace />;

  return (
    <div>
      <div className="pt-page-head">
        <div>
          <h1 className="pt-title">Tavolinat</h1>
          <p className="pt-sub">Totali i shitjeve për çdo tavolinë.</p>
        </div>
        <div className="pt-tabs">
          {Object.entries(PERIOD_LABELS).map(([key, label]) => (
            <button key={key} className={`pt-tab${period === key ? ' active' : ''}`} onClick={() => setPeriod(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="ad-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="pt-stats">
        <div className="pt-stat pt-stat-accent">
          <div className="pt-stat-label">Totali i tavolinave</div>
          <div className="pt-stat-value">{formatMoney(data?.total)}</div>
          <div className="pt-stat-meta">{PERIOD_LABELS[period]}</div>
        </div>
        <div className="pt-stat">
          <div className="pt-stat-label">Fatura</div>
          <div className="pt-stat-value">{data?.orders || 0}</div>
          <div className="pt-stat-meta">nga {data?.tables?.length || 0} tavolina</div>
        </div>
      </div>

      {loading ? (
        <div className="pt-empty">Duke ngarkuar…</div>
      ) : data?.tables?.length ? (
        <div className="pt-tables">
          {data.tables.map((t) => (
            <div className="pt-table-card" key={t.tableName}>
              <div className="pt-table-name">
                <span className="pt-table-dot" />
                {t.tableName}
              </div>
              <div className="pt-table-total">{formatMoney(t.total)}</div>
              <div className="pt-table-meta">
                <span>{t.orders} {t.orders === 1 ? 'faturë' : 'fatura'}</span>
                <span>mes. {formatMoney(t.average)}</span>
              </div>
              <div className="pt-table-meta" style={{ borderTop: 'none', paddingTop: 0, marginTop: 6 }}>
                <span className="ad-hint">E fundit: {formatDateTime(t.lastSaleAt)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ad-card pt-empty">Nuk ka shitje me tavolina në këtë periudhë.</div>
      )}
    </div>
  );
}

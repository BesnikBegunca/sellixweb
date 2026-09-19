import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { usePortalAuth } from '../../lib/PortalAuthContext';
import {
  formatMoney,
  formatMoneyShort,
  formatDayLabel,
  formatMonthLabel,
  formatDateTime,
  PERIOD_LABELS,
  PAYMENT_LABELS
} from './format';
import './portal.css';

const STAT_ORDER = ['today', 'yesterday', 'week', 'month', 'year', 'all'];

function StatTile({ label, stat, accent }) {
  return (
    <div className={`pt-stat${accent ? ' pt-stat-accent' : ''}`}>
      <div className="pt-stat-label">{label}</div>
      <div className="pt-stat-value">{formatMoney(stat?.total)}</div>
      <div className="pt-stat-meta">
        {stat?.orders || 0} {stat?.orders === 1 ? 'faturë' : 'fatura'}
        {stat?.orders > 0 && ` · mes. ${formatMoney(stat.average)}`}
      </div>
    </div>
  );
}

function BarChart({ data, labelKey, formatLabel }) {
  // Scaled to the tallest bar, so a quiet fortnight still fills the chart and
  // the day-to-day shape stays readable instead of flattening to nothing.
  const max = Math.max(...data.map((d) => d.total), 0);

  // On a phone there is no room for 14 date labels side by side — drawn in
  // full they collide into an unreadable smear. Showing every other one keeps
  // the axis legible; the bars themselves all stay.
  const [dense, setDense] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setDense(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const labelEvery = dense && data.length > 8 ? 2 : 1;

  return (
    <div className="pt-chart">
      {data.map((point, i) => {
        const height = max > 0 ? Math.max((point.total / max) * 100, point.total > 0 ? 4 : 0) : 0;
        const label = formatLabel(point[labelKey]);
        return (
          <div className="pt-bar-col" key={point[labelKey]}>
            <div
              className={`pt-bar${point.total > 0 ? '' : ' pt-bar-empty'}`}
              style={{ height: `${height}%` }}
              title={`${label}: ${formatMoney(point.total)} · ${point.orders} fatura`}
            />
            {/* Counted from the end so the most recent day always keeps its label. */}
            <div className="pt-bar-label">{(data.length - 1 - i) % labelEvery === 0 ? label : ' '}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Sales() {
  const { business } = usePortalAuth();
  const [overview, setOverview] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [period, setPeriod] = useState('today');
  const [chartMode, setChartMode] = useState('daily');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .portalOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .portalBreakdown(period)
      .then((data) => {
        // Without this guard a slow response for an old period can land after
        // a newer one and show figures that do not match the selected tab.
        if (!cancelled) setBreakdown(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [period]);

  if (loading) return <div className="pt-empty">Duke ngarkuar…</div>;
  if (error) return <div className="ad-error">{error}</div>;

  const summary = overview?.summary || {};

  return (
    <div>
      <div className="pt-page-head">
        <div>
          <h1 className="pt-title">{business?.name}</h1>
          <p className="pt-sub">
            {overview?.lastSaleAt
              ? `Shitja e fundit: ${formatDateTime(overview.lastSaleAt)}`
              : 'Ende nuk ka shitje të sinkronizuara'}
          </p>
        </div>
      </div>

      <div className="pt-stats pt-stats-6">
        {STAT_ORDER.map((key) => (
          <StatTile key={key} label={PERIOD_LABELS[key]} stat={summary[key]} accent={key === 'today'} />
        ))}
      </div>

      <div className="ad-card" style={{ padding: 20, marginBottom: 18 }}>
        <div className="pt-page-head" style={{ marginBottom: 6 }}>
          <h2 className="pt-section-title" style={{ margin: 0 }}>
            {chartMode === 'daily' ? '14 ditët e fundit' : `Muajt e vitit`}
          </h2>
          <div className="pt-tabs">
            <button className={`pt-tab${chartMode === 'daily' ? ' active' : ''}`} onClick={() => setChartMode('daily')}>
              Ditore
            </button>
            <button className={`pt-tab${chartMode === 'monthly' ? ' active' : ''}`} onClick={() => setChartMode('monthly')}>
              Mujore
            </button>
          </div>
        </div>
        {chartMode === 'daily' ? (
          <BarChart data={overview?.daily || []} labelKey="date" formatLabel={formatDayLabel} />
        ) : (
          <BarChart data={overview?.monthly || []} labelKey="month" formatLabel={formatMonthLabel} />
        )}
      </div>

      <div className="pt-page-head">
        <h2 className="pt-section-title" style={{ margin: 0 }}>Detajet</h2>
        <div className="pt-tabs">
          {Object.entries(PERIOD_LABELS).map(([key, label]) => (
            <button key={key} className={`pt-tab${period === key ? ' active' : ''}`} onClick={() => setPeriod(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-split">
        <div className="ad-card" style={{ padding: 20 }}>
          <h3 className="pt-section-title">Mënyra e pagesës</h3>
          {breakdown?.payments?.length ? (
            breakdown.payments.map((p) => (
              <div className="pt-list-row" key={p.method}>
                <span className="pt-name">
                  {PAYMENT_LABELS[p.method] || p.method} · {p.orders}
                </span>
                <span className="pt-amount">{formatMoney(p.total)}</span>
              </div>
            ))
          ) : (
            <div className="pt-empty">Nuk ka shitje në këtë periudhë.</div>
          )}
        </div>

        <div className="ad-card" style={{ padding: 20 }}>
          <h3 className="pt-section-title">Produktet më të shitura</h3>
          {breakdown?.products?.length ? (
            breakdown.products.map((p) => (
              <div className="pt-list-row" key={p.name}>
                <span className="pt-name">
                  {p.name} · {p.quantity}×
                </span>
                <span className="pt-amount">{formatMoneyShort(p.total)}</span>
              </div>
            ))
          ) : (
            <div className="pt-empty">Nuk ka të dhëna për produktet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

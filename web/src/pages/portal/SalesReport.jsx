import { useEffect, useMemo, useState } from 'react';
import { PERIODS, formatEuro, formatQty, paymentLabel, dayLabel, monthLabel } from '../../lib/sales';
import { liveClock } from '../../lib/useLiveRefresh';

const STAFF_COLORS = ['#1D9BF0', '#22C55E', '#F59E0B', '#A855F7', '#F43F5E', '#14B8A6', '#6366F1', '#FB7185'];
const STAFF_UNNAMED = 'Pa kamarjer';

export function staffLabel(name) {
  const trimmed = String(name || '').trim();
  return trimmed || STAFF_UNNAMED;
}

export function staffColor(name) {
  const key = staffLabel(name);
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return STAFF_COLORS[hash % STAFF_COLORS.length];
}

// Says why the numbers changed by themselves. "LIVE" means the push stream is
// open and a receipt lands here the moment the till syncs it; "Auto" means the
// stream is down and the page is falling back to polling.
export function LiveBadge({ live, lastUpdated }) {
  return (
    <span
      className={`pt-live${live ? '' : ' off'}`}
      title={live ? 'Përditësohet vetë sapo arka dërgon një faturë' : 'Lidhja live u ndërpre — po kontrollohet çdo disa sekonda'}
    >
      <span className="pt-live-dot" aria-hidden="true" />
      {live ? 'LIVE' : 'Auto'}
      {lastUpdated && <span className="pt-live-time">{liveClock(lastUpdated)}</span>}
    </span>
  );
}

function BarChart({ points, valueKey, labelFn }) {
  const max = Math.max(1, ...points.map((p) => Number(p[valueKey]) || 0));
  const hasAny = points.some((p) => Number(p[valueKey]) > 0);
  if (!hasAny) {
    return <div className="pt-empty">Nuk ka shitje në këtë periudhë.</div>;
  }
  return (
    <div className="pt-bars" role="img" aria-label="Grafiku i shitjeve">
      {points.map((p, i) => {
        const value = Number(p[valueKey]) || 0;
        const pct = Math.max(value > 0 ? 4 : 0, (value / max) * 100);
        return (
          <div key={p.date || p.month || i} className="pt-bar-col" title={`${labelFn(p)} · ${formatEuro(value)}`}>
            <div className="pt-bar-track">
              <div className="pt-bar" style={{ height: `${pct}%` }} />
            </div>
            <div className="pt-bar-label">{labelFn(p)}</div>
          </div>
        );
      })}
    </div>
  );
}

export function PeriodPills({ period, onChange }) {
  return (
    <div className="pt-pills" role="tablist" aria-label="Periudha">
      {PERIODS.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`pt-pill${period === p.id ? ' active' : ''}`}
          onClick={() => onChange(p.id)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function TodayRing({ totals }) {
  const today = totals?.today || { total: 0, count: 0 };
  const yesterday = totals?.yesterday || { total: 0, count: 0 };
  const denom = Math.max(Number(yesterday.total) || 0, Number(today.total) || 0, 0.01);
  const pct = Number(today.total) > 0 ? Math.min(100, (Number(today.total) / denom) * 100) : 0;
  const radius = 102;
  const circ = 2 * Math.PI * radius;
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(pct));
    return () => cancelAnimationFrame(frame);
  }, [pct]);

  return (
    <div className="pt-today">
      <div className="pt-today-ring" role="img" aria-label={`Sot ${formatEuro(today.total)}`}>
        <svg className="pt-today-svg" viewBox="0 0 240 240" aria-hidden="true">
          <circle className="pt-today-track" cx="120" cy="120" r={radius} />
          <circle
            className="pt-today-fill"
            cx="120"
            cy="120"
            r={radius}
            strokeDasharray={circ}
            strokeDashoffset={circ - (circ * drawn) / 100}
          />
        </svg>
        <div className="pt-today-inner">
          <div className="ad-mono pt-today-label">Sot</div>
          <div className="ad-heading pt-today-value">{formatEuro(today.total)}</div>
          <div className="ad-hint">{today.count} {today.count === 1 ? 'porosi' : 'porosi'}</div>
        </div>
      </div>
    </div>
  );
}

export function TotalsGrid({ totals }) {
  return <TodayRing totals={totals} />;
}

export function SalesCharts({ breakdown, chartMode, onChartModeChange }) {
  const days = breakdown?.days || [];
  const months = breakdown?.months || [];
  return (
    <div className="ad-card pt-panel">
      <div className="pt-panel-head">
        <h2 className="ad-heading pt-h">Grafiku</h2>
        <div className="pt-pills pt-pills-sm">
          <button type="button" className={`pt-pill${chartMode === 'days' ? ' active' : ''}`} onClick={() => onChartModeChange('days')}>
            14 ditë
          </button>
          <button type="button" className={`pt-pill${chartMode === 'months' ? ' active' : ''}`} onClick={() => onChartModeChange('months')}>
            12 muaj
          </button>
        </div>
      </div>
      {chartMode === 'days' ? (
        <BarChart points={days} valueKey="total" labelFn={(p) => dayLabel(p.date)} />
      ) : (
        <BarChart points={months} valueKey="total" labelFn={(p) => monthLabel(p.month)} />
      )}
    </div>
  );
}

export function PaymentsList({ payments }) {
  const rows = payments || [];
  return (
    <div className="ad-card pt-panel">
      <h2 className="ad-heading pt-h">Pagesat</h2>
      {rows.length === 0 ? (
        <div className="pt-empty">Nuk ka pagesa të sinkronizuara.</div>
      ) : (
        <ul className="pt-list">
          {rows.map((p) => (
            <li key={p.method}>
              <span>{paymentLabel(p.method)}</span>
              <span className="pt-list-meta">{p.count} · {formatEuro(p.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProductsList({ products }) {
  const rows = products || [];
  return (
    <div className="ad-card pt-panel">
      <h2 className="ad-heading pt-h">Produktet më të shitura</h2>
      {rows.length === 0 ? (
        <div className="pt-empty">Nuk ka artikuj të sinkronizuar.</div>
      ) : (
        <ul className="pt-list">
          {rows.map((p) => (
            <li key={p.name}>
              <span>{p.name}</span>
              <span className="pt-list-meta">{formatQty(p.quantity)} × · {formatEuro(p.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TablesGrid({ tables }) {
  const rows = tables || [];
  const [staffFilter, setStaffFilter] = useState('');
  const staffNames = useMemo(() => {
    const names = [...new Set(rows.map((t) => staffLabel(t.staffName)))];
    return names.sort((a, b) => a.localeCompare(b, 'sq', { sensitivity: 'base' }));
  }, [rows]);

  useEffect(() => {
    if (staffFilter && !staffNames.includes(staffFilter)) setStaffFilter('');
  }, [staffFilter, staffNames]);

  if (rows.length === 0) {
    return <div className="pt-empty">Nuk ka shitje me tavolinë në këtë periudhë. Takeaway / banaku nuk shfaqen këtu.</div>;
  }

  const visible = staffFilter ? rows.filter((t) => staffLabel(t.staffName) === staffFilter) : rows;
  const showStaffChrome = staffNames.length > 1 || (staffNames.length === 1 && staffNames[0] !== STAFF_UNNAMED);

  return (
    <div>
      {showStaffChrome && (
        <div className="pt-pills pt-staff-pills" role="tablist" aria-label="Kamarjerët">
          <button
            type="button"
            className={`pt-pill${staffFilter === '' ? ' active' : ''}`}
            onClick={() => setStaffFilter('')}
          >
            Të gjithë
          </button>
          {staffNames.map((name) => (
            <button
              key={name}
              type="button"
              className={`pt-pill pt-staff-pill${staffFilter === name ? ' active' : ''}`}
              style={{ '--staff-color': staffColor(name) }}
              onClick={() => setStaffFilter(name)}
            >
              <span className="pt-staff-dot" />
              {name}
            </button>
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <div className="pt-empty">Ky kamarjer nuk ka tavolinë të hapur.</div>
      ) : (
        <div className="pt-tables">
          {visible.map((t) => {
            const waiter = staffLabel(t.staffName);
            const color = staffColor(t.staffName);
            return (
              <div
                key={`${t.name}::${t.staffName || ''}`}
                className="ad-card pt-table-card"
                style={showStaffChrome ? { '--staff-color': color } : undefined}
              >
                {showStaffChrome && (
                  <div className="pt-table-staff">{waiter}</div>
                )}
                <div className="ad-heading pt-table-name">{t.name}</div>
                <div className="pt-table-total">{formatEuro(t.total)}</div>
                <div className="ad-hint">{t.count} {t.count === 1 ? 'porosi' : 'porosi'}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SalesList({ sales }) {
  const rows = sales || [];
  if (rows.length === 0) {
    return <div className="pt-empty">Nuk ka faturë të sinkronizuar në këtë periudhë.</div>;
  }
  return (
    <div className="ad-card" style={{ overflow: 'hidden' }}>
      <div className="pt-panel" style={{ paddingBottom: 0 }}>
        <h2 className="ad-heading pt-h">Faturat e fundit</h2>
      </div>
      <div style={{ overflowX: 'auto' }} className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Ora</th>
              <th>Fatura</th>
              <th>Tavolina</th>
              <th>Stafi</th>
              <th>Pagesa</th>
              <th>Totali</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.saleUid}>
                <td data-label="Ora" className="ad-mono" style={{ fontSize: 12 }}>{s.soldAt}</td>
                <td data-label="Fatura">{s.receiptNo || '—'}</td>
                <td data-label="Tavolina">{s.tableName || 'Banak'}</td>
                <td data-label="Stafi">{s.staffName || '—'}</td>
                <td data-label="Pagesa">{paymentLabel(s.paymentMethod)}</td>
                <td data-label="Totali" style={{ fontWeight: 700 }}>{formatEuro(s.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

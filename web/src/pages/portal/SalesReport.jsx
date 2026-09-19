import { PERIODS, formatEuro, formatQty, paymentLabel, dayLabel, monthLabel } from '../../lib/sales';

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

export function TotalsGrid({ totals }) {
  const cards = [
    { key: 'today', label: 'Sot' },
    { key: 'yesterday', label: 'Dje' },
    { key: 'week', label: '1 javë' },
    { key: 'month', label: '1 muaj' },
    { key: 'year', label: '1 vit' },
    { key: 'all', label: 'Gjithsej' }
  ];
  return (
    <div className="pt-totals">
      {cards.map((c) => {
        const row = totals?.[c.key] || { total: 0, count: 0 };
        return (
          <div key={c.key} className="ad-card pt-stat">
            <div className="ad-mono pt-stat-label">{c.label}</div>
            <div className="ad-heading pt-stat-value">{formatEuro(row.total)}</div>
            <div className="ad-hint">{row.count} {row.count === 1 ? 'porosi' : 'porosi'}</div>
          </div>
        );
      })}
    </div>
  );
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
  if (rows.length === 0) {
    return <div className="pt-empty">Nuk ka shitje me tavolinë në këtë periudhë. Takeaway / banaku nuk shfaqen këtu.</div>;
  }
  return (
    <div className="pt-tables">
      {rows.map((t) => (
        <div key={t.name} className="ad-card pt-table-card">
          <div className="ad-heading pt-table-name">{t.name}</div>
          <div className="pt-table-total">{formatEuro(t.total)}</div>
          <div className="ad-hint">{t.count} {t.count === 1 ? 'porosi' : 'porosi'}</div>
        </div>
      ))}
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
      <div style={{ overflowX: 'auto' }}>
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

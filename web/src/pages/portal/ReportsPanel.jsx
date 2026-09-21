import { useMemo } from 'react';
import { formatEuro } from '../../lib/sales';

const MONTHS_SQ = [
  'Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor',
  'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'
];

function pad(n) {
  return String(n).padStart(2, '0');
}

export function reportPeriodOptions(kind) {
  const now = new Date();
  if (kind === 'year') {
    const y = now.getFullYear();
    return Array.from({ length: 6 }, (_, i) => {
      const year = String(y - i);
      return { value: year, label: year };
    });
  }
  const items = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    items.push({ value, label: `${MONTHS_SQ[d.getMonth()]} ${d.getFullYear()}` });
  }
  return items;
}

function formatWhen(raw) {
  if (!raw) return '';
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return raw.slice(0, 16);
  return `${m[3]}.${m[2]}.${m[1]} · ${m[4]}:${m[5]}`;
}

export default function ReportsPanel({
  reports,
  loading,
  error,
  busy,
  preview,
  kind,
  period,
  onKindChange,
  onPeriodChange,
  onCreate,
  onDownload,
  onDelete
}) {
  const options = useMemo(() => reportPeriodOptions(kind), [kind]);

  return (
    <div className="pt-reports">
      <div className="ad-card pt-panel pt-report-make">
        <h2 className="ad-heading pt-h">Krijo raport PDF</h2>
        <p className="ad-hint" style={{ margin: '0 0 14px', lineHeight: 1.5 }}>
          Zgjidh 1 muaj ose 1 vit. Raporti ruhet këtu dhe shkarkohet në telefon ose PC.
        </p>
        <div className="pt-report-form">
          <label>
            <span className="ad-hint">Lloji</span>
            <select className="ad-field" value={kind} onChange={(e) => onKindChange(e.target.value)}>
              <option value="month">1 muaj</option>
              <option value="year">1 vit</option>
            </select>
          </label>
          <label>
            <span className="ad-hint">{kind === 'year' ? 'Viti' : 'Muaji'}</span>
            <select className="ad-field" value={period} onChange={(e) => onPeriodChange(e.target.value)}>
              {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
        {preview && (
          <div className="pt-report-preview">
            <div>
              <div className="ad-hint">Totali</div>
              <div className="pt-report-total">{formatEuro(preview.total)}</div>
            </div>
            <div>
              <div className="ad-hint">Fatura</div>
              <div className="pt-report-count">{preview.count}</div>
            </div>
            <div>
              <div className="ad-hint">Periudha</div>
              <div className="pt-report-range">{preview.from} → {preview.to}</div>
            </div>
          </div>
        )}
        {error && <div className="ad-error" style={{ margin: '12px 0 0' }}>{error}</div>}
        <button type="button" className="ad-btn pt-report-go" disabled={busy} onClick={onCreate}>
          {busy ? 'Duke krijuar…' : 'Krijo dhe shkarko PDF'}
        </button>
      </div>

      <div className="ad-card pt-panel">
        <h2 className="ad-heading pt-h">Raportet e ruajtura</h2>
        {loading && !reports ? (
          <div className="ad-hint">Duke ngarkuar…</div>
        ) : !reports?.length ? (
          <div className="ad-hint">Nuk ka raporte ende. Krijo një më lart.</div>
        ) : (
          <ul className="pt-report-list">
            {reports.map((r) => (
              <li key={r.id} className="pt-report-item">
                <div className="pt-report-meta">
                  <div className="pt-report-name">{r.title}</div>
                  <div className="ad-hint">
                    {formatEuro(r.total)} · {r.count} fatura · {formatWhen(r.createdAt)}
                  </div>
                </div>
                <div className="pt-report-actions">
                  <button type="button" className="ad-btn" disabled={busy} onClick={() => onDownload(r)}>
                    Shkarko
                  </button>
                  <button type="button" className="ad-btn-ghost" disabled={busy} onClick={() => onDelete(r)}>
                    Fshi
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

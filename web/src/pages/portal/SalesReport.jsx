import { useEffect, useMemo, useState } from 'react';
import { PERIODS, formatEuro, formatQty, paymentLabel, dayLabel, monthLabel, registerLabel, DEFAULT_DAILY_GOAL, periodGoal, periodLabel } from '../../lib/sales';
import { liveClock } from '../../lib/useLiveRefresh';

const STAFF_COLORS = ['#5EEAD4', '#38BDF8', '#86EFAC', '#FBBF24', '#FB7185', '#67E8F9', '#FDBA74', '#A3E635'];
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

export function TodayRing({ totals, goal = 0, period = 'today', onSaveGoal }) {
  const stats = totals?.[period] || totals?.today || { total: 0, count: 0 };
  const dailyGoal = Number(goal) > 0 ? Number(goal) : DEFAULT_DAILY_GOAL;
  const target = periodGoal(dailyGoal, period);
  const rawPct = target > 0 ? (Number(stats.total) / target) * 100 : 0;
  const over = target > 0 && Number(stats.total) > target;
  const pct = Math.min(100, rawPct);
  const radius = 102;
  const circ = 2 * Math.PI * radius;
  const [drawn, setDrawn] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(dailyGoal));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const label = periodLabel(period);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(pct));
    return () => cancelAnimationFrame(frame);
  }, [pct]);

  useEffect(() => {
    if (!editing) setDraft(String(dailyGoal));
  }, [dailyGoal, editing]);

  const save = async (e) => {
    e.preventDefault();
    if (!onSaveGoal) return;
    const value = Number(String(draft).replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) {
      setError('Shkruaj një shumë valide.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSaveGoal(value);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-today">
      <div
        className={`pt-today-ring${over ? ' is-over' : ''}`}
        role="img"
        aria-label={`${label} ${formatEuro(stats.total)}${over ? ', objektivi u tejkalua' : ''}`}
      >
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
          <div className="ad-mono pt-today-label">{label}</div>
          <div className="ad-heading pt-today-value">{formatEuro(stats.total)}</div>
          <div className="ad-hint">{stats.count} {stats.count === 1 ? 'porosi' : 'porosi'}</div>
          {target > 0 && (
            <div className="pt-today-pct">{Math.round(rawPct)}% · {formatEuro(target)}</div>
          )}
        </div>
      </div>
      {onSaveGoal && (
        <div className="pt-today-goal">
          {editing ? (
            <form className="pt-today-form" onSubmit={save}>
              <input
                className="ad-field"
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                placeholder="p.sh. 200"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Objektivi ditor në euro"
              />
              <button className="ad-btn" type="submit" disabled={saving}>{saving ? 'Duke ruajtur…' : 'Ruaj'}</button>
              <button className="ad-btn-ghost" type="button" onClick={() => { setEditing(false); setError(''); }}>Anulo</button>
            </form>
          ) : (
            <button type="button" className="ad-btn-ghost" onClick={() => setEditing(true)}>
              Ndrysho objektivin
            </button>
          )}
          {error && <div className="ad-error">{error}</div>}
        </div>
      )}
    </div>
  );
}

export function TotalsGrid({ totals }) {
  const cards = [
    { key: 'today', label: 'Sot' },
    { key: 'yesterday', label: 'Dje' },
    { key: 'week', label: '1 javë' },
    { key: 'month', label: '1 muaj' },
    { key: 'month3', label: '3 muaj' },
    { key: 'month6', label: '6 muaj' },
    { key: 'month9', label: '9 muaj' },
    { key: 'year', label: '1 vit' },
    { key: 'all', label: 'Total' }
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
                className={`ad-card pt-table-card${showStaffChrome ? ' has-staff' : ''}`}
                style={showStaffChrome ? { '--staff-color': color } : undefined}
              >
                <div className="ad-heading pt-table-name">{t.name}</div>
                <div className="pt-table-total">{formatEuro(t.total)}</div>
                {showStaffChrome && <div className="pt-table-waiter">{waiter}</div>}
                <div className="ad-hint">{t.count} {t.count === 1 ? 'porosi' : 'porosi'}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// The market's answer to TablesGrid. A shop floor has tables to lay out; a
// market has two or three tills whose takings the owner wants to compare, so
// these are rows with a share bar rather than a grid of squares.
function soldAtLabel(soldAt, asOf) {
  if (!soldAt) return '';
  const [day, time] = String(soldAt).split(' ');
  const clock = (time || '').slice(0, 5);
  return day === asOf ? clock : `${dayLabel(day)} ${clock}`;
}

export function RegistersGrid({ data }) {
  const devices = data?.devices || [];
  const total = Number(data?.total) || 0;
  const count = Number(data?.count) || 0;

  if (devices.length === 0) {
    return (
      <div className="pt-empty">
        Asnjë arkë nuk ka dërguar shitje ende. Sapo një kompjuter të aktivizohet dhe të lëshojë faturën e parë, del këtu.
      </div>
    );
  }

  // Only worth crowning a winner when there is something to win: with a single
  // till, or with everything at zero, the badge would just be noise.
  const best = devices.reduce((a, b) => (b.total > a.total ? b : a), devices[0]);
  const hasRace = devices.filter((d) => d.total > 0).length > 1;
  // The catch-all row for receipts with no device id is not a till, so it does
  // not get counted as one.
  const tills = devices.filter((d) => d.number).length;

  return (
    <div className="pt-regs">
      <div className="ad-card pt-regs-sum">
        <div>
          <div className="ad-mono pt-stat-label">
            Gjithsej nga {tills} {tills === 1 ? 'arkë' : 'arka'}
          </div>
          <div className="ad-heading pt-regs-sum-value">{formatEuro(total)}</div>
        </div>
        <div className="ad-hint">{count} {count === 1 ? 'faturë' : 'fatura'}</div>
      </div>

      {devices.map((d) => {
        const share = Number(d.share) || 0;
        const last = soldAtLabel(d.lastSoldAt, data?.asOf);
        return (
          <div
            key={d.deviceId || 'unknown'}
            className={`ad-card pt-reg${hasRace && d === best ? ' best' : ''}${d.total > 0 ? '' : ' quiet'}`}
          >
            <div className="pt-reg-head">
              <span className="pt-reg-no" aria-hidden="true">{d.number || '?'}</span>
              <div className="pt-reg-id">
                <div className="ad-heading pt-reg-name">
                  {registerLabel(d.number)}
                  {hasRace && d === best && <span className="pt-reg-best">Më e larta</span>}
                </div>
                <div className="ad-hint pt-reg-sub">
                  {d.machineName ||
                    (!d.number
                      ? 'Fatura pa ID arke'
                      : d.activated
                        ? 'Pa emër'
                        : 'Arkë e pa-aktivizuar')}
                </div>
              </div>
              <div className="pt-reg-money">
                <div className="pt-reg-total">{formatEuro(d.total)}</div>
                <div className="ad-hint">{d.count} {d.count === 1 ? 'faturë' : 'fatura'}</div>
              </div>
            </div>
            <div className="pt-reg-bar" role="img" aria-label={`${share}% e shitjeve`}>
              <div className="pt-reg-bar-fill" style={{ width: `${Math.max(share > 0 ? 2 : 0, share)}%` }} />
            </div>
            <div className="pt-reg-foot">
              <span>{share}% e shitjeve</span>
              <span>{last ? `Shitja e fundit ${last}` : 'Pa shitje në këtë periudhë'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SalesList({ sales, isRestaurant = true }) {
  const rows = sales || [];
  const [openId, setOpenId] = useState(null);

  if (rows.length === 0) {
    return <div className="pt-empty">Nuk ka faturë të sinkronizuar në këtë periudhë.</div>;
  }

  return (
    <div className="ad-card pt-panel">
      <h2 className="ad-heading pt-h">Faturat e fundit</h2>
      <div className="pt-sales">
        {rows.map((s) => {
          const paid = s.status !== 'open';
          const open = openId === s.saleUid;
          const items = s.items || [];
          return (
            <div key={s.saleUid} className={`ad-card pt-sale${paid ? ' paid' : ''}${open ? ' open' : ''}`}>
              <button
                type="button"
                className="pt-sale-toggle"
                onClick={() => setOpenId(open ? null : s.saleUid)}
                aria-expanded={open}
              >
                <div className="pt-sale-main">
                  <div className="pt-sale-meta">
                    {/* A restaurant receipt belongs to a table; a market
                        receipt belongs to the till that rang it up. */}
                    <div className="pt-sale-table">
                      {isRestaurant ? (s.tableName || 'Banak') : registerLabel(s.deviceNumber)}
                    </div>
                    <div className="ad-hint">
                      {s.receiptNo || 'Pa tiketë'}
                      {s.soldAt ? ` · ${s.soldAt}` : ''}
                      {s.staffName ? ` · ${s.staffName}` : ''}
                    </div>
                  </div>
                  <div className="pt-sale-side">
                    <div className="pt-sale-total">{formatEuro(s.total)}</div>
                    <div className={`pt-sale-status${paid ? ' paid' : ''}`}>
                      {paid ? 'Paguar' : 'Printuar'}
                    </div>
                  </div>
                </div>
              </button>
              {open && (
                <div className="pt-sale-items">
                  {items.length === 0 ? (
                    <div className="pt-empty">Nuk ka artikuj të sinkronizuar për këtë faturë.</div>
                  ) : (
                    <ul className="pt-list">
                      {items.map((item, i) => (
                        <li key={`${s.saleUid}-${i}`}>
                          <span>{formatQty(item.quantity)} × {item.name}</span>
                          <span className="pt-list-meta">{formatEuro(item.total)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function localStamp(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!match) return { dayKey: '', date: '—', time: '—' };
  return {
    dayKey: `${match[1]}-${match[2]}-${match[3]}`,
    date: `${match[3]}.${match[2]}.${match[1]}`,
    time: `${match[4]}:${match[5]}`
  };
}

export function GjendjaTable({ data }) {
  const [openDay, setOpenDay] = useState(null);
  const shifts = data?.shifts || [];
  const days = useMemo(() => {
    const byDay = new Map();
    for (const shift of shifts) {
      const closed = localStamp(shift.closedAt);
      if (!closed.dayKey) continue;
      const list = byDay.get(closed.dayKey) || [];
      list.push(shift);
      byDay.set(closed.dayKey, list);
    }
    return [...byDay.keys()]
      .sort((a, b) => b.localeCompare(a))
      .map((key) => {
        const dayShifts = byDay.get(key).slice().sort((a, b) => String(a.closedAt).localeCompare(String(b.closedAt)));
        // Same as server shiftDayBar: latest event per shift (Shtyp or Mbyll).
        const latestByShift = new Map();
        for (const s of dayShifts) {
          latestByShift.set(String(s.shiftUid || s.uid), s);
        }
        const total = [...latestByShift.values()].reduce((sum, s) => sum + (Number(s.total) || 0), 0);
        return {
          dayKey: key,
          date: localStamp(`${key} 00:00:00`).date,
          total,
          shifts: dayShifts
        };
      });
  }, [shifts]);

  if (!shifts.length) {
    return (
      <div className="ad-card pt-panel">
        <div className="pt-empty">
          Nuk ka mbyllje gjendje të sinkronizuara. Shtyp ose mbyll gjendjen në POS — faqja përditësohet vetë.
        </div>
      </div>
    );
  }

  return (
    <div className="ad-card pt-panel">
      <div className="pt-gj-stats">
        <div className="pt-gj-stat">
          <div className="ad-hint">Mbyllje gjendje</div>
          <div className="ad-heading pt-gj-stat-value">{data?.count || 0}</div>
        </div>
        <div className="pt-gj-stat">
          <div className="ad-hint">Totali i të gjithëve</div>
          <div className="ad-heading pt-gj-stat-value">{formatEuro(data?.total)}</div>
        </div>
      </div>
      <h2 className="ad-heading pt-h">Shitjet sipas mbylljes së gjendjes</h2>
      <p className="ad-hint" style={{ margin: '-8px 0 14px', lineHeight: 1.45 }}>
        Kliko datën për orën, intervalin, totalin dhe kamarierët.
      </p>
      <div className="pt-gj">
        {days.map((day) => {
          const open = openDay === day.dayKey;
          return (
            <div key={day.dayKey} className={`pt-gj-day-card${open ? ' open' : ''}`}>
              <button
                type="button"
                className="pt-gj-day-toggle"
                onClick={() => setOpenDay(open ? null : day.dayKey)}
                aria-expanded={open}
              >
                <span className="pt-gj-day-date">{day.date}</span>
                <span className="pt-gj-day-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
              </button>
              {open && (
                <div className="pt-gj-day-body">
                  {day.shifts.map((shift) => {
                    const opened = localStamp(shift.openedAt);
                    const closed = localStamp(shift.closedAt);
                    const waiters = shift.waiters || [];
                    const printed = shift.kind === 'printed';
                    return (
                      <div key={shift.uid} className="pt-gj-detail">
                        <div className="pt-gj-row">
                          <span className="pt-gj-close" data-label={printed ? 'Ora e shtypjes' : 'Ora e mbylljes'}>
                            {closed.time}
                            <span className={`pt-gj-kind${printed ? ' printed' : ''}`}>{printed ? 'Shtypur' : 'Mbyllur'}</span>
                          </span>
                          <span className="pt-gj-period" data-label="Periudha">{opened.time} – {closed.time}</span>
                          <span className="pt-gj-total" data-label="Totali">{formatEuro(shift.total)}</span>
                        </div>
                        {waiters.length > 0 && (
                          <ul className="pt-list">
                            {waiters.map((w) => (
                              <li key={`${shift.uid}-${w.name}`}>
                                <span>{w.name}</span>
                                <span className="pt-list-meta">{formatEuro(w.total)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                  <div className="pt-gj-day-sum">
                    <span>Totali ditor</span>
                    <span>{formatEuro(day.total)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


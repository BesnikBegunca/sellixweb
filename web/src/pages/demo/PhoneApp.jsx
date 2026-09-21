import { useEffect, useMemo, useRef, useState } from 'react';
import { SellixMark } from './icons';
import { BUSINESS, CITY, HISTORY, PRODUCT_INDEX, hhmm, lineTotal } from './data';
import { selectStats, staffName } from './store';
import { useNow } from './charts';
import { staffColor } from '../portal/SalesReport';

// A replica of the business portal (/portal) as it looks when the owner has
// added it to the iPhone home screen: same header, tabs, ring and cards.

const euro = (v) => `${(Math.round(v * 100) / 100).toFixed(2)} €`;

const TABS = [
  ['sales', 'Shitjet'],
  ['tables', 'Tavolinat'],
  ['gjendja', 'Gjendja'],
  ['reports', 'Raportet'],
  ['account', 'Llogaria'],
];

const PERIODS = [
  ['today', 'Sot'],
  ['yesterday', 'Dje'],
  ['week', '1 javë'],
  ['month', '1 muaj'],
  ['month3', '3 muaj'],
  ['year', '1 vit'],
];

const GOAL = 200;
const GOAL_DAYS = { today: 1, yesterday: 1, week: 7, month: 30, month3: 90, year: 365 };
const PERIOD_LABEL = { today: 'SOT', yesterday: 'DJE', week: '1 JAVË', month: '1 MUAJ', month3: '3 MUAJ', year: '1 VIT' };

function StatusBar({ now }) {
  return (
    <div className="ip-status">
      <span className="ip-time">{hhmm(now)}</span>
      <span className="ip-island" />
      <span className="ip-sys">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.4c2.3 0 4.4.9 6 2.4l1.3-1.4A10.4 10.4 0 0 0 8 .4 10.4 10.4 0 0 0 .7 3.4L2 4.8a8.4 8.4 0 0 1 6-2.4zm0 3.8c1.3 0 2.5.5 3.4 1.3l1.3-1.4A6.8 6.8 0 0 0 8 4.2c-1.8 0-3.4.7-4.7 1.9l1.3 1.4c.9-.8 2.1-1.3 3.4-1.3zM8 10.2l2-2.1a2.9 2.9 0 0 0-4 0l2 2.1z" /></svg>
        <span className="ip-batt"><i /></span>
      </span>
    </div>
  );
}

function periodTotals(stats) {
  const week = HISTORY.reduce((a, b) => a + b, 0) + stats.revenue;
  const month = week * 4.1;
  const yesterday = HISTORY[HISTORY.length - 1];
  const ord = (v) => Math.max(stats.orders, Math.round(v / 5.4));
  return {
    today: { total: stats.revenue, count: stats.orders },
    yesterday: { total: yesterday, count: Math.round(yesterday / 5.4) },
    week: { total: week, count: ord(week) },
    month: { total: month, count: ord(month) },
    month3: { total: month * 2.9, count: ord(month * 2.9) },
    year: { total: month * 11.3, count: ord(month * 11.3) },
  };
}

export default function PhoneApp({ state, dispatch }) {
  const now = useNow(15000);
  const [tab, setTabState] = useState('sales');
  const scrollRef = useRef(null);
  const setTab = (id) => {
    setTabState(id);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };
  const [banner, setBanner] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const latest = state.notes[0];

  useEffect(() => {
    if (!latest) return undefined;
    setBanner(latest);
    const id = setTimeout(() => setBanner(null), 4200);
    return () => clearTimeout(id);
  }, [latest]);

  const stats = selectStats(state);
  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  };

  return (
    <div className="ip-frame">
      <div className="ip-btn ip-btn-action" />
      <div className="ip-btn ip-btn-up" />
      <div className="ip-btn ip-btn-down" />
      <div className="ip-btn ip-btn-power" />
      <div className="ip-screen pw">
        <StatusBar now={now} />

        <div className={`ip-banner ${banner ? 'is-in' : ''}`} onClick={() => { setBanner(null); setTab(banner?.kind === 'shift' ? 'gjendja' : 'sales'); }}>
          {banner && (
            <>
              <span className="ip-banner-icon"><SellixMark size={13} /></span>
              <div className="ip-banner-text">
                <div className="ip-banner-top"><b>SelliX</b><span>tani</span></div>
                <b>{banner.title}</b>
                <span>{banner.body}</span>
              </div>
            </>
          )}
        </div>

        <div ref={scrollRef} className={`pw-scroll ${refreshing ? 'is-refreshing' : ''}`}>
          <header className="pw-top">
            <div className="pw-brand">
              <span className="pw-mark"><span /></span>
              <div>
                <div className="pw-name">{BUSINESS}</div>
                <div className="pw-hint">{CITY} · Portal i biznesit</div>
              </div>
            </div>
            <div className="pw-actions">
              <button className="pw-btn-ghost" onClick={refresh}>{refreshing ? 'Duke rifreskuar…' : 'Rifresko'}</button>
              <button className="pw-btn-dil" onClick={() => setTab('sales')}>Dil</button>
            </div>
          </header>

          <nav className="pw-tabs">
            {TABS.map(([id, label]) => (
              <button key={id} className={`pw-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
            ))}
          </nav>

          <main className="pw-main" key={tab}>
            {tab === 'sales' && <Sales state={state} stats={stats} now={now} />}
            {tab === 'tables' && <Tables state={state} stats={stats} now={now} />}
            {tab === 'gjendja' && <Gjendja state={state} stats={stats} dispatch={dispatch} now={now} />}
            {tab === 'reports' && <Reports stats={stats} />}
            {tab === 'account' && <Account />}
          </main>
          <div className="pw-foot">← Faqja e SelliX</div>
        </div>
        <span className="ip-home" />
      </div>
    </div>
  );
}

function Head({ title, now }) {
  return (
    <div className="pw-page-head">
      <h1 className="pw-title">{title}</h1>
      <span className="pw-live"><span className="pw-live-dot" />LIVE<span className="pw-live-time">{hhmm(now)}</span></span>
    </div>
  );
}

function Ring({ total, count, period }) {
  const target = GOAL * GOAL_DAYS[period];
  const raw = (total / target) * 100;
  const over = total > target;
  const r = 102;
  const circ = 2 * Math.PI * r;
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const f = requestAnimationFrame(() => setDrawn(Math.min(100, raw)));
    return () => cancelAnimationFrame(f);
  }, [raw]);
  return (
    <div className="pw-today">
      <div className={`pw-ring ${over ? 'is-over' : ''}`}>
        <svg viewBox="0 0 240 240" className="pw-ring-svg">
          <circle className="pw-ring-track" cx="120" cy="120" r={r} />
          <circle className="pw-ring-fill" cx="120" cy="120" r={r} strokeDasharray={circ} strokeDashoffset={circ * (1 - drawn / 100)} />
        </svg>
        <div className="pw-ring-inner">
          <div className="pw-ring-label">{PERIOD_LABEL[period]}</div>
          <div className="pw-ring-value">{euro(total)}</div>
          <div className="pw-hint">{count} porosi</div>
          <div className="pw-ring-pct">{Math.round(raw)}% · {euro(target)}</div>
        </div>
      </div>
      <button className="pw-btn-ghost">Objektivi ditor: {euro(GOAL)}</button>
    </div>
  );
}

function Sales({ state, stats, now }) {
  const [period, setPeriod] = useState('today');
  const [openId, setOpenId] = useState(null);
  const totals = periodTotals(stats);
  const sales = [...state.sales].reverse();

  const { payments, products } = useMemo(() => {
    const prod = {};
    for (const s of state.sales) {
      for (const [id, q] of Object.entries(s.items)) {
        const p = PRODUCT_INDEX[id];
        if (!p) continue;
        prod[id] = prod[id] || { n: p.n, q: 0, t: 0 };
        prod[id].q += q;
        prod[id].t += q * p.p;
      }
    }
    const cash = state.sales.filter((_, i) => i % 4 !== 1);
    const card = state.sales.filter((_, i) => i % 4 === 1);
    return {
      payments: [
        ['Para në dorë', cash.length, cash.reduce((a, s) => a + s.total, 0)],
        ['Kartelë', card.length, card.reduce((a, s) => a + s.total, 0)],
      ],
      products: Object.values(prod).sort((a, b) => b.t - a.t).slice(0, 5),
    };
  }, [state.sales]);

  const bars = [...HISTORY, stats.revenue];
  const max = Math.max(...bars);
  const labels = bars.map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (bars.length - 1 - i));
    return `${d.getDate()}`;
  });

  return (
    <div>
      <Head title="Shitjet" now={now} />
      <div className="pw-pills">
        {PERIODS.map(([id, l]) => (
          <button key={id} className={`pw-pill ${period === id ? 'active' : ''}`} onClick={() => setPeriod(id)}>{l}</button>
        ))}
      </div>
      <Ring total={totals[period].total} count={totals[period].count} period={period} />
      <div className="pw-totals">
        {PERIODS.map(([id, l]) => (
          <div key={id} className="pw-card pw-stat">
            <div className="pw-stat-label">{l}</div>
            <div className="pw-stat-value">{euro(totals[id].total)}</div>
            <div className="pw-hint">{totals[id].count} porosi</div>
          </div>
        ))}
      </div>
      <div className="pw-card pw-panel">
        <div className="pw-panel-head">
          <h2 className="pw-h">Grafiku</h2>
          <div className="pw-pills pw-pills-sm"><button className="pw-pill active">Ditë</button><button className="pw-pill">Muaj</button></div>
        </div>
        <div className="pw-bars">
          {bars.map((v, i) => (
            <div key={i} className="pw-bar-col">
              <div className="pw-bar-track"><div className="pw-bar" style={{ height: `${(v / max) * 100}%` }} /></div>
              <div className="pw-bar-label">{labels[i]}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="pw-card pw-panel">
        <h2 className="pw-h">Pagesat</h2>
        <ul className="pw-list">
          {payments.map(([n, c, t]) => <li key={n}><span>{n}</span><span className="pw-meta">{c} · {euro(t)}</span></li>)}
        </ul>
      </div>
      <div className="pw-card pw-panel">
        <h2 className="pw-h">Produktet më të shitura</h2>
        <ul className="pw-list">
          {products.map((p) => <li key={p.n}><span>{p.n}</span><span className="pw-meta">{p.q} × · {euro(p.t)}</span></li>)}
        </ul>
      </div>
      <div className="pw-card pw-panel">
        <h2 className="pw-h">Faturat e fundit</h2>
        <div className="pw-sales">
          {sales.slice(0, 8).map((s, i) => {
            const open = openId === s.id;
            const fresh = i === 0 && !s.id.startsWith('seed');
            return (
              <div key={s.id} className={`pw-card pw-sale ${fresh ? 'is-new' : ''}`}>
                <button className="pw-sale-toggle" onClick={() => setOpenId(open ? null : s.id)}>
                  <div>
                    <div className="pw-sale-table">Tavolina {s.table}</div>
                    <div className="pw-hint">#{String(s.no).padStart(4, '0')} · {hhmm(new Date(s.at))} · {staffName(state, s.waiter)}</div>
                  </div>
                  <div className="pw-sale-side">
                    <div className="pw-sale-total">{euro(s.total)}</div>
                    <div className="pw-sale-status">Paguar</div>
                  </div>
                </button>
                {open && (
                  <div className="pw-sale-items">
                    <ul className="pw-list">
                      {Object.entries(s.items).map(([id, q]) => (
                        <li key={id}><span>{q} × {PRODUCT_INDEX[id]?.n}</span><span className="pw-meta">{euro(q * (PRODUCT_INDEX[id]?.p || 0))}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Tables({ state, stats, now }) {
  const [filter, setFilter] = useState('');
  const open = state.tables.filter((t) => Object.keys(t.items).length);
  const waiters = [...new Set(open.map((t) => staffName(state, t.waiter)))];
  const shown = open.filter((t) => !filter || staffName(state, t.waiter) === filter);
  const totals = periodTotals(stats);
  return (
    <div>
      <Head title="Tavolinat" now={now} />
      <p className="pw-hint pw-lead">Totalet sipas tavolinës, të përditësuara vetvetiu sapo arka dërgon një porosi.</p>
      <Ring total={totals.today.total} count={totals.today.count} period="today" />
      {open.length > 0 && (
        <div className="pw-pills pw-staff-pills">
          <button className={`pw-pill ${filter === '' ? 'active' : ''}`} onClick={() => setFilter('')}>Të gjithë</button>
          {waiters.map((w) => (
            <button key={w} className={`pw-pill pw-staff-pill ${filter === w ? 'active' : ''}`} style={{ '--staff-color': staffColor(w) }} onClick={() => setFilter(w)}>
              <span className="pw-staff-dot" />{w}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <div className="pw-empty">Nuk ka tavolina të hapura tani. Hap një tavolinë në POS — shfaqet këtu menjëherë.</div>
      ) : (
        <div className="pw-tables">
          {shown.map((t) => {
            const w = staffName(state, t.waiter);
            const count = Object.values(t.items).reduce((a, b) => a + b, 0);
            return (
              <div key={t.id} className="pw-card pw-table" style={{ '--staff-color': staffColor(w) }}>
                <div className="pw-table-name">Tavolina {t.id}</div>
                <div className="pw-table-total">{euro(lineTotal(t.items))}</div>
                <div className="pw-table-waiter">{w}</div>
                <div className="pw-hint">{count} artikuj · {t.printed ? 'printuar' : 'e hapur'}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Gjendja({ state, stats, dispatch, now }) {
  const [open, setOpen] = useState(true);
  const d = new Date();
  const date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  const opened = hhmm(new Date(state.shift.at));
  return (
    <div>
      <Head title="Gjendja" now={now} />
      <p className="pw-hint pw-lead">Mbylljet e gjendjes nga kasa, me orën, intervalin dhe totalin e çdo turni — si në desktop.</p>
      <div className="pw-card pw-panel">
        <div className="pw-gj-stats">
          <div className="pw-gj-stat"><div className="pw-hint">Turni</div><div className="pw-gj-value">{state.shift.open ? 'Hapur' : 'Mbyllur'}</div></div>
          <div className="pw-gj-stat"><div className="pw-hint">Totali sot</div><div className="pw-gj-value">{euro(stats.revenue)}</div></div>
        </div>
        <div className="pw-gj-card">
          <button className="pw-gj-toggle" onClick={() => setOpen(!open)}>
            <span className="pw-gj-date">{date}</span>
            <span className="pw-gj-chev">{open ? '▾' : '▸'}</span>
          </button>
          {open && (
            <div className="pw-gj-body">
              <div className="pw-gj-row">
                <span>{state.shift.open ? 'Turn aktiv' : 'Mbyllur'}<span className={`pw-gj-kind ${state.shift.open ? 'printed' : ''}`}>{state.shift.open ? 'Live' : 'Mbyllur'}</span></span>
                <b className="pw-gj-total">{euro(stats.revenue)}</b>
              </div>
              <div className="pw-hint">Periudha · {opened} – {state.shift.open ? 'tani' : hhmm(new Date())}</div>
              <ul className="pw-list" style={{ marginTop: 10 }}>
                {Object.entries(stats.byWaiter).map(([id, v]) => (
                  <li key={id}><span>{staffName(state, id)}</span><span className="pw-meta">{euro(v)}</span></li>
                ))}
              </ul>
              <div className="pw-gj-sum"><span>Totali i ditës</span><span>{euro(stats.revenue)}</span></div>
            </div>
          )}
        </div>
      </div>
      <button className="pw-btn-ghost pw-block" onClick={() => dispatch({ type: 'toggleShift' })}>
        {state.shift.open ? 'Mbyll gjendjen' : 'Hap gjendjen'}
      </button>
    </div>
  );
}

function Reports({ stats }) {
  const [done, setDone] = useState(false);
  const month = periodTotals(stats).month;
  return (
    <div>
      <div className="pw-page-head"><h1 className="pw-title">Raportet</h1></div>
      <div className="pw-card pw-panel">
        <h2 className="pw-h">Krijo raport</h2>
        <p className="pw-hint" style={{ margin: '0 0 12px', lineHeight: 1.45 }}>Zgjidh periudhën dhe ruaj PDF me shitjet, pagesat dhe produktet.</p>
        <div className="pw-field-row">
          <label><span className="pw-hint">Nga</span><div className="pw-field">01.{String(new Date().getMonth() + 1).padStart(2, '0')}.{new Date().getFullYear()}</div></label>
          <label><span className="pw-hint">Deri</span><div className="pw-field">Sot</div></label>
        </div>
        <div className="pw-report-preview">
          <div><div className="pw-hint">Totali</div><div className="pw-report-total">{euro(month.total)}</div></div>
          <div><div className="pw-hint">Fatura</div><b>{month.count}</b></div>
        </div>
        <button className="pw-btn pw-block" onClick={() => setDone(true)}>{done ? '✓ Raporti u ruajt' : 'Krijo raportin PDF'}</button>
      </div>
    </div>
  );
}

function Account() {
  return (
    <div>
      <div className="pw-page-head"><h1 className="pw-title">Llogaria</h1></div>
      <div className="pw-card pw-panel">
        <ul className="pw-list">
          <li><span className="pw-meta">Biznesi</span><span>{BUSINESS}</span></li>
          <li><span className="pw-meta">Qyteti</span><span>{CITY}</span></li>
          <li><span className="pw-meta">Lloji</span><span>Kafiteri · Tavolina</span></li>
          <li><span className="pw-meta">Licenca</span><span className="pw-ok">Aktive · 516 ditë</span></li>
          <li><span className="pw-meta">Kompjuterë</span><span>1 arkë</span></li>
        </ul>
      </div>
      <button className="pw-btn-ghost pw-block">Ndrysho fjalëkalimin</button>
    </div>
  );
}

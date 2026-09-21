import { useEffect, useState } from 'react';
import Icon, { SellixMark } from './icons';
import { BUSINESS, PRODUCT_INDEX, hhmm, lineTotal, money, weekSeries } from './data';
import { selectStats, staffName } from './store';
import { Bars, useNow } from './charts';

const TABS = [
  ['home', 'Sot', 'home'],
  ['tables', 'Tavolinat', 'grid'],
  ['sales', 'Shitjet', 'receipt'],
  ['staff', 'Stafi', 'group'],
];

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

export default function PhoneApp({ state, dispatch }) {
  const now = useNow(15000);
  const [tab, setTab] = useState('home');
  const [banner, setBanner] = useState(null);
  const latest = state.notes[0];

  useEffect(() => {
    if (!latest) return undefined;
    setBanner(latest);
    const id = setTimeout(() => setBanner(null), 4200);
    return () => clearTimeout(id);
  }, [latest]);

  const stats = selectStats(state);

  return (
    <div className="ip-frame">
      <div className="ip-btn ip-btn-action" />
      <div className="ip-btn ip-btn-up" />
      <div className="ip-btn ip-btn-down" />
      <div className="ip-btn ip-btn-power" />
      <div className="ip-screen">
        <StatusBar now={now} />

        <div className={`ip-banner ${banner ? 'is-in' : ''}`} onClick={() => { setBanner(null); setTab(banner?.kind === 'pay' ? 'sales' : 'home'); }}>
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

        <div className="ip-content" key={tab}>
          {tab === 'home' && <Home state={state} stats={stats} dispatch={dispatch} />}
          {tab === 'tables' && <Tables state={state} stats={stats} />}
          {tab === 'sales' && <Sales state={state} stats={stats} />}
          {tab === 'staff' && <Staff state={state} stats={stats} />}
        </div>

        <nav className="ip-tabbar">
          {TABS.map(([id, label, icon]) => (
            <button key={id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
              <Icon name={icon} size={22} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <span className="ip-home" />
      </div>
    </div>
  );
}

function LargeTitle({ kicker, title, right }) {
  return (
    <div className="ip-largetitle">
      <div>
        <small>{kicker}</small>
        <h3>{title}</h3>
      </div>
      {right}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Mirëmëngjes' : h < 18 ? 'Mirëdita' : 'Mirëmbrëma';
}

function Home({ state, stats, dispatch }) {
  const week = weekSeries(stats.revenue);
  const yesterday = week.values[week.values.length - 2];
  const delta = yesterday ? ((stats.revenue - yesterday) / yesterday) * 100 : 0;
  return (
    <>
      <LargeTitle kicker={`${greeting()}, Admin`} title={BUSINESS} right={<span className="ip-live"><i /> Live</span>} />

      <div className="ip-hero">
        <small>Të ardhura sot</small>
        <b>{money(stats.revenue)}</b>
        <span className={`ip-delta ${delta < 0 ? 'is-down' : ''}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% nga dje</span>
        <Bars values={week.values} labels={week.labels} height={64} />
      </div>

      <div className="ip-kpis">
        <div className="ip-kpi"><small>Fitim</small><b className="tone-primary-text">{money(stats.profit)}</b></div>
        <div className="ip-kpi"><small>Bilanci i hapur</small><b>{money(stats.open)}</b></div>
        <div className="ip-kpi"><small>Porosi</small><b>{stats.orders}</b></div>
        <div className="ip-kpi"><small>Mesatarja</small><b>{money(stats.avg)}</b></div>
      </div>

      <div className="ip-group">
        <div className="ip-row">
          <span className={`ip-dot ${state.shift.open ? '' : 'is-off'}`} />
          <div className="ip-row-main"><b>Turni {state.shift.open ? 'hapur' : 'mbyllur'}</b><small>{state.shift.open ? 'Operacioni është aktiv' : 'Raporti u ruajt'}</small></div>
          <button className={`ip-mini-btn ${state.shift.open ? 'is-danger' : ''}`} onClick={() => dispatch({ type: 'toggleShift' })}>{state.shift.open ? 'Mbyll' : 'Hap'}</button>
        </div>
      </div>

      <div className="ip-section-title">Aktiviteti</div>
      <div className="ip-group">
        {state.notes.length === 0 && (
          <div className="ip-row ip-hint"><Icon name="bell" size={18} /><div className="ip-row-main"><small>Bëj një pagesë në POS dhe shiko njoftimin këtu.</small></div></div>
        )}
        {state.notes.slice(0, 4).map((n) => (
          <div key={n.id} className="ip-row">
            <span className={`ip-ic kind-${n.kind}`}><Icon name={{ pay: 'cash', order: 'print', staff: 'user', shift: 'clock', expense: 'wallet' }[n.kind]} size={16} /></span>
            <div className="ip-row-main"><b>{n.title}</b><small>{n.body}</small></div>
            <small className="ip-time-sm">{hhmm(new Date(n.at))}</small>
          </div>
        ))}
        {state.notes.length === 0 && [...state.sales].reverse().slice(0, 3).map((s) => (
          <div key={s.id} className="ip-row">
            <span className="ip-ic kind-pay"><Icon name="cash" size={16} /></span>
            <div className="ip-row-main"><b>Tavolina {s.table}</b><small>{staffName(state, s.waiter)}</small></div>
            <b className="ip-amount">{money(s.total)}</b>
          </div>
        ))}
      </div>
    </>
  );
}

function Tables({ state, stats }) {
  return (
    <>
      <LargeTitle kicker={`${stats.busy} të zëna · ${stats.free} të lira`} title="Tavolinat" />
      <div className="ip-hero ip-hero-sm">
        <small>Bilanci i hapur</small>
        <b>{money(stats.open)}</b>
      </div>
      <div className="ip-tables">
        {state.tables.map((t) => {
          const busy = Object.keys(t.items).length > 0;
          return (
            <div key={t.id} className={`ip-table ${busy ? 'is-busy' : ''}`}>
              <small>T{t.id}</small>
              <b>{busy ? money(lineTotal(t.items)) : 'E lirë'}</b>
              {busy && <em>{staffName(state, t.waiter).split(' ')[0]}</em>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Sales({ state, stats }) {
  const sales = [...state.sales].reverse();
  return (
    <>
      <LargeTitle kicker={`${stats.orders} fatura sot`} title="Shitjet" right={<b className="ip-total">{money(stats.revenue)}</b>} />
      <div className="ip-group">
        {sales.map((s) => (
          <div key={s.id} className="ip-row">
            <span className="ip-ic kind-pay"><Icon name="receipt" size={16} /></span>
            <div className="ip-row-main">
              <b>Tavolina {s.table} · {hhmm(new Date(s.at))}</b>
              <small>{Object.entries(s.items).map(([id, q]) => `${q}× ${PRODUCT_INDEX[id]?.n}`).join(', ')}</small>
            </div>
            <b className="ip-amount">{money(s.total)}</b>
          </div>
        ))}
      </div>
    </>
  );
}

function Staff({ state, stats }) {
  const max = Math.max(1, ...Object.values(stats.byWaiter));
  return (
    <>
      <LargeTitle kicker={`${state.staff.length} anëtarë`} title="Stafi" />
      <div className="ip-group">
        {state.staff.map((s) => {
          const v = stats.byWaiter[s.id] || 0;
          return (
            <div key={s.id} className="ip-row ip-staff">
              <span className={`ip-avatar ${s.role === 'manager' ? 'is-gold' : ''}`}>{s.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
              <div className="ip-row-main">
                <b>{s.name}{stats.top?.id === s.id && ' 🏆'}</b>
                <small>{s.role === 'manager' ? 'Menaxher' : 'Kamarier'}{s.wage ? ` · ${s.wage}€/ditë` : ''}</small>
                {s.role === 'waiter' && <span className="ip-meter"><i style={{ width: `${(v / max) * 100}%` }} /></span>}
              </div>
              {s.role === 'waiter' && <b className="ip-amount">{money(v)}</b>}
            </div>
          );
        })}
      </div>
    </>
  );
}

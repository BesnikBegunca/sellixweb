import { useMemo, useRef, useState } from 'react';
import Icon from './icons';
import { BUSINESS, CATEGORIES, PRODUCT_INDEX, hhmm, lineTotal, money, weekSeries } from './data';
import { selectStats, staffName } from './store';
import { LineChart, useNow } from './charts';
import { Brand } from './PosApp';

const NAV = [
  ['overview', 'Përmbledhje', 'dashboard'],
  ['gjendja', 'Gjendja', 'clock'],
  ['stafi', 'Stafi', 'group'],
  ['shitjet', 'Shitjet', 'receipt'],
  ['fitime', 'Fitime', 'trend'],
  ['menu', 'Menu', 'menu'],
  ['tavolinat', 'Tavolinat', 'grid'],
];

const TITLES = {
  overview: 'Përmbledhje', gjendja: 'Gjendja e turnit', stafi: 'Stafi', shitjet: 'Shitjet',
  fitime: 'Fitime', menu: 'Menu', tavolinat: 'Tavolinat',
};

export default function ManagerApp({ state, dispatch }) {
  const [collapsed, setCollapsed] = useState(false);
  const now = useNow(1000);
  const stats = selectStats(state);
  const tab = state.mgrTab;

  return (
    <div className={`sx-mgr ${collapsed ? 'is-collapsed' : ''}`}>
      <aside className="sx-side">
        <div className="sx-side-head">
          <Brand title={collapsed ? '' : 'Menaxher'} />
          <button className="sx-side-collapse" onClick={() => setCollapsed(!collapsed)} aria-label="Mblidh menunë">
            <Icon name="collapse" size={20} style={{ transform: collapsed ? 'scaleX(-1)' : 'none' }} />
          </button>
        </div>
        <nav className="sx-side-nav">
          {NAV.map(([id, label, icon]) => (
            <button key={id} className={tab === id ? 'is-on' : ''} onClick={() => dispatch({ type: 'mgrTab', tab: id })} title={label}>
              <Icon name={icon} size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sx-side-foot">
          <button onClick={() => dispatch({ type: 'go', screen: 'tables' })} title="Hap POS">
            <Icon name="table" size={18} /><span>Hap POS</span>
          </button>
          <button onClick={() => dispatch({ type: 'logout' })} title="Dil">
            <Icon name="logout" size={18} /><span>Dil</span>
          </button>
        </div>
      </aside>

      <div className="sx-mgr-main">
        <header className="sx-topbar">
          <div>
            <h2>{TITLES[tab]}</h2>
            <span>Manager Dashboard · POS System</span>
          </div>
          <div style={{ flex: 1 }} />
          <span className="sx-sync"><i /> <Icon name="cloud" size={16} /> Sinkronizuar</span>
          <span className="sx-timechip">
            <Icon name="clock" size={16} />
            <span><b>{hhmm(now)}</b><small>{now.toLocaleDateString('sq-AL')}</small></span>
          </span>
          <span className="sx-rolebadge"><Icon name="user" size={15} /> MENAXHER</span>
        </header>

        <div className="sx-mgr-body sx-scroll" key={tab}>
          {tab === 'overview' && <Overview state={state} stats={stats} dispatch={dispatch} now={now} />}
          {tab === 'gjendja' && <Gjendja state={state} stats={stats} dispatch={dispatch} />}
          {tab === 'stafi' && <Stafi state={state} stats={stats} dispatch={dispatch} />}
          {tab === 'shitjet' && <Shitjet state={state} stats={stats} />}
          {tab === 'fitime' && <Fitime stats={stats} />}
          {tab === 'menu' && <Menu state={state} dispatch={dispatch} />}
          {tab === 'tavolinat' && <TablesView state={state} stats={stats} dispatch={dispatch} />}
        </div>
      </div>
    </div>
  );
}

function PageHead({ icon, title, sub }) {
  return (
    <div className="sx-pagehead">
      <div className="sx-pagehead-row">
        <span className="sx-iconbox"><Icon name={icon} size={22} /></span>
        <h1>{title}</h1>
      </div>
      <p>{sub}</p>
    </div>
  );
}

function Kpi({ icon, tone = 'green', label, value, sub, big }) {
  return (
    <div className={`sx-card sx-kpi ${big ? 'is-big' : ''}`}>
      <span className={`sx-iconbox tone-${tone}`}><Icon name={icon} size={22} /></span>
      <div className="sx-kpi-label">{label}</div>
      <div className="sx-kpi-value">{value}</div>
      {sub && <div className="sx-kpi-sub">{sub}</div>}
    </div>
  );
}

/* ───────────── Overview ───────────── */

function Overview({ state, stats, dispatch, now }) {
  const week = weekSeries(stats.revenue);
  const go = (tab) => dispatch({ type: 'mgrTab', tab });
  const cats = new Set(state.products.map((p) => p.c)).size;
  return (
    <div className="sx-stack">
      <div className="sx-hero">
        <div>
          <div className="sx-hero-kicker">Përmbledhje e ditës</div>
          <div className="sx-hero-title">{BUSINESS}</div>
          <span className={`sx-hero-chip ${state.shift.open ? '' : 'is-off'}`}>{state.shift.open ? 'Turni hapur' : 'Turni mbyllur'}</span>
        </div>
        <div className="sx-hero-clock">
          <small>Ora aktuale</small>
          <b>{now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</b>
        </div>
      </div>

      <div className="sx-grid-4">
        <Kpi big icon="print" tone="green" label="Të ardhura sot" value={money(stats.revenue)} sub="Shitjet e ditës aktuale" />
        <Kpi big icon="trend" tone="gold" label="Fitim sot" value={money(stats.profit)} sub="Pas shpenzimeve" />
        <Kpi big icon="wallet" tone="blue" label="Bilanci i hapur" value={money(stats.open)} sub={stats.busy ? `${stats.busy} tavolina të zëna` : 'Asnjë tavolinë e zënë'} />
        <Kpi big icon="clock" tone="green" label="Turni" value={state.shift.open ? 'Hapur' : 'Mbyllur'} sub={state.shift.open ? 'Operacioni është aktiv' : 'Raporti u ruajt'} />
      </div>

      <section className="sx-card sx-section">
        <h3>Pamja operative</h3>
        <p className="sx-muted">Gjendja e stafit, tavolinave dhe menusë — kliko për të hapur seksionin.</p>
        <div className="sx-grid-4 sx-grid-tight">
          <OpTile icon="group" label="Stafi" value={state.staff.length} sub="Staf i regjistruar" onClick={() => go('stafi')} />
          <OpTile icon="cash" tone="red" label="Shpenzime" value={money(stats.expenses)} sub="Totali i shpenzimeve" onClick={() => go('gjendja')} />
          <OpTile icon="bars" tone="gold" label="Fitim javor" value={money(week.values.reduce((a, b) => a + b, 0))} sub="7 ditët e fundit" onClick={() => go('fitime')} />
          <OpTile icon="table" label="Tavolina" value={`${stats.free} lira`} sub={`${stats.busy} të zëna · ${Math.round((stats.busy / state.tables.length) * 100)}%`} onClick={() => go('tavolinat')} />
          <OpTile icon="cocktail" label="Menu" value={`${state.products.length} produkte`} sub={`${cats} kategori`} onClick={() => go('menu')} />
          <OpTile icon="trophy" tone="gold" label="Top kamarier" value={stats.top?.name || '—'} sub={stats.top ? money(stats.top.total) : ''} onClick={() => go('shitjet')} />
        </div>
      </section>

      <div className="sx-grid-2-1">
        <section className="sx-card sx-section">
          <div className="sx-section-head">
            <h3>Shitjet e 7 ditëve</h3>
            <span className="sx-pill">{money(week.values.reduce((a, b) => a + b, 0))}</span>
          </div>
          <LineChart values={week.values} labels={week.labels} height={210} />
        </section>
        <section className="sx-card sx-section">
          <div className="sx-section-head">
            <h3>Tavolinat tani</h3>
            <button className="sx-link" onClick={() => go('tavolinat')}>Të gjitha</button>
          </div>
          <div className="sx-mini-tables">
            {state.tables.slice(0, 12).map((t) => {
              const busy = Object.keys(t.items).length > 0;
              return (
                <div key={t.id} className={`sx-mini-table ${busy ? 'is-busy' : ''}`}>
                  <b>{t.id}</b>
                  <span>{busy ? money(lineTotal(t.items)) : 'e lirë'}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function OpTile({ icon, tone = 'green', label, value, sub, onClick }) {
  return (
    <button className="sx-optile" onClick={onClick}>
      <span className={`sx-iconbox sm tone-${tone}`}><Icon name={icon} size={20} /></span>
      <span className="sx-optile-text">
        <small>{label}</small>
        <b>{value}</b>
        <em>{sub}</em>
      </span>
      <Icon name="chevron" size={20} className="sx-optile-chev" />
    </button>
  );
}

/* ───────────── Gjendja ───────────── */

function Gjendja({ state, stats, dispatch }) {
  const [report, setReport] = useState(false);
  const [exp, setExp] = useState({ n: '', v: '' });
  const at = new Date(state.shift.at);
  const addExpense = (e) => {
    e.preventDefault();
    const v = parseFloat(exp.v);
    if (!exp.n.trim() || !(v > 0)) return dispatch({ type: 'toast', text: 'Shkruaj përshkrimin dhe shumën', tone: 'bad' });
    dispatch({ type: 'addExpense', n: exp.n.trim(), v });
    setExp({ n: '', v: '' });
  };
  return (
    <div className="sx-stack">
      <PageHead icon="clock" title="Gjendja" sub="Hap, shtyp ose mbyll turne operative." />
      <div className="sx-shift-row">
        <div className={`sx-card sx-shift ${state.shift.open ? 'is-open' : ''}`}>
          <span className="sx-shift-ic"><Icon name={state.shift.open ? 'play' : 'stop'} size={30} /></span>
          <div>
            <span className={`sx-status ${state.shift.open ? '' : 'is-off'}`}><i /> {state.shift.open ? 'E HAPUR' : 'E MBYLLUR'}</span>
            <h3>{state.shift.open ? 'Gjendja aktive' : 'Gjendja e mbyllur'}</h3>
            <span className="sx-muted">{state.shift.open ? 'Hapur' : 'Mbyllur'}: {at.toLocaleDateString('sq-AL')} {hhmm(at)}</span>
          </div>
        </div>
        <div className="sx-shift-actions">
          <button className="sx-btn-primary" onClick={() => setReport(true)}><Icon name="print" size={18} /> Shtyp gjendjen</button>
          <button className={state.shift.open ? 'sx-btn-danger' : 'sx-btn-outline'} onClick={() => dispatch({ type: 'toggleShift' })}>
            <Icon name={state.shift.open ? 'stop' : 'play'} size={18} /> {state.shift.open ? 'Mbyll gjendjen' : 'Hap gjendjen'}
          </button>
        </div>
      </div>

      <div className="sx-grid-3">
        <Kpi icon="print" tone="gold" label="Shitje" value={money(stats.revenue)} sub={`${stats.orders} porosi`} />
        <Kpi icon="cash" tone="red" label="Shpenzime" value={money(stats.expenses)} sub={`${state.expenses.length} regjistrime`} />
        <Kpi icon="trend" tone="green" label="Fitimi" value={money(stats.profit)} sub="Shitje − shpenzime" />
      </div>

      <section className="sx-card sx-section">
        <h3>Shpenzimet e turnit</h3>
        <form className="sx-inline-form" onSubmit={addExpense}>
          <input className="sx-input" placeholder="p.sh. Akull, qumësht, furnitor…" value={exp.n} onChange={(e) => setExp({ ...exp, n: e.target.value })} />
          <input className="sx-input sx-input-sm" placeholder="0.00" inputMode="decimal" value={exp.v} onChange={(e) => setExp({ ...exp, v: e.target.value.replace(',', '.') })} />
          <button className="sx-btn-primary" type="submit"><Icon name="plus" size={18} /> Shto</button>
        </form>
        <div className="sx-list">
          {state.expenses.map((x) => (
            <div key={x.id} className="sx-list-row"><span>{x.n}</span><b className="tone-red-text">−{money(x.v)}</b></div>
          ))}
        </div>
      </section>

      {report && (
        <div className="sx-modal-back" onClick={() => setReport(false)}>
          <div className="sx-receipt" onClick={(e) => e.stopPropagation()}>
            <div className="sx-receipt-paper">
              <b>{BUSINESS.toUpperCase()}</b>
              <span>RAPORTI I GJENDJES</span>
              <span>{new Date().toLocaleString('sq-AL')}</span>
              <hr />
              {Object.entries(stats.byWaiter).map(([id, v]) => (
                <div key={id} className="sx-receipt-row"><span>{staffName(state, id)}</span><span>{money(v)}</span></div>
              ))}
              <hr />
              <div className="sx-receipt-row"><span>Porosi</span><span>{stats.orders}</span></div>
              <div className="sx-receipt-row"><span>Shitje</span><span>{money(stats.revenue)}</span></div>
              <div className="sx-receipt-row"><span>Shpenzime</span><span>−{money(stats.expenses)}</span></div>
              <hr />
              <div className="sx-receipt-row is-total"><span>FITIMI</span><span>{money(stats.profit)}</span></div>
              <span className="sx-receipt-foot">SelliX POS · faleminderit</span>
            </div>
            <button className="sx-btn-primary" onClick={() => setReport(false)}>Mbyll</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── Stafi ───────────── */

function Stafi({ state, stats, dispatch }) {
  const [form, setForm] = useState({ role: 'waiter', name: '', pin: '', wage: '' });
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState({});
  const waiters = state.staff.filter((s) => s.role === 'waiter').length;

  const submit = (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return dispatch({ type: 'toast', text: 'Shkruaj emrin e plotë', tone: 'bad' });
    if (!/^\d{4,6}$/.test(form.pin)) return dispatch({ type: 'toast', text: 'PIN duhet të ketë 4–6 shifra', tone: 'bad' });
    dispatch({ type: 'addStaff', member: { role: form.role, name: form.name.trim(), pin: form.pin, wage: parseFloat(form.wage) || 0 } });
    setForm({ role: form.role, name: '', pin: '', wage: '' });
  };

  const list = state.staff
    .filter((s) => filter === 'all' || s.role === filter)
    .filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="sx-stack">
      <PageHead icon="group" title="Stafi" sub="Kamarierët dhe menaxherët në një vend. Anëtari i ri mund të hyjë menjëherë me PIN-in e tij." />
      <div className="sx-grid-3">
        <Kpi icon="group" label="Gjithsej" value={state.staff.length} />
        <Kpi icon="receipt" tone="blue" label="Kamarierë" value={waiters} />
        <Kpi icon="shield" tone="gold" label="Menaxherë" value={state.staff.length - waiters} />
      </div>

      <section className="sx-card sx-addcard">
        <div className="sx-addcard-head">
          <span className="sx-iconbox solid"><Icon name="user" size={22} /></span>
          <div>
            <h3>Shto anëtar</h3>
            <p>Zgjidh rolin, pastaj emrin dhe PIN-in e hyrjes.</p>
          </div>
        </div>
        <form className="sx-addcard-form" onSubmit={submit}>
          <label>Roli
            <select className="sx-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="waiter">Kamarier</option>
              <option value="manager">Menaxher</option>
            </select>
          </label>
          <label className="grow">Emri i plotë
            <input className="sx-input" placeholder="p.sh. Arta Krasniqi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>Kodi PIN
            <input className="sx-input" placeholder="••••" inputMode="numeric" maxLength={6} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} />
            <small>Minimum 4 shifra.</small>
          </label>
          <label>Rroga (€/ditë)
            <input className="sx-input" placeholder="0.00" inputMode="decimal" value={form.wage} onChange={(e) => setForm({ ...form, wage: e.target.value.replace(',', '.') })} />
            <small>Opsionale.</small>
          </label>
          <button className="sx-btn-primary" type="submit"><Icon name="plus" size={18} /> Shto anëtar</button>
        </form>
      </section>

      <section className="sx-card sx-stafflist">
        <div className="sx-stafflist-tools">
          <div className="sx-search"><Icon name="search" size={20} /><input placeholder="Kërko emrin…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {[['all', 'Të gjithë'], ['waiter', 'Kamarierë'], ['manager', 'Menaxherë']].map(([id, l]) => (
            <button key={id} className={`sx-filter ${filter === id ? 'is-on' : ''}`} onClick={() => setFilter(id)}>{l}</button>
          ))}
        </div>
        {list.map((s) => {
          const initials = s.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
          return (
            <div key={s.id} className="sx-staff">
              <span className={`sx-avatar ${s.role === 'manager' ? 'is-gold' : ''}`}>{initials}</span>
              <div className="sx-staff-info">
                <b>{s.name}</b>
                <div>
                  <span className={`sx-role ${s.role === 'manager' ? 'is-gold' : ''}`}>{s.role === 'manager' ? 'Menaxher' : 'Kamarier'}</span>
                  <span className="sx-muted">PIN: {shown[s.id] ? s.pin : '••••'}</span>
                  <button className="sx-eye" onClick={() => setShown({ ...shown, [s.id]: !shown[s.id] })} aria-label="Shfaq PIN"><Icon name="eye" size={16} /></button>
                </div>
              </div>
              {stats.byWaiter[s.id] > 0 && <span className="sx-muted">Sot: <b className="sx-strong">{money(stats.byWaiter[s.id])}</b></span>}
              {s.wage > 0 && <span className="sx-pill">{s.wage}€/d</span>}
              <button className="sx-trash" disabled={s.id === state.user?.id} onClick={() => dispatch({ type: 'removeStaff', id: s.id })} aria-label="Fshij"><Icon name="trash" size={20} /></button>
            </div>
          );
        })}
        {!list.length && <div className="sx-muted sx-empty">Asnjë rezultat.</div>}
      </section>
    </div>
  );
}

/* ───────────── Shitjet ───────────── */

function Shitjet({ state, stats }) {
  const sales = [...state.sales].reverse();
  return (
    <div className="sx-stack">
      <PageHead icon="receipt" title="Shitjet" sub="Çdo faturë e paguar shfaqet këtu në kohë reale — provo një pagesë nga POS-i." />
      <div className="sx-grid-3">
        <Kpi icon="receipt" label="Porosi sot" value={stats.orders} />
        <Kpi icon="cash" tone="gold" label="Shitje" value={money(stats.revenue)} />
        <Kpi icon="bars" tone="blue" label="Mesatarja / faturë" value={money(stats.avg)} />
      </div>
      <section className="sx-card sx-table-card">
        <div className="sx-trow sx-thead"><span>#</span><span>Ora</span><span>Tavolina</span><span>Kamarieri</span><span>Artikuj</span><span>Totali</span></div>
        {sales.map((s, i) => (
          <div key={s.id} className={`sx-trow ${i === 0 && !s.id.startsWith('seed') ? 'is-new' : ''}`}>
            <span className="sx-muted">{String(s.no).padStart(3, '0')}</span>
            <span>{hhmm(new Date(s.at))}</span>
            <span>Tavolina {s.table}</span>
            <span>{staffName(state, s.waiter)}</span>
            <span className="sx-muted sx-ellipsis">{Object.entries(s.items).map(([id, q]) => `${q}× ${PRODUCT_INDEX[id]?.n}`).join(', ')}</span>
            <b>{money(s.total)}</b>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ───────────── Fitime ───────────── */

function Fitime({ stats }) {
  const [range, setRange] = useState('week');
  const week = weekSeries(stats.profit);
  const series = useMemo(() => {
    if (range === 'day') {
      const hours = ['08', '10', '12', '14', '16', '18', '20'];
      const base = [4, 18, 26, 21, 30, 38, 22];
      const sum = base.reduce((a, b) => a + b, 0);
      return { values: base.map((b) => (b / sum) * Math.max(stats.profit, 0)), labels: hours.map((h) => `${h}:00`) };
    }
    if (range === 'month') {
      const vals = [288, 331, 362, 405, Math.max(0, stats.profit) + 310];
      return { values: vals, labels: ['Jav 1', 'Jav 2', 'Jav 3', 'Jav 4', 'Tani'] };
    }
    return { values: week.values.map((v, i) => (i === week.values.length - 1 ? Math.max(0, stats.profit) : v * 0.84)), labels: week.labels };
  }, [range, stats.profit, week.labels, week.values]);
  const total = series.values.reduce((a, b) => a + b, 0);
  const margin = stats.revenue ? (stats.profit / stats.revenue) * 100 : 0;

  return (
    <div className="sx-stack">
      <PageHead icon="trend" title="Fitime" sub="Fitimi = shitje − shpenzime, sipas periudhës." />
      <div className="sx-grid-4">
        <Kpi icon="cash" tone="gold" label="Fitim Ditor" value={money(stats.profit)} />
        <Kpi icon="trend" tone="gold" label="Fitim Javor" value={money(week.values.slice(0, -1).reduce((a, b) => a + b * 0.84, 0) + stats.profit)} />
        <Kpi icon="clock" tone="gold" label="Fitim Mujor" value={money(1386 + stats.profit)} />
        <Kpi icon="bars" tone="green" label="Shitje Gjithsej" value={money(stats.revenue)} />
      </div>
      <div className="sx-grid-2-1">
        <section className="sx-card sx-section">
          <div className="sx-section-head">
            <h3>Trendi i Fitimit</h3>
            <div className="sx-seg">
              {[['day', 'Ditore'], ['week', 'Javore'], ['month', 'Mujore']].map(([id, l]) => (
                <button key={id} className={range === id ? 'is-on' : ''} onClick={() => setRange(id)}>{l}</button>
              ))}
            </div>
          </div>
          <LineChart values={series.values} labels={series.labels} height={250} />
        </section>
        <div className="sx-stack-sm">
          <div className="sx-card sx-section">
            <div className="sx-kpi-label">Mesatare</div>
            <div className="sx-kpi-value tone-primary-text">{money(total / series.values.length)}</div>
          </div>
          <div className="sx-card sx-section">
            <h4>Ndarja</h4>
            <div className="sx-list-row"><span className="sx-muted">Të Ardhura</span><b>{money(stats.revenue)}</b></div>
            <div className="sx-list-row"><span className="sx-muted">Kosto</span><b>{money(stats.expenses)}</b></div>
            <div className="sx-list-row is-hl"><span>Fitimi</span><b>{money(stats.profit)}</b></div>
          </div>
          <div className="sx-card sx-section">
            <h4>Marzhi</h4>
            <div className="sx-kpi-value tone-primary-text">{margin.toFixed(0)}%</div>
            <div className="sx-meter"><i style={{ width: `${Math.max(0, Math.min(100, margin))}%` }} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Menu ───────────── */

function Menu({ state, dispatch }) {
  const [cat, setCat] = useState('kafe');
  const [form, setForm] = useState({ n: '', p: '', c: 'kafe', img: '' });
  const [q, setQ] = useState('');
  const fileRef = useRef(null);
  const counts = {};
  for (const p of state.products) counts[p.c] = (counts[p.c] || 0) + 1;
  const products = state.products.filter((p) => (q ? p.n.toLowerCase().includes(q.toLowerCase()) : p.c === cat));

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (f) setForm({ ...form, img: URL.createObjectURL(f) });
  };
  const submit = (e) => {
    e.preventDefault();
    const price = parseFloat(form.p);
    if (!form.n.trim() || !(price > 0)) return dispatch({ type: 'toast', text: 'Shkruaj emrin dhe çmimin', tone: 'bad' });
    dispatch({ type: 'addProduct', product: { n: form.n.trim(), p: price, c: form.c, img: form.img } });
    setCat(form.c);
    setForm({ n: '', p: '', c: form.c, img: '' });
  };

  return (
    <div className="sx-stack">
      <div className="sx-grid-3">
        <Kpi icon="grid" label="Kategori" value={CATEGORIES.length} />
        <Kpi icon="menu" tone="blue" label="Produkte" value={state.products.length} />
        <Kpi icon="coffee" tone="gold" label={CATEGORIES.find((c) => c.id === cat)?.n} value={counts[cat] || 0} />
      </div>

      <section className="sx-card sx-addcard">
        <div className="sx-addcard-head">
          <span className="sx-iconbox solid"><Icon name="cocktail" size={22} /></span>
          <div>
            <h3>Pije e re</h3>
            <p>Vendos foton, emrin dhe çmimin — pastaj shtohet direkt në POS.</p>
          </div>
        </div>
        <form className="sx-menu-form" onSubmit={submit}>
          <button type="button" className="sx-photo" onClick={() => fileRef.current?.click()}>
            {form.img ? <img src={form.img} alt="" /> : (
              <>
                <span className="sx-iconbox solid"><Icon name="photo" size={24} /></span>
                <b>Shto foton e pijes</b>
                <small>Kliko këtu · PNG, JPG, WEBP</small>
              </>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
          <div className="sx-menu-fields">
            <label>Emri i pijes
              <input className="sx-input" placeholder="p.sh. Espresso, Mojito, Heineken" value={form.n} onChange={(e) => setForm({ ...form, n: e.target.value })} />
            </label>
            <div className="sx-row-2">
              <label>Çmimi
                <input className="sx-input" placeholder="0.00" inputMode="decimal" value={form.p} onChange={(e) => setForm({ ...form, p: e.target.value.replace(',', '.') })} />
              </label>
              <label>Kategoria
                <select className="sx-input" value={form.c} onChange={(e) => setForm({ ...form, c: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.n}</option>)}
                </select>
              </label>
            </div>
            <button className="sx-btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}><Icon name="plus" size={18} /> Shto pijen në menu</button>
          </div>
        </form>
      </section>

      <div className="sx-menu-split">
        <section className="sx-card sx-section">
          <h3>Kategoritë</h3>
          <p className="sx-muted">Zgjidh një kategori.</p>
          <div className="sx-catlist">
            {CATEGORIES.map((c) => (
              <button key={c.id} className={cat === c.id && !q ? 'is-on' : ''} onClick={() => { setCat(c.id); setQ(''); }}>
                <Icon name={c.icon} size={18} /> <span>{c.n}</span> <em>{counts[c.id] || 0}</em>
              </button>
            ))}
          </div>
        </section>
        <div className="sx-stack-sm">
          <div className="sx-search sx-card"><Icon name="search" size={20} /><input placeholder="Kërko produkt…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="sx-menu-grid">
            {products.map((p) => (
              <div key={p.id} className="sx-menu-item">
                <div className="sx-menu-img">{p.img ? <img src={p.img} alt="" /> : <Icon name="coffee" size={34} />}</div>
                <b>{p.n}</b>
                <span>{money(p.p)}</span>
                <button className="sx-trash" onClick={() => dispatch({ type: 'removeProduct', id: p.id })} aria-label="Fshij"><Icon name="trash" size={18} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Tables ───────────── */

function TablesView({ state, stats, dispatch }) {
  return (
    <div className="sx-stack">
      <PageHead icon="grid" title="Tavolinat" sub="Pamje live e sallës. Kliko një tavolinë për ta hapur në POS." />
      <div className="sx-grid-3">
        <Kpi icon="table" label="Të lira" value={stats.free} />
        <Kpi icon="table" tone="red" label="Të zëna" value={stats.busy} />
        <Kpi icon="wallet" tone="blue" label="Bilanci i hapur" value={money(stats.open)} />
      </div>
      <div className="sx-mgr-tables">
        {state.tables.map((t) => {
          const busy = Object.keys(t.items).length > 0;
          return (
            <button key={t.id} className={`sx-card sx-mgr-table ${busy ? 'is-busy' : ''}`} onClick={() => dispatch({ type: 'openTable', id: t.id })}>
              <div className="sx-table-head">
                <b>Tavolina {t.id}</b>
                <span className={`sx-badge ${busy ? 'is-busy' : ''}`}>{busy ? 'E zënë' : 'E lirë'}</span>
              </div>
              <div className="sx-mgr-table-val">{busy ? money(lineTotal(t.items)) : '—'}</div>
              <span className="sx-muted">{busy ? staffName(state, t.waiter) : 'Nuk ka porosi aktive'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

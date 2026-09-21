import { useEffect, useMemo, useState } from 'react';
import Icon, { SellixMark } from './icons';
import { BUSINESS, CATEGORIES, PRODUCT_INDEX, longDate, lineTotal, money } from './data';
import { staffName } from './store';
import { useNow } from './charts';
import ManagerApp from './ManagerApp';

export default function PosApp({ state, dispatch }) {
  if (state.screen === 'pin' || !state.user) return <PinScreen dispatch={dispatch} staff={state.staff} />;
  if (state.screen === 'manager') return <ManagerApp state={state} dispatch={dispatch} />;
  if (state.screen === 'order' && state.table) return <OrderScreen state={state} dispatch={dispatch} />;
  return <TablesScreen state={state} dispatch={dispatch} />;
}

export function Brand({ title }) {
  return (
    <div className="sx-brand">
      <SellixMark size={20} />
      <b>SelliX</b>
      {title && <span>{title}</span>}
    </div>
  );
}

function AppHeader({ title, onBack, user }) {
  const now = useNow(30000);
  return (
    <header className="sx-apphead">
      <button className="sx-iconbtn" onClick={onBack} aria-label="Kthehu"><Icon name="back" /></button>
      <Brand title={title} />
      <div className="sx-apphead-date">{longDate(now)}</div>
      <div className="sx-userchip">
        <span className="sx-avatar-ic"><Icon name="user" size={18} /></span>
        {user?.name}
      </div>
    </header>
  );
}

/* ───────────── PIN + change calculator ───────────── */

function PinScreen({ dispatch, staff }) {
  const now = useNow(1000);
  const [pin, setPin] = useState('');
  const [bad, setBad] = useState(false);

  const submit = (value = pin) => {
    if (staff.some((s) => s.pin === value)) {
      dispatch({ type: 'login', pin: value });
    } else {
      setBad(true);
      setTimeout(() => setBad(false), 500);
      setPin('');
    }
  };

  const press = (k) => {
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (k === 'ok') return submit();
    setPin((p) => {
      const next = (p + k).slice(0, 6);
      if (next.length === 4 && staff.some((s) => s.pin === next)) setTimeout(() => submit(next), 120);
      return next;
    });
  };

  return (
    <div className="sx-pin">
      <div className="sx-pin-license">Licenca juaj skadon: 516 ditë</div>
      <div className="sx-pin-head">
        <SellixMark size={40} />
        <b className="sx-pin-logo">SelliX</b>
        <div>
          <div className="sx-pin-biz">{BUSINESS}</div>
          <div className="sx-pin-sub">Sistem i shpejtë dhe i thjeshtë për menaxhim restoranti</div>
        </div>
      </div>

      <div className="sx-pin-body">
        <section className="sx-card sx-pin-card">
          <div className="sx-pin-title">
            <h3>Shkruaj PIN</h3>
            <div className="sx-pin-hints">
              <button onClick={() => submit('1234')}>Kamarier · 1234</button>
              <button onClick={() => submit('0000')}>Menaxher · 0000</button>
            </div>
          </div>
          <div className={`sx-pin-field ${bad ? 'is-bad' : ''} ${pin ? 'has-value' : ''}`}>
            {pin ? pin.replace(/./g, '•') : 'P I N'}
          </div>
          <div className="sx-pin-pad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
              <button key={k} className="sx-key" onClick={() => press(k)}>{k}</button>
            ))}
            <button className="sx-key sx-key-del" onClick={() => press('del')} aria-label="Fshij"><Icon name="backspace" size={26} /></button>
            <button className="sx-key" onClick={() => press('0')}>0</button>
            <button className={`sx-key sx-key-ok ${pin.length >= 4 ? 'is-ready' : ''}`} onClick={() => press('ok')} aria-label="Hyr"><Icon name="check" size={28} /></button>
          </div>
        </section>
        <ChangeCalculator />
      </div>

      <div className="sx-pin-clock">{now.toLocaleTimeString('sq-AL', { hour12: false })}</div>
      <button className="sx-pin-exit" aria-label="Dil" onClick={() => setPin('')}><Icon name="logout" size={30} /></button>
    </div>
  );
}

function ChangeCalculator() {
  const [bill, setBill] = useState('');
  const [paid, setPaid] = useState('');
  const [field, setField] = useState('bill');
  const set = field === 'bill' ? setBill : setPaid;

  const press = (k) => {
    if (k === 'AC') { setBill(''); setPaid(''); setField('bill'); return; }
    if (k === 'Enter') { setField(field === 'bill' ? 'paid' : 'bill'); return; }
    set((v) => {
      if (k === '.' && v.includes('.')) return v;
      if (v.includes('.') && v.split('.')[1].length >= 2) return v;
      return (v === '0' && k !== '.' ? '' : v) + k;
    });
  };
  const b = parseFloat(bill) || 0;
  const p = parseFloat(paid) || 0;
  const change = p - b;

  return (
    <section className="sx-card sx-calc">
      <div className="sx-calc-left">
        <h4>Llogaritësi i Kusurit</h4>
        <label>Shuma e Faturës</label>
        <button className={`sx-calc-field ${field === 'bill' ? 'is-on' : ''}`} onClick={() => setField('bill')}>{bill || '0.00'}€</button>
        <label>Pagoi Klienti</label>
        <button className={`sx-calc-field ${field === 'paid' ? 'is-on' : ''}`} onClick={() => setField('paid')}>{paid || '0.00'}€</button>
        <div className="sx-calc-sep" />
        <label>Kusuri</label>
        <div className={`sx-calc-result ${change < 0 ? 'is-neg' : change > 0 ? 'is-pos' : ''}`}>{money(Math.max(0, change))}</div>
        {change < 0 && p > 0 && <div className="sx-calc-warn">Mungojnë {money(-change)}</div>}
      </div>
      <div className="sx-calc-pad">
        <button className="sx-calc-ac" onClick={() => press('AC')}>AC</button>
        {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((k) => (
          <button key={k} className="sx-ckey" onClick={() => press(k)}>{k}</button>
        ))}
        <button className="sx-ckey" onClick={() => press('.')}>.</button>
        <button className="sx-ckey sx-ckey-wide" onClick={() => press('0')}>0</button>
        <button className="sx-calc-enter" onClick={() => press('Enter')}>Enter</button>
      </div>
    </section>
  );
}

/* ───────────── Tables ───────────── */

function TablesScreen({ state, dispatch }) {
  const [always, setAlways] = useState(false);
  const total = state.tables.reduce((s, t) => s + lineTotal(t.items), 0);
  const busy = state.tables.filter((t) => Object.keys(t.items).length).length;

  return (
    <div className="sx-screen">
      <AppHeader title="Tavolinat" user={state.user} onBack={() => dispatch(state.user.role === 'manager' ? { type: 'go', screen: 'manager' } : { type: 'logout' })} />
      <div className="sx-scroll sx-pad">
        <div className="sx-tables-top">
          <div>
            <div className="sx-muted">Totali i të gjitha tavolinave</div>
            <div className="sx-tables-total">{money(total)}</div>
          </div>
          <span className="sx-pill">{busy ? `${busy} të zëna · ${state.tables.length - busy} të lira` : 'Të gjitha të lira'}</span>
          <div style={{ flex: 1 }} />
          <label className="sx-switch-row">
            Always open
            <button className={`sx-switch ${always ? 'is-on' : ''}`} onClick={() => setAlways(!always)} aria-pressed={always}><i /></button>
          </label>
        </div>

        <div className="sx-tables-grid">
          {state.tables.map((t) => {
            const entries = Object.entries(t.items);
            const sum = lineTotal(t.items);
            const isBusy = entries.length > 0;
            return (
              <button key={t.id} className={`sx-table ${isBusy ? 'is-busy' : ''}`} onClick={() => dispatch({ type: 'openTable', id: t.id })}>
                <div className="sx-table-head">
                  <b>Tavolina {t.id}</b>
                  <span className={`sx-badge ${isBusy ? 'is-busy' : ''}`}>{isBusy ? 'E zënë' : 'E lirë'}</span>
                </div>
                {isBusy ? (
                  <>
                    <ul className="sx-table-items">
                      {entries.slice(0, 3).map(([id, q]) => (
                        <li key={id}><span>{q}× {PRODUCT_INDEX[id]?.n}</span></li>
                      ))}
                      {entries.length > 3 && <li className="sx-muted">+{entries.length - 3} të tjera</li>}
                    </ul>
                    <div className="sx-table-foot">
                      <span>{staffName(state, t.waiter)}</span>
                      <b>{money(sum)}</b>
                    </div>
                  </>
                ) : (
                  <div className="sx-muted sx-table-empty">Nuk ka porosi aktive</div>
                )}
              </button>
            );
          })}
          <button className="sx-table sx-table-add" onClick={() => dispatch({ type: 'addTable' })} aria-label="Shto tavolinë">
            <span><Icon name="plus" size={30} /></span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Order ───────────── */

function OrderScreen({ state, dispatch }) {
  const [cat, setCat] = useState('kafe');
  const [paying, setPaying] = useState(false);
  const table = state.tables.find((t) => t.id === state.table);
  const items = Object.entries(table?.items || {});
  const total = lineTotal(table?.items || {});
  const products = state.products.filter((p) => p.c === cat);
  const counts = useMemo(() => {
    const c = {};
    for (const p of state.products) c[p.c] = (c[p.c] || 0) + 1;
    return c;
  }, [state.products]);

  const add = (pid) => {
    dispatch({ type: 'add', table: table.id, pid });
  };

  return (
    <div className="sx-screen">
      <AppHeader title="Porosia" user={state.user} onBack={() => dispatch({ type: 'go', screen: 'tables', table: null })} />
      <div className="sx-order">
        <div className="sx-order-main sx-scroll">
          <div className="sx-cats">
            {CATEGORIES.map((c) => (
              <button key={c.id} className={`sx-cat ${cat === c.id ? 'is-on' : ''}`} onClick={() => setCat(c.id)}>
                <b>{c.n}</b>
                <span>{counts[c.id] || 0} items</span>
              </button>
            ))}
          </div>
          <div className="sx-products">
            {products.map((p) => (
              <div key={p.id} className="sx-product" onClick={() => add(p.id)} role="button" tabIndex={0}>
                <div className="sx-product-img">
                  {p.img ? <img src={p.img} alt="" loading="lazy" draggable="false" /> : <Icon name="coffee" size={40} />}
                </div>
                <div className="sx-product-foot">
                  <div>
                    <div className="sx-product-name">{p.n}</div>
                    <div className="sx-product-price">{money(p.p)}</div>
                  </div>
                  <button className="sx-plus" onClick={(e) => { e.stopPropagation(); add(p.id); }} aria-label={`Shto ${p.n}`}><Icon name="plus" size={18} /></button>
                </div>
                {table?.items[p.id] > 0 && <span className="sx-product-qty">{table.items[p.id]}</span>}
              </div>
            ))}
          </div>
        </div>

        <aside className="sx-card sx-cart">
          <h3>Porosia aktuale</h3>
          <div className="sx-cart-meta">
            <span className="sx-muted">#{String(state.orderNo + 1).padStart(2, '0')}</span>
            <span className="sx-chip-primary"><Icon name="table" size={16} /> Tavolina {table?.id}</span>
          </div>
          <div className="sx-cart-list sx-scroll">
            {items.length === 0 && (
              <div className="sx-cart-empty">
                <Icon name="receipt" size={34} />
                <span>Kliko një produkt për ta shtuar në porosi</span>
              </div>
            )}
            {items.map(([pid, q]) => {
              const p = PRODUCT_INDEX[pid];
              return (
                <div key={pid} className="sx-line">
                  <div className="sx-line-img">{p?.img && <img src={p.img} alt="" />}</div>
                  <div className="sx-line-info">
                    <b>{p?.n}</b>
                    <span>{money(p?.p || 0)}</span>
                  </div>
                  <div className="sx-stepper">
                    <button onClick={() => dispatch({ type: 'dec', table: table.id, pid })} aria-label="Hiq"><Icon name="minus" size={16} /></button>
                    <b key={q} className="sx-pop">{q}</b>
                    <button onClick={() => dispatch({ type: 'add', table: table.id, pid })} aria-label="Shto"><Icon name="plus" size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sx-cart-total">
            <span>Totali</span>
            <b>{money(total)}</b>
          </div>
          <button className="sx-btn-primary sx-btn-lg" disabled={!items.length} onClick={() => dispatch({ type: 'print', table: table.id })}>
            {table?.printed ? 'PRINTUAR ✓' : 'PRINTO'}
          </button>
          <button className="sx-btn-outline sx-btn-lg" disabled={!items.length} onClick={() => setPaying(true)}>
            <Icon name="cash" size={20} /> PAGUAJ
          </button>
        </aside>
      </div>
      {paying && <PayModal total={total} table={table.id} onClose={() => setPaying(false)} onPay={() => { setPaying(false); dispatch({ type: 'pay', table: table.id }); }} />}
    </div>
  );
}

function PayModal({ total, table, onClose, onPay }) {
  const [given, setGiven] = useState(null);
  const options = [total, 5, 10, 20, 50].filter((v, i, a) => v >= total && a.indexOf(v) === i);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const change = given != null ? given - total : 0;

  return (
    <div className="sx-modal-back" onClick={onClose}>
      <div className="sx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sx-modal-kicker">Pagesa · Tavolina {table}</div>
        <div className="sx-modal-total">{money(total)}</div>
        <div className="sx-muted" style={{ marginBottom: 10 }}>Sa pagoi klienti?</div>
        <div className="sx-pay-grid">
          {options.map((v, i) => (
            <button key={v} className={`sx-pay-opt ${given === v ? 'is-on' : ''}`} onClick={() => setGiven(v)}>
              {i === 0 ? 'Saktë' : money(v)}
              {i === 0 && <small>{money(v)}</small>}
            </button>
          ))}
        </div>
        <div className="sx-pay-change">
          <span>Kusuri</span>
          <b>{money(Math.max(0, change))}</b>
        </div>
        <div className="sx-modal-actions">
          <button className="sx-btn-outline" onClick={onClose}>Anulo</button>
          <button className="sx-btn-primary" onClick={onPay}><Icon name="check" size={18} /> Konfirmo pagesën</button>
        </div>
      </div>
    </div>
  );
}

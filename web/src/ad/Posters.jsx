import { useMemo } from 'react';
import PosApp from '../pages/demo/PosApp';
import PhoneApp from '../pages/demo/PhoneApp';
import ManagerApp from '../pages/demo/ManagerApp';
import { SellixMark } from '../pages/demo/icons';
import { initialState, lineTotal, money } from '../pages/demo/data';
import { reducer } from '../pages/demo/store';
import '../pages/demo/demo.css';
import '../pages/demo/phone-portal.css';
import './posters.css';
import makiato from './img/makiato.webp';
import kapuqino from './img/kapuqino.webp';
import latte from './img/latte.webp';
import frappe from './img/frappe.webp';
import icecoffee from './img/icecoffee.webp';
import gintonic from './img/gintonic.webp';
import peja from './img/peja.webp';
import cola from './img/cola.webp';
import redbull from './img/redbull.webp';
import corona from './img/corona.webp';

// Ten 1080×1920 (TikTok / Reels / Stories) ad stills. posters.html?p=1..10
// renders one; the recorder screenshots each. Key content stays inside the
// TikTok safe area: below ~160px, above ~1500px and clear of the right rail.

const noop = () => {};

function useStates() {
  return useMemo(() => {
    const base = initialState();
    const waiter = { ...base, user: base.staff[1], screen: 'order', table: 3 };
    let order = waiter;
    for (const pid of ['espresso', 'frappe', 'frappe', 'kapuqino', 'latte']) order = reducer(order, { type: 'add', table: 3, pid });
    order = { ...reducer(order, { type: 'print', table: 3 }), toast: null, notes: [] };
    const paid = lineTotal(order.tables.find((t) => t.id === 3).items);
    const after = { ...reducer(order, { type: 'pay', table: 3 }), toast: null, notes: [] };
    const manager = { ...after, user: after.staff[0], screen: 'manager', mgrTab: 'overview' };
    return { order, after, manager, paid };
  }, []);
}

/* ───────────── building blocks ───────────── */

function Brand({ light = false, style }) {
  return (
    <div className={`ps-brand ${light ? 'is-light' : ''}`} style={style}>
      <SellixMark size={34} />
      <b>SelliX</b>
    </div>
  );
}

function Cta({ light = false, text = 'sellix.software', note, style }) {
  return (
    <div className="ps-cta-wrap" style={style}>
      <div className={`ps-cta ${light ? 'is-light' : ''}`}>{text}<span>→</span></div>
      {note && <div className={`ps-cta-note ${light ? 'is-light' : ''}`}>{note}</div>}
    </div>
  );
}

function Window({ children, theme = 'dark', scale = 0.8, style }) {
  return (
    <div className="sx-demo" data-theme={theme} style={{ position: 'absolute', ...style }}>
      <div className="sx-window" style={{ width: 1200 * scale + 2 }}>
        <div className="sx-window-bar"><span className="sx-dots"><i /><i /><i /></span><span className="sx-window-title">SelliX POS — Windows</span></div>
        <div style={{ width: 1200 * scale, height: 740 * scale, overflow: 'hidden' }}>
          <div className="sx-app" style={{ width: 1200, height: 740, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function Phone({ state, scale = 1.4, style }) {
  return (
    <div className="sx-demo" data-theme="dark" style={{ position: 'absolute', width: 318 * scale, height: 660 * scale, ...style }}>
      <div style={{ width: 318, height: 660, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <PhoneApp state={state} dispatch={noop} />
      </div>
    </div>
  );
}

function Notice({ title, body, time = 'tani', style }) {
  return (
    <div className="ps-notice" style={style}>
      <img src="/icon-192.png" alt="" />
      <div>
        <div className="ps-notice-top"><b>SelliX</b><span>{time}</span></div>
        <b>{title}</b>
        <span>{body}</span>
      </div>
    </div>
  );
}

function LockPhone({ scale = 1.5, style, children }) {
  return (
    <div className="sx-demo" data-theme="dark" style={{ position: 'absolute', width: 318 * scale, height: 660 * scale, ...style }}>
      <div style={{ width: 318, height: 660, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <div className="ip-frame">
          <div className="ip-btn ip-btn-action" /><div className="ip-btn ip-btn-up" /><div className="ip-btn ip-btn-down" /><div className="ip-btn ip-btn-power" />
          <div className="ip-screen ps-lock">
            <div className="ip-status" style={{ color: '#fff' }}>
              <span className="ip-time" />
              <span className="ip-island" />
              <span className="ip-sys"><span className="ip-batt"><i /></span></span>
            </div>
            <div className="ps-lock-date">E martë, 22 Shtator</div>
            <div className="ps-lock-time">13:40</div>
            <div className="ps-lock-stack">{children}</div>
            <span className="ip-home" style={{ background: '#fff' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Drink({ src, size, style }) {
  return <img src={src} alt="" className="ps-drink" style={{ width: size, ...style }} />;
}

/* ───────────── the ten posters ───────────── */

function P1({ s }) {
  return (
    <div className="ps ps-dark">
      <Brand style={{ top: 170 }} />
      <div className="ps-text" style={{ top: 290 }}>
        <div className="ps-kicker">POS PËR KAFITERI & RESTORANTE</div>
        <h1 className="ps-h1">Arka që<br />punon <em>për ty.</em></h1>
        <p className="ps-sub">Porositë në kompjuter. Shitjet live në telefon.</p>
      </div>
      <div className="ps-tilt" style={{ left: 60, top: 860 }}>
        <Window scale={0.72} style={{ position: 'relative' }}><PosApp state={s.order} dispatch={noop} /></Window>
      </div>
      <Phone state={s.after} scale={1.02} style={{ left: 640, top: 900 }} />
      <Cta style={{ top: 1500 }} note="Provoje live në shfletues" />
    </div>
  );
}

function P2() {
  return (
    <div className="ps ps-light">
      <Brand light style={{ top: 170 }} />
      <div className="ps-text" style={{ top: 300 }}>
        <div className="ps-kicker is-dark">ÇMIMI</div>
        <div className="ps-price-small">Vetëm</div>
        <div className="ps-price-big">33<span>¢</span></div>
        <div className="ps-price-unit">cent në ditë</div>
      </div>
      <div className="ps-compare" style={{ top: 1060 }}>
        <div className="ps-compare-row">
          <img src={makiato} alt="" />
          <div><b>Një makiato</b><span>në ditë</span></div>
          <strong className="is-muted">1.00 €</strong>
        </div>
        <div className="ps-compare-row is-hl">
          <span className="ps-compare-logo"><SellixMark size={22} /></span>
          <div><b>SelliX POS</b><span>në ditë, gjithçka përfshirë</span></div>
          <strong>0.33 €</strong>
        </div>
      </div>
      <div className="ps-price-foot" style={{ top: 1380 }}>9.99 € / muaj · Të gjitha modulet</div>
      <Cta light style={{ top: 1470 }} />
    </div>
  );
}

function P3({ s }) {
  return (
    <div className="ps ps-dark ps-glow-top">
      <Brand style={{ top: 170 }} />
      <div className="ps-text ps-center" style={{ top: 280 }}>
        <div className="ps-kicker">NJOFTIME NË TELEFON</div>
        <h1 className="ps-h1 ps-h1-sm">Lajmi më i mirë<br />i <em>ditës.</em></h1>
      </div>
      <LockPhone scale={1.3} style={{ left: 333, top: 590 }}>
        <Notice title="🎉 Urime! Keni arritur objektivin" body="Shitjet sot: 248.60 € · Objektivi ditor: 200.00 €" />
        <Notice title={`Pagesë · Tavolina 3`} body={`${money(s.paid)} nga Kamarieri`} time="2 min" style={{ opacity: 0.82 }} />
      </LockPhone>
      <div className="ps-float-chip" style={{ left: 60, top: 1120 }}>🎯 Objektivi ditor</div>
      <Cta style={{ top: 1500 }} note="iPhone & Android" />
    </div>
  );
}

function P4({ s }) {
  return (
    <div className="ps ps-dark">
      <Brand style={{ top: 170 }} />
      <div className="ps-text" style={{ top: 290 }}>
        <div className="ps-kicker">ARKA POS</div>
        <h1 className="ps-h1">Porosi me<br /><em>dy prekje.</em></h1>
      </div>
      <div className="ps-zoom" style={{ left: -120, top: 720 }}>
        <Window scale={1} style={{ position: 'relative' }}><PosApp state={s.order} dispatch={noop} /></Window>
        <div className="ps-tap" style={{ left: 530, top: 560 }} />
        <svg className="ps-pointer" style={{ left: 540, top: 575 }} width="64" height="64" viewBox="0 0 24 24"><path d="M5 3l14 8-6.5 1.6L9.8 19z" fill="#fff" stroke="#0B110E" strokeWidth="1.4" strokeLinejoin="round" /></svg>
      </div>
      <div className="ps-stats" style={{ top: 1330 }}>
        <div><b>2</b><span>prekje</span></div>
        <div><b>0</b><span>gabime</span></div>
        <div><b>1</b><span>printim</span></div>
      </div>
      <Cta style={{ top: 1520 }} />
    </div>
  );
}

function P5({ s }) {
  return (
    <div className="ps ps-split">
      <div className="ps-split-top">
        <div className="ps-paper">
          <div className="ps-paper-line">Tav 3 — 2 makiato, 1 kola…</div>
          <div className="ps-paper-line">Tav 5 — 3 birra ??</div>
          <div className="ps-paper-line is-cross">Total: 14.40 13.90 ?</div>
        </div>
        <div className="ps-text" style={{ top: 180 }}>
          <div className="ps-kicker is-red">PARA</div>
          <h2 className="ps-h2 is-muted">Bllok letre.<br />Llogari që s’dalin.</h2>
        </div>
      </div>
      <div className="ps-split-bottom">
        <div className="ps-text" style={{ top: 70 }}>
          <div className="ps-kicker">ME SELLIX</div>
          <h2 className="ps-h2">Çdo porosi,<br /><em>e regjistruar.</em></h2>
        </div>
        <Phone state={s.after} scale={0.98} style={{ left: 600, top: 60 }} />
        <ul className="ps-checks" style={{ top: 420 }}>
          <li>Raport automatik</li>
          <li>Stafi me PIN</li>
          <li>Tavolinat live</li>
        </ul>
      </div>
      <div className="ps-split-badge">VS</div>
      <Cta style={{ top: 1560 }} />
    </div>
  );
}

function P6({ s }) {
  return (
    <div className="ps ps-mint">
      <Brand style={{ top: 170 }} />
      <div className="ps-text" style={{ top: 290 }}>
        <div className="ps-kicker is-ink">PORTALI I PRONARIT</div>
        <h1 className="ps-h1 is-ink">Shitjet e lokalit.<br />Në xhep.</h1>
      </div>
      <Phone state={s.after} scale={1.24} style={{ left: 520, top: 610 }} />
      <div className="ps-glass" style={{ left: 70, top: 820 }}><span className="ps-live-dot" />LIVE</div>
      <div className="ps-glass" style={{ left: 70, top: 940 }}>📍 Nga kudo</div>
      <div className="ps-glass" style={{ left: 70, top: 1060 }}>🔔 Njoftime</div>
      <Cta style={{ top: 1500, left: 60 }} />
    </div>
  );
}

const FEATURES = [
  ['🍽️', 'Tavolinat live', 'Kush është i zënë, sa ka hapur'],
  ['🔐', 'Stafi me PIN', 'Çdo kamarier me llogarinë e vet'],
  ['🧾', 'Gjendja & turnet', 'Mbyll turnin me një prekje'],
  ['📊', 'Raporte PDF', 'Ditore, javore, mujore'],
  ['📸', 'Menu me foto', 'Pije e re në 5 sekonda'],
  ['📶', 'Punon offline', 'Edhe pa internet'],
];

function P7() {
  return (
    <div className="ps ps-light">
      <Brand light style={{ top: 170 }} />
      <div className="ps-text" style={{ top: 290 }}>
        <div className="ps-kicker is-dark">NJË PAKO · GJITHÇKA</div>
        <h1 className="ps-h1 is-ink ps-h1-sm">Gjithçka që i duhet<br />lokalit tënd.</h1>
      </div>
      <div className="ps-grid" style={{ top: 700 }}>
        {FEATURES.map(([ic, t, d]) => (
          <div key={t} className="ps-tile">
            <span>{ic}</span>
            <b>{t}</b>
            <small>{d}</small>
          </div>
        ))}
      </div>
      <Cta light style={{ top: 1500 }} note="9.99 € / muaj" />
    </div>
  );
}

function P8() {
  return (
    <div className="ps ps-dark ps-glow-center">
      <Brand style={{ top: 170 }} />
      <Drink src={kapuqino} size={300} style={{ left: 40, top: 300, transform: 'rotate(-8deg)' }} />
      <Drink src={gintonic} size={250} style={{ left: 770, top: 250, transform: 'rotate(7deg)' }} />
      <Drink src={frappe} size={250} style={{ left: 760, top: 1150, transform: 'rotate(-6deg)' }} />
      <Drink src={peja} size={230} style={{ left: 60, top: 1170, transform: 'rotate(5deg)' }} />
      <Drink src={latte} size={170} style={{ left: 470, top: 300, opacity: 0.55, filter: 'blur(2px)' }} />
      <Drink src={redbull} size={170} style={{ left: 470, top: 1260, opacity: 0.6, filter: 'blur(2px)' }} />
      <div className="ps-text ps-center" style={{ top: 760 }}>
        <div className="ps-kicker">MENU ME FOTO</div>
        <h1 className="ps-h1 ps-h1-sm">Menuja jote,<br /><em>më e bukur.</em></h1>
        <p className="ps-sub">Shto një pije të re në 5 sekonda —<br />shfaqet direkt në POS.</p>
      </div>
      <Cta style={{ top: 1520 }} />
    </div>
  );
}

function P9({ s }) {
  return (
    <div className="ps ps-light ps-light-deep">
      <Brand light style={{ top: 170 }} />
      <div className="ps-text" style={{ top: 290 }}>
        <div className="ps-kicker is-dark">PANELI I MENAXHERIT</div>
        <h1 className="ps-h1 is-ink">Menaxho si<br />profesionist.</h1>
      </div>
      <div className="ps-tilt-r" style={{ left: 70, top: 800 }}>
        <Window theme="light" scale={0.8} style={{ position: 'relative' }}><ManagerApp state={s.manager} dispatch={noop} /></Window>
      </div>
      <div className="ps-kpi" style={{ left: 560, top: 700 }}>
        <small>Fitim sot</small>
        <b>+27.50 €</b>
      </div>
      <Cta light style={{ top: 1500 }} note="Light & Dark mode" />
    </div>
  );
}

function P10({ s }) {
  return (
    <div className="ps ps-dark ps-glow-top">
      <Brand style={{ top: 170 }} />
      <Drink src={icecoffee} size={260} style={{ left: 800, top: 250, transform: 'rotate(10deg)', opacity: 0.9 }} />
      <Drink src={cola} size={170} style={{ left: 40, top: 1180, transform: 'rotate(-12deg)', opacity: 0.8 }} />
      <Drink src={corona} size={150} style={{ left: 880, top: 1250, transform: 'rotate(8deg)', opacity: 0.7 }} />
      <div className="ps-text ps-center" style={{ top: 330 }}>
        <div className="ps-kicker">PROVOJE SOT</div>
        <h1 className="ps-h1">Pa e<br /><em>shkarkuar.</em></h1>
        <p className="ps-sub">Demo e plotë live në shfletues:<br />POS, tavolina dhe portali në telefon.</p>
      </div>
      <div className="ps-steps" style={{ top: 950 }}>
        <div><b>1</b>Hape sellix.software</div>
        <div><b>2</b>Hyr me PIN 1234</div>
        <div><b>3</b>Merr porosinë e parë</div>
      </div>
      <Cta style={{ top: 1390 }} text="sellix.software" note="9.99 € / muaj · 33 cent në ditë" />
    </div>
  );
}

const POSTERS = [P1, P2, P3, P4, P5, P6, P7, P8, P9, P10];

export default function Posters() {
  const s = useStates();
  const n = Number(new URLSearchParams(window.location.search).get('p')) || 0;
  if (n >= 1 && n <= POSTERS.length) {
    const P = POSTERS[n - 1];
    return <div className="ps-root"><P s={s} /></div>;
  }
  // Overview: all ten side by side, scaled down.
  return (
    <div className="ps-overview">
      {POSTERS.map((P, i) => (
        <div key={i} className="ps-thumb">
          <div className="ps-root" style={{ transform: 'scale(0.25)', transformOrigin: 'top left' }}><P s={s} /></div>
        </div>
      ))}
    </div>
  );
}

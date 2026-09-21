import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import PosApp from '../pages/demo/PosApp';
import PhoneApp from '../pages/demo/PhoneApp';
import ManagerApp from '../pages/demo/ManagerApp';
import { SellixMark } from '../pages/demo/icons';
import { initialState, lineTotal, money } from '../pages/demo/data';
import { reducer } from '../pages/demo/store';
import '../pages/demo/demo.css';
import '../pages/demo/phone-portal.css';
import './ad.css';

// 30-second product ad, 1920×1080. Everything on screen is a pure function of
// the timeline position `t`, so the recorder can seek frame by frame.

export const DURATION = 30;
const W = 1920;
const H = 1080;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eo = (x) => 1 - Math.pow(1 - x, 3);
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x) => {
  const c1 = 1.5;
  return 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const lerp = (a, b, x) => a + (b - a) * x;

// Scene windows [in, out]. Neighbouring scenes overlap for the crossfade.
const S = {
  intro: [0, 3.3],
  hook: [3.1, 6.5],
  pos: [6.3, 13.6],
  phone: [13.4, 19.2],
  mgr: [19.0, 24.2],
  price: [24.0, 27.4],
  cta: [27.2, 30.5],
};
const FADE = 0.35;
const sceneAlpha = (t, [a, b], { first = false, last = false } = {}) => {
  const fin = first ? 1 : prog(t, a, a + FADE);
  const fout = last ? 1 : 1 - prog(t, b - FADE, b);
  return Math.min(fin, fout);
};
const inScene = (t, [a, b]) => t >= a - 0.001 && t <= b;

// POS storyline
const TABLE = 3;
const TAPS = [
  [7.5, 'Espresso', 'espresso'],
  [8.15, 'Frappe', 'frappe'],
  [8.7, 'Frappe', 'frappe'],
  [9.3, 'Kapuçino', 'kapuqino'],
  [9.95, 'Latte', 'latte'],
];
const PRINT_T = 10.9;
const PAY_T = 12.3;
const BANNER_T = 14.7;

function posStateAt(base, t) {
  let s = base;
  for (const [tt, , pid] of TAPS) if (t >= tt) s = reducer(s, { type: 'add', table: TABLE, pid });
  if (t >= PRINT_T) s = reducer(s, { type: 'print', table: TABLE });
  if (t >= PAY_T) s = reducer(s, { type: 'pay', table: TABLE });
  return { ...s, toast: null, notes: [] };
}

/* ───────────── building blocks ───────────── */

function Words({ text, t, start, stagger = 0.07, dur = 0.55, style, className }) {
  const words = text.split(' ');
  return (
    <span className={className} style={style}>
      {words.map((w, i) => {
        const x = eo(prog(t, start + i * stagger, start + i * stagger + dur));
        return (
          <span key={i}>
            <span className="ad-word">
              <span style={{ display: 'inline-block', transform: `translateY(${(1 - x) * 105}%)`, opacity: x }}>{w}</span>
            </span>
            {i < words.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </span>
  );
}

function FadeUp({ t, start, dur = 0.6, dist = 24, children, style }) {
  const x = eo(prog(t, start, start + dur));
  return <div style={{ ...style, opacity: x, transform: `translateY(${(1 - x) * dist}px)` }}>{children}</div>;
}

function Caption({ t, start, kicker, title, sub, style }) {
  return (
    <div className="ad-caption" style={style}>
      <FadeUp t={t} start={start}><div className="ad-kicker">{kicker}</div></FadeUp>
      <h2 className="ad-h2">
        {title.map((line, i) => (
          <div key={i}><Words text={line} t={t} start={start + 0.15 + i * 0.22} /></div>
        ))}
      </h2>
      {sub && <FadeUp t={t} start={start + 0.6}><p className="ad-sub">{sub}</p></FadeUp>}
    </div>
  );
}

function Window({ children, title = 'SelliX POS — Windows', theme = 'dark', scale = 1, style }) {
  return (
    <div className="sx-demo" data-theme={theme} style={{ position: 'absolute', transformOrigin: 'top left', ...style }}>
      <div className="sx-window" style={{ width: 1200 * scale + 2 }}>
        <div className="sx-window-bar"><span className="sx-dots"><i /><i /><i /></span><span className="sx-window-title">{title}</span></div>
        <div style={{ width: 1200 * scale, height: 740 * scale, overflow: 'hidden' }}>
          <div style={{ width: 1200, height: 740, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function Background({ t }) {
  const a = Math.sin(t * 0.35) * 120;
  const b = Math.cos(t * 0.27) * 90;
  return (
    <div className="ad-bg">
      <div className="ad-blob" style={{ left: 260 + a, top: 120 + b, background: 'radial-gradient(circle, rgba(94,199,154,.22), transparent 62%)' }} />
      <div className="ad-blob" style={{ left: 1100 - a, top: 420 - b, width: 1100, height: 1100, background: 'radial-gradient(circle, rgba(35,75,54,.55), transparent 60%)' }} />
      <div className="ad-grid" />
      <div className="ad-vignette" />
    </div>
  );
}

/* ───────────── scenes ───────────── */

function Intro({ t }) {
  const m = back(prog(t, 0.2, 1.0));
  const line = eio(prog(t, 1.0, 1.8));
  return (
    <div className="ad-center">
      <div style={{ display: 'flex', alignItems: 'center', gap: 34, color: '#ECF3EE' }}>
        <div style={{ transform: `scale(${lerp(0.4, 1, m)})`, opacity: prog(t, 0.2, 0.5) }}><SellixMark size={96} /></div>
        <div className="ad-wordmark"><Words text="SelliX" t={t} start={0.55} dur={0.6} /></div>
      </div>
      <div className="ad-rule" style={{ width: 520 * line }} />
      <FadeUp t={t} start={1.5}><div className="ad-tagline">POS për kafiteri, bare dhe restorante</div></FadeUp>
    </div>
  );
}

function Hook({ t }) {
  const s0 = S.hook[0] + 0.25;
  const strike = eio(prog(t, 5.0, 5.45));
  const dim = 1 - 0.55 * prog(t, 5.0, 5.4);
  const pop = back(prog(t, 5.45, 6.0));
  return (
    <div className="ad-center">
      <FadeUp t={t} start={s0}><div className="ad-kicker">ENDE KËSHTU?</div></FadeUp>
      <div style={{ position: 'relative', opacity: dim, textAlign: 'center' }}>
        <div className="ad-h1"><Words text="Bllok letre. Arkë e vjetër." t={t} start={s0 + 0.1} /></div>
        <div className="ad-h1 ad-muted"><Words text="Llogari që s’dalin." t={t} start={s0 + 0.55} /></div>
        <div className="ad-strike" style={{ top: '30%', width: `${strike * 100}%` }} />
        <div className="ad-strike" style={{ top: '76%', width: `${prog(t, 5.15, 5.6) * 100}%` }} />
      </div>
      <div className="ad-h1 ad-accent" style={{ marginTop: 36, transform: `scale(${lerp(0.6, 1, pop)})`, opacity: prog(t, 5.45, 5.7) }}>
        Kalo në SelliX.
      </div>
    </div>
  );
}

function offsetIn(el, root) {
  let x = 0;
  let y = 0;
  while (el && el !== root) {
    x += el.offsetLeft;
    y += el.offsetTop;
    el = el.offsetParent;
  }
  return { x, y };
}

function Cursor({ t, waypoints, pos }) {
  if (!pos) return null;
  let i = 0;
  while (i < waypoints.length - 1 && t >= waypoints[i + 1][0]) i++;
  const cur = pos[waypoints[i][1]];
  const next = waypoints[i + 1];
  let p = cur;
  if (next) {
    const k = eio(prog(t, next[0] - 0.5, next[0]));
    const np = pos[next[1]];
    p = { x: lerp(cur.x, np.x, k), y: lerp(cur.y, np.y, k) };
  }
  const tap = waypoints.find(([tt, , isTap]) => isTap && t >= tt && t < tt + 0.5);
  const press = waypoints.some(([tt, , isTap]) => isTap && Math.abs(t - tt) < 0.09);
  const rp = tap ? prog(t, tap[0], tap[0] + 0.5) : 0;
  return (
    <>
      {tap && (
        <div className="ad-ripple" style={{ left: pos[tap[1]].x, top: pos[tap[1]].y, transform: `translate(-50%,-50%) scale(${lerp(0.2, 1.8, eo(rp))})`, opacity: 1 - rp }} />
      )}
      <svg className="ad-cursor" style={{ left: p.x, top: p.y, transform: `scale(${press ? 0.82 : 1})` }} width="40" height="40" viewBox="0 0 24 24">
        <path d="M5 3l14 8-6.5 1.6L9.8 19z" fill="#fff" stroke="#0B110E" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </>
  );
}

function PosScene({ t, base }) {
  const appRef = useRef(null);
  const [pos, setPos] = useState(null);
  const state = posStateAt(base, t);

  useLayoutEffect(() => {
    const root = appRef.current;
    if (!root) return;
    const center = (el) => {
      const o = offsetIn(el, root);
      return { x: o.x + el.offsetWidth / 2, y: o.y + el.offsetHeight / 2 };
    };
    const map = { start: { x: 1080, y: 690 } };
    root.querySelectorAll('.sx-product').forEach((card) => {
      const name = card.querySelector('.sx-product-name')?.textContent;
      const plus = card.querySelector('.sx-plus');
      if (name && plus) map[name] = center(plus);
    });
    const print = root.querySelector('.sx-btn-primary.sx-btn-lg');
    const pay = root.querySelector('.sx-btn-outline.sx-btn-lg');
    if (print) map.print = center(print);
    if (pay) map.pay = center(pay);
    setPos(map);
  }, []);

  const waypoints = [[6.3, 'start'], ...TAPS.map(([tt, name]) => [tt, name, true]), [PRINT_T, 'print', true], [PAY_T, 'pay', true]];
  const enter = eo(prog(t, 6.3, 7.4));
  const printToast = Math.min(prog(t, PRINT_T + 0.05, PRINT_T + 0.3), 1 - prog(t, 11.9, 12.2));
  const payToast = prog(t, PAY_T + 0.05, PAY_T + 0.3);
  const table = posStateAt(base, PAY_T - 0.01).tables.find((x) => x.id === TABLE);

  return (
    <>
      <Caption t={t} start={6.5} kicker="01 · ARKA POS" title={['Porosi me', 'dy prekje.']} sub="Zgjidh tavolinën, shto produktet dhe printo — kamarieri punon më shpejt se kurrë." style={{ left: 120, top: 300, width: 540 }} />
      <div style={{ position: 'absolute', left: 700, top: 150, perspective: 2600 }}>
        <div style={{ transform: `translateX(${(1 - enter) * 160}px) rotateY(${lerp(-20, -6, enter)}deg) translateY(${Math.sin(t * 0.8) * 4}px)`, transformOrigin: 'left center', opacity: enter }}>
          <Window scale={0.98} style={{ position: 'relative' }}>
            <div ref={appRef} className="sx-app" style={{ width: 1200, height: 740 }}>
              <PosApp state={state} dispatch={() => {}} />
              <div className="sx-toast" style={{ opacity: printToast, transform: 'translateX(-50%)' }}>✓ Porosia u dërgua në printer</div>
              <div className="sx-toast" style={{ opacity: payToast, transform: 'translateX(-50%)' }}>✓ Pagesa u krye · {money(lineTotal(table.items))}</div>
              <Cursor t={t} waypoints={waypoints} pos={pos} />
            </div>
          </Window>
        </div>
      </div>
    </>
  );
}

function PhoneScene({ t, base }) {
  const before = useMemo(() => posStateAt(base, PAY_T - 0.01), [base]);
  const after = useMemo(() => posStateAt(base, 99), [base]);
  const paid = lineTotal(before.tables.find((x) => x.id === TABLE).items);
  const s0 = S.phone[0];
  const phoneIn = eo(prog(t, s0 + 0.2, s0 + 1.1));
  const deskIn = eo(prog(t, s0, s0 + 0.8));
  const dot = eio(prog(t, BANNER_T - 0.9, BANNER_T - 0.05));
  const banner = back(prog(t, BANNER_T, BANNER_T + 0.5));
  const bannerOut = prog(t, 18.4, 18.8);
  const phoneState = t >= BANNER_T ? after : before;
  const PS = 1.28;

  // Arc from the desktop to the phone; the dot rides it as the receipt syncs.
  const p0 = { x: 870, y: 720 };
  const p1 = { x: 1150, y: 330 };
  const c = { x: 1060, y: 760 };
  const bez = (k) => ({
    x: (1 - k) ** 2 * p0.x + 2 * (1 - k) * k * c.x + k * k * p1.x,
    y: (1 - k) ** 2 * p0.y + 2 * (1 - k) * k * c.y + k * k * p1.y,
  });
  const d = bez(dot);

  return (
    <>
      <Caption t={t} start={s0 + 0.2} kicker="02 · PORTALI I PRONARIT" title={['Çdo pagesë,', 'live në telefon.']} sub="Shitjet, tavolinat dhe turni — i sheh nga kudo, në çast." style={{ left: 120, top: 150, width: 820 }} />
      <div style={{ position: 'absolute', left: 120, top: 540, opacity: deskIn, transform: `translateY(${(1 - deskIn) * 40}px)` }}>
        <Window scale={0.62} style={{ position: 'relative' }}>
          <div className="sx-app" style={{ width: 1200, height: 740 }}>
            <PosApp state={after} dispatch={() => {}} />
            <div className="sx-toast" style={{ transform: 'translateX(-50%)' }}>✓ Pagesa u krye · {money(paid)}</div>
          </div>
        </Window>
      </div>
      <svg style={{ position: 'absolute', left: 0, top: 0 }} width={W} height={H}>
        <path d={`M${p0.x},${p0.y} Q${c.x},${c.y} ${p1.x},${p1.y}`} fill="none" stroke="rgba(94,199,154,.35)" strokeWidth="3" strokeDasharray="4 12" strokeLinecap="round" style={{ opacity: deskIn }} />
        {dot > 0 && dot < 1 && <circle cx={d.x} cy={d.y} r="10" fill="#5EC79A" style={{ filter: 'drop-shadow(0 0 14px #5EC79A)' }} />}
      </svg>
      <div className="sx-demo" data-theme="dark" style={{ position: 'absolute', left: 1210, top: 70, transform: `translateY(${(1 - phoneIn) * 500}px) scale(${PS})`, transformOrigin: 'top left', opacity: phoneIn }}>
        <div style={{ position: 'relative', width: 318, height: 660, filter: 'drop-shadow(0 50px 70px rgba(0,0,0,.6))' }}>
          <PhoneApp state={phoneState} dispatch={() => {}} />
          <div className="pw" style={{ position: 'absolute', left: 11, right: 11, top: 11 }}>
            <div className="ip-banner is-in" style={{ transform: `translateY(${lerp(-130, 0, banner) - bannerOut * 130}%) scale(${lerp(0.9, 1, banner)})`, opacity: Math.min(prog(t, BANNER_T, BANNER_T + 0.2), 1 - bannerOut) }}>
              <span className="ip-banner-icon"><SellixMark size={13} /></span>
              <div className="ip-banner-text">
                <div className="ip-banner-top"><b>SelliX</b><span>tani</span></div>
                <b>Pagesë · Tavolina {TABLE}</b>
                <span>{money(paid)} nga Kamarieri</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const FEATURES = ['Stafi me PIN', 'Tavolina live', 'Gjendja & turnet', 'Fitime & grafikë', 'Menu me foto', 'Raporte PDF'];

function MgrScene({ t, base }) {
  const state = useMemo(() => {
    const s = posStateAt(base, 99);
    return { ...s, user: s.staff[0], screen: 'manager', mgrTab: 'overview' };
  }, [base]);
  const s0 = S.mgr[0];
  const enter = eo(prog(t, s0 + 0.1, s0 + 1.0));
  const light = eio(prog(t, 21.9, 22.6));
  const chip = back(prog(t, 22.4, 22.9));
  const wrap = { transform: `translateX(${(1 - enter) * 160}px) rotateY(${lerp(-18, -6, enter)}deg)`, transformOrigin: 'left center', opacity: enter };
  return (
    <>
      <Caption t={t} start={s0 + 0.2} kicker="03 · MENAXHIMI" title={['Gjithçka', 'nën kontroll.']} style={{ left: 120, top: 230, width: 540 }} />
      <div className="ad-checks" style={{ left: 120, top: 540 }}>
        {FEATURES.map((f, i) => {
          const x = eo(prog(t, s0 + 0.7 + i * 0.3, s0 + 1.2 + i * 0.3));
          return (
            <div key={f} className="ad-check" style={{ opacity: x, transform: `translateX(${(1 - x) * -30}px)` }}>
              <span>✓</span>{f}
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 700, top: 150, perspective: 2600 }}>
        <div style={wrap}>
          <div style={{ position: 'relative' }}>
            <Window scale={0.98} style={{ position: 'relative' }}>
              <div className="sx-app" style={{ width: 1200, height: 740 }}><ManagerApp state={state} dispatch={() => {}} /></div>
            </Window>
            <Window scale={0.98} theme="light" style={{ position: 'absolute', left: 0, top: 0, clipPath: `inset(0 ${(1 - light) * 100}% 0 0)` }}>
              <div className="sx-app" style={{ width: 1200, height: 740 }}><ManagerApp state={state} dispatch={() => {}} /></div>
            </Window>
          </div>
        </div>
      </div>
      <div className="ad-pill" style={{ left: 1500, top: 88, opacity: prog(t, 22.4, 22.6), transform: `scale(${lerp(0.6, 1, chip)})` }}>☀ Light &nbsp;·&nbsp; ☾ Dark</div>
    </>
  );
}

function PriceScene({ t }) {
  const s0 = S.price[0];
  const n = (9.99 * eo(prog(t, s0 + 0.35, s0 + 1.2))).toFixed(2);
  const chips = ['Windows 10 / 11', 'iPhone & Android', 'Punon edhe offline', 'Mbështetje 24/7 në shqip'];
  return (
    <div className="ad-center">
      <FadeUp t={t} start={s0 + 0.2}><div className="ad-kicker">NJË PAKO · TË GJITHA MODULET</div></FadeUp>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, opacity: prog(t, s0 + 0.3, s0 + 0.55) }}>
        <span className="ad-price">{n} €</span>
        <span className="ad-per">/ muaj</span>
      </div>
      <FadeUp t={t} start={s0 + 1.0}><div className="ad-sub" style={{ textAlign: 'center', marginTop: 8 }}>Shkarkoje, instaloje dhe shit brenda ditës.</div></FadeUp>
      <div style={{ display: 'flex', gap: 14, marginTop: 44 }}>
        {chips.map((c, i) => {
          const x = back(prog(t, s0 + 1.3 + i * 0.18, s0 + 1.75 + i * 0.18));
          return <div key={c} className="ad-chip" style={{ opacity: prog(t, s0 + 1.3 + i * 0.18, s0 + 1.5 + i * 0.18), transform: `scale(${lerp(0.7, 1, x)})` }}>{c}</div>;
        })}
      </div>
    </div>
  );
}

function CtaScene({ t }) {
  const s0 = S.cta[0];
  const icon = back(prog(t, s0 + 0.2, s0 + 0.8));
  const glow = 0.5 + 0.5 * Math.sin((t - s0) * 3);
  return (
    <div className="ad-center">
      <img src="/pwa-icon.png" alt="" className="ad-icon" style={{ transform: `scale(${lerp(0.5, 1, icon)})`, opacity: prog(t, s0 + 0.2, s0 + 0.4), boxShadow: `0 30px 80px -20px rgba(94,199,154,${0.25 + glow * 0.25})` }} />
      <div className="ad-h1" style={{ marginTop: 40 }}><Words text="Provoje sot." t={t} start={s0 + 0.5} /></div>
      <FadeUp t={t} start={s0 + 0.9}><div className="ad-sub" style={{ textAlign: 'center' }}>Demo live në shfletues — pa e shkarkuar.</div></FadeUp>
      <FadeUp t={t} start={s0 + 1.2}><div className="ad-url">sellix.software</div></FadeUp>
    </div>
  );
}

/* ───────────── root ───────────── */

export default function Ad() {
  const params = new URLSearchParams(window.location.search);
  const record = params.has('record');
  const fixed = params.get('t');
  const [t, setT] = useState(fixed ? Number(fixed) : 0);
  const [scale, setScale] = useState(1);
  const base = useMemo(() => {
    const s = initialState();
    return { ...s, user: s.staff[1], screen: 'order', table: TABLE };
  }, []);

  useEffect(() => {
    window.__seek = (v) => {
      window.__adT = v;
      flushSync(() => setT(v));
    };
    window.__ready = true;
    if (record || fixed) return undefined;
    let raf;
    const start = performance.now();
    const loop = () => {
      const v = ((performance.now() - start) / 1000) % DURATION;
      window.__adT = v;
      setT(v);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [record, fixed]);

  useEffect(() => {
    if (record) return undefined;
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [record]);

  const scenes = [
    ['intro', Intro, { first: true }],
    ['hook', Hook],
    ['pos', PosScene],
    ['phone', PhoneScene],
    ['mgr', MgrScene],
    ['price', PriceScene],
    ['cta', CtaScene, { last: true }],
  ];

  return (
    <div className="ad-root" style={{ width: W, height: H, transform: `scale(${scale})` }}>
      <Background t={t} />
      {scenes.map(([key, Comp, opts]) =>
        inScene(t, S[key]) ? (
          <div key={key} className="ad-scene" style={{ opacity: sceneAlpha(t, S[key], opts) }}>
            <Comp t={t} base={base} />
          </div>
        ) : null
      )}
      <div className="ad-fadein" style={{ opacity: 1 - prog(t, 0, 0.4) }} />
    </div>
  );
}

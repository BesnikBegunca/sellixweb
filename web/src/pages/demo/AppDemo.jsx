import { useEffect, useReducer, useRef, useState } from 'react';
import Icon from './icons';
import PosApp from './PosApp';
import PhoneApp from './PhoneApp';
import { initialState } from './data';
import { reducer } from './store';
import './demo.css';
import './phone-portal.css';

const APP_W = 1200;
const APP_H = 740;
const PHONE_W = 318;
const PHONE_H = 660;

// Measures the available width and scales a fixed-size canvas into it.
function useFit(base, min = 0) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      if (w) setScale(Math.max(min, Math.min(1, w / base)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [base, min]);
  return [ref, scale];
}

const COPY = {
  sq: {
    kicker: '01 — PROVO APP-IN',
    title: 'Provoje SelliX këtu, pa e shkarkuar',
    sub: 'Një kopje e plotë e aplikacionit, direkt në shfletues. Hyr si kamarier, merr porosi, paguaj — dhe shiko si pronari i kafiterisë e sheh gjithçka live në telefon, te portali i biznesit.',
    steps: [['1', 'Hyr me PIN', 'Kamarier 1234 · Menaxher 0000'], ['2', 'Hap tavolinë', 'Shto produkte, printo, paguaj'], ['3', 'Shiko telefonin', 'Portali i pronarit përditësohet live']],
    desk: 'SelliX POS — Windows',
    phone: 'Portali i biznesit — iPhone',
    reset: 'Rinis',
    scroll: 'Rrëshqit anash për ta parë të plotë',
    light: 'Light', dark: 'Dark',
  },
  en: {
    kicker: '01 — TRY THE APP',
    title: 'Try SelliX right here, no download',
    sub: 'A full copy of the app, running in your browser. Log in as a waiter, take orders, charge — and watch the café owner see it all live on the phone, in the business portal.',
    steps: [['1', 'Log in with PIN', 'Waiter 1234 · Manager 0000'], ['2', 'Open a table', 'Add items, print, charge'], ['3', 'Watch the phone', 'The owner portal updates live']],
    desk: 'SelliX POS — Windows',
    phone: 'Business portal — iPhone',
    reset: 'Reset',
    scroll: 'Swipe sideways to see it all',
    light: 'Light', dark: 'Dark',
  },
};

export default function AppDemo({ lang = 'sq', theme = 'dark', onTheme }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [deskRef, deskScale] = useFit(APP_W, 0.56);
  const [phoneRef, phoneScale] = useFit(PHONE_W);
  const c = COPY[lang] || COPY.sq;

  useEffect(() => {
    if (!state.toast) return undefined;
    const id = setTimeout(() => dispatch({ type: 'clearToast', id: state.toast.id }), 2600);
    return () => clearTimeout(id);
  }, [state.toast]);

  const overflow = APP_W * deskScale;

  return (
    <section id="demo" className="sx-demo-section">
      <div className="sx-demo-intro">
        <div>
          <div className="lp-kicker">{c.kicker}</div>
          <h2 className="lp-h2">{c.title}</h2>
          <p className="lp-lead">{c.sub}</p>
        </div>
        <ol className="sx-demo-steps">
          {c.steps.map(([n, t, s]) => (
            <li key={n}><span>{n}</span><div><b>{t}</b><small>{s}</small></div></li>
          ))}
        </ol>
      </div>

      <div className="sx-demo sx-demo-stage" data-theme={theme}>
        <div className="sx-demo-glow" />
        <div className="sx-demo-desk">
          <div className="sx-window">
            <div className="sx-window-bar">
              <span className="sx-dots"><i /><i /><i /></span>
              <span className="sx-window-title">{c.desk}</span>
              <div className="sx-window-tools">
                <div className="sx-theme-seg" role="group" aria-label="Theme">
                  <button className={theme === 'light' ? 'is-on' : ''} onClick={() => onTheme?.('light')}><Icon name="sun" size={14} /> {c.light}</button>
                  <button className={theme === 'dark' ? 'is-on' : ''} onClick={() => onTheme?.('dark')}><Icon name="moon" size={14} /> {c.dark}</button>
                </div>
                <button className="sx-window-reset" onClick={() => dispatch({ type: 'reset' })}><Icon name="refresh" size={14} /> {c.reset}</button>
              </div>
            </div>
            <div ref={deskRef} className="sx-window-viewport">
              <div style={{ width: overflow, height: APP_H * deskScale }}>
                <div className="sx-app" style={{ width: APP_W, height: APP_H, transform: `scale(${deskScale})` }}>
                  <PosApp state={state} dispatch={dispatch} />
                  {state.toast && (
                    <div key={state.toast.id} className={`sx-toast ${state.toast.tone === 'bad' ? 'is-bad' : ''}`}>
                      <Icon name={state.toast.tone === 'bad' ? 'shield' : 'check'} size={18} /> {state.toast.text}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {deskScale <= 0.56 && <div className="sx-demo-scrollhint">↔ {c.scroll}</div>}
        </div>

        <div className="sx-demo-phone">
          <div ref={phoneRef} className="sx-phone-fit">
            <div style={{ width: PHONE_W * phoneScale, height: PHONE_H * phoneScale, margin: '0 auto' }}>
              <div style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${phoneScale})`, transformOrigin: 'top left' }}>
                <PhoneApp state={state} dispatch={dispatch} />
              </div>
            </div>
          </div>
          <div className="sx-demo-caption">{c.phone}</div>
        </div>
      </div>
    </section>
  );
}

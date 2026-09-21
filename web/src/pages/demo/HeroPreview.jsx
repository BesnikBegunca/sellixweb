import { useEffect, useMemo, useRef, useState } from 'react';
import PosApp from './PosApp';
import PhoneApp from './PhoneApp';
import { initialState } from './data';
import './demo.css';
import './phone-portal.css';

const APP_W = 1200;
const APP_H = 740;
const PHONE_W = 318;
const PHONE_H = 660;
// Stage geometry in unscaled pixels: desktop window with the phone overlapping
// its bottom-right corner.
const STAGE_W = 1340;
const STAGE_H = 900;

const noop = () => {};

// A still picture of the demo for the hero: the real screens, scaled down and
// frozen (no pointer events). Clicking it jumps to the live demo.
export default function HeroPreview({ theme = 'dark' }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.4);
  const state = useMemo(() => {
    const s = initialState();
    return { ...s, user: s.staff[1], screen: 'order', table: 2 };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      if (w) setScale(w / STAGE_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <a href="#demo" className="sx-hero-preview" aria-label="Shiko demon live" ref={ref} style={{ height: STAGE_H * scale }}>
      <div className="sx-demo sx-hero-stage" data-theme={theme} style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }} aria-hidden="true" inert="">
        <div className="sx-window sx-hero-window">
          <div className="sx-window-bar">
            <span className="sx-dots"><i /><i /><i /></span>
            <span className="sx-window-title">SelliX POS — Windows</span>
          </div>
          <div className="sx-app" style={{ width: APP_W, height: APP_H }}>
            <PosApp state={state} dispatch={noop} />
          </div>
        </div>
        <div className="sx-hero-phone" style={{ width: PHONE_W, height: PHONE_H }}>
          <PhoneApp state={state} dispatch={noop} />
        </div>
      </div>
    </a>
  );
}

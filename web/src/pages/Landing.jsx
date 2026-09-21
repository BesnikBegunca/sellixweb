import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import AddToHome from './AddToHome';
import './landing.css';

const ACCENT = 'oklch(0.82 0.12 195)';
const ACCENT_SOFT = 'oklch(0.86 0.12 195)';

function Hero3D({ cat, t, spin3d = true }) {
  const stageRef = useRef(null);
  const startRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [rx, setRx] = useState(-9);
  const [ry, setRy] = useState(-26);
  const [touched, setTouched] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !window.ResizeObserver) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w) setScale(Math.min(1, w / 520));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      setRy(startRef.current.ry + dx * 0.4);
      setRx(Math.max(-30, Math.min(26, startRef.current.rx - dy * 0.28)));
    };
    const onUp = () => {
      setDragging(false);
      startRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const onDown = (e) => {
    startRef.current = { x: e.clientX, y: e.clientY, rx, ry };
    setDragging(true);
    setTouched(true);
  };

  const spinning = !touched && spin3d;

  return (
    <div>
      <div
        ref={stageRef}
        onPointerDown={onDown}
        style={{ width: 'min(520px,100%)', aspectRatio: '520/360', perspective: 1700, marginLeft: 'auto', cursor: dragging ? 'grabbing' : 'grab' }}
      >
        <div style={{ width: 520, height: 360, transformOrigin: 'top left', transform: `scale(${scale})` }}>
          <div
            style={{
              position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d',
              transform: spinning ? 'none' : `rotateX(${rx}deg) rotateY(${ry}deg)`,
              animation: spinning ? 'sellixSpin 26s ease-in-out infinite' : 'none',
              willChange: 'transform'
            }}
          >
            <div style={{ position: 'absolute', left: 0, top: 14, width: 372, height: 266, transformStyle: 'preserve-3d' }}>
              <div style={{ position: 'absolute', inset: 0, transform: 'translateZ(13px)', borderRadius: 16, background: 'linear-gradient(158deg,#101D29,#0A131C)', border: '1px solid rgba(255,255,255,.15)', boxShadow: '0 50px 90px -34px rgba(0,0,0,.95)', padding: 12, display: 'flex', flexDirection: 'column', gap: 9, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: '.14em', color: '#6D7E8E' }}>
                  <span style={{ width: 8, height: 6, border: `1.5px solid ${ACCENT}`, borderRadius: 2 }}></span>SELLIX POS
                  <span style={{ flex: 1 }}></span>{cat.badge}
                </div>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 9, minHeight: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(2,1fr)', gap: 6 }}>
                    {cat.tiles.map((tile, i) => (
                      <div key={i} style={{ borderRadius: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'flex-end', padding: 6, fontSize: 10, fontWeight: 600, color: '#C6D3DE', lineHeight: 1.15 }}>{tile}</div>
                    ))}
                  </div>
                  <div style={{ borderRadius: 8, background: 'rgba(0,0,0,.32)', border: '1px solid rgba(255,255,255,.07)', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {cat.rows.map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 10, color: '#9CAAB8' }}><span>{r.n}</span><span style={{ color: '#E4ECF3', fontVariantNumeric: 'tabular-nums' }}>{r.v}</span></div>
                    ))}
                    <div style={{ flex: 1 }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 6 }}><span style={{ color: '#9CAAB8' }}>TOTAL</span><span>{cat.total}</span></div>
                    <div style={{ borderRadius: 6, background: ACCENT, color: '#04121A', fontSize: 10, fontWeight: 700, textAlign: 'center', padding: 6 }}>{t.pay}</div>
                  </div>
                </div>
              </div>
              <div style={{ position: 'absolute', inset: 0, transform: 'translateZ(-13px) rotateY(180deg)', borderRadius: 16, background: 'linear-gradient(158deg,#0D1722,#070C12)', border: '1px solid rgba(255,255,255,.08)', display: 'grid', placeItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 26, color: 'rgba(242,246,250,.22)', letterSpacing: '-0.02em' }}>SelliX</span>
              </div>
              <div style={{ position: 'absolute', top: '50%', left: '50%', width: 372, height: 26, transform: 'translate(-50%,-50%) translateY(-133px) rotateX(90deg)', background: 'linear-gradient(#16232F,#0B141D)' }}></div>
              <div style={{ position: 'absolute', top: '50%', left: '50%', width: 372, height: 26, transform: 'translate(-50%,-50%) translateY(133px) rotateX(90deg)', background: 'linear-gradient(#0B141D,#070D14)' }}></div>
              <div style={{ position: 'absolute', top: '50%', left: '50%', width: 26, height: 266, transform: 'translate(-50%,-50%) translateX(-186px) rotateY(90deg)', background: 'linear-gradient(#131F2A,#09111A)' }}></div>
              <div style={{ position: 'absolute', top: '50%', left: '50%', width: 26, height: 266, transform: 'translate(-50%,-50%) translateX(186px) rotateY(90deg)', background: 'linear-gradient(#09111A,#131F2A)' }}></div>
              <div style={{ position: 'absolute', top: '100%', left: '50%', width: 150, height: 44, transform: 'translate(-50%,-2px) rotateX(72deg)', background: 'linear-gradient(#0E1923,#080F16)', borderRadius: '0 0 10px 10px' }}></div>
              <div style={{ position: 'absolute', top: '100%', left: '50%', width: 250, height: 120, transform: 'translate(-50%,18px) rotateX(80deg)', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(0,0,0,.75), transparent 70%)', filter: 'blur(10px)' }}></div>
            </div>

            <div style={{ position: 'absolute', right: 6, top: 132, width: 118, height: 126, transformStyle: 'preserve-3d' }}>
              <div style={{ position: 'absolute', inset: 0, transform: 'translateZ(44px)', borderRadius: 12, background: 'linear-gradient(160deg,#121F2B,#0A121A)', border: '1px solid rgba(255,255,255,.13)', padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6 }}>
                <span style={{ width: 26, height: 5, borderRadius: 3, background: ACCENT, animation: 'sellixPulse 2.6s ease-in-out infinite' }}></span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, letterSpacing: '.12em', color: '#6D7E8E' }}>{t.printer}</span>
              </div>
              <div style={{ position: 'absolute', inset: 0, transform: 'translateZ(-44px) rotateY(180deg)', borderRadius: 12, background: '#080F16', border: '1px solid rgba(255,255,255,.06)' }}></div>
              <div style={{ position: 'absolute', top: '50%', left: '50%', width: 118, height: 88, transform: 'translate(-50%,-50%) translateY(-63px) rotateX(90deg)', background: 'linear-gradient(#17242F,#0C1620)', borderRadius: 3 }}></div>
              <div style={{ position: 'absolute', top: '50%', left: '50%', width: 118, height: 88, transform: 'translate(-50%,-50%) translateY(63px) rotateX(90deg)', background: '#070D14' }}></div>
              <div style={{ position: 'absolute', top: '50%', left: '50%', width: 88, height: 126, transform: 'translate(-50%,-50%) translateX(-59px) rotateY(90deg)', background: 'linear-gradient(#101B25,#080F16)' }}></div>
              <div style={{ position: 'absolute', top: '50%', left: '50%', width: 88, height: 126, transform: 'translate(-50%,-50%) translateX(59px) rotateY(90deg)', background: 'linear-gradient(#0A121A,#111C26)' }}></div>
              <div style={{ position: 'absolute', left: '50%', top: -118, width: 86, height: 124, transformOrigin: 'bottom center', transform: 'translateX(-50%) rotateX(-14deg)', background: 'linear-gradient(#FFFFFF,#DCE4EC)', borderRadius: '3px 3px 0 0', boxShadow: '0 18px 30px -14px rgba(0,0,0,.8)', padding: '9px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 7, letterSpacing: '.12em', color: '#0A121A' }}>SELLIX · {cat.badge}</span>
                <span style={{ height: 1, background: '#B9C4CF' }}></span>
                <span style={{ height: 3, width: '76%', background: '#C9D2DB', borderRadius: 2 }}></span>
                <span style={{ height: 3, width: '58%', background: '#C9D2DB', borderRadius: 2 }}></span>
                <span style={{ height: 3, width: '66%', background: '#C9D2DB', borderRadius: 2 }}></span>
                <span style={{ height: 1, background: '#B9C4CF' }}></span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: '#0A121A', fontWeight: 600 }}>TOTAL {cat.total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#4F5E6D', letterSpacing: '.1em', marginTop: 6 }}>{t.drag}</div>
    </div>
  );
}

function SolutionMock({ cat, t }) {
  return (
    <div style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,.1)', background: 'linear-gradient(160deg,#0C1620,#080E15)', boxShadow: '0 40px 80px -40px rgba(0,0,0,.9)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#2C3A47' }}></span>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#2C3A47' }}></span>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#2C3A47' }}></span>
        <span style={{ flex: 1 }}></span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.14em', color: '#6D7E8E' }}>{cat.badge}</span>
      </div>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {cat.tiles.map((tile, i) => (
            <div key={i} style={{ aspectRatio: '1/1', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'flex-end', padding: 9, fontSize: 12, fontWeight: 600, color: '#C6D3DE', lineHeight: 1.2 }}>{tile}</div>
          ))}
        </div>
        <div style={{ borderRadius: 10, background: 'rgba(0,0,0,.34)', border: '1px solid rgba(255,255,255,.07)', padding: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {cat.rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: '#9CAAB8' }}><span>{r.n}</span><span style={{ color: '#E4ECF3', fontVariantNumeric: 'tabular-nums' }}>{r.v}</span></div>
          ))}
          <div style={{ flex: 1, minHeight: 14 }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 9 }}><span style={{ color: '#9CAAB8' }}>TOTAL</span><span>{cat.total}</span></div>
          <div style={{ borderRadius: 8, background: ACCENT, color: '#04121A', fontSize: 12, fontWeight: 700, textAlign: 'center', padding: 9 }}>{t.pay}</div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [content, setContent] = useState(null);
  const [lang, setLang] = useState('sq');
  const [catIdx, setCatIdx] = useState(0);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', business: '', phone: '', category: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [setupReady, setSetupReady] = useState(false);

  useEffect(() => {
    api.getContent().then(({ content }) => setContent(content)).catch(() => setError('load'));
    api.getSetup().then((s) => setSetupReady(Boolean(s?.available))).catch(() => setSetupReady(false));
  }, []);

  if (!content) {
    return <div style={{ minHeight: '100vh', background: '#070D14' }} />;
  }

  const t = content.t[lang];
  const cats = content.cats;
  const cat = cats[catIdx][lang];
  const compare = content.compare[lang];
  const includes = content.includes[lang];
  const quotes = content.quotes[lang];
  const price = content.price;
  const isSq = lang === 'sq';
  const setupHref = setupReady ? api.setupDownloadUrl() : '#kontakt';

  const langBtn = (on) => ({
    padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: '.06em',
    background: on ? '#F2F6FA' : 'transparent', color: on ? '#06121A' : '#8FA0B2'
  });

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.submitLead({
        name: form.name,
        business: form.business,
        phone: form.phone,
        category: form.category || cats[0][lang].n
      });
      setSent(true);
      setForm({ name: '', business: '', phone: '', category: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { padding: '15px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.3)', color: '#F2F6FA', fontSize: 15, outline: 'none' };

  return (
    <div className="lp" style={{ color: '#F2F6FA', fontFamily: 'Manrope,Helvetica,sans-serif', minHeight: '100dvh', overflowX: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: -240, left: '50%', width: 1100, height: 800, transform: 'translateX(-50%)', background: `radial-gradient(ellipse at center, oklch(0.82 0.12 195 / 0.12), transparent 65%)`, filter: 'blur(10px)', pointerEvents: 'none' }}></div>

      <nav className="lp-header" style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(18px)', background: 'rgba(7,13,20,.72)', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <div className="lp-header-inner" style={{ maxWidth: 1200, margin: '0 auto', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 18 }}>
          <a className="lp-brand" href="#top" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'block', width: 32, height: 22, border: '2px solid #F2F6FA', borderRadius: 6, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 2, right: 2, top: 4, height: 2, background: '#F2F6FA' }}></span>
            </span>
            <span className="lp-brand-text" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em' }}>SelliX</span>
          </a>
          <div className="lp-header-spacer" style={{ flex: 1 }}></div>
          <div className="lp-header-links" style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 13, fontWeight: 500, color: '#8FA0B2' }}>
            <a className="lp-navlink" href="#zgjidhjet">{isSq ? 'Zgjidhjet' : 'Solutions'}</a>
            <a className="lp-navlink" href="#krahaso">{isSq ? 'Pse Sellix' : 'Why Sellix'}</a>
            <a className="lp-navlink" href="#shkarko">{isSq ? 'Çmimi' : 'Pricing'}</a>
            <a className="lp-navlink" href="#kontakt">{isSq ? 'Kontakt' : 'Contact'}</a>
            <a className="lp-navlink" href="#shto">{isSq ? 'App' : 'App'}</a>
          </div>
          <div className="lp-header-tools" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 3, border: '1px solid rgba(255,255,255,.1)', borderRadius: 999 }}>
            <button onClick={() => setLang('sq')} style={langBtn(lang === 'sq')}>SQ</button>
            <button onClick={() => setLang('en')} style={langBtn(lang === 'en')}>EN</button>
          </div>
          <div className="lp-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link
              to="/portal/login"
              className="lp-btn-outline"
              style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,.16)', color: '#F2F6FA', fontWeight: 600, fontSize: 13 }}
            >
              {isSq ? 'Biznesi im' : 'My business'}
            </Link>
            <a href={setupHref} className="lp-btn-white" style={{ padding: '9px 18px', borderRadius: 999, background: '#F2F6FA', color: '#06121A', fontWeight: 700, fontSize: 13 }}>
              {isSq ? 'Shkarko' : 'Download'}
            </a>
          </div>
        </div>
      </nav>

      <section id="top" style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 24px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 48, alignItems: 'center', position: 'relative' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '.16em', color: ACCENT, marginBottom: 22 }}>
            {isSq ? 'SOFTWARE POS · 8 SEKTORË' : 'POS SOFTWARE · 8 SECTORS'}
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 'clamp(42px,5.4vw,72px)', lineHeight: 1.02, letterSpacing: '-0.035em', margin: '0 0 24px' }}>
            {isSq ? <>Një sistem.<br />Tetë biznese.</> : <>One system.<br />Eight businesses.</>}
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.55, color: '#8FA0B2', margin: '0 0 34px', maxWidth: 460 }}>
            {isSq ? 'Për çdo sektor një zgjidhje e dedikuar — shkarkoje, instaloje, shit brenda ditës.' : 'A dedicated solution for every sector — download it, install it, sell the same day.'}
          </p>
          <div className="lp-cta-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
            <a href={setupHref} className="lp-btn-primary" style={{ padding: '15px 26px', borderRadius: 14, background: ACCENT, color: '#04121A', fontWeight: 700, fontSize: 15 }}>
              {isSq ? 'Shkarko aplikacionin' : 'Download the app'}
            </a>
            <a href="#zgjidhjet" className="lp-btn-outline" style={{ padding: '15px 26px', borderRadius: 14, border: '1px solid rgba(255,255,255,.16)', color: '#F2F6FA', fontWeight: 600, fontSize: 15 }}>
              {isSq ? 'Shiko zgjidhjet' : 'See the solutions'}
            </a>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#61707F', letterSpacing: '.04em' }}>Windows 10/11 · macOS 12+ · {price} €/{isSq ? 'muaj' : 'mo'}</div>
        </div>

        <div style={{ minWidth: 0 }}>
          <Hero3D cat={cat} t={t} />
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '26px 24px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))', gap: 1, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 18, overflow: 'hidden' }}>
          {[
            ['8', isSq ? 'zgjidhje të dedikuara' : 'dedicated solutions'],
            [`${price} €`, isSq ? 'në muaj, një pako e vetme' : 'per month, one single plan'],
            ['99.9%', isSq ? 'kohë pune, edhe offline' : 'uptime, offline too'],
            ['24/7', isSq ? 'mbështetje në shqip' : 'support in Albanian']
          ].map(([n, l], i) => (
            <div key={i} style={{ background: '#080F17', padding: '26px 24px' }}>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em' }}>{n}</div>
              <div style={{ fontSize: 13, color: '#8FA0B2', marginTop: 6 }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="zgjidhjet" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 90px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 20, marginBottom: 32 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '.16em', color: ACCENT, marginBottom: 14 }}>01 — {isSq ? 'ZGJIDHJET' : 'SOLUTIONS'}</div>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 'clamp(30px,3.4vw,44px)', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.06 }}>
              {isSq ? 'Një software për sektorin tënd' : 'One software built for your sector'}
            </h2>
          </div>
          <p style={{ flex: 1, minWidth: 240, margin: 0, fontSize: 15, color: '#8FA0B2', lineHeight: 1.6, maxWidth: 380 }}>
            {isSq ? 'Zgjidh biznesin — ekrani, moduli dhe raportet ndryshojnë bashkë me të.' : 'Pick the business — screens, modules and reports change with it.'}
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 26 }}>
          {cats.map((c, i) => (
            <button
              key={i}
              className="lp-catbtn"
              onClick={() => setCatIdx(i)}
              style={{
                padding: '11px 17px', borderRadius: 999, fontSize: 14, fontWeight: 600,
                border: i === catIdx ? `1px solid oklch(0.82 0.12 195 / 0.6)` : '1px solid rgba(255,255,255,.1)',
                background: i === catIdx ? `oklch(0.82 0.12 195 / 0.15)` : 'rgba(255,255,255,.03)',
                color: i === catIdx ? '#EAF7FA' : '#8FA0B2'
              }}
            >
              {c[lang].n}
            </button>
          ))}
        </div>

        <div style={{ border: '1px solid rgba(255,255,255,.09)', borderRadius: 24, background: 'linear-gradient(150deg, rgba(255,255,255,.04), rgba(255,255,255,.015))', padding: 'clamp(22px,3vw,40px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 36, alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 'clamp(26px,2.8vw,36px)', letterSpacing: '-0.03em', margin: '0 0 12px' }}>{cat.n}</h3>
            <p style={{ fontSize: 17, color: 'oklch(0.86 0.09 195)', margin: '0 0 26px', lineHeight: 1.45 }}>{cat.t}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 30 }}>
              {cat.f.map((feat, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ flex: 'none', width: 7, height: 7, marginTop: 8, borderRadius: 2, background: ACCENT }}></span>
                  <span style={{ fontSize: 15, color: '#D5DFE8', lineHeight: 1.5 }}>{feat}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <a href={setupHref} className="lp-btn-white" style={{ padding: '13px 22px', borderRadius: 12, background: '#F2F6FA', color: '#06121A', fontWeight: 700, fontSize: 14 }}>{t.getModule}</a>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#61707F', letterSpacing: '.08em' }}>{t.included} {price} €</span>
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            <SolutionMock cat={cat} t={t} />
          </div>
        </div>
      </section>

      <section id="krahaso" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 90px' }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '.16em', color: ACCENT, marginBottom: 14 }}>02 — {isSq ? 'PSE SELLIX' : 'WHY SELLIX'}</div>
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 'clamp(30px,3.4vw,44px)', letterSpacing: '-0.03em', margin: '0 0 34px', lineHeight: 1.06 }}>
          {isSq ? 'Arka klasike, dhe pastaj Sellix' : 'The old cash register, then Sellix'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 16 }}>
          <div style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: 28, background: 'rgba(255,255,255,.015)' }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '.14em', color: '#61707F', marginBottom: 22 }}>{t.oldWay}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {compare.map((row, i) => (
                <div key={i} style={{ fontSize: 15, color: '#7D8C9A', lineHeight: 1.45 }}>{row.a}</div>
              ))}
            </div>
          </div>
          <div style={{ border: `1px solid oklch(0.82 0.12 195 / 0.35)`, borderRadius: 20, padding: 28, background: `linear-gradient(160deg, oklch(0.82 0.12 195 / 0.1), rgba(255,255,255,.02))` }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '.14em', color: ACCENT_SOFT, marginBottom: 22 }}>SELLIX</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {compare.map((row, i) => (
                <div key={i} style={{ fontSize: 15, color: '#EAF2F8', lineHeight: 1.45, fontWeight: 500 }}>{row.b}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="shkarko" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 90px' }}>
        <div style={{ border: '1px solid rgba(255,255,255,.09)', borderRadius: 26, background: 'linear-gradient(150deg, rgba(255,255,255,.05), rgba(255,255,255,.015))', padding: 'clamp(24px,3vw,46px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 40 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '.16em', color: ACCENT, marginBottom: 14 }}>03 — {isSq ? 'SHKARKO' : 'DOWNLOAD'}</div>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 'clamp(30px,3.4vw,44px)', letterSpacing: '-0.03em', margin: '0 0 18px', lineHeight: 1.06 }}>
              {isSq ? 'Një pako. Të gjitha modulet.' : 'One plan. Every module.'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 26 }}>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 64, lineHeight: 0.9, letterSpacing: '-0.04em' }}>{price} €</span>
              <span style={{ fontSize: 15, color: '#8FA0B2', paddingBottom: 8 }}>{isSq ? '/ muaj për pikë shitjeje' : '/ month per store'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: '12px 20px', marginBottom: 30 }}>
              {includes.map((inc, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><span style={{ flex: 'none', width: 7, height: 7, marginTop: 7, borderRadius: 2, background: ACCENT }}></span><span style={{ fontSize: 14, color: '#D5DFE8', lineHeight: 1.45 }}>{inc}</span></div>
              ))}
            </div>
            <div className="lp-cta-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <a href={setupHref} className="lp-btn-primary" style={{ padding: '15px 24px', borderRadius: 14, background: ACCENT, color: '#04121A', fontWeight: 700, fontSize: 15, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>{t.winBtn}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 500, opacity: 0.75 }}>WINDOWS 10 / 11 · 64-BIT</span>
              </a>
              <a href="#kontakt" className="lp-btn-outline2" style={{ padding: '15px 24px', borderRadius: 14, border: '1px solid rgba(255,255,255,.18)', color: '#F2F6FA', fontWeight: 700, fontSize: 15, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>{t.macBtn}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 500, color: '#7D8C9A' }}>MACOS 12+ · {isSq ? 'Kërko demo' : 'Request demo'}</span>
              </a>
            </div>
          </div>

          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '100%', borderRadius: 18, border: '1px solid rgba(255,255,255,.1)', background: 'linear-gradient(160deg,#0C1620,#080E15)', overflow: 'hidden', boxShadow: '0 40px 80px -40px rgba(0,0,0,.9)' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ display: 'block', width: 22, height: 16, border: '1.6px solid #F2F6FA', borderRadius: 4 }}></span>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14 }}>SelliX</span>
                <span style={{ flex: 1 }}></span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#6D7E8E' }}>{t.installing}</span>
              </div>
              <div style={{ padding: '26px 22px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><span style={{ display: 'block', width: '72%', height: '100%', background: ACCENT }}></span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8FA0B2' }}><span>{t.step}</span><span>72%</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginTop: 6 }}>
                  <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', padding: 14 }}><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#6D7E8E', letterSpacing: '.12em' }}>SETUP</div><div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{t.setup1}</div></div>
                  <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', padding: 14 }}><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#6D7E8E', letterSpacing: '.12em' }}>SYNC</div><div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{t.setup2}</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 90px' }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '.16em', color: ACCENT, marginBottom: 26 }}>04 — {isSq ? 'REFERENCA' : 'REFERENCES'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 16 }}>
          {quotes.map((q, i) => (
            <div key={i} style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: 28, background: 'rgba(255,255,255,.02)', display: 'flex', flexDirection: 'column', gap: 22 }}>
              <p style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: 19, lineHeight: 1.35, letterSpacing: '-0.015em', color: '#EAF2F8' }}>{q.text}</p>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#6D7E8E', letterSpacing: '.08em', lineHeight: 1.6 }}>{q.who}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="kontakt" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 90px' }}>
        <div style={{ border: '1px solid rgba(255,255,255,.09)', borderRadius: 26, padding: 'clamp(24px,3vw,46px)', background: 'linear-gradient(150deg, rgba(255,255,255,.04), rgba(255,255,255,.012))', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px,1fr))', gap: 40 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '.16em', color: ACCENT, marginBottom: 14 }}>05 — {isSq ? 'DEMO' : 'DEMO'}</div>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 'clamp(28px,3.2vw,40px)', letterSpacing: '-0.03em', margin: '0 0 16px', lineHeight: 1.06 }}>
              {isSq ? '15 minuta, biznesi yt, ekrani yt' : '15 minutes, your business, your screen'}
            </h2>
            <p style={{ fontSize: 16, color: '#8FA0B2', lineHeight: 1.6, margin: '0 0 26px', maxWidth: 380 }}>
              {isSq ? 'Tregojmë saktësisht zgjidhjen e sektorit tënd — pa prezantime të gjata.' : "We show exactly your sector's setup — no long pitch."}
            </p>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#8FA0B2', lineHeight: 2 }}>
              <div>+383 44 000 000</div>
              <div>shitje@sellix.software</div>
            </div>
          </div>
          <form onSubmit={onSubmit} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input className="lp-field" required placeholder={t.ph.name} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="lp-field" required placeholder={t.ph.biz} style={inputStyle} value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} />
            <input className="lp-field" required placeholder={t.ph.phone} style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <select className="lp-field" required style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="" disabled style={{ background: '#0A121A' }}>{isSq ? 'Zgjidh sektorin' : 'Choose a sector'}</option>
              {cats.map((c, i) => (
                <option key={i} value={c[lang].n} style={{ background: '#0A121A' }}>{c[lang].n}</option>
              ))}
            </select>
            <button type="submit" disabled={submitting} style={{ padding: '16px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, background: ACCENT, color: '#04121A', opacity: submitting ? 0.7 : 1 }}>
              {t.submit}
            </button>
            <div style={{ fontSize: 13, color: error ? '#F87171' : ACCENT_SOFT, minHeight: 20 }}>
              {error ? (isSq ? 'Diçka shkoi keq. Provo përsëri.' : 'Something went wrong. Try again.') : sent ? t.sent : ''}
            </div>
          </form>
        </div>
      </section>

      <section id="shto" className="lp-a2hs-section">
        <div className="lp-a2hs-card">
          <img src="/pwa-icon.png" alt="SelliX" className="lp-a2hs-hero-icon" width="96" height="96" />
          <div className="lp-a2hs-hero-text">
            <div className="lp-a2hs-kicker">{isSq ? 'NË TELEFON' : 'ON YOUR PHONE'}</div>
            <h2>{isSq ? 'Shto SelliX në ekranin kryesor' : 'Add SelliX to the home screen'}</h2>
            <p>
              {isSq
                ? 'Ikona e app-it, emri SelliX. Shtyp butonin më poshtë.'
                : 'App icon, name SelliX. Tap the button below.'}
            </p>
          </div>
          <AddToHome lang={lang} />
        </div>
      </section>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,.07)', padding: '34px 24px 46px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <img src="/pwa-icon.png" alt="" width="30" height="30" style={{ borderRadius: 8 }} />
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>SelliX</span>
          </div>
          <span style={{ flex: 1 }}></span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: 14, color: '#8FA0B2' }}>
            <a className="lp-navlink" href="#zgjidhjet">{isSq ? 'Zgjidhjet' : 'Solutions'}</a>
            <a className="lp-navlink" href={setupHref}>{isSq ? 'Shkarko' : 'Download'}</a>
            <a className="lp-navlink" href="#kontakt">{isSq ? 'Kontakt' : 'Contact'}</a>
            <a className="lp-navlink" href="#shto">{isSq ? 'Shto në telefon' : 'Add to phone'}</a>
            <Link className="lp-navlink" to="/portal/login">{isSq ? 'Biznesi im' : 'My business'}</Link>
            <Link className="lp-navlink" to="/admin/login">{isSq ? 'Hyrje Admin' : 'Admin Login'}</Link>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#4F5E6D', letterSpacing: '.1em' }}>SELLIX SOFTWARE · 2026</div>
        </div>
      </footer>
    </div>
  );
}

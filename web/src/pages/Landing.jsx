import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import AddToHome from './AddToHome';
import AppDemo from './demo/AppDemo';
import HeroPreview from './demo/HeroPreview';
import './landing.css';

const ACCENT = '#5EC79A';

const THEME_BG = { dark: '#0B110E', light: '#F7F8F6' };

function initialTheme() {
  try {
    const saved = localStorage.getItem('sellix-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* storage unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function ThemeIcon({ theme }) {
  return theme === 'dark' ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v3h-2zm0 19h2v3h-2zM1 11h3v2H1zm19 0h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1z" /></svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" /></svg>
  );
}

export default function Landing() {
  const [content, setContent] = useState(null);
  const [lang, setLang] = useState('sq');
  const [theme, setTheme] = useState(initialTheme);
  const [, setError] = useState('');
  const [setupReady, setSetupReady] = useState(false);

  useEffect(() => {
    api.getContent().then(({ content }) => setContent(content)).catch(() => setError('load'));
    api.getSetup().then((s) => setSetupReady(Boolean(s?.available))).catch(() => setSetupReady(false));
  }, []);

  // Keep the document background (overscroll, safe areas) in step with the theme.
  useEffect(() => {
    try { localStorage.setItem('sellix-theme', theme); } catch { /* ignore */ }
    const els = [document.documentElement, document.body, document.getElementById('root')].filter(Boolean);
    els.forEach((el) => { el.style.background = THEME_BG[theme]; });
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevMeta = meta?.getAttribute('content');
    meta?.setAttribute('content', THEME_BG[theme]);
    return () => {
      els.forEach((el) => { el.style.background = ''; });
      if (meta && prevMeta) meta.setAttribute('content', prevMeta);
    };
  }, [theme]);

  if (!content) {
    return <div style={{ minHeight: '100vh', background: THEME_BG[theme] }} />;
  }

  const t = content.t[lang];
  const compare = content.compare[lang];
  const includes = content.includes[lang];
  const price = content.price;
  const isSq = lang === 'sq';
  const setupHref = setupReady ? api.setupDownloadUrl() : '#shkarko';

  const langBtn = (on) => ({
    padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: '.06em',
    background: on ? 'var(--lp-invert)' : 'transparent', color: on ? 'var(--lp-invert-text)' : 'var(--lp-muted)'
  });
  const bullet = { flex: 'none', width: 7, height: 7, borderRadius: 2, background: 'var(--lp-accent)' };

  return (
    <div className="lp" data-theme={theme} style={{ fontFamily: 'Manrope,Helvetica,sans-serif', minHeight: '100dvh', overflowX: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: -240, left: '50%', width: 1100, height: 800, transform: 'translateX(-50%)', background: 'radial-gradient(ellipse at center, var(--lp-glow), transparent 65%)', filter: 'blur(10px)', pointerEvents: 'none' }}></div>

      <nav className="lp-header" style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(18px)', background: 'var(--lp-nav)', borderBottom: '1px solid var(--lp-border)' }}>
        <div className="lp-header-inner" style={{ maxWidth: 1200, margin: '0 auto', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 18 }}>
          <a className="lp-brand" href="#top" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'block', width: 32, height: 22, border: '2px solid var(--lp-text)', borderRadius: 6, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 2, right: 2, top: 4, height: 2, background: 'var(--lp-text)' }}></span>
            </span>
            <span className="lp-brand-text" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em' }}>SelliX</span>
          </a>
          <div className="lp-header-spacer" style={{ flex: 1 }}></div>
          <div className="lp-header-links" style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 13, fontWeight: 500, color: 'var(--lp-muted)' }}>
            <a className="lp-navlink" href="#demo">{isSq ? 'Provo' : 'Try it'}</a>
            <a className="lp-navlink" href="#krahaso">{isSq ? 'Pse Sellix' : 'Why Sellix'}</a>
            <a className="lp-navlink" href="#shkarko">{isSq ? 'Çmimi' : 'Pricing'}</a>
            <a className="lp-navlink" href="#shto">App</a>
          </div>
          <div className="lp-header-tools" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 3, border: '1px solid var(--lp-border-2)', borderRadius: 999 }}>
              <button onClick={() => setLang('sq')} style={langBtn(lang === 'sq')}>SQ</button>
              <button onClick={() => setLang('en')} style={langBtn(lang === 'en')}>EN</button>
            </div>
            <button
              className="lp-theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              <ThemeIcon theme={theme} />
            </button>
          </div>
          <div className="lp-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link
              to="/portal/login"
              className="lp-btn-outline"
              style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid var(--lp-border-2)', color: 'var(--lp-text)', fontWeight: 600, fontSize: 13 }}
            >
              {isSq ? 'Biznesi im' : 'My business'}
            </Link>
            <a href={setupHref} className="lp-btn-white" style={{ padding: '9px 18px', borderRadius: 999, background: 'var(--lp-invert)', color: 'var(--lp-invert-text)', fontWeight: 700, fontSize: 13 }}>
              {isSq ? 'Shkarko' : 'Download'}
            </a>
          </div>
        </div>
      </nav>

      <section id="top" style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 24px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 48, alignItems: 'center', position: 'relative' }}>
        <div style={{ minWidth: 0 }}>
          <div className="lp-kicker" style={{ marginBottom: 22 }}>
            {isSq ? 'SOFTWARE POS' : 'POS SOFTWARE'}
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 'clamp(42px,5.4vw,72px)', lineHeight: 1.02, letterSpacing: '-0.035em', margin: '0 0 24px' }}>
            {isSq ? <>POS.<br />Sistemi ideal.</> : <>POS.<br />The ideal system.</>}
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.55, color: 'var(--lp-muted)', margin: '0 0 34px', maxWidth: 460 }}>
            {isSq
              ? 'Shkarkoje, instaloje dhe shit brenda ditës — thjeshtë dhe i shpejtë.'
              : 'Download, install, and sell the same day — simple and fast.'}
          </p>
          <div className="lp-cta-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
            <a href={setupHref} className="lp-btn-primary" style={{ padding: '15px 26px', borderRadius: 14, background: 'var(--lp-btn)', color: 'var(--lp-btn-text)', fontWeight: 700, fontSize: 15 }}>
              {isSq ? 'Shkarko aplikacionin' : 'Download the app'}
            </a>
            <a href="#demo" className="lp-btn-outline" style={{ padding: '15px 26px', borderRadius: 14, border: '1px solid var(--lp-border-2)', color: 'var(--lp-text)', fontWeight: 600, fontSize: 15 }}>
              {isSq ? 'Provoje live →' : 'Try it live →'}
            </a>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--lp-faint)', letterSpacing: '.04em' }}>Windows 10/11 · iOS · {price} €/{isSq ? 'muaj' : 'mo'}</div>
        </div>

        <div style={{ minWidth: 0 }}>
          <HeroPreview theme={theme} />
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '26px 24px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))', gap: 1, background: 'var(--lp-border)', border: '1px solid var(--lp-border)', borderRadius: 18, overflow: 'hidden' }}>
          {[
            ['POS', isSq ? 'për biznesin tënd' : 'for your business'],
            [`${price} €`, isSq ? 'në muaj, një pako e vetme' : 'per month, one single plan'],
            ['99.9%', isSq ? 'kohë pune, edhe offline' : 'uptime, offline too'],
            ['24/7', isSq ? 'mbështetje në shqip' : 'support in Albanian']
          ].map(([n, l], i) => (
            <div key={i} style={{ background: 'var(--lp-card-solid)', padding: '26px 24px' }}>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em' }}>{n}</div>
              <div style={{ fontSize: 13, color: 'var(--lp-muted)', marginTop: 6 }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      <AppDemo lang={lang} theme={theme} onTheme={setTheme} />

      <section id="krahaso" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 90px' }}>
        <div className="lp-kicker">02 — {isSq ? 'PSE SELLIX' : 'WHY SELLIX'}</div>
        <h2 className="lp-h2" style={{ marginBottom: 34 }}>
          {isSq ? 'Arka klasike, dhe pastaj Sellix' : 'The old cash register, then Sellix'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 16 }}>
          <div style={{ border: '1px solid var(--lp-border)', borderRadius: 20, padding: 28, background: 'var(--lp-card)' }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '.14em', color: 'var(--lp-faint)', marginBottom: 22 }}>{t.oldWay}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {compare.map((row, i) => (
                <div key={i} style={{ fontSize: 15, color: 'var(--lp-muted)', lineHeight: 1.45 }}>{row.a}</div>
              ))}
            </div>
          </div>
          <div style={{ border: '1px solid var(--lp-accent-line)', borderRadius: 20, padding: 28, background: 'linear-gradient(160deg, var(--lp-accent-soft), var(--lp-card))' }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '.14em', color: 'var(--lp-accent)', marginBottom: 22 }}>SELLIX</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {compare.map((row, i) => (
                <div key={i} style={{ fontSize: 15, color: 'var(--lp-text)', lineHeight: 1.45, fontWeight: 500 }}>{row.b}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="shkarko" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 90px' }}>
        <div style={{ border: '1px solid var(--lp-border)', borderRadius: 26, background: 'var(--lp-card)', padding: 'clamp(24px,3vw,46px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 40 }}>
          <div style={{ minWidth: 0 }}>
            <div className="lp-kicker">03 — {isSq ? 'SHKARKO' : 'DOWNLOAD'}</div>
            <h2 className="lp-h2" style={{ marginBottom: 18 }}>
              {isSq ? 'Një pako. Të gjitha modulet.' : 'One plan. Every module.'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 26 }}>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 64, lineHeight: 0.9, letterSpacing: '-0.04em' }}>{price} €</span>
              <span style={{ fontSize: 15, color: 'var(--lp-muted)', paddingBottom: 8 }}>{isSq ? '/ muaj për pikë shitjeje' : '/ month per store'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: '12px 20px', marginBottom: 30 }}>
              {includes.map((inc, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><span style={{ ...bullet, marginTop: 7 }}></span><span style={{ fontSize: 14, color: 'var(--lp-text-2)', lineHeight: 1.45 }}>{inc}</span></div>
              ))}
            </div>
            <div className="lp-cta-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <a href={setupHref} className="lp-btn-primary" style={{ padding: '15px 24px', borderRadius: 14, background: 'var(--lp-btn)', color: 'var(--lp-btn-text)', fontWeight: 700, fontSize: 15, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>{t.winBtn}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 500, opacity: 0.75 }}>WINDOWS 10 / 11 · 64-BIT</span>
              </a>
            </div>
          </div>

          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '100%', borderRadius: 18, border: '1px solid rgba(255,255,255,.1)', background: 'linear-gradient(160deg,#0E1812,#09100C)', overflow: 'hidden', boxShadow: 'var(--lp-shadow)', color: '#ECF3EE' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ display: 'block', width: 22, height: 16, border: '1.6px solid #ECF3EE', borderRadius: 4 }}></span>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14 }}>SelliX</span>
                <span style={{ flex: 1 }}></span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#6E8378' }}>{t.installing}</span>
              </div>
              <div style={{ padding: '26px 22px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><span style={{ display: 'block', width: '72%', height: '100%', background: ACCENT }}></span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8DA396' }}><span>{t.step}</span><span>72%</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginTop: 6 }}>
                  <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', padding: 14 }}><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#6E8378', letterSpacing: '.12em' }}>SETUP</div><div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{t.setup1}</div></div>
                  <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', padding: 14 }}><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#6E8378', letterSpacing: '.12em' }}>SYNC</div><div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{t.setup2}</div></div>
                </div>
              </div>
            </div>
          </div>
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

      <footer style={{ borderTop: '1px solid var(--lp-border)', padding: '34px 24px 46px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <img src="/pwa-icon.png" alt="" width="30" height="30" style={{ borderRadius: 8 }} />
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>SelliX</span>
          </div>
          <span style={{ flex: 1 }}></span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: 14, color: 'var(--lp-muted)' }}>
            <a className="lp-navlink" href="#demo">{isSq ? 'Provo app-in' : 'Try the app'}</a>
            <a className="lp-navlink" href={setupHref}>{isSq ? 'Shkarko' : 'Download'}</a>
            <a className="lp-navlink" href="#shto">{isSq ? 'Shto në telefon' : 'Add to phone'}</a>
            <Link className="lp-navlink" to="/portal/login">{isSq ? 'Biznesi im' : 'My business'}</Link>
            <Link className="lp-navlink" to="/admin/login">{isSq ? 'Hyrje Admin' : 'Admin Login'}</Link>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--lp-faint)', letterSpacing: '.1em' }}>SELLIX SOFTWARE · 2026</div>
        </div>
      </footer>
    </div>
  );
}

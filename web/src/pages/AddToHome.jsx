import { useEffect, useState } from 'react';

function detectPlatform() {
  const ua = window.navigator.userAgent || '';
  const iPadOs = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/i.test(ua) || iPadOs) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|Edg|Firefox/i.test(ua)) return 'mac-safari';
  return 'desktop';
}

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    window.__a2hsInstalled === true
  );
}

function waitForPrompt(ms) {
  if (window.__a2hsPrompt) return Promise.resolve(window.__a2hsPrompt);
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener('a2hs-ready', done);
      resolve(window.__a2hsPrompt || null);
    };
    const timer = setTimeout(done, ms);
    window.addEventListener('a2hs-ready', done);
  });
}

function iosLayout() {
  const ua = window.navigator.userAgent || '';
  const iPad = /iPad/i.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  if (/CriOS/i.test(ua)) return { arrow: 'top-right', browser: 'chrome' };
  if (/FxiOS|EdgiOS|OPiOS/i.test(ua)) return { arrow: null, browser: 'other' };
  if (iPad) return { arrow: 'top-right', browser: 'safari' };
  const ver = parseInt((ua.match(/Version\/(\d+)/) || [])[1] || '0', 10);
  if (ver >= 26) return { arrow: 'bottom-right', browser: 'safari26' };
  return { arrow: 'bottom-center', browser: 'safari' };
}

const IconShare = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12 3.2 7.8 7.4l1.4 1.4 1.8-1.8V15h2V7l1.8 1.8 1.4-1.4zM6 10v10h12V10h2v12H4V10z" />
  </svg>
);

const IconHome = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12 3.2 3 11h2.5v8.5h5V14h3v5.5h5V11H21z" />
  </svg>
);

const IconCheck = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M9.6 16.6 5.4 12.4l1.4-1.4 2.8 2.8 7-7 1.4 1.4z" />
  </svg>
);

const IconDots = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="6" cy="12" r="2" fill="currentColor" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <circle cx="18" cy="12" r="2" fill="currentColor" />
  </svg>
);

function guideSteps(platform, sq) {
  switch (platform) {
    case 'ios': {
      const { browser } = iosLayout();
      const step1 =
        browser === 'safari26'
          ? {
              icon: <IconDots />,
              title: sq ? 'Shtyp •••' : 'Tap •••',
              detail: sq ? 'Poshtë djathtas, pastaj Share' : 'Bottom right, then Share',
            }
          : browser === 'other'
            ? {
                icon: <IconShare />,
                title: sq ? 'Hap Share' : 'Open Share',
                detail: sq ? 'Nga menyja e shfletuesit' : 'From the browser menu',
              }
            : {
                icon: <IconShare />,
                title: sq ? 'Shtyp Share' : 'Tap Share',
                detail: sq ? 'Ku tregon shigjeta' : 'Where the arrow points',
              };
      return {
        kicker: sq ? '3 PREKJE' : '3 TAPS',
        title: sq ? 'Shto në Home Screen' : 'Add to Home Screen',
        text: sq
          ? 'Ikona dhe emri SelliX vendosen vetë — ndiq hapat më poshtë.'
          : 'The SelliX icon and name are set for you — follow the steps below.',
        steps: [
          step1,
          {
            icon: <IconHome />,
            title: 'Add to Home Screen',
            detail: sq ? 'Nëse s’e sheh, shtyp View More' : 'Tap View More if you don’t see it',
          },
          {
            icon: <IconCheck />,
            title: sq ? 'Shtyp Add' : 'Tap Add',
            detail: sq ? 'Gati — hapet si app' : 'Done — opens like an app',
          },
        ],
      };
    }
    case 'android':
      return {
        kicker: sq ? 'INSTALIM' : 'INSTALL',
        title: sq ? 'Shto SelliX' : 'Add SelliX',
        text: sq
          ? 'Shfletuesi nuk e hapi dritaren automatike. Vazhdo nga menyja:'
          : 'Your browser did not show the automatic prompt. Continue from the menu:',
        steps: [
          { icon: <IconDots />, title: sq ? 'Menyja ⋮' : 'Menu ⋮', detail: sq ? 'Lart djathtas' : 'Top right' },
          { icon: <IconHome />, title: sq ? 'Install / Add' : 'Install / Add', detail: 'Add to Home screen' },
          { icon: <IconCheck />, title: sq ? 'Konfirmo' : 'Confirm', detail: 'Install' },
        ],
      };
    case 'mac-safari':
      return {
        kicker: 'MAC',
        title: sq ? 'Shto në Dock' : 'Add to Dock',
        text: sq ? 'Në Safari për Mac:' : 'In Safari on Mac:',
        steps: [
          { icon: <IconShare />, title: 'File / Share', detail: sq ? 'Hap menynë' : 'Open the menu' },
          { icon: <IconHome />, title: 'Add to Dock', detail: sq ? 'Zgjidh opsionin' : 'Choose the option' },
          { icon: <IconCheck />, title: 'Add', detail: sq ? 'Konfirmo' : 'Confirm' },
        ],
      };
    default:
      return {
        kicker: 'CHROME / EDGE',
        title: sq ? 'Instalo SelliX' : 'Install SelliX',
        text: sq
          ? 'Instalimi automatik punon në Chrome dhe Edge. Nëse dritarja nuk u shfaq:'
          : 'Automatic install works in Chrome and Edge. If no prompt appeared:',
        steps: [
          { icon: <IconShare />, title: 'Chrome / Edge', detail: sq ? 'Hape faqen aty' : 'Open this page there' },
          { icon: <IconHome />, title: sq ? 'Ikonë ⊕' : 'Icon ⊕', detail: sq ? 'Në shiritin e adresës' : 'In the address bar' },
          { icon: <IconCheck />, title: 'Install', detail: 'SelliX' },
        ],
      };
  }
}

function GuideSheet({ g, sq, onClose }) {
  return (
    <div className="lp-a2hs-sheet lp-a2hs-sheet--guide" onClick={(e) => e.stopPropagation()}>
      <div className="lp-a2hs-home-preview" aria-hidden="true">
        <div className="lp-a2hs-home-grid">
          <span className="lp-a2hs-home-dot" />
          <span className="lp-a2hs-home-dot" />
          <span className="lp-a2hs-home-app">
            <img src="/pwa-icon.png" alt="" width="44" height="44" />
            <em>SelliX</em>
          </span>
          <span className="lp-a2hs-home-dot" />
        </div>
      </div>

      <div className="lp-a2hs-kicker lp-a2hs-sheet-kicker">{g.kicker}</div>
      <div className="lp-a2hs-sheet-name">{g.title}</div>
      <p>{g.text}</p>

      <ol className="lp-a2hs-cards">
        {g.steps.map((step, i) => (
          <li key={i} className="lp-a2hs-card-step" style={{ animationDelay: `${80 + i * 90}ms` }}>
            <span className="lp-a2hs-card-num">{i + 1}</span>
            <span className="lp-a2hs-card-icon">{step.icon}</span>
            <span className="lp-a2hs-card-copy">
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <button type="button" className="lp-a2hs-close" onClick={onClose}>
        {sq ? 'Kuptova' : 'Got it'}
      </button>
    </div>
  );
}

export default function AddToHome({ lang = 'sq' }) {
  const [installed, setInstalled] = useState(isStandalone);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const sq = lang === 'sq';
  const platform = detectPlatform();

  useEffect(() => {
    const onInstalled = () => {
      setInstalled(true);
      setGuideOpen(false);
    };
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  const onInstall = async () => {
    setConfirmOpen(false);
    if (platform === 'ios' || platform === 'mac-safari') {
      setGuideOpen(true);
      return;
    }
    setBusy(true);
    try {
      const prompt = await waitForPrompt(1500);
      if (!prompt) {
        setGuideOpen(true);
        return;
      }
      window.__a2hsPrompt = null;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === 'accepted') setInstalled(true);
    } catch {
      setGuideOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const g = guideSteps(platform, sq);
  const arrow = platform === 'ios' ? iosLayout().arrow : null;

  return (
    <>
      <button
        type="button"
        className="lp-a2hs"
        onClick={platform === 'ios' ? onInstall : () => setConfirmOpen(true)}
        disabled={busy || installed}
      >
        <img src="/pwa-icon.png" alt="" width="56" height="56" className="lp-a2hs-icon" />
        <span className="lp-a2hs-copy">
          <span className="lp-a2hs-name">SelliX</span>
          <span className="lp-a2hs-label">
            {installed
              ? (sq ? 'Është shtuar ✓' : 'Installed ✓')
              : busy
                ? (sq ? 'Duke shtuar…' : 'Adding…')
                : 'Add to Home Screen'}
          </span>
        </span>
      </button>

      {confirmOpen && (
        <div className="lp-a2hs-back" role="dialog" aria-modal="true" onClick={() => setConfirmOpen(false)}>
          <div className="lp-a2hs-sheet" onClick={(e) => e.stopPropagation()}>
            <img src="/pwa-icon.png" alt="SelliX" width="72" height="72" className="lp-a2hs-preview" />
            <div className="lp-a2hs-sheet-name">{sq ? 'Instalo SelliX?' : 'Install SelliX?'}</div>
            <p>
              {sq
                ? 'SelliX do të shtohet në ekranin kryesor / desktop dhe hapet si aplikacion.'
                : 'SelliX will be added to your home screen / desktop and opens like an app.'}
            </p>
            <div className="lp-a2hs-actions">
              <button type="button" className="lp-a2hs-cancel" onClick={() => setConfirmOpen(false)}>
                {sq ? 'Anulo' : 'Cancel'}
              </button>
              <button type="button" className="lp-a2hs-close" onClick={onInstall}>
                {sq ? 'Instalo' : 'Install'}
              </button>
            </div>
          </div>
        </div>
      )}

      {guideOpen && (
        <div
          className={`lp-a2hs-back${arrow ? ` lp-a2hs-back--${arrow.startsWith('bottom') ? 'top' : 'bottom'}` : ''}`}
          role="dialog"
          aria-modal="true"
          onClick={() => setGuideOpen(false)}
        >
          {arrow && (
            <div className={`lp-a2hs-arrow lp-a2hs-arrow--${arrow}`} aria-hidden="true">
              <span className="lp-a2hs-arrow-pulse" />
              <svg width="40" height="40" viewBox="0 0 24 24">
                <path fill="currentColor" d="M11 3h2v13.2l4.6-4.6 1.4 1.4-7 7-7-7 1.4-1.4 4.6 4.6z" />
              </svg>
            </div>
          )}
          <GuideSheet g={g} sq={sq} onClose={() => setGuideOpen(false)} />
        </div>
      )}
    </>
  );
}

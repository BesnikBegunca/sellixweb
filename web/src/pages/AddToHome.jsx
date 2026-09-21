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

// The native prompt can arrive a moment after the page loads — wait briefly for it.
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

const ShareIcon = () => (
  <svg className="lp-a2hs-ios-share" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12 3.2 7.8 7.4l1.4 1.4 1.8-1.8V15h2V7l1.8 1.8 1.4-1.4zM6 10v10h12V10h2v12H4V10z" />
  </svg>
);

function guide(platform, sq) {
  switch (platform) {
    case 'ios':
      return {
        text: sq
          ? 'Apple nuk lejon shtimin automatik në iPhone/iPad. Bëje me 3 hapa — ikona dhe emri SelliX vendosen vetë.'
          : 'Apple does not allow automatic install on iPhone/iPad. It takes 3 taps — the SelliX name and icon are set automatically.',
        steps: [
          <>{sq ? 'Shtyp Share' : 'Tap Share'} <ShareIcon /> {sq ? '(poshtë ose lart në Safari)' : '(bottom or top bar in Safari)'}</>,
          sq ? 'Zgjidh "Add to Home Screen" (Shto në ekranin bazë)' : 'Choose "Add to Home Screen"',
          sq ? 'Shtyp "Add" — gati!' : 'Tap "Add" — done!',
        ],
      };
    case 'android':
      return {
        text: sq
          ? 'Shfletuesi yt nuk e hapi dritaren automatike. Shtoje nga menyja:'
          : 'Your browser did not show the automatic prompt. Add it from the menu:',
        steps: [
          sq ? 'Shtyp menynë ⋮ (lart djathtas)' : 'Tap the ⋮ menu (top right)',
          sq ? 'Zgjidh "Install app" ose "Add to Home screen"' : 'Choose "Install app" or "Add to Home screen"',
          sq ? 'Konfirmo me "Install" / "Add"' : 'Confirm with "Install" / "Add"',
        ],
      };
    case 'mac-safari':
      return {
        text: sq ? 'Në Safari për Mac:' : 'In Safari on Mac:',
        steps: [
          sq ? 'Hap menynë File (ose Share)' : 'Open the File (or Share) menu',
          sq ? 'Zgjidh "Add to Dock"' : 'Choose "Add to Dock"',
          sq ? 'Shtyp "Add"' : 'Click "Add"',
        ],
      };
    default:
      return {
        text: sq
          ? 'Instalimi automatik punon në Chrome dhe Edge. Nëse dritarja nuk u shfaq:'
          : 'Automatic install works in Chrome and Edge. If no prompt appeared:',
        steps: [
          sq ? 'Hape faqen në Chrome ose Microsoft Edge' : 'Open this page in Chrome or Microsoft Edge',
          sq ? 'Kliko ikonën e instalimit ⊕ në shiritin e adresës' : 'Click the install icon ⊕ in the address bar',
          sq ? 'Ose menyja ⋮ → "Install SelliX" / "Apps → Install"' : 'Or menu ⋮ → "Install SelliX" / "Apps → Install"',
        ],
      };
  }
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

  // "Instalo" in our confirm sheet is a fresh user gesture, so the native prompt/share can open from it.
  const onInstall = async () => {
    setConfirmOpen(false);
    // iOS never fires beforeinstallprompt — open the native share sheet, which slides up
    // from the bottom; the user picks "Add to Home Screen" there.
    if (platform === 'ios' && navigator.share) {
      try {
        await navigator.share({ title: 'SelliX', url: window.location.origin + '/' });
      } catch (err) {
        if (err?.name !== 'AbortError') setGuideOpen(true);
      }
      return;
    }
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
      window.__a2hsPrompt = null; // a prompt can only be used once
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === 'accepted') setInstalled(true);
    } catch {
      setGuideOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const g = guide(platform, sq);

  return (
    <>
      <button type="button" className="lp-a2hs" onClick={platform === 'ios' ? onInstall : () => setConfirmOpen(true)}disabled={busy || installed}>
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
              {platform === 'ios'
                ? (sq
                  ? 'SelliX do të shtohet në ekranin kryesor. Pas "Instalo", zgjidh "Add to Home Screen" në menynë që hapet.'
                  : 'SelliX will be added to your home screen. After "Install", choose "Add to Home Screen" in the menu that opens.')
                : (sq
                  ? 'SelliX do të shtohet në ekranin kryesor / desktop dhe hapet si aplikacion.'
                  : 'SelliX will be added to your home screen / desktop and opens like an app.')}
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
        <div className="lp-a2hs-back" role="dialog" aria-modal="true" onClick={() => setGuideOpen(false)}>
          <div className="lp-a2hs-sheet" onClick={(e) => e.stopPropagation()}>
            <img src="/pwa-icon.png" alt="SelliX" width="72" height="72" className="lp-a2hs-preview" />
            <div className="lp-a2hs-sheet-name">SelliX</div>
            <p>{g.text}</p>
            <ol className="lp-a2hs-steps">
              {g.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            <button type="button" className="lp-a2hs-close" onClick={() => setGuideOpen(false)}>
              {sq ? 'Mbyll' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

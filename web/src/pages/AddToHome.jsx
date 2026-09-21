import { useEffect, useState } from 'react';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIos() {
  const ua = window.navigator.userAgent || '';
  const iPhone = /iPad|iPhone|iPod/i.test(ua);
  const iPadOs = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return iPhone || iPadOs;
}

export default function AddToHome({ lang = 'sq' }) {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const sq = lang === 'sq';

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return undefined;
    }
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setIosOpen(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const onClick = async () => {
    if (deferred) {
      setBusy(true);
      try {
        deferred.prompt();
        await deferred.userChoice;
      } catch {
        /* user dismissed */
      } finally {
        setBusy(false);
        setDeferred(null);
        if (isStandalone()) setInstalled(true);
      }
      return;
    }
    setIosOpen(true);
  };

  return (
    <>
      <button type="button" className="lp-a2hs" onClick={onClick} disabled={busy}>
        <img src="/pwa-icon.png" alt="" width="56" height="56" className="lp-a2hs-icon" />
        <span className="lp-a2hs-copy">
          <span className="lp-a2hs-name">SelliX</span>
          <span className="lp-a2hs-label">
            {busy ? (sq ? 'Duke shtuar…' : 'Adding…') : (sq ? 'Add to Home Screen' : 'Add to Home Screen')}
          </span>
        </span>
      </button>

      {iosOpen && (
        <div className="lp-a2hs-back" role="dialog" aria-modal="true" onClick={() => setIosOpen(false)}>
          <div className="lp-a2hs-sheet" onClick={(e) => e.stopPropagation()}>
            <img src="/pwa-icon.png" alt="SelliX" width="72" height="72" className="lp-a2hs-preview" />
            <div className="lp-a2hs-sheet-name">SelliX</div>
            <p>
              {isIos()
                ? (sq
                  ? 'Në iPhone, shtyp Share pastaj Add to Home Screen. Ikona dhe emri SelliX vendosen automatikisht.'
                  : 'On iPhone, tap Share then Add to Home Screen. The SelliX name and icon are applied automatically.')
                : (sq
                  ? 'Hape këtë faqe në Chrome të telefonit dhe shtyp përsëri butonin — aty shtohet direkt në ekranin kryesor.'
                  : 'Open this page in Chrome on your phone and tap the button again — it adds SelliX to the home screen.')}
            </p>
            {isIos() && (
              <ol className="lp-a2hs-steps">
                <li>
                  {sq ? 'Shtyp Share' : 'Tap Share'}{' '}
                  <svg className="lp-a2hs-ios-share" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M12 3.2 7.8 7.4l1.4 1.4 1.8-1.8V15h2V7l1.8 1.8 1.4-1.4zM6 10v10h12V10h2v12H4V10z" />
                  </svg>
                </li>
                <li>{sq ? 'Zgjidh Add to Home Screen' : 'Choose Add to Home Screen'}</li>
                <li>{sq ? 'Shtyp Add — emri është SelliX' : 'Tap Add — the name is SelliX'}</li>
              </ol>
            )}
            <button type="button" className="lp-a2hs-close" onClick={() => setIosOpen(false)}>
              {sq ? 'Mbyll' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

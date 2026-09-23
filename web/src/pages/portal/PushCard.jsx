import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { currentSubscription, disablePush, enablePush, pushSupport } from '../../lib/push';

const DISMISS_KEY = 'sellix_push_prompt_dismissed';
// The prompt and the Llogaria card are separate instances; this keeps them in step.
const CHANGE_EVENT = 'sellix-push-change';

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

// Turns push notifications on for this device. `compact` is the prompt shown
// above the portal pages until the owner enables or dismisses it; the full
// card lives on the Llogaria page.
export default function PushCard({ compact = false }) {
  const [support, setSupport] = useState(() => pushSupport());
  const [subscribed, setSubscribed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    let alive = true;
    const check = () => currentSubscription()
      .then((sub) => alive && setSubscribed(!!sub))
      .catch(() => alive && setSubscribed(false));
    check();
    window.addEventListener(CHANGE_EVENT, check);
    return () => {
      alive = false;
      window.removeEventListener(CHANGE_EVENT, check);
    };
  }, []);

  const turnOn = async () => {
    setBusy(true);
    setError('');
    setNote('');
    try {
      await enablePush();
      setSubscribed(true);
      window.dispatchEvent(new Event(CHANGE_EVENT));
      setNote('Njoftimet u aktivizuan në këtë pajisje.');
    } catch (err) {
      setError(err.message || 'Njoftimet nuk u aktivizuan.');
      setSupport(pushSupport());
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setError('');
    try {
      await disablePush();
      setSubscribed(false);
      window.dispatchEvent(new Event(CHANGE_EVENT));
      setNote('Njoftimet u çaktivizuan.');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api.portalPushTest();
      setNote(r.delivered ? 'Njoftimi provë u dërgua.' : 'Asnjë pajisje nuk e mori njoftimin.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  if (compact) {
    if (dismissed || subscribed !== false || support === 'unsupported' || support === 'denied') return null;
    return (
      <div className="ad-card pt-push-prompt">
        <span className="pt-push-ic" aria-hidden="true">🔔</span>
        <div className="pt-push-text">
          <b>Merr njoftim kur arrini objektivin ditor</b>
          <span className="ad-hint">
            {support === 'needs-install'
              ? 'Në iPhone: Share → “Add to Home Screen”, pastaj hape SelliX nga ekrani kryesor.'
              : 'Si aplikacion i vërtetë — edhe kur telefoni është i mbyllur.'}
          </span>
          {error && <span className="ad-error">{error}</span>}
        </div>
        <div className="pt-push-actions">
          {support === 'ready' && <button type="button" className="ad-btn" onClick={turnOn} disabled={busy}>{busy ? '…' : 'Aktivizo'}</button>}
          <button type="button" className="ad-btn-ghost" onClick={dismiss}>Më vonë</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ad-card pt-panel">
      <h2 className="ad-heading pt-h">Njoftimet</h2>
      <p className="ad-hint" style={{ margin: '0 0 14px', lineHeight: 1.5 }}>
        Aktivizo njoftimet në këtë pajisje. Pastaj te cilësimet lart zgjidh Always ose Customize.
      </p>
      {support === 'needs-install' && (
        <ol className="pt-push-steps">
          <li>Hape këtë faqe në <b>Safari</b> në iPhone.</li>
          <li>Shtyp <b>Share</b> → <b>Add to Home Screen</b>.</li>
          <li>Hape <b>SelliX</b> nga ekrani kryesor dhe kthehu këtu te Llogaria.</li>
        </ol>
      )}
      {support === 'unsupported' && <div className="ad-hint">Ky shfletues nuk i mbështet njoftimet. Provo Chrome, Edge ose Safari (iOS 16.4+).</div>}
      {support === 'denied' && (
        <div className="ad-error">Njoftimet janë bllokuar për këtë faqe. Lejoji te cilësimet e shfletuesit ose të telefonit, pastaj rifresko.</div>
      )}
      {support === 'ready' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {subscribed ? (
            <>
              <span className="pt-push-on">● Aktive në këtë pajisje</span>
              <button type="button" className="ad-btn-ghost" onClick={test} disabled={busy}>Dërgo njoftim provë</button>
              <button type="button" className="ad-btn-ghost" onClick={turnOff} disabled={busy}>Çaktivizo</button>
            </>
          ) : (
            <button type="button" className="ad-btn" onClick={turnOn} disabled={busy || subscribed === null}>
              {busy ? 'Duke aktivizuar…' : 'Aktivizo njoftimet'}
            </button>
          )}
        </div>
      )}
      {error && <div className="ad-error" style={{ marginTop: 10 }}>{error}</div>}
      {note && <div style={{ color: '#8FD8B8', fontSize: 13, marginTop: 10 }}>{note}</div>}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { currentSubscription, enablePush, isStandalone, pushSupport } from '../../lib/push';

const SEEN_KEY = 'sellix_push_welcome_seen';

function seen() {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

// First launch from the home screen: ask for notifications straight away.
// iOS only shows its "Allow notifications" alert in response to a tap, so this
// screen puts one big button in front of the owner; the tap triggers the
// system prompt. If permission was already granted, it subscribes silently.
export default function PushWelcome() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isStandalone() || pushSupport() !== 'ready') return;
    let alive = true;
    currentSubscription().then((sub) => {
      if (!alive || sub) return;
      if (Notification.permission === 'granted') {
        enablePush().catch(() => {});
        return;
      }
      if (Notification.permission === 'default' && !seen()) setOpen(true);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!open) return null;

  const allow = async () => {
    setBusy(true);
    setError('');
    try {
      await enablePush();
      markSeen();
      window.dispatchEvent(new Event('sellix-push-change'));
      setOpen(false);
    } catch (err) {
      markSeen();
      setError(err.message || 'Njoftimet nuk u aktivizuan.');
    } finally {
      setBusy(false);
    }
  };

  const later = () => {
    markSeen();
    setOpen(false);
  };

  return (
    <div className="pt-welcome" role="dialog" aria-modal="true" aria-labelledby="pt-welcome-title">
      <div className="pt-welcome-card">
        <img src="/icon-192.png" alt="" className="pt-welcome-icon" />
        <div className="pt-welcome-bell" aria-hidden="true">🔔</div>
        <h2 id="pt-welcome-title" className="ad-heading">Lejo njoftimet</h2>
        <p>Merrni njoftim në telefon sapo të arrini objektivin ditor, kur licenca afron skadimin dhe kur SelliX ju shkruan.</p>
        <ul>
          <li>🎉 “Urime! Keni arritur objektivin”</li>
          <li>📅 Kujtesë për vazhdimin e licencës</li>
          <li>💬 Mesazhe nga ekipi SelliX</li>
        </ul>
        {error && <div className="ad-error" style={{ marginBottom: 12 }}>{error}</div>}
        <button type="button" className="ad-btn pt-welcome-allow" onClick={allow} disabled={busy}>
          {busy ? 'Duke aktivizuar…' : 'Lejo njoftimet'}
        </button>
        <button type="button" className="pt-welcome-later" onClick={later} disabled={busy}>Jo tani</button>
      </div>
    </div>
  );
}

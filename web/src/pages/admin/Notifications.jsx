import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import './admin.css';

function formatWhen(raw) {
  const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]} · ${m[4]}:${m[5]}` : '—';
}

const TITLE_MAX = 80;
const BODY_MAX = 300;

export default function Notifications() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all');
  const [picked, setPicked] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.getNotifications().then(setData).catch((e) => setError(e.message));
  }, []);

  const businesses = useMemo(() => data?.businesses || [], [data]);
  const filtered = businesses.filter((b) => `${b.name} ${b.city}`.toLowerCase().includes(query.trim().toLowerCase()));
  const chosen = target === 'all' ? businesses : businesses.filter((b) => picked.has(b.id));
  const devices = chosen.reduce((s, b) => s + b.devices, 0);

  const toggle = (id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!title.trim() || !body.trim()) return setError('Shkruaj titullin dhe mesazhin.');
    if (target === 'selected' && !picked.size) return setError('Zgjidh së paku një biznes.');
    const who = target === 'all' ? 'të gjitha bizneset' : `${picked.size} biznes${picked.size === 1 ? '' : 'e'}`;
    if (!window.confirm(`Dërgo njoftimin te ${who}?`)) return;
    setSending(true);
    try {
      const r = await api.sendNotification({ title, body, target, businessIds: [...picked] });
      setResult(r);
      setData((prev) => ({ ...prev, history: r.history }));
      setTitle('');
      setBody('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="ad-page-head">
        <h1 className="ad-heading">Notifications</h1>
      </div>
      <p className="ad-hint" style={{ margin: '-6px 0 18px', fontSize: 13, lineHeight: 1.5 }}>
        Mesazhi arrin si njoftim në telefonat e pronarëve që kanë aktivizuar njoftimet te portali (iPhone me SelliX në ekranin kryesor, Android, kompjuter).
        Njoftimi “Urime! Keni arritur objektivin” dërgohet automatikisht.
      </p>

      <div className="ad-notify-grid">
        <form className="ad-card ad-notify-form" onSubmit={send}>
          <label className="ad-notify-label">
            <span>Titulli <span className="ad-hint">{title.length}/{TITLE_MAX}</span></span>
            <input className="ad-field" maxLength={TITLE_MAX} placeholder="p.sh. Përditësim i ri i SelliX" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="ad-notify-label">
            <span>Mesazhi <span className="ad-hint">{body.length}/{BODY_MAX}</span></span>
            <textarea className="ad-field" rows={4} maxLength={BODY_MAX} placeholder="Çfarë do t’u shkruash pronarëve…" value={body} onChange={(e) => setBody(e.target.value)} />
          </label>

          <div className="ad-notify-label">Kujt t’i dërgohet</div>
          <div className="ad-notify-targets">
            <button type="button" className={target === 'all' ? 'active' : ''} onClick={() => setTarget('all')}>
              Të gjitha bizneset <span>{businesses.length}</span>
            </button>
            <button type="button" className={target === 'selected' ? 'active' : ''} onClick={() => setTarget('selected')}>
              Zgjidh bizneset <span>{picked.size}</span>
            </button>
          </div>

          {target === 'selected' && (
            <div className="ad-notify-picker">
              <input className="ad-field" placeholder="Kërko biznesin…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <div className="ad-notify-list">
                {!data && <div className="ad-hint">Duke ngarkuar…</div>}
                {data && !filtered.length && <div className="ad-hint">Asnjë biznes.</div>}
                {filtered.map((b) => (
                  <label key={b.id} className={`ad-notify-row ${picked.has(b.id) ? 'on' : ''}`}>
                    <input type="checkbox" checked={picked.has(b.id)} onChange={() => toggle(b.id)} />
                    <span className="ad-notify-name">
                      <b>{b.name}</b>
                      {b.city && <span className="ad-hint">{b.city}</span>}
                    </span>
                    <span className={`ad-notify-devices ${b.devices ? '' : 'none'}`}>
                      {b.devices ? `${b.devices} pajisje` : 'pa njoftime'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="ad-notify-summary">
            Do të dërgohet te <b>{chosen.length}</b> biznese · <b>{devices}</b> pajisje me njoftime aktive
          </div>
          {error && <div className="ad-error">{error}</div>}
          {result && (
            <div className="ad-notify-ok">
              ✓ U dërgua te {result.businesses} biznese — {result.delivered} pajisje e morën{result.failed ? `, ${result.failed} dështuan` : ''}.
            </div>
          )}
          <button className="ad-btn" type="submit" disabled={sending}>{sending ? 'Duke dërguar…' : 'Dërgo njoftimin'}</button>
        </form>

        <div className="ad-notify-preview">
          <div className="ad-hint" style={{ marginBottom: 10 }}>Si duket në iPhone</div>
          <div className="ad-notify-phone">
            <div className="ad-notify-banner">
              <img src="/icon-192.png" alt="" />
              <div>
                <div className="ad-notify-top"><b>SelliX</b><span>tani</span></div>
                <b>{title || 'Titulli i njoftimit'}</b>
                <span>{body || 'Mesazhi që shkruan shfaqet këtu.'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ad-card" style={{ marginTop: 20 }}>
        <h2 className="ad-heading" style={{ fontSize: 16, fontWeight: 700, margin: 0, padding: '16px 16px 4px' }}>Njoftimet e dërguara</h2>
        {!data?.history?.length ? (
          <div className="ad-hint" style={{ padding: 16 }}>Ende nuk është dërguar asnjë njoftim.</div>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr><th>Data</th><th>Njoftimi</th><th>Kujt</th><th>Pajisje</th></tr>
              </thead>
              <tbody>
                {data.history.map((n) => (
                  <tr key={n.id}>
                    <td data-label="Data" className="ad-hint" style={{ whiteSpace: 'nowrap' }}>{formatWhen(n.createdAt)}</td>
                    <td data-label="Njoftimi"><b>{n.title}</b><div className="ad-hint" style={{ marginTop: 2 }}>{n.body}</div></td>
                    <td data-label="Kujt">{n.target === 'all' ? `Të gjithë (${n.businessesCount})` : `${n.businessesCount} biznese`}</td>
                    <td data-label="Pajisje">{n.delivered}{n.failed ? <span className="ad-hint"> · {n.failed} dështuan</span> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import './admin.css';

function formatBytes(n) {
  const num = Number(n) || 0;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Setup() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef(null);

  const load = () => {
    api.getSetupAdmin()
      .then(setInfo)
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const onPick = () => inputRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setOk('');
    setUploading(true);
    setProgress(0);
    try {
      const result = await api.uploadSetup(file, (pct) => setProgress(pct));
      setInfo(result);
      setOk(`U ngarkua: ${result.fileName}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div>
      <div className="ad-page-head">
        <h1 className="ad-heading">Setup</h1>
        <span className="ad-hint">Skedari që shkarkohet nga butoni Shkarko në landing</span>
      </div>

      {error && <div className="ad-error" style={{ marginBottom: 14 }}>{error}</div>}
      {ok && <div style={{ marginBottom: 14, color: 'oklch(0.82 0.12 195)', fontSize: 14 }}>{ok}</div>}

      <div className="ad-card" style={{ padding: 22, maxWidth: 560 }}>
        <div style={{ fontSize: 13, color: '#8FA0B2', marginBottom: 16, lineHeight: 1.5 }}>
          Ngarko një setup të ri (.exe / .msi / .zip…). Klientët do të shkarkojnë gjithmonë versionin e fundit.
        </div>

        {info === null ? (
          <div style={{ color: '#8FA0B2' }}>Loading…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                <span style={{ color: '#8FA0B2' }}>Status</span>
                <span style={{ fontWeight: 600 }}>{info.available ? 'Aktiv' : 'Nuk ka setup'}</span>
              </div>
              {info.available && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                    <span style={{ color: '#8FA0B2' }}>Emri</span>
                    <span style={{ fontWeight: 600, wordBreak: 'break-all', textAlign: 'right' }}>{info.fileName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                    <span style={{ color: '#8FA0B2' }}>Madhësia</span>
                    <span style={{ fontWeight: 600 }}>{formatBytes(info.sizeBytes)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                    <span style={{ color: '#8FA0B2' }}>Ngarkuar</span>
                    <span style={{ fontWeight: 600 }}>{info.uploadedAt || '—'}</span>
                  </div>
                </>
              )}
            </div>

            <input ref={inputRef} type="file" accept=".exe,.msi,.dmg,.pkg,.zip" hidden onChange={onFile} />
            <button className="ad-btn" type="button" onClick={onPick} disabled={uploading} style={{ width: '100%' }}>
              {uploading ? `Duke ngarkuar… ${progress}%` : info.available ? 'Ngarko setup të ri' : 'Ngarko setup'}
            </button>

            {uploading && (
              <div style={{ marginTop: 12, height: 6, borderRadius: 4, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'oklch(0.82 0.12 195)', transition: 'width .2s' }} />
              </div>
            )}

            <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '.12em', color: '#6D7E8E', marginBottom: 6 }}>
                SHKARKIME
              </div>
              <div className="ad-heading" style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em' }}>
                {info.downloadCount ?? 0}
              </div>
              <div style={{ fontSize: 13, color: '#8FA0B2', marginTop: 4 }}>
                Sa herë është shkarkuar setup-i nga klientët
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

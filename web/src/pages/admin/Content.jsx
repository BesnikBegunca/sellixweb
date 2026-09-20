import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import './admin.css';

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function linesToArray(text) {
  return text.split('\n').map((s) => s.trim()).filter(Boolean);
}

function LabeledField({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: '#8FA0B2', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function SectorEditor({ sector, onChange }) {
  const [lang, setLang] = useState('sq');
  const s = sector[lang];

  const update = (field, value) => {
    onChange({ ...sector, [lang]: { ...s, [field]: value } });
  };

  const updateRow = (i, field, value) => {
    const rows = s.rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r));
    update('rows', rows);
  };

  const addRow = () => update('rows', [...s.rows, { n: '', v: '' }]);
  const removeRow = (i) => update('rows', s.rows.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {['sq', 'en'].map((l) => (
          <button
            key={l}
            type="button"
            className="ad-btn-ghost"
            onClick={() => setLang(l)}
            style={{ borderColor: lang === l ? 'oklch(0.82 0.12 195)' : undefined, color: lang === l ? '#EAF7FA' : undefined }}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      <LabeledField label="Sector name">
        <input className="ad-field" value={s.n} onChange={(e) => update('n', e.target.value)} />
      </LabeledField>
      <LabeledField label="Tagline">
        <input className="ad-field" value={s.t} onChange={(e) => update('t', e.target.value)} />
      </LabeledField>
      <LabeledField label="Features (one per line)">
        <textarea className="ad-field" rows={3} value={s.f.join('\n')} onChange={(e) => update('f', linesToArray(e.target.value))} />
      </LabeledField>
      <LabeledField label="Screen badge label">
        <input className="ad-field" value={s.badge} onChange={(e) => update('badge', e.target.value)} />
      </LabeledField>
      <LabeledField label="Screen tiles (one per line, 6 shown)">
        <textarea className="ad-field" rows={3} value={s.tiles.join('\n')} onChange={(e) => update('tiles', linesToArray(e.target.value))} />
      </LabeledField>
      <LabeledField label="Receipt rows">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {s.rows.map((r, i) => (
            <div key={i} className="ad-row-edit">
              <input className="ad-field" placeholder="Item" value={r.n} onChange={(e) => updateRow(i, 'n', e.target.value)} />
              <input className="ad-field" placeholder="Price" value={r.v} onChange={(e) => updateRow(i, 'v', e.target.value)} style={{ maxWidth: 110 }} />
              <button type="button" className="ad-btn-danger" onClick={() => removeRow(i)}>×</button>
            </div>
          ))}
          <button type="button" className="ad-btn-ghost" onClick={addRow} style={{ alignSelf: 'flex-start' }}>+ Add row</button>
        </div>
      </LabeledField>
      <LabeledField label="Total">
        <input className="ad-field" value={s.total} onChange={(e) => update('total', e.target.value)} style={{ maxWidth: 160 }} />
      </LabeledField>
    </div>
  );
}

function QuotesEditor({ quotes, onChange }) {
  const [lang, setLang] = useState('sq');
  const list = quotes[lang];

  const update = (list) => onChange({ ...quotes, [lang]: list });
  const updateItem = (i, field, value) => update(list.map((q, idx) => (idx === i ? { ...q, [field]: value } : q)));
  const addItem = () => update([...list, { text: '', who: '' }]);
  const removeItem = (i) => update(list.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {['sq', 'en'].map((l) => (
          <button key={l} type="button" className="ad-btn-ghost" onClick={() => setLang(l)}
            style={{ borderColor: lang === l ? 'oklch(0.82 0.12 195)' : undefined, color: lang === l ? '#EAF7FA' : undefined }}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      {list.map((q, i) => (
        <div key={i} className="ad-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea className="ad-field" rows={2} placeholder="Quote" value={q.text} onChange={(e) => updateItem(i, 'text', e.target.value)} />
          <input className="ad-field" placeholder="Attribution" value={q.who} onChange={(e) => updateItem(i, 'who', e.target.value)} />
          <button type="button" className="ad-btn-danger" onClick={() => removeItem(i)} style={{ alignSelf: 'flex-start' }}>Remove</button>
        </div>
      ))}
      <button type="button" className="ad-btn-ghost" onClick={addItem} style={{ alignSelf: 'flex-start' }}>+ Add testimonial</button>
    </div>
  );
}

function CompareEditor({ compare, onChange }) {
  const sq = compare.sq, en = compare.en;
  // Rows are paired by index across languages; edit "old way" (a) and "sellix" (b) per language.
  const updateField = (i, lang, field, value) => {
    const next = { sq: compare.sq.map((r) => ({ ...r })), en: compare.en.map((r) => ({ ...r })) };
    next[lang][i][field] = value;
    onChange(next);
  };
  const addRow = () => onChange({ sq: [...sq, { a: '', b: '' }], en: [...en, { a: '', b: '' }] });
  const removeRow = (i) => onChange({ sq: sq.filter((_, idx) => idx !== i), en: en.filter((_, idx) => idx !== i) });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sq.map((_, i) => (
        <div key={i} className="ad-card ad-compare-row" style={{ padding: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="ad-hint">Old way (SQ)</span>
            <input className="ad-field" value={compare.sq[i].a} onChange={(e) => updateField(i, 'sq', 'a', e.target.value)} />
            <span className="ad-hint">Old way (EN)</span>
            <input className="ad-field" value={compare.en[i].a} onChange={(e) => updateField(i, 'en', 'a', e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="ad-hint">SelliX (SQ)</span>
            <input className="ad-field" value={compare.sq[i].b} onChange={(e) => updateField(i, 'sq', 'b', e.target.value)} />
            <span className="ad-hint">SelliX (EN)</span>
            <input className="ad-field" value={compare.en[i].b} onChange={(e) => updateField(i, 'en', 'b', e.target.value)} />
          </div>
          <button type="button" className="ad-btn-danger" onClick={() => removeRow(i)}>×</button>
        </div>
      ))}
      <button type="button" className="ad-btn-ghost" onClick={addRow} style={{ alignSelf: 'flex-start' }}>+ Add row</button>
    </div>
  );
}

function IncludesEditor({ includes, onChange }) {
  const [lang, setLang] = useState('sq');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {['sq', 'en'].map((l) => (
          <button key={l} type="button" className="ad-btn-ghost" onClick={() => setLang(l)}
            style={{ borderColor: lang === l ? 'oklch(0.82 0.12 195)' : undefined, color: lang === l ? '#EAF7FA' : undefined }}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <textarea
        className="ad-field"
        rows={6}
        value={includes[lang].join('\n')}
        onChange={(e) => onChange({ ...includes, [lang]: linesToArray(e.target.value) })}
      />
      <span className="ad-hint">One item per line — shown in the pricing section.</span>
    </div>
  );
}

export default function Content() {
  const [content, setContent] = useState(null);
  const [activeSector, setActiveSector] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getContent().then(({ content }) => setContent(clone(content))).catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="ad-error">{error}</div>;
  if (!content) return <div style={{ color: '#8FA0B2' }}>Loading…</div>;

  const save = async () => {
    setSaving(true);
    setStatus('');
    setError('');
    try {
      const { content: saved } = await api.updateContent(content);
      setContent(clone(saved));
      setStatus('Saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="ad-page-head">
        <h1 className="ad-heading">Site content</h1>
        <div className="ad-page-tools">
          {status && <span className="ad-hint" style={{ color: 'oklch(0.86 0.12 195)' }}>{status}</span>}
          <button className="ad-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
      {error && <div className="ad-error" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="ad-card" style={{ padding: 20, marginBottom: 20 }}>
        <LabeledField label="Price (€ / month)">
          <input
            className="ad-field"
            style={{ maxWidth: 160 }}
            value={content.price}
            onChange={(e) => setContent({ ...content, price: e.target.value })}
          />
        </LabeledField>
      </div>

      <div className="ad-card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 className="ad-heading" style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>Sector cards</h2>
        <div className="ad-chip-row" style={{ marginBottom: 18 }}>
          {content.cats.map((c, i) => (
            <button
              key={i}
              type="button"
              className="ad-btn-ghost"
              onClick={() => setActiveSector(i)}
              style={{ borderColor: activeSector === i ? 'oklch(0.82 0.12 195)' : undefined, color: activeSector === i ? '#EAF7FA' : undefined }}
            >
              {c.sq.n}
            </button>
          ))}
        </div>
        <SectorEditor
          sector={content.cats[activeSector]}
          onChange={(next) => {
            const cats = content.cats.map((c, i) => (i === activeSector ? next : c));
            setContent({ ...content, cats });
          }}
        />
      </div>

      <div className="ad-card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 className="ad-heading" style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>Why SelliX comparison</h2>
        <CompareEditor compare={content.compare} onChange={(compare) => setContent({ ...content, compare })} />
      </div>

      <div className="ad-card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 className="ad-heading" style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>Plan includes</h2>
        <IncludesEditor includes={content.includes} onChange={(includes) => setContent({ ...content, includes })} />
      </div>

      <div className="ad-card" style={{ padding: 20 }}>
        <h2 className="ad-heading" style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>Testimonials</h2>
        <QuotesEditor quotes={content.quotes} onChange={(quotes) => setContent({ ...content, quotes })} />
      </div>
    </div>
  );
}

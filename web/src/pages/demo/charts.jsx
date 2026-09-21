import { useEffect, useState } from 'react';

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// Smooth line (Catmull-Rom → Bézier) with a soft area fill.
export function LineChart({ values, labels, width = 640, height = 220, max, ticks = 4, unit = '€' }) {
  const pad = { l: 38, r: 14, t: 12, b: 26 };
  const top = max || Math.max(10, Math.ceil(Math.max(...values) / 50) * 50);
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const pts = values.map((v, i) => [pad.l + (values.length === 1 ? w / 2 : (i * w) / (values.length - 1)), pad.t + h - (v / top) * h]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  const area = `${d} L${pts[pts.length - 1][0]},${pad.t + h} L${pts[0][0]},${pad.t + h} Z`;
  return (
    <svg className="sx-chart" viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sxArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--sx-primary)" stopOpacity=".28" />
          <stop offset="1" stopColor="var(--sx-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const y = pad.t + (h * i) / ticks;
        return (
          <g key={i}>
            <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} className="sx-grid" strokeDasharray={i === ticks ? '' : '3 5'} />
            <text x={pad.l - 8} y={y + 4} textAnchor="end" className="sx-axis">{Math.round(top - (top * i) / ticks)}{i === 0 ? unit : ''}</text>
          </g>
        );
      })}
      <path d={area} fill="url(#sxArea)" />
      <path d={d} fill="none" stroke="var(--sx-primary)" strokeWidth="2.5" strokeLinecap="round" />
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={i === pts.length - 1 ? 5 : 3.5} fill="var(--sx-primary)" stroke="var(--sx-surface)" strokeWidth="2" />
          <text x={x} y={height - 6} textAnchor="middle" className="sx-axis">{labels[i]}</text>
        </g>
      ))}
    </svg>
  );
}

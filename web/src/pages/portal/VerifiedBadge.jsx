// The blue verified tick shown after the business name. Drawn inline rather
// than pulled from the sprite in /public/icons.svg, which is only for the
// landing page's social links.
//
// The badge is two rounded squares, one turned 45°, which gives the eight
// scalloped points; the check is stroked on top so it stays crisp at the small
// sizes it renders at. It sizes itself from the surrounding text (1em), so it
// matches whatever it sits next to.
export default function VerifiedBadge({ color = '#1D9BF0', label = 'Biznes i verifikuar' }) {
  return (
    <svg className="pt-verified" viewBox="0 0 24 24" role="img" aria-label={label}>
      <title>{label}</title>
      <g className="pt-verified-shield" style={{ fill: color }}>
        <rect x="3" y="3" width="18" height="18" rx="4.5" />
        <rect x="3" y="3" width="18" height="18" rx="4.5" transform="rotate(45 12 12)" />
      </g>
      <path
        className="pt-verified-check"
        d="M7.9 12.25 10.75 15.1 16.2 9.35"
        fill="none"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

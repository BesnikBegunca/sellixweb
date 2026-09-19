// Albanian number and date formatting, in one place so every figure in the
// portal reads the same way.

const money = new Intl.NumberFormat('sq-AL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(value) {
  return `${money.format(Number(value) || 0)} €`;
}

// Compact form for chart labels and tight tiles, where a full amount would
// wrap: 1.2k rather than 1,240.00 €.
export function formatMoneyShort(value) {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1000) return `${money.format(n / 1000).replace(/[.,]00$/, '')}k €`;
  return `${money.format(n)} €`;
}

const DAYS = ['Die', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht'];
const MONTHS = ['Jan', 'Shk', 'Mar', 'Pri', 'Maj', 'Qer', 'Kor', 'Gus', 'Sht', 'Tet', 'Nën', 'Dhj'];

// The API sends 'YYYY-MM-DD' local dates. Parsing those by hand avoids the
// Date constructor treating a bare date as UTC and shifting the label a day.
function parseLocalDate(value) {
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatDayLabel(isoDate) {
  const d = parseLocalDate(isoDate);
  return `${DAYS[d.getDay()]} ${d.getDate()}`;
}

export function formatMonthLabel(isoMonth) {
  const month = Number(String(isoMonth).slice(5, 7));
  return MONTHS[month - 1] || isoMonth;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const s = String(value).replace('T', ' ');
  const date = parseLocalDate(s);
  const time = s.slice(11, 16);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${time ? ` · ${time}` : ''}`;
}

export const PERIOD_LABELS = {
  today: 'Sot',
  yesterday: 'Dje',
  week: 'Java',
  month: 'Muaji',
  year: 'Viti',
  all: 'Totali'
};

export const PAYMENT_LABELS = {
  cash: 'Para në dorë',
  card: 'Kartelë',
  bank: 'Bankë',
  voucher: 'Kupon',
  other: 'Tjetër'
};

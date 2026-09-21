export const PERIODS = [
  { id: 'today', label: 'Sot' },
  { id: 'yesterday', label: 'Dje' },
  { id: 'week', label: '1 javë' },
  { id: 'month', label: '1 muaj' },
  { id: 'month3', label: '3 muaj' },
  { id: 'month6', label: '6 muaj' },
  { id: 'month9', label: '9 muaj' },
  { id: 'year', label: '1 vit' },
  { id: 'all', label: 'Total' }
];

const MONTHS_SQ = ['Jan', 'Shk', 'Mar', 'Pri', 'Maj', 'Qer', 'Kor', 'Gus', 'Sht', 'Tet', 'Nën', 'Dhj'];

const PAYMENTS = {
  cash: 'Para në dorë',
  card: 'Kartelë',
  card_terminal: 'Kartelë',
  credit: 'Kartelë',
  debit: 'Kartelë',
  pos: 'Kartelë',
  visa: 'Kartelë',
  mastercard: 'Kartelë',
  transfer: 'Transfertë',
  bank: 'Transfertë',
  unknown: 'Pa specifikuar'
};

export function localDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatEuro(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00 €';
  return `${n.toFixed(2)} €`;
}

export function formatQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}

export function paymentLabel(method) {
  const key = String(method || 'unknown').trim().toLowerCase();
  return PAYMENTS[key] || method || 'Pa specifikuar';
}

export function dayLabel(isoDate) {
  if (!isoDate) return '';
  const [, m, d] = isoDate.split('-');
  return `${Number(d)} ${MONTHS_SQ[Number(m) - 1] || m}`;
}

export function monthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${MONTHS_SQ[Number(m) - 1] || m} ${y.slice(2)}`;
}

// A market's tills are numbered in the order they were activated, so the owner
// can say "kompjuteri 2" and mean the same machine every day. A receipt that
// arrived without a device id (an old sync, or a till that never activated)
// has no number to show.
export function registerLabel(number) {
  return number ? `Kompjuteri ${number}` : 'Pa identifikim';
}

export function periodQuery(period, date = localDate()) {
  return `period=${encodeURIComponent(period)}&date=${encodeURIComponent(date)}`;
}

export const DEFAULT_DAILY_GOAL = 200;

const PERIOD_GOAL_DAYS = {
  today: 1,
  yesterday: 1,
  week: 7,
  month: 30,
  month3: 90,
  month6: 180,
  month9: 270,
  year: 365,
  all: 365
};

export function periodGoal(dailyGoal, period = 'today') {
  const daily = Number(dailyGoal) > 0 ? Number(dailyGoal) : DEFAULT_DAILY_GOAL;
  return daily * (PERIOD_GOAL_DAYS[period] || 1);
}

export function periodLabel(period) {
  return PERIODS.find((p) => p.id === period)?.label || 'Sot';
}

export function parseLicenseExpiry(raw) {
  if (!raw) return null;
  const match = String(raw).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const expires = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0)
  );
  const ms = expires.getTime() - Date.now();
  return {
    date: `${match[3]}.${match[2]}.${match[1]}`,
    time: `${match[4]}:${match[5]}`,
    days: Math.ceil(ms / 86400000),
    expires
  };
}

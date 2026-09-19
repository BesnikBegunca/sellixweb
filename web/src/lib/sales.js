export const PERIODS = [
  { id: 'today', label: 'Sot' },
  { id: 'yesterday', label: 'Dje' },
  { id: 'week', label: '1 javë' },
  { id: 'month', label: '1 muaj' },
  { id: 'year', label: '1 vit' },
  { id: 'all', label: 'Gjithsej' }
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

export function periodQuery(period, date = localDate()) {
  return `period=${encodeURIComponent(period)}&date=${encodeURIComponent(date)}`;
}

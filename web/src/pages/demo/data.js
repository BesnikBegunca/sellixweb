// Seed data for the interactive landing-page demo. Everything lives in memory;
// nothing here touches the API.

export const BUSINESS = 'Friends SHPK';

export const CATEGORIES = [
  { id: 'kafe', n: 'Kafe', icon: 'coffee' },
  { id: 'pije', n: 'Pije', icon: 'bottle' },
  { id: 'alko', n: 'Alkoholike', icon: 'beer' },
  { id: 'shots', n: 'Shots', icon: 'shot' },
  { id: 'cocktails', n: 'Cocktails', icon: 'cocktail' },
];

const p = (id, n, price, c, img) => ({ id, n, p: price, c, img: `/demo/${img}.webp` });

export const PRODUCTS = [
  p('espresso', 'Espresso', 1.0, 'kafe', 'espresso'),
  p('makiato-m', 'Makiato e Madhe', 1.0, 'kafe', 'makiato'),
  p('makiato-v', 'Makiato e Vogël', 0.9, 'kafe', 'makiato'),
  p('ice', 'Ice Coffee', 1.5, 'kafe', 'icecoffee'),
  p('kapuqino', 'Kapuçino', 1.2, 'kafe', 'kapuqino'),
  p('latte', 'Latte', 1.3, 'kafe', 'latte'),
  p('frappe', 'Frappe', 1.2, 'kafe', 'frappe'),
  p('qaj', 'Çaj', 1.0, 'kafe', 'qaj'),
  p('uje', 'Ujë Natyral', 0.8, 'pije', 'uje'),
  p('ujegaz', 'Ujë i Gazuar', 0.9, 'pije', 'ujegaz'),
  p('cola', 'Coca-Cola', 1.5, 'pije', 'cola'),
  p('fanta', 'Fanta', 1.5, 'pije', 'fanta'),
  p('sprite', 'Sprite', 1.5, 'pije', 'sprite'),
  p('redbull', 'Red Bull', 2.5, 'pije', 'redbull'),
  p('peja', 'Birra Peja', 1.5, 'alko', 'peja'),
  p('heineken', 'Heineken', 2.0, 'alko', 'heineken'),
  p('corona', 'Corona', 2.5, 'alko', 'corona'),
  p('jack', 'Jack Daniel’s', 3.5, 'alko', 'jack'),
  p('jager', 'Jägermeister', 2.0, 'shots', 'jager'),
  p('b52', 'B-52', 2.5, 'shots', 'b52'),
  p('kamikaze', 'Kamikaze', 2.0, 'shots', 'kamikaze'),
  p('tekila', 'Tekila', 2.0, 'shots', 'tekila'),
  p('mojito', 'Mojito', 4.0, 'cocktails', 'mojito'),
  p('gintonic', 'Gin Tonic', 4.0, 'cocktails', 'gintonic'),
  p('bluelagoon', 'Blue Lagoon', 4.5, 'cocktails', 'bluelagoon'),
  p('whiskeysour', 'Whiskey Sour', 4.5, 'cocktails', 'whiskeysour'),
  p('longisland', 'Long Island', 5.0, 'cocktails', 'longisland'),
];

export const STAFF = [
  { id: 's0', name: 'Administrator', role: 'manager', pin: '0000', wage: 0 },
  { id: 's1', name: 'Besnik Begunca', role: 'waiter', pin: '1234', wage: 12 },
  { id: 's2', name: 'Niki', role: 'waiter', pin: '5678', wage: 10 },
];

// Revenue for the six days before today (rolling window ending yesterday).
export const HISTORY = [64.2, 71.8, 59.4, 83.6, 118.9, 49.7];

export const money = (v) => `${(Math.round(v * 100) / 100).toFixed(2)}€`;

export const hhmm = (d) => d.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit', hour12: false });

const DAYS = ['E diel', 'E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë'];
const MONTHS = ['Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor', 'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'];
export const SHORT_DAYS = ['Die', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht'];
export const longDate = (d) => `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;

export function weekSeries(revenueToday) {
  const values = [...HISTORY, revenueToday];
  const today = new Date().getDay();
  const labels = values.map((_, i) => SHORT_DAYS[(today - (values.length - 1 - i) + 7) % 7]);
  return { values, labels };
}

export const lineTotal = (items) =>
  Object.entries(items).reduce((s, [id, q]) => s + (PRODUCT_INDEX[id]?.p || 0) * q, 0);

// Filled lazily so products added from the Menu screen resolve too.
export const PRODUCT_INDEX = Object.fromEntries(PRODUCTS.map((x) => [x.id, x]));

function seedSales() {
  const now = Date.now();
  const plan = [
    ['s1', 3, { 'makiato-m': 2, uje: 2 }],
    ['s2', 1, { espresso: 3 }],
    ['s1', 6, { frappe: 2, 'ice': 1 }],
    ['s1', 4, { kapuqino: 2, qaj: 1 }],
    ['s2', 9, { peja: 4, cola: 1 }],
    ['s1', 2, { mojito: 2, gintonic: 1 }],
    ['s2', 7, { 'makiato-v': 3, ujegaz: 1 }],
    ['s1', 10, { redbull: 2, jager: 2 }],
    ['s2', 11, { latte: 2, espresso: 1 }],
    ['s1', 1, { heineken: 3, corona: 1 }],
  ];
  return plan.map(([waiter, table, items], i) => ({
    id: `seed-${i}`,
    no: i + 1,
    table,
    waiter,
    items,
    total: lineTotal(items),
    at: now - (plan.length - i) * 27 * 60 * 1000,
  }));
}

function seedTables() {
  const busy = {
    2: { items: { kapuqino: 2, uje: 1 }, waiter: 's1', printed: true },
    5: { items: { peja: 3, heineken: 1 }, waiter: 's2', printed: true },
    8: { items: { mojito: 2 }, waiter: 's1', printed: false },
  };
  return Array.from({ length: 12 }, (_, i) => {
    const id = i + 1;
    return { id, items: {}, waiter: null, printed: false, ...(busy[id] || {}) };
  });
}

export function initialState() {
  const sales = seedSales();
  return {
    user: null,
    screen: 'pin',
    table: null,
    mgrTab: 'overview',
    tables: seedTables(),
    sales,
    staff: STAFF,
    products: PRODUCTS,
    expenses: [
      { id: 'e1', n: 'Qumësht dhe akull', v: 14.5 },
      { id: 'e2', n: 'Furnitor — kafe', v: 22 },
    ],
    shift: { open: true, at: new Date(new Date().setHours(8, 0, 0, 0)).getTime() },
    orderNo: sales.length,
    notes: [],
    toast: null,
  };
}

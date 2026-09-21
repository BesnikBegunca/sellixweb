import { PRODUCT_INDEX, initialState, lineTotal, money } from './data';

let seq = 0;
const uid = (p) => `${p}-${Date.now().toString(36)}-${++seq}`;

const withNote = (state, note) => ({
  ...state,
  notes: [{ id: uid('n'), at: Date.now(), ...note }, ...state.notes].slice(0, 20),
});

const mapTable = (state, id, fn) => ({
  ...state,
  tables: state.tables.map((t) => (t.id === id ? fn(t) : t)),
});

export function staffName(state, id) {
  return state.staff.find((s) => s.id === id)?.name || '—';
}

export function reducer(state, a) {
  switch (a.type) {
    case 'reset':
      return initialState();

    case 'login': {
      const user = state.staff.find((s) => s.pin === a.pin);
      if (!user) return state;
      return { ...state, user, screen: user.role === 'manager' ? 'manager' : 'tables', mgrTab: 'overview' };
    }
    case 'logout':
      return { ...state, user: null, screen: 'pin', table: null };

    case 'go':
      return { ...state, screen: a.screen, table: a.table ?? state.table };

    case 'mgrTab':
      return { ...state, mgrTab: a.tab };

    case 'openTable':
      return { ...state, screen: 'order', table: a.id };

    case 'add':
      return mapTable(state, a.table, (t) => ({
        ...t,
        waiter: t.waiter || state.user?.id || 's1',
        printed: false,
        items: { ...t.items, [a.pid]: (t.items[a.pid] || 0) + 1 },
      }));

    case 'dec':
      return mapTable(state, a.table, (t) => {
        const items = { ...t.items };
        items[a.pid] = (items[a.pid] || 0) - 1;
        if (items[a.pid] <= 0) delete items[a.pid];
        const empty = Object.keys(items).length === 0;
        return { ...t, items, waiter: empty ? null : t.waiter, printed: empty ? false : t.printed };
      });

    case 'print': {
      const t = state.tables.find((x) => x.id === a.table);
      if (!t || !Object.keys(t.items).length) return state;
      const next = mapTable(state, a.table, (x) => ({ ...x, printed: true }));
      return withNote(
        { ...next, toast: { id: uid('t'), text: `Porosia për Tavolina ${a.table} u dërgua në printer` } },
        { kind: 'order', title: `Porosi e re · Tavolina ${a.table}`, body: `${money(lineTotal(t.items))} nga ${staffName(state, t.waiter)}` }
      );
    }

    case 'pay': {
      const t = state.tables.find((x) => x.id === a.table);
      if (!t || !Object.keys(t.items).length) return state;
      const total = lineTotal(t.items);
      const no = state.orderNo + 1;
      const sale = { id: uid('s'), no, table: t.id, waiter: t.waiter || state.user?.id, items: t.items, total, at: Date.now() };
      const next = mapTable(
        { ...state, sales: [...state.sales, sale], orderNo: no, screen: 'tables', table: null },
        a.table,
        (x) => ({ ...x, items: {}, waiter: null, printed: false })
      );
      return withNote(
        { ...next, toast: { id: uid('t'), text: `Pagesa u krye · ${money(total)}` } },
        { kind: 'pay', title: `Pagesë · Tavolina ${t.id}`, body: `${money(total)} nga ${staffName(state, sale.waiter)}` }
      );
    }

    case 'addTable': {
      const id = Math.max(...state.tables.map((t) => t.id)) + 1;
      return { ...state, tables: [...state.tables, { id, items: {}, waiter: null, printed: false }] };
    }

    case 'addStaff': {
      if (state.staff.some((s) => s.pin === a.member.pin)) {
        return { ...state, toast: { id: uid('t'), text: 'Ky PIN përdoret nga një anëtar tjetër', tone: 'bad' } };
      }
      const member = { id: uid('st'), ...a.member };
      return withNote(
        { ...state, staff: [...state.staff, member], toast: { id: uid('t'), text: `${member.name} u shtua në staf` } },
        { kind: 'staff', title: 'Anëtar i ri në staf', body: `${member.name} · ${member.role === 'manager' ? 'Menaxher' : 'Kamarier'}` }
      );
    }
    case 'removeStaff':
      return { ...state, staff: state.staff.filter((s) => s.id !== a.id) };

    case 'addProduct': {
      const product = { id: uid('p'), ...a.product };
      PRODUCT_INDEX[product.id] = product;
      return { ...state, products: [...state.products, product], toast: { id: uid('t'), text: `${product.n} u shtua në POS` } };
    }
    case 'removeProduct':
      return { ...state, products: state.products.filter((p) => p.id !== a.id) };

    case 'addExpense':
      return withNote(
        { ...state, expenses: [...state.expenses, { id: uid('e'), n: a.n, v: a.v }], toast: { id: uid('t'), text: 'Shpenzimi u regjistrua' } },
        { kind: 'expense', title: 'Shpenzim i ri', body: `${a.n} · ${money(a.v)}` }
      );

    case 'toggleShift': {
      const open = !state.shift.open;
      return withNote(
        { ...state, shift: { open, at: Date.now() }, toast: { id: uid('t'), text: open ? 'Gjendja u hap' : 'Gjendja u mbyll' } },
        { kind: 'shift', title: open ? 'Turni u hap' : 'Turni u mbyll', body: open ? 'Operacioni është aktiv' : 'Raporti i ditës është gati' }
      );
    }

    case 'toast':
      return { ...state, toast: { id: uid('t'), text: a.text, tone: a.tone } };
    case 'clearToast':
      return state.toast?.id === a.id ? { ...state, toast: null } : state;

    default:
      return state;
  }
}

export function selectStats(state) {
  const revenue = state.sales.reduce((s, x) => s + x.total, 0);
  const expenses = state.expenses.reduce((s, x) => s + x.v, 0);
  const open = state.tables.reduce((s, t) => s + lineTotal(t.items), 0);
  const busy = state.tables.filter((t) => Object.keys(t.items).length).length;
  const byWaiter = {};
  for (const s of state.sales) byWaiter[s.waiter] = (byWaiter[s.waiter] || 0) + s.total;
  const top = Object.entries(byWaiter).sort((a, b) => b[1] - a[1])[0];
  return {
    revenue,
    expenses,
    profit: revenue - expenses,
    open,
    busy,
    free: state.tables.length - busy,
    orders: state.sales.length,
    avg: state.sales.length ? revenue / state.sales.length : 0,
    byWaiter,
    top: top ? { id: top[0], name: staffName(state, top[0]), total: top[1] } : null,
  };
}

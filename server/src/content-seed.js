// Default site content. Editable afterwards via the admin Content page.
export const DEFAULT_CONTENT = {
  price: '20',
  cats: [
    { sq: { n: 'Restorante', t: 'Nga tavolina në kuzhinë, pa humbur porosi.',
        f: ['Plan sallash dhe tavolinash', 'Porosia nga tableti shkon vetë në kuzhinë', 'Ndarje fature, bakshish, raport turni'],
        badge: 'SALLA A · TAVOLINA 04', tiles: ['Tavolina 01', 'Tavolina 02', 'Pizza', 'Pasta', 'Pije', 'Deserte'],
        rows: [{ n: 'Margherita', v: '6.50 €' }, { n: 'Fileto', v: '12.00 €' }, { n: 'Verë e bardhë', v: '4.00 €' }], total: '22.50 €' },
      en: { n: 'Restaurants', t: 'From table to kitchen, nothing lost.',
        f: ['Room and table floor plans', 'Tablet orders print straight to the kitchen', 'Split bills, tips, shift reports'],
        badge: 'ROOM A · TABLE 04', tiles: ['Table 01', 'Table 02', 'Pizza', 'Pasta', 'Drinks', 'Desserts'],
        rows: [{ n: 'Margherita', v: '€6.50' }, { n: 'Fillet', v: '€12.00' }, { n: 'White wine', v: '€4.00' }], total: '€22.50' } },

    { sq: { n: 'Kafene & bar', t: 'Shpejtësi në banak, kontroll në turne.',
        f: ['Arkëtim në dy klikime', 'Turne, bakshish, derdhje kase', 'Çmime happy hour automatike'],
        badge: 'TURNI I MËNGJESIT', tiles: ['Espresso', 'Macchiato', 'Çaj', 'Freddo', 'Birrë', 'Turni'],
        rows: [{ n: 'Espresso', v: '1.00 €' }, { n: 'Freddo', v: '2.00 €' }, { n: 'Birrë', v: '2.50 €' }], total: '5.50 €' },
      en: { n: 'Cafés & bars', t: 'Speed at the bar, control over shifts.',
        f: ['Two-tap checkout', 'Shifts, tips, cash-drawer counts', 'Automatic happy-hour pricing'],
        badge: 'MORNING SHIFT', tiles: ['Espresso', 'Macchiato', 'Tea', 'Freddo', 'Beer', 'Shift'],
        rows: [{ n: 'Espresso', v: '€1.00' }, { n: 'Freddo', v: '€2.00' }, { n: 'Beer', v: '€2.50' }], total: '€5.50' } },

    { sq: { n: 'Markete', t: 'Barkod, stok, raport — në një ekran.',
        f: ['Shitje me barkod dhe peshore', 'Stoku zbritet në çdo arkëtim', 'Porosi furnitorëve me një klik'],
        badge: 'KASA 2 · BARKOD AKTIV', tiles: ['Barkod', 'Bukë', 'Qumësht', 'Pije', 'Higjienë', 'Peshore'],
        rows: [{ n: 'Qumësht 1L', v: '1.10 €' }, { n: 'Bukë', v: '0.60 €' }, { n: 'Detergjent', v: '3.40 €' }], total: '5.10 €' },
      en: { n: 'Markets', t: 'Barcode, stock, reports — one screen.',
        f: ['Barcode and scale checkout', 'Stock drops on every sale', 'Supplier orders in one click'],
        badge: 'TILL 2 · BARCODE ON', tiles: ['Barcode', 'Bread', 'Milk', 'Drinks', 'Hygiene', 'Scale'],
        rows: [{ n: 'Milk 1L', v: '€1.10' }, { n: 'Bread', v: '€0.60' }, { n: 'Detergent', v: '€3.40' }], total: '€5.10' } },

    { sq: { n: 'Butique', t: 'Çdo ngjyrë dhe madhësi, e numëruar saktë.',
        f: ['Variante ngjyrë dhe madhësi', 'Etiketa me barkod nga programi', 'Kthime, kupona dhe zbritje sezonale'],
        badge: 'VARIANTE · MADHËSI / NGJYRË', tiles: ['Fustane', 'Xhupa', 'Bluza', 'Aksesorë', 'Zbritje', 'Etiketa'],
        rows: [{ n: 'Fustan / M / Zi', v: '45.00 €' }, { n: 'Bluzë / S / Bezhë', v: '19.00 €' }, { n: 'Rrip / 90', v: '12.00 €' }], total: '76.00 €' },
      en: { n: 'Boutiques', t: 'Every colour and size, counted right.',
        f: ['Colour and size variants', 'Barcode labels printed in-app', 'Returns, coupons and seasonal markdowns'],
        badge: 'VARIANTS · SIZE / COLOUR', tiles: ['Dresses', 'Coats', 'Tops', 'Accessories', 'Markdown', 'Labels'],
        rows: [{ n: 'Dress / M / Black', v: '€45.00' }, { n: 'Top / S / Beige', v: '€19.00' }, { n: 'Belt / 90', v: '€12.00' }], total: '€76.00' } },

    { sq: { n: 'Dyqane këpucësh', t: 'Stok për numër. Shitje pa hamendje.',
        f: ['Matricë numrash 36–46 për model', 'Stoku mbahet për numër, jo për model', 'Kërkim i shpejtë nga rafti dhe depoja'],
        badge: 'MATRICË NUMRASH · 36–46', tiles: ['Femra', 'Burra', 'Fëmijë', 'Sportive', 'Numra', 'Depo'],
        rows: [{ n: 'Sneaker / 41', v: '69.00 €' }, { n: 'Çizme / 38', v: '89.00 €' }, { n: 'Krem lëkure', v: '5.00 €' }], total: '163.00 €' },
      en: { n: 'Shoe stores', t: 'Stock per size. No guesswork.',
        f: ['Size matrix 36–46 per model', 'Stock tracked per size, not per model', 'Fast lookup from shelf and stockroom'],
        badge: 'SIZE MATRIX · 36–46', tiles: ['Women', 'Men', 'Kids', 'Sport', 'Sizes', 'Stockroom'],
        rows: [{ n: 'Sneaker / 41', v: '€69.00' }, { n: 'Boots / 38', v: '€89.00' }, { n: 'Leather cream', v: '€5.00' }], total: '€163.00' } }
  ],
  compare: {
    sq: [
      { a: 'Raport vetëm në fund të ditës', b: 'Raporte live nga telefoni' },
      { a: 'Stoku numërohet me dorë', b: 'Stoku zbritet në çdo shitje' },
      { a: 'Një pikë, një arkë', b: 'Shumë pika, një panel' },
      { a: 'Çmimet ndryshohen nga tekniku', b: 'Çmimet ndryshohen në pesë sekonda' },
      { a: 'Pa histori klientësh', b: 'Kartelë klienti dhe pika besnikërie' }
    ],
    en: [
      { a: 'Reports only at closing time', b: 'Live reports from your phone' },
      { a: 'Stock counted by hand', b: 'Stock deducted on every sale' },
      { a: 'One store, one register', b: 'Many stores, one dashboard' },
      { a: 'A technician changes prices', b: 'You change prices in five seconds' },
      { a: 'No customer history', b: 'Customer profiles and loyalty points' }
    ]
  },
  includes: {
    sq: ['Të gjitha modulet e sektorit', 'Përditësime automatike', 'Kopje e sigurt në cloud', 'Punon edhe pa internet', 'Trajnim fillestar', 'Pa kontratë afatgjatë'],
    en: ['All modules for your sector', 'Automatic updates', 'Secure cloud backup', 'Works offline too', 'Onboarding training', 'No long-term contract']
  },
  t: {
    sq: { pay: 'PAGUAJ', printer: 'PRINTER FATURASH', drag: 'TËRHIQ PËR TA RROTULLUAR', getModule: 'Marr këtë zgjidhje',
      included: 'PËRFSHIHET NË PAKON', oldWay: 'ARKA KLASIKE', winBtn: 'Shkarko për Windows', macBtn: 'Shkarko për macOS',
      installing: 'INSTALIMI', step: 'Po instalohet moduli i sektorit', setup1: 'Pa konfigurim teknik', setup2: 'Të dhënat vijnë vetë' },
    en: { pay: 'PAY', printer: 'RECEIPT PRINTER', drag: 'DRAG TO ROTATE', getModule: 'Get this solution',
      included: 'INCLUDED IN THE PLAN', oldWay: 'THE OLD REGISTER', winBtn: 'Download for Windows', macBtn: 'Download for macOS',
      installing: 'INSTALLING', step: 'Installing your sector module', setup1: 'No technical setup', setup2: 'Your data syncs itself' }
  }
};

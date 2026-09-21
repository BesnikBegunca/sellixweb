// Minimal A4 PDF (Helvetica). Albanian letters are folded so the standard
// Type1 fonts can print the report without embedding a TTF.

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;

const PAYMENTS = {
  cash: 'Para ne dore',
  card: 'Karte',
  card_terminal: 'Karte',
  credit: 'Karte',
  debit: 'Karte',
  pos: 'Karte',
  visa: 'Karte',
  mastercard: 'Karte',
  transfer: 'Transfere',
  bank: 'Transfere',
  unknown: 'Pa specifikuar'
};

function foldAscii(input) {
  return String(input ?? '')
    .replace(/ë/g, 'e')
    .replace(/Ë/g, 'E')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .replace(/[^\x20-\x7E]/g, '?');
}

function pdfEscape(input) {
  return foldAscii(input).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function euro(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const [intPart, dec] = safe.toFixed(2).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped}.${dec} EUR`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

function paymentLabel(method) {
  const key = String(method || 'unknown').trim().toLowerCase();
  return PAYMENTS[key] || foldAscii(method || 'Pa specifikuar');
}

class PdfDoc {
  constructor() {
    this.pages = [];
    this.ops = [];
    this.y = PAGE_H - MARGIN;
  }

  ensure(need = 18) {
    if (this.y - need < MARGIN + 16) this.newPage();
  }

  newPage() {
    if (this.ops.length) this.pages.push(this.ops);
    this.ops = [];
    this.y = PAGE_H - MARGIN;
  }

  fill(x, y, w, h, r, g, b) {
    this.ops.push(`${r} ${g} ${b} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f 0 0 0 rg`);
  }

  stroke(x, y, w, h) {
    this.ops.push(`0.75 w 0.55 0.62 0.68 RG ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S 0 0 0 RG`);
  }

  line(x1, y1, x2, y2) {
    this.ops.push(`0.6 w 0.82 0.86 0.90 RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S 0 0 0 RG`);
  }

  text(str, x, y, { size = 11, bold = false, color = null } = {}) {
    const font = bold ? '/F2' : '/F1';
    const c = color ? `${color[0]} ${color[1]} ${color[2]} rg ` : '';
    const reset = color ? ' 0 0 0 rg' : '';
    this.ops.push(`BT ${font} ${size} Tf ${c}${x.toFixed(2)} ${y.toFixed(2)} Td (${pdfEscape(str)}) Tj${reset} ET`);
  }

  right(str, xRight, y, opts) {
    const width = foldAscii(str).length * (opts?.size || 11) * 0.5;
    this.text(str, xRight - width, y, opts);
  }

  build() {
    if (this.ops.length) this.pages.push(this.ops);
    if (this.pages.length === 0) this.pages.push([]);

    const objects = [];
    const add = (body) => {
      objects.push(body);
      return objects.length;
    };

    const font1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const font2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const pageIds = [];
    const contentIds = [];

    for (const ops of this.pages) {
      const stream = ops.join('\n');
      contentIds.push(
        add(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`)
      );
    }

    const kids = [];
    for (let i = 0; i < this.pages.length; i++) {
      const id = add(
        `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`
      );
      pageIds.push(id);
      kids.push(`${id} 0 R`);
    }

    const pagesId = add(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageIds.length} >>`);
    for (let i = 0; i < pageIds.length; i++) {
      objects[pageIds[i] - 1] = objects[pageIds[i] - 1].replace('/Parent 0 0 R', `/Parent ${pagesId} 0 R`);
    }
    const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    let out = '%PDF-1.4\n';
    const offsets = [0];
    for (let i = 0; i < objects.length; i++) {
      offsets.push(Buffer.byteLength(out, 'utf8'));
      out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xrefAt = Buffer.byteLength(out, 'utf8');
    out += `xref\n0 ${objects.length + 1}\n`;
    out += '0000000000 65535 f \n';
    for (let i = 1; i < offsets.length; i++) {
      out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    out += `trailer << /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
    return Buffer.from(out, 'utf8');
  }
}

function section(doc, title) {
  doc.ensure(36);
  doc.y -= 10;
  doc.text(title, MARGIN, doc.y, { size: 12, bold: true, color: [0.08, 0.72, 0.65] });
  doc.y -= 6;
  doc.line(MARGIN, doc.y, PAGE_W - MARGIN, doc.y);
  doc.y -= 16;
}

function row(doc, left, mid, right, { bold = false, size = 10 } = {}) {
  doc.ensure(16);
  doc.text(left, MARGIN, doc.y, { size, bold });
  if (mid != null) doc.text(String(mid), 320, doc.y, { size, bold });
  doc.right(right, PAGE_W - MARGIN, doc.y, { size, bold });
  doc.y -= 15;
}

export function buildSalesReportPdf(snapshot) {
  const doc = new PdfDoc();
  const innerW = PAGE_W - MARGIN * 2;

  doc.fill(0, PAGE_H - 92, PAGE_W, 92, 0.03, 0.09, 0.14);
  doc.text('SelliX', MARGIN, PAGE_H - 40, { size: 11, bold: true, color: [0.08, 0.72, 0.65] });
  doc.text(snapshot.title, MARGIN, PAGE_H - 62, { size: 18, bold: true, color: [1, 1, 1] });
  doc.text(snapshot.business?.name || 'Biznes', MARGIN, PAGE_H - 82, { size: 11, color: [0.75, 0.82, 0.88] });
  doc.y = PAGE_H - 118;

  const meta = [
    snapshot.business?.nui ? `NUI ${snapshot.business.nui}` : null,
    snapshot.business?.city || null,
    snapshot.business?.sector || null
  ].filter(Boolean).join('  ·  ');
  if (meta) {
    doc.text(meta, MARGIN, doc.y, { size: 10, color: [0.45, 0.5, 0.55] });
    doc.y -= 16;
  }
  doc.text(`Periudha: ${fmtDate(snapshot.from)} - ${fmtDate(snapshot.to)}`, MARGIN, doc.y, { size: 10 });
  doc.y -= 28;

  doc.fill(MARGIN, doc.y - 38, innerW, 52, 0.94, 0.98, 0.98);
  doc.text('Totali i shitjeve', MARGIN + 14, doc.y, { size: 10, color: [0.38, 0.44, 0.5] });
  doc.text(euro(snapshot.total), MARGIN + 14, doc.y - 22, { size: 20, bold: true, color: [0.05, 0.45, 0.42] });
  doc.right(`${snapshot.count} fatura`, PAGE_W - MARGIN - 14, doc.y - 18, { size: 11, bold: true });
  doc.y -= 72;

  if (snapshot.staff?.length) {
    section(doc, 'Sipas kamarierit / shitësit');
    row(doc, 'Emri', 'Fatura', 'Shuma', { bold: true, size: 9 });
    for (const s of snapshot.staff) {
      row(doc, s.name || 'Pa emer', s.count, euro(s.total));
    }
  }

  if (snapshot.payments?.length) {
    section(doc, 'Sipas pageses');
    row(doc, 'Metoda', 'Fatura', 'Shuma', { bold: true, size: 9 });
    for (const p of snapshot.payments) {
      row(doc, paymentLabel(p.method), p.count, euro(p.total));
    }
  }

  const series = snapshot.kind === 'year' ? snapshot.months : snapshot.days;
  if (series?.length) {
    section(doc, snapshot.kind === 'year' ? 'Muajt' : 'Ditet');
    row(doc, snapshot.kind === 'year' ? 'Muaji' : 'Data', 'Fatura', 'Shuma', { bold: true, size: 9 });
    for (const item of series) {
      const label = item.month || fmtDate(item.date);
      row(doc, label, item.count, euro(item.total));
    }
  }

  if (snapshot.products?.length) {
    section(doc, 'Produktet me te shitura');
    row(doc, 'Produkti', 'Sasia', 'Shuma', { bold: true, size: 9 });
    for (const p of snapshot.products) {
      const qty = Number.isInteger(p.quantity) ? String(p.quantity) : Number(p.quantity).toFixed(2);
      row(doc, String(p.name || '').slice(0, 42), qty, euro(p.total));
    }
  }

  doc.ensure(28);
  doc.y -= 10;
  doc.line(MARGIN, doc.y, PAGE_W - MARGIN, doc.y);
  doc.y -= 16;
  doc.text('Raport i gjeneruar nga SelliX. Shumat jane nga faturat e sinkronizuara te kasave.', MARGIN, doc.y, {
    size: 8,
    color: [0.45, 0.5, 0.55]
  });

  return doc.build();
}

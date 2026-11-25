import type { PageDrawing } from './render';

const PT = 72 / 25.4;
const n = (v: number): string => {
  const s = (Math.round(v * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const pt = (mm: number) => n(mm * PT);

function pageStream(d: PageDrawing): string {
  const out: string[] = ['q', '1 J 1 j', '0 0 0 RG'];
  const line = (pts: readonly (readonly [number, number])[], closed: boolean) => {
    pts.forEach((p, i) => out.push(`${pt(p[0])} ${pt(p[1])} ${i === 0 ? 'm' : 'l'}`));
    out.push(closed ? 'h S' : 'S');
  };
  out.push(`${pt(0.25)} w [] 0 d`);
  for (const c of d.cut) line(c.points, c.closed);

  const dash: Record<string, string> = {
    mountain: `[${pt(3)} ${pt(1)} ${pt(0.6)} ${pt(1)}] 0 d`,
    valley: `[${pt(1.6)} ${pt(1.2)}] 0 d`,
    tab: `[${pt(1.6)} ${pt(1.2)}] 0 d`,
  };
  for (const kind of ['mountain', 'valley', 'tab', 'flat']) {
    const list = d.folds.filter((f) => f.kind === kind);
    if (list.length === 0) continue;
    if (kind === 'flat') {
      out.push(`${pt(0.1)} w [] 0 d 0.53 0.53 0.53 RG`);
    } else {
      out.push(`${pt(0.2)} w ${dash[kind]} 0 0 0 RG`);
    }
    for (const f of list) line([f.a, f.b], false);
  }
  out.push(`${pt(0.2)} w [] 0 d 0 0 0 RG`);
  for (const t of d.text) line(t, false);
  out.push('Q');
  return out.join('\n');
}

/**
 * A vector PDF (one page per drawing, page size in millimetres). Lines only, no fonts, no images, no dates: the same
 * drawings always give the same bytes.
 */
export function exportPdf(drawings: readonly PageDrawing[]): Uint8Array {
  const objects: string[] = [];
  const pageCount = drawings.length;
  // 1 catalog, 2 page tree, then (page, content) pairs.
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  const kids = drawings.map((_, i) => `${3 + i * 2} 0 R`).join(' ');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);
  drawings.forEach((d, i) => {
    const content = pageStream(d);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pt(d.widthMm)} ${pt(d.heightMm)}] /Contents ${4 + i * 2} 0 R /Resources << >> >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i) & 0xff;
  return bytes;
}

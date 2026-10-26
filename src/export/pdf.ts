import type { Drawing } from '../qr/geometry';
import { num } from '../qr/path';
import { hexToRgb } from './color';

/** PDF text string as UTF-16BE hex, so any title survives. */
function pdfText(s: string): string {
  let hex = 'FEFF';
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/**
 * One-page vector PDF, `sizePt` points square. The page content is drawn in module units
 * (y down) through one transformation matrix; every byte is ASCII so offsets are string lengths.
 */
export function toPdf(d: Drawing, sizePt: number, title = 'QR code', date = new Date()): Uint8Array<ArrayBuffer> {
  const s = sizePt / d.size;
  const ops: string[] = ['q', `${num(s)} 0 0 ${num(-s)} 0 ${num(sizePt)} cm`];
  const fill = (hex: string) => hexToRgb(hex).map(num).join(' ') + ' rg';
  if (d.background) ops.push(fill(d.background), `0 0 ${num(d.size)} ${num(d.size)} re f`);
  for (const l of d.layers) {
    if (!l.cmds.length) continue;
    ops.push(fill(l.fill));
    let line = '';
    for (const c of l.cmds) {
      if (c[0] === 'M') line += `${num(c[1])} ${num(c[2])} m `;
      else if (c[0] === 'L') line += `${num(c[1])} ${num(c[2])} l `;
      else if (c[0] === 'C') line += `${c.slice(1).map((v) => num(v as number)).join(' ')} c `;
      else {
        ops.push(line + 'h');
        line = '';
      }
    }
    if (line) ops.push(line.trimEnd());
    ops.push(l.rule === 'evenodd' ? 'f*' : 'f');
  }
  ops.push('Q');
  const content = ops.join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(sizePt)} ${num(sizePt)}] /Resources << >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Title ${pdfText(title)} /Creator (Wunder QR Code) /Producer (Wunder QR Code) /CreationDate (${pdfDate(date)}) >>`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

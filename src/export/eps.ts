import type { Drawing } from '../qr/geometry';
import { num } from '../qr/path';
import { hexToRgb } from './color';

/** Encapsulated PostScript (level 2), `sizePt` points square, for print and sign makers. */
export function toEps(d: Drawing, sizePt: number, title = 'QR code', date = new Date()): string {
  const s = sizePt / d.size;
  // DSC comments are 7-bit: anything else in the title becomes "?". Parentheses would end the text.
  const safeTitle = title.replace(/[^\x20-\x7e]/g, '?').replace(/[()\\]/g, '');
  const lines = [
    '%!PS-Adobe-3.0 EPSF-3.0',
    `%%BoundingBox: 0 0 ${Math.ceil(sizePt)} ${Math.ceil(sizePt)}`,
    `%%HiResBoundingBox: 0 0 ${num(sizePt)} ${num(sizePt)}`,
    `%%Title: (${safeTitle})`,
    '%%Creator: Wunder QR Code',
    `%%CreationDate: (${date.toISOString()})`,
    '%%LanguageLevel: 2',
    '%%Pages: 1',
    '%%EndComments',
    '%%Page: 1 1',
    'save',
    '/m /moveto load def /l /lineto load def /c /curveto load def /h /closepath load def',
    `0 ${num(sizePt)} translate ${num(s)} ${num(-s)} scale`,
  ];
  const color = (hex: string) => hexToRgb(hex).map(num).join(' ') + ' setrgbcolor';
  if (d.background) lines.push(color(d.background), `0 0 ${num(d.size)} ${num(d.size)} rectfill`);
  for (const layer of d.layers) {
    if (!layer.cmds.length) continue;
    lines.push(color(layer.fill), 'newpath');
    let line = '';
    for (const c of layer.cmds) {
      if (c[0] === 'M') line += `${num(c[1])} ${num(c[2])} m `;
      else if (c[0] === 'L') line += `${num(c[1])} ${num(c[2])} l `;
      else if (c[0] === 'C') line += `${c.slice(1).map((v) => num(v as number)).join(' ')} c `;
      else {
        lines.push(line + 'h');
        line = '';
      }
    }
    if (line) lines.push(line.trimEnd());
    lines.push(layer.rule === 'evenodd' ? 'eofill' : 'fill');
  }
  lines.push('restore', 'showpage', '%%EOF', '');
  return lines.join('\n');
}

import type { Drawing } from '../qr/geometry';
import { num, toSvgD } from '../qr/path';

export function toSvg(d: Drawing, px: number, title = 'QR code'): string {
  const s = num(d.size);
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${s} ${s}" role="img"><title>${esc(title)}</title>`;
  if (d.background) out += `<rect width="${s}" height="${s}" fill="${d.background}"/>`;
  for (const l of d.layers) {
    if (!l.cmds.length) continue;
    out += `<path d="${toSvgD(l.cmds)}" fill="${l.fill}"`;
    if (l.rule === 'evenodd') out += ' fill-rule="evenodd"';
    if (l.crisp) out += ' shape-rendering="crispEdges"';
    out += '/>';
  }
  return out + '</svg>';
}

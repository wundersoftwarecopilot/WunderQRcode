/**
 * Paths shared by every exporter, in absolute coordinates, y pointing down.
 * Only move / line / cubic / close: SVG, Canvas (Path2D), PDF and PostScript all speak these.
 */
export type Cmd = ['M', number, number] | ['L', number, number] | ['C', number, number, number, number, number, number] | ['Z'];

/** Bézier handle length for a quarter circle. */
const K = 0.5522847498307936;

export function rect(out: Cmd[], x: number, y: number, w: number, h: number): void {
  out.push(['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']);
}

/** Rectangle with an independent radius per corner (top-left, top-right, bottom-right, bottom-left). */
export function roundRect(out: Cmd[], x: number, y: number, w: number, h: number, r: [number, number, number, number]): void {
  const [tl, tr, br, bl] = r;
  const line = (px: number, py: number) => {
    const last = out[out.length - 1];
    if (last[0] === 'Z' || last[last.length - 2] !== px || last[last.length - 1] !== py) out.push(['L', px, py]);
  };
  out.push(['M', x + tl, y]);
  line(x + w - tr, y);
  if (tr) out.push(['C', x + w - tr + tr * K, y, x + w, y + tr - tr * K, x + w, y + tr]);
  line(x + w, y + h - br);
  if (br) out.push(['C', x + w, y + h - br + br * K, x + w - br + br * K, y + h, x + w - br, y + h]);
  line(x + bl, y + h);
  if (bl) out.push(['C', x + bl - bl * K, y + h, x, y + h - bl + bl * K, x, y + h - bl]);
  line(x, y + tl);
  if (tl) out.push(['C', x, y + tl - tl * K, x + tl - tl * K, y, x + tl, y]);
  out.push(['Z']);
}

export function circle(out: Cmd[], cx: number, cy: number, r: number): void {
  const k = r * K;
  out.push(
    ['M', cx, cy - r],
    ['C', cx + k, cy - r, cx + r, cy - k, cx + r, cy],
    ['C', cx + r, cy + k, cx + k, cy + r, cx, cy + r],
    ['C', cx - k, cy + r, cx - r, cy + k, cx - r, cy],
    ['C', cx - r, cy - k, cx - k, cy - r, cx, cy - r],
    ['Z'],
  );
}

export function transform(cmds: Cmd[], scale: number, dx: number, dy: number): Cmd[] {
  return cmds.map((c): Cmd => {
    switch (c[0]) {
      case 'M':
      case 'L':
        return [c[0], c[1] * scale + dx, c[2] * scale + dy];
      case 'C':
        return ['C', c[1] * scale + dx, c[2] * scale + dy, c[3] * scale + dx, c[4] * scale + dy, c[5] * scale + dx, c[6] * scale + dy];
      default:
        return c;
    }
  });
}

/** Short decimal: at most 3 decimals, no trailing zeros, never "-0". */
export function num(n: number): string {
  const s = Number(n.toFixed(3));
  return Object.is(s, -0) ? '0' : String(s);
}

export function toSvgD(cmds: Cmd[]): string {
  let d = '';
  for (const c of cmds) {
    if (c[0] === 'Z') d += 'Z';
    else d += c[0] + c.slice(1).map((v) => num(v as number)).join(' ');
  }
  return d;
}

/**
 * Parses an SVG path `d` (all commands, absolute or relative, arcs included) into absolute
 * M/L/C/Z. Used for the logo, so the official artwork can be pasted in as plain path data.
 */
export function parseSvgPath(d: string): Cmd[] {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
  const out: Cmd[] = [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  // Last control point, for S/T reflections.
  let cx = 0;
  let cy = 0;
  let prev = '';
  const n = () => parseFloat(tokens[i++]);
  const isNum = () => i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i]);
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) throw new Error('Path must start with a command');
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (C) {
      case 'M': {
        x = ox + n();
        y = oy + n();
        sx = x;
        sy = y;
        out.push(['M', x, y]);
        // Further pairs after a moveto are implicit linetos.
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L':
        x = ox + n();
        y = oy + n();
        out.push(['L', x, y]);
        break;
      case 'H':
        x = ox + n();
        out.push(['L', x, y]);
        break;
      case 'V':
        y = oy + n();
        out.push(['L', x, y]);
        break;
      case 'C': {
        const x1 = ox + n(), y1 = oy + n(), x2 = ox + n(), y2 = oy + n();
        x = ox + n();
        y = oy + n();
        out.push(['C', x1, y1, x2, y2, x, y]);
        cx = x2;
        cy = y2;
        break;
      }
      case 'S': {
        const x1 = prev === 'C' || prev === 'S' ? 2 * x - cx : x;
        const y1 = prev === 'C' || prev === 'S' ? 2 * y - cy : y;
        const x2 = ox + n(), y2 = oy + n();
        x = ox + n();
        y = oy + n();
        out.push(['C', x1, y1, x2, y2, x, y]);
        cx = x2;
        cy = y2;
        break;
      }
      case 'Q':
      case 'T': {
        let qx: number, qy: number;
        if (C === 'Q') {
          qx = ox + n();
          qy = oy + n();
        } else {
          qx = prev === 'Q' || prev === 'T' ? 2 * x - cx : x;
          qy = prev === 'Q' || prev === 'T' ? 2 * y - cy : y;
        }
        const ex = ox + n(), ey = oy + n();
        out.push(['C', x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey]);
        x = ex;
        y = ey;
        cx = qx;
        cy = qy;
        break;
      }
      case 'A': {
        const rx = n(), ry = n(), rot = n(), large = n(), sweep = n();
        const ex = ox + n(), ey = oy + n();
        arcToCubics(out, x, y, rx, ry, rot, large !== 0, sweep !== 0, ex, ey);
        x = ex;
        y = ey;
        break;
      }
      case 'Z':
        out.push(['Z']);
        x = sx;
        y = sy;
        break;
      default:
        throw new Error(`Unsupported path command ${cmd}`);
    }
    prev = C;
    if (C === 'Z' && isNum()) throw new Error('Numbers after Z');
  }
  return out;
}

/** SVG elliptical arc → cubic Béziers (SVG 1.1 implementation notes, F.6.5). */
function arcToCubics(out: Cmd[], x1: number, y1: number, rx: number, ry: number, angle: number, large: boolean, sweep: boolean, x2: number, y2: number): void {
  if (x1 === x2 && y1 === y2) return;
  if (!rx || !ry) {
    out.push(['L', x2, y2]);
    return;
  }
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (angle * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const xp = cos * dx + sin * dy;
  const yp = -sin * dx + cos * dy;
  const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num2 = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const den = rx * rx * yp * yp + ry * ry * xp * xp;
  let coef = Math.sqrt(Math.max(0, num2 / den));
  if (large === sweep) coef = -coef;
  const cxp = (coef * rx * yp) / ry;
  const cyp = (-coef * ry * xp) / rx;
  const cxc = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cyc = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const segs = Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9);
  const step = dt / segs;
  const k = (4 / 3) * Math.tan(step / 4);
  let t = t1;
  const pt = (a: number): [number, number] => [cxc + rx * Math.cos(a) * cos - ry * Math.sin(a) * sin, cyc + rx * Math.cos(a) * sin + ry * Math.sin(a) * cos];
  const dpt = (a: number): [number, number] => [-rx * Math.sin(a) * cos - ry * Math.cos(a) * sin, -rx * Math.sin(a) * sin + ry * Math.cos(a) * cos];
  for (let s = 0; s < segs; s++) {
    const [ax, ay] = pt(t);
    const [adx, ady] = dpt(t);
    const t2 = t + step;
    const [bx, by] = s === segs - 1 ? [x2, y2] : pt(t2);
    const [bdx, bdy] = dpt(t2);
    out.push(['C', ax + k * adx, ay + k * ady, bx - k * bdx, by - k * bdy, bx, by]);
    t = t2;
  }
}

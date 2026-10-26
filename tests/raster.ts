import type { Drawing } from '../src/qr/geometry';
import { hexToRgb } from '../src/export/color';

/**
 * Test-only scanline rasteriser: fills a Drawing into RGBA pixels with exact non-zero /
 * even-odd rules and no anti-aliasing, so a decoder can read what every exporter describes.
 */
export function rasterize(d: Drawing, px: number, background = '#FFFFFF'): Uint8ClampedArray {
  const out = new Uint8ClampedArray(px * px * 4);
  const paint = (hex: string, rows: Array<Array<[number, number]>>) => {
    const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v * 255));
    rows.forEach((spans, y) => {
      for (const [x0, x1] of spans)
        for (let x = Math.max(0, x0); x < Math.min(px, x1); x++) {
          const i = (y * px + x) * 4;
          out[i] = r;
          out[i + 1] = g;
          out[i + 2] = b;
          out[i + 3] = 255;
        }
    });
  };
  const bgRows = Array.from({ length: px }, (): Array<[number, number]> => [[0, px]]);
  paint(d.background ?? background, bgRows);

  const s = px / d.size;
  for (const layer of d.layers) {
    // Flatten to edges in pixel space.
    const edges: Array<[number, number, number, number]> = [];
    let sx = 0, sy = 0, x = 0, y = 0;
    for (const c of layer.cmds) {
      if (c[0] === 'M') {
        x = sx = c[1] * s;
        y = sy = c[2] * s;
      } else if (c[0] === 'L') {
        edges.push([x, y, c[1] * s, c[2] * s]);
        x = c[1] * s;
        y = c[2] * s;
      } else if (c[0] === 'C') {
        const [x1, y1, x2, y2, x3, y3] = c.slice(1).map((v) => (v as number) * s);
        const steps = 12;
        let px0 = x, py0 = y;
        for (let k = 1; k <= steps; k++) {
          const t = k / steps, u = 1 - t;
          const qx = u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
          const qy = u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
          edges.push([px0, py0, qx, qy]);
          px0 = qx;
          py0 = qy;
        }
        x = x3;
        y = y3;
      } else {
        if (x !== sx || y !== sy) edges.push([x, y, sx, sy]);
        x = sx;
        y = sy;
      }
    }
    // Each edge drops its crossings straight into the rows it spans (pixel centres at y + 0.5).
    const hits: Array<Array<[number, number]>> = Array.from({ length: px }, () => []);
    for (const [ax, ay, bx, by] of edges) {
      if (ay === by) continue;
      const lo = Math.min(ay, by), hi = Math.max(ay, by);
      for (let row = Math.max(0, Math.ceil(lo - 0.5)); row < px && row + 0.5 < hi; row++) {
        const yc = row + 0.5;
        hits[row].push([ax + ((yc - ay) / (by - ay)) * (bx - ax), by > ay ? 1 : -1]);
      }
    }
    const rows = hits.map((h) => {
      h.sort((a, b) => a[0] - b[0]);
      const spans: Array<[number, number]> = [];
      let wind = 0;
      for (let k = 0; k < h.length - 1; k++) {
        wind = layer.rule === 'evenodd' ? wind ^ 1 : wind + h[k][1];
        if (wind !== 0) spans.push([Math.round(h[k][0]), Math.round(h[k + 1][0])]);
      }
      return spans;
    });
    paint(layer.fill, rows);
  }
  return out;
}

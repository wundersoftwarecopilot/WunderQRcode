import { BRAND } from './colors';

/**
 * The Wunder logo, as SVG path data in a 100 × 100 box.
 *
 * PLACEHOLDER: a white "W" monogram on the red disc, the same mark used in the Wunder virtual
 * showroom, until the official SVG master arrives from the graphics office. This is the only place
 * to change it: the header, the favicon and the logo inside the QR codes (all six export formats)
 * are drawn from these paths. To swap in the official artwork, copy each `<path d="…">` and its
 * fill from the master SVG into `parts` (any path command works, arcs included) and adjust
 * `viewBox`; shapes other than <path> (circle, rect, polygon) must be converted to paths first.
 */
export interface LogoPart {
  d: string;
  fill: string;
  rule?: 'nonzero' | 'evenodd';
}

export interface Logo {
  /** [minX, minY, width, height] of the artwork. */
  viewBox: [number, number, number, number];
  parts: LogoPart[];
  /** Shape cut out of the QR modules under the logo. */
  clear: 'circle' | 'rect';
}

// The W: four slanted bars (bottom edge at y 70, tops at y 30 and 42), 8.5 wide.
const bar = (bx: number, tx: number, ty: number) => `M${bx - 4.25} 70H${bx + 4.25}L${tx + 4.25} ${ty}H${tx - 4.25}Z`;

export const LOGO: Logo = {
  viewBox: [0, 0, 100, 100],
  parts: [
    { d: 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z', fill: BRAND.red },
    { d: bar(40, 23.5, 30) + bar(40, 50, 42) + bar(60, 50, 42) + bar(60, 76.5, 30), fill: BRAND.white },
  ],
  clear: 'circle',
};

/** Standalone SVG markup of the logo (header, footer, favicon). */
export function logoSvg(attrs = ''): string {
  const [x, y, w, h] = LOGO.viewBox;
  const paths = LOGO.parts.map((p) => `<path d="${p.d}" fill="${p.fill}"${p.rule === 'evenodd' ? ' fill-rule="evenodd"' : ''}/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}"${attrs ? ' ' + attrs : ''}>${paths}</svg>`;
}

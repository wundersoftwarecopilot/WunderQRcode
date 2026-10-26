import { LOGO } from '../brand/logo';
import type { QrMatrix } from './matrix';
import { type Cmd, circle, parseSvgPath, rect, roundRect, transform } from './path';

export type ModuleStyle = 'square' | 'rounded' | 'dots';
export type EyeStyle = 'square' | 'rounded' | 'circle';

export interface Design {
  /** Quiet zone around the symbol, in modules. */
  margin: number;
  /** Data modules. */
  fg: string;
  /** The three finder patterns ("eyes"). */
  eye: string;
  /** null = transparent. */
  bg: string | null;
  moduleStyle: ModuleStyle;
  eyeStyle: EyeStyle;
  logo: boolean;
}

export interface Layer {
  cmds: Cmd[];
  fill: string;
  rule: 'nonzero' | 'evenodd';
  /** Only axis-aligned edges on the module grid: rasterisers may snap them to pixels. */
  crisp: boolean;
}

/** A styled QR code in module units: `size` × `size` including the quiet zone. */
export interface Drawing {
  size: number;
  background: string | null;
  layers: Layer[];
}

/**
 * Centres (row/column indices) of the alignment patterns of a version, ISO/IEC 18004 annex E;
 * the three that would overlap the finder patterns are skipped by the caller.
 */
export function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const out = [6];
  for (let pos = version * 4 + 10; out.length < count; pos -= step) out.splice(1, 0, pos);
  return out;
}

/** Logo width as a share of the symbol width (quiet zone excluded). */
export const LOGO_SHARE = 0.24;
/** Free ring between the logo and the nearest module, in modules. */
const LOGO_GAP = 0.4;

export function buildDrawing(m: QrMatrix, o: Design): Drawing {
  const n = m.size;
  const q = o.margin;
  // Modules not drawn as plain data modules: the finder patterns and the logo cut-out.
  const hidden = new Uint8Array(n * n);
  const eyes: Array<[number, number]> = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ];
  for (const [ec, er] of eyes) for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) hidden[(er + r) * n + ec + c] = 1;

  const logoLayers: Layer[] = [];
  if (o.logo) {
    const [vx, vy, vw, vh] = LOGO.viewBox;
    const scale = (n * LOGO_SHARE) / Math.max(vw, vh);
    const w = vw * scale;
    const h = vh * scale;
    const x0 = (n - w) / 2;
    const y0 = (n - h) / 2;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        let cut: boolean;
        if (LOGO.clear === 'circle') {
          // Nearest point of the module square to the disc centre.
          const px = Math.min(Math.max(n / 2, c), c + 1);
          const py = Math.min(Math.max(n / 2, r), r + 1);
          cut = Math.hypot(px - n / 2, py - n / 2) < Math.max(w, h) / 2 + LOGO_GAP;
        } else {
          cut = c + 1 > x0 - LOGO_GAP && c < x0 + w + LOGO_GAP && r + 1 > y0 - LOGO_GAP && r < y0 + h + LOGO_GAP;
        }
        if (cut) hidden[r * n + c] = 1;
      }
    for (const part of LOGO.parts)
      logoLayers.push({
        cmds: transform(parseSvgPath(part.d), scale, q + x0 - vx * scale, q + y0 - vy * scale),
        fill: part.fill,
        rule: part.rule ?? 'nonzero',
        crisp: false,
      });
  }

  // Alignment patterns are drawn whole, in the eye style: as loose dots their rings break up and
  // readers miss them. One the logo covers stays hidden under it.
  const aligns: Array<[number, number]> = [];
  const pos = alignmentPositions(m.version);
  for (const r of pos)
    for (const c of pos) {
      if ((r < 9 && c < 9) || (r < 9 && c > n - 10) || (r > n - 10 && c < 9)) continue;
      let covered = false;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) covered ||= hidden[(r + dr) * n + c + dc] === 1;
      if (covered) continue;
      aligns.push([r, c]);
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) hidden[(r + dr) * n + c + dc] = 1;
    }

  const on = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && m.dark[r * n + c] === 1 && hidden[r * n + c] === 0;

  const mods: Cmd[] = [];
  for (let r = 0; r < n; r++) {
    if (o.moduleStyle === 'square') {
      // Horizontal runs: fewer, longer rectangles and no seams between neighbours.
      for (let c = 0; c < n; ) {
        if (!on(r, c)) {
          c++;
          continue;
        }
        const c0 = c;
        while (on(r, c)) c++;
        rect(mods, q + c0, q + r, c - c0, 1);
      }
      continue;
    }
    for (let c = 0; c < n; c++) {
      if (!on(r, c)) continue;
      if (o.moduleStyle === 'dots') circle(mods, q + c + 0.5, q + r + 0.5, 0.45);
      else {
        // A corner is rounded when neither of the two modules beside it is dark.
        const up = on(r - 1, c);
        const down = on(r + 1, c);
        const left = on(r, c - 1);
        const right = on(r, c + 1);
        const R = 0.5;
        roundRect(mods, q + c, q + r, 1, 1, [!up && !left ? R : 0, !up && !right ? R : 0, !down && !right ? R : 0, !down && !left ? R : 0]);
      }
    }
  }

  const eyeCmds: Cmd[] = [];
  for (const [ec, er] of eyes) {
    const x = q + ec;
    const y = q + er;
    if (o.eyeStyle === 'circle') {
      circle(eyeCmds, x + 3.5, y + 3.5, 3.5);
      circle(eyeCmds, x + 3.5, y + 3.5, 2.5);
      circle(eyeCmds, x + 3.5, y + 3.5, 1.5);
    } else if (o.eyeStyle === 'rounded') {
      roundRect(eyeCmds, x, y, 7, 7, [2.25, 2.25, 2.25, 2.25]);
      roundRect(eyeCmds, x + 1, y + 1, 5, 5, [1.4, 1.4, 1.4, 1.4]);
      roundRect(eyeCmds, x + 2, y + 2, 3, 3, [0.9, 0.9, 0.9, 0.9]);
    } else {
      rect(eyeCmds, x, y, 7, 7);
      rect(eyeCmds, x + 1, y + 1, 5, 5);
      rect(eyeCmds, x + 2, y + 2, 3, 3);
    }
  }

  const alignCmds: Cmd[] = [];
  for (const [r, c] of aligns) {
    const x = q + c - 2;
    const y = q + r - 2;
    if (o.eyeStyle === 'circle') {
      circle(alignCmds, x + 2.5, y + 2.5, 2.5);
      circle(alignCmds, x + 2.5, y + 2.5, 1.5);
      circle(alignCmds, x + 2.5, y + 2.5, 0.5);
    } else if (o.eyeStyle === 'rounded') {
      roundRect(alignCmds, x, y, 5, 5, [1.6, 1.6, 1.6, 1.6]);
      roundRect(alignCmds, x + 1, y + 1, 3, 3, [0.8, 0.8, 0.8, 0.8]);
      roundRect(alignCmds, x + 2, y + 2, 1, 1, [0.3, 0.3, 0.3, 0.3]);
    } else {
      rect(alignCmds, x, y, 5, 5);
      rect(alignCmds, x + 1, y + 1, 3, 3);
      rect(alignCmds, x + 2, y + 2, 1, 1);
    }
  }

  return {
    size: n + 2 * q,
    background: o.bg,
    layers: [
      // Ring and hole of each eye are separate sub-paths: even-odd leaves the hole empty.
      { cmds: mods, fill: o.fg, rule: 'evenodd', crisp: o.moduleStyle === 'square' },
      { cmds: alignCmds, fill: o.fg, rule: 'evenodd', crisp: o.eyeStyle === 'square' },
      { cmds: eyeCmds, fill: o.eye, rule: 'evenodd', crisp: o.eyeStyle === 'square' },
      ...logoLayers,
    ],
  };
}

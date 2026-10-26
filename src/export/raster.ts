import type { Drawing } from '../qr/geometry';

export type RasterType = 'image/png' | 'image/jpeg' | 'image/webp';

/**
 * Draws the code on a `px` × `px` canvas. Grid-aligned layers are snapped to whole pixels so a
 * square code stays sharp at any size; curves keep their anti-aliasing.
 */
export function drawToCanvas(d: Drawing, px: number, canvas: HTMLCanvasElement = document.createElement('canvas'), background = d.background): HTMLCanvasElement {
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not available');
  ctx.clearRect(0, 0, px, px);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, px, px);
  }
  const s = px / d.size;
  for (const l of d.layers) {
    if (!l.cmds.length) continue;
    const f = l.crisp ? (v: number) => Math.round(v * s) : (v: number) => v * s;
    ctx.beginPath();
    for (const c of l.cmds) {
      if (c[0] === 'M') ctx.moveTo(f(c[1]), f(c[2]));
      else if (c[0] === 'L') ctx.lineTo(f(c[1]), f(c[2]));
      else if (c[0] === 'C') ctx.bezierCurveTo(f(c[1]), f(c[2]), f(c[3]), f(c[4]), f(c[5]), f(c[6]));
      else ctx.closePath();
    }
    ctx.fillStyle = l.fill;
    ctx.fill(l.rule);
  }
  return canvas;
}

export class UnsupportedFormatError extends Error {}

export function toRasterBlob(d: Drawing, px: number, type: RasterType): Promise<Blob> {
  // JPEG has no alpha channel: a transparent code gets a white background instead of black.
  const canvas = drawToCanvas(d, px, undefined, type === 'image/jpeg' ? (d.background ?? '#FFFFFF') : d.background);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        // Browsers that cannot encode a type (Safari and WebP) silently fall back to PNG.
        if (!blob) reject(new Error('Encoding failed'));
        else if (blob.type !== type) reject(new UnsupportedFormatError(type));
        else resolve(blob);
      },
      type,
      type === 'image/png' ? undefined : type === 'image/webp' ? 1 : 0.95,
    ),
  );
}

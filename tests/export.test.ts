import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { toEps } from '../src/export/eps';
import { toPdf } from '../src/export/pdf';
import { toSvg } from '../src/export/svg';
import { buildDrawing } from '../src/qr/geometry';
import { makeMatrix } from '../src/qr/matrix';
import { parseSvgPath, toSvgD } from '../src/qr/path';

const TEXT = 'https://www.wunder.it/';
const drawing = (logo = true) =>
  buildDrawing(makeMatrix(TEXT, 'H'), { margin: 4, fg: '#1D1D1B', eye: '#D90000', bg: '#FFFFFF', moduleStyle: 'rounded', eyeStyle: 'rounded', logo });

function hasTool(name: string): boolean {
  try {
    execFileSync('which', [name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Binary PGM (P5) → RGBA. */
function pgmToRgba(buf: Buffer): { data: Uint8ClampedArray; width: number; height: number } {
  const header = buf.toString('latin1', 0, 64).match(/^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/);
  if (!header) throw new Error('not a PGM');
  const width = +header[1];
  const height = +header[2];
  const gray = buf.subarray(header[0].length);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([gray[i], gray[i], gray[i], 255], i * 4);
  return { data, width, height };
}

describe('PDF', () => {
  const bytes = toPdf(drawing(), 283.46, 'QR – Wunder', new Date('2026-01-02T03:04:05Z'));
  const text = new TextDecoder().decode(bytes);

  it('has a valid cross-reference table', () => {
    expect(text.startsWith('%PDF-1.4\n')).toBe(true);
    const startxref = +text.match(/startxref\n(\d+)\n%%EOF\n$/)![1];
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const entries = text.slice(startxref).match(/^(\d{10}) 00000 n $/gm)!;
    expect(entries).toHaveLength(5);
    entries.forEach((e, i) => expect(text.slice(+e.slice(0, 10)).startsWith(`${i + 1} 0 obj\n`)).toBe(true));
    const len = +text.match(/\/Length (\d+)/)![1];
    const start = text.indexOf('stream\n') + 7;
    expect(text.slice(start + len, start + len + 10)).toBe('\nendstream');
    expect(text).toContain('/MediaBox [0 0 283.46 283.46]');
    expect(text).toContain('/CreationDate (D:20260102030405Z)');
  });

  it.skipIf(!hasTool('pdftoppm'))('renders with poppler and decodes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wqr-'));
    writeFileSync(join(dir, 'qr.pdf'), bytes);
    execFileSync('pdftoppm', ['-r', '150', '-gray', join(dir, 'qr.pdf'), join(dir, 'out')]);
    const pgm = readdirSync(dir).find((f) => f.endsWith('.pgm'))!;
    const { data, width, height } = pgmToRgba(readFileSync(join(dir, pgm)));
    expect(width).toBe(591);
    expect(jsQR(data, width, height)?.data).toBe(TEXT);
  });
});

describe('EPS', () => {
  const eps = toEps(drawing(), 141.73, 'QR (Wunder) – è', new Date('2026-01-02T03:04:05Z'));
  it('has DSC headers, one save/restore pair and one fill per layer', () => {
    const lines = eps.split('\n');
    expect(lines[0]).toBe('%!PS-Adobe-3.0 EPSF-3.0');
    expect(lines).toContain('%%BoundingBox: 0 0 142 142');
    expect(lines).toContain('%%HiResBoundingBox: 0 0 141.73 141.73');
    expect(lines).toContain('%%Title: (QR Wunder ? ?)');
    expect(lines.filter((l) => l === 'save')).toHaveLength(1);
    expect(lines.filter((l) => l === 'restore')).toHaveLength(1);
    // modules, alignment pattern, eyes (even-odd); disc and W (non-zero)
    expect(lines.filter((l) => l === 'eofill')).toHaveLength(3);
    expect(lines.filter((l) => l === 'fill')).toHaveLength(2);
    expect(eps.endsWith('%%EOF\n')).toBe(true);
    expect(/^[\x09\x0a\x20-\x7e]*$/.test(eps)).toBe(true);
  });
});

describe('SVG', () => {
  it('describes background, modules, eyes and logo', () => {
    const svg = toSvg(drawing(), 512, 'a < b & c');
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="512" height="512" viewBox="0 0 37 37"/);
    expect(svg).toContain('<title>a &lt; b &amp; c</title>');
    expect(svg.match(/<path /g)).toHaveLength(5);
    expect(svg).toContain('fill="#D90000"');
  });

  it('marks square layers crisp and leaves out the logo when off', () => {
    const d = buildDrawing(makeMatrix(TEXT, 'M'), { margin: 2, fg: '#000000', eye: '#000000', bg: null, moduleStyle: 'square', eyeStyle: 'square', logo: false });
    const svg = toSvg(d, 256);
    // modules, alignment pattern, eyes
    expect(svg.match(/shape-rendering="crispEdges"/g)).toHaveLength(3);
    expect(svg).not.toContain('<rect');
  });
});

describe('path parser', () => {
  it('handles relative commands, H/V, S, Q/T and arcs', () => {
    expect(toSvgD(parseSvgPath('m10 10h5v5h-5z'))).toBe('M10 10L15 10L15 15L10 15Z');
    expect(toSvgD(parseSvgPath('M0 0L1 1 2 0'))).toBe('M0 0L1 1L2 0');
    expect(toSvgD(parseSvgPath('M0 0C0 1 1 1 1 0S2 -1 2 0'))).toBe('M0 0C0 1 1 1 1 0C1 -1 2 -1 2 0');
    expect(toSvgD(parseSvgPath('M0 0Q1 3 2 0T4 0'))).toBe('M0 0C0.667 2 1.333 2 2 0C2.667 -2 3.333 -2 4 0');
    // A half circle of radius 50 ends exactly where asked and bulges to x = 100.
    const arc = parseSvgPath('M50 0A50 50 0 0 1 50 100');
    expect(arc.at(-1)!.slice(-2)).toEqual([50, 100]);
    expect(arc.filter((c) => c[0] === 'C')).toHaveLength(2);
    expect((arc[1] as number[])[5]).toBeCloseTo(100, 6);
  });
});

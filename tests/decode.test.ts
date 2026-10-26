import jsQR from 'jsqr';
import qrcode from 'qrcode-generator';
import { describe, expect, it } from 'vitest';
import { type Design, type EyeStyle, type ModuleStyle, alignmentPositions, buildDrawing } from '../src/qr/geometry';
import { type Ecc, QrTooLongError, makeMatrix } from '../src/qr/matrix';
import { vcardPayload, wifiPayload } from '../src/payloads';
import { rasterize } from './raster';

function decode(text: string, design: Partial<Design>, ecc: Ecc = 'M', pxPerModule = 8): string | undefined {
  const o: Design = { margin: 4, fg: '#1D1D1B', eye: '#1D1D1B', bg: '#FFFFFF', moduleStyle: 'square', eyeStyle: 'square', logo: false, ...design };
  const m = makeMatrix(text, o.logo ? 'H' : ecc);
  const d = buildDrawing(m, o);
  const px = d.size * pxPerModule;
  return jsQR(rasterize(d, px), px, px)?.data;
}

const TEXTS = {
  url: 'https://www.wunder.it/',
  long: 'https://medicale.wunder.it/it/pesapersone-digitali/1478-r2020.html?utm_source=qr&utm_medium=print&utm_campaign=fiera-2026&ref=' + 'x'.repeat(120),
  utf8: 'Perché è così? Prezzo 10 € — bilance di precisione ✓',
  wifi: wifiPayload({ ssid: 'Wunder Ospiti', password: 'p@ss;word', security: 'WPA', hidden: false }),
  vcard: vcardPayload({
    firstName: 'Mario', lastName: 'Rossi', org: 'Wunder Sa.Bi. Srl', title: 'Commerciale', mobile: '+39 333 1234567', work: '+39 02 90964566',
    email: 'mario.rossi@wunder.it', url: 'https://www.wunder.it/', street: 'Via Vecchia per Monza 20', city: "Trezzo sull'Adda", zip: '20056', country: 'Italia', note: '',
  }),
};

describe('generated codes decode back to their content', () => {
  for (const [name, text] of Object.entries(TEXTS))
    it(`plain ${name}`, () => {
      expect(decode(text, {})).toBe(text);
    });

  const modules: ModuleStyle[] = ['square', 'rounded', 'dots'];
  const eyes: EyeStyle[] = ['square', 'rounded', 'circle'];
  for (const moduleStyle of modules)
    for (const eyeStyle of eyes)
      for (const logo of [false, true])
        it(`${moduleStyle} modules, ${eyeStyle} eyes${logo ? ', logo' : ''}`, () => {
          const design: Partial<Design> = { moduleStyle, eyeStyle, logo, eye: '#D90000' };
          // Small and large renders: at high resolution loose dots read as gaps, not modules.
          for (const text of [TEXTS.url, TEXTS.vcard])
            for (const ppm of [5, 24]) expect(decode(text, design, 'M', ppm), `${ppm} px/module`).toBe(text);
        });

  it('logo on every small version (1–6)', () => {
    // Version 1 holds 7 bytes at H; each step adds capacity.
    for (const text of ['wunder', 'https://wunder.it', 'https://www.wunder.it/it/', 'https://www.wunder.it/it/azienda/contatti/']) {
      expect(decode(text, { logo: true })).toBe(text);
      expect(decode(text, { logo: true, moduleStyle: 'dots', eyeStyle: 'circle' })).toBe(text);
    }
  });

  it('brand colours and a transparent background', () => {
    expect(decode(TEXTS.url, { fg: '#116374', eye: '#D90000', bg: null })).toBe(TEXTS.url);
    expect(decode(TEXTS.url, { fg: '#D90000', eye: '#D90000' })).toBe(TEXTS.url);
  });

  it('a quiet zone of 1 module still reads', () => {
    expect(decode(TEXTS.url, { margin: 1 })).toBe(TEXTS.url);
  });
});

describe('matrix', () => {
  it('alignment patterns sit where the encoder put them, in every version', () => {
    expect(alignmentPositions(1)).toEqual([]);
    expect(alignmentPositions(2)).toEqual([6, 18]);
    expect(alignmentPositions(7)).toEqual([6, 22, 38]);
    expect(alignmentPositions(32)).toEqual([6, 34, 60, 86, 112, 138]);
    expect(alignmentPositions(40)).toEqual([6, 30, 58, 86, 114, 142, 170]);
    for (let v = 2; v <= 40; v++) {
      const qr = qrcode(v as Parameters<typeof qrcode>[0], 'L');
      qr.addData('wunder');
      qr.make();
      const size = qr.getModuleCount();
      const m = { version: (size - 17) / 4, size, dark: Uint8Array.from({ length: size * size }, (_, i) => (qr.isDark(Math.floor(i / size), i % size) ? 1 : 0)) };
      expect(m.version).toBe(v);
      const pos = alignmentPositions(v);
      for (const r of pos)
        for (const c of pos) {
          if ((r < 9 && c < 9) || (r < 9 && c > m.size - 10) || (r > m.size - 10 && c < 9)) continue;
          for (let dr = -2; dr <= 2; dr++)
            for (let dc = -2; dc <= 2; dc++) {
              const ring = Math.max(Math.abs(dr), Math.abs(dc));
              expect(m.dark[(r + dr) * m.size + c + dc], `v${v} (${r},${c})`).toBe(ring === 1 ? 0 : 1);
            }
        }
    }
  });

  it('reports the version and grows with the content', () => {
    const a = makeMatrix('wunder', 'H');
    expect(a.version).toBe(1);
    expect(a.size).toBe(21);
    expect(makeMatrix(TEXTS.long, 'M').version).toBeGreaterThan(5);
  });

  it('throws QrTooLongError past version 40', () => {
    expect(() => makeMatrix('a'.repeat(3000), 'H')).toThrow(QrTooLongError);
    expect(makeMatrix('a'.repeat(2900), 'L').version).toBe(40);
  });
});

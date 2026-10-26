import qrcode from 'qrcode-generator';

export type Ecc = 'L' | 'M' | 'Q' | 'H';

/** A QR symbol without quiet zone: `size` × `size` modules, row-major, 1 = dark. */
export interface QrMatrix {
  size: number;
  version: number;
  ecc: Ecc;
  dark: Uint8Array;
}

/** The content does not fit in a version 40 symbol at the chosen error correction. */
export class QrTooLongError extends Error {
  constructor(public readonly bytes: number) {
    super(`QR content too long (${bytes} bytes)`);
  }
}

/** UTF-8 bytes as a binary string: the library writes each char code as one byte. */
export function utf8Binary(text: string): string {
  let out = '';
  for (const b of new TextEncoder().encode(text)) out += String.fromCharCode(b);
  return out;
}

export function makeMatrix(text: string, ecc: Ecc): QrMatrix {
  const bytes = utf8Binary(text);
  const qr = qrcode(0, ecc);
  qr.addData(bytes, 'Byte');
  try {
    qr.make();
  } catch {
    throw new QrTooLongError(bytes.length);
  }
  const size = qr.getModuleCount();
  const dark = new Uint8Array(size * size);
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark[r * size + c] = qr.isDark(r, c) ? 1 : 0;
  return { size, version: (size - 17) / 4, ecc, dark };
}

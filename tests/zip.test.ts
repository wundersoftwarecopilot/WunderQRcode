import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { crc32, zip } from '../src/export/zip';

const enc = new TextEncoder();
const hasPython = (() => {
  try {
    execFileSync('python3', ['-c', 'import zipfile'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('lays out local headers, central directory and end record', () => {
    const bytes = zip([{ name: 'a.txt', data: enc.encode('ciao') }, { name: 'perché.svg', data: enc.encode('<svg/>') }], new Date(2026, 9, 26, 15, 30, 10));
    const v = new DataView(bytes.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const end = bytes.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
    const dirAt = v.getUint32(end + 16, true);
    expect(v.getUint32(dirAt, true)).toBe(0x02014b50);
    // 2026-10-26 15:30:10 in MS-DOS format.
    expect(v.getUint16(12, true)).toBe(((2026 - 1980) << 9) | (10 << 5) | 26);
    expect(v.getUint16(10, true)).toBe((15 << 11) | (30 << 5) | 5);
  });

  it.skipIf(!hasPython)('is read back intact by Python zipfile', () => {
    const files = [
      { name: 'qrcode-wunder.png', data: Uint8Array.from({ length: 5000 }, (_, i) => (i * 31) & 255) },
      { name: 'qrcode-wunder.svg', data: enc.encode('<svg xmlns="http://www.w3.org/2000/svg"/>') },
      { name: 'città.eps', data: enc.encode('%!PS') },
    ];
    const dir = mkdtempSync(join(tmpdir(), 'wqr-zip-'));
    const path = join(dir, 'test.zip');
    writeFileSync(path, zip(files));
    const out = execFileSync('python3', [
      '-c',
      'import sys,zipfile,hashlib\nz=zipfile.ZipFile(sys.argv[1])\nassert z.testzip() is None\nfor i in z.infolist(): print(i.filename, i.file_size, hashlib.sha256(z.read(i)).hexdigest())',
      path,
    ]).toString();
    const sha = (d: Uint8Array) => createHash('sha256').update(d).digest('hex');
    expect(out.trim().split('\n')).toEqual(files.map((f) => `${f.name} ${f.data.length} ${sha(f.data)}`));
  });
});

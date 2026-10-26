// Browser smoke test of the built site (dist/): renders, downloads every format and decodes
// the files back with jsQR. Screenshots go to shots/. Run `npm run build` first.
//   node scripts/smoke.mjs
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node-tools/node_modules/playwright'));
}
const jsQR = require('jsqr');

const root = resolve('dist');
const shots = resolve('shots');
const dl = join(shots, 'downloads');
rmSync(shots, { recursive: true, force: true });
mkdirSync(dl, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  try {
    const body = readFileSync(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failures.push(msg);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT', acceptDownloads: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(url);
await page.waitForSelector('#preview svg');
check((await page.textContent('h1')) === 'Generatore di QR Code', 'Italian by default for it-IT');
check((await page.getAttribute('.site-header .brand', 'href')) === 'https://www.wunder.it/', 'header logo links to www.wunder.it');
check((await page.getAttribute('.site-footer .brand', 'href')) === 'https://www.wunder.it/', 'footer logo links to www.wunder.it');
check((await page.locator('.site-header .brand svg path').count()) === 2, 'header logo drawn from brand/logo.ts');
const bar = page.locator('.topbar .contacts');
check((await bar.locator('a[href^="tel:+39"]').count()) === 1 && (await bar.locator('a[href^="mailto:"]').count()) >= 1, 'contact bar: phone and e-mail links at the top right');
const barBox = await bar.boundingBox();
check(barBox.x + barBox.width > 1440 / 2 && barBox.y < 40, `contact bar sits top right (x ${Math.round(barBox.x)}–${Math.round(barBox.x + barBox.width)})`);
await page.click('.ac-toggle');
const rows = await page.$$eval('#all-contacts dt', (dts) => dts.map((d) => d.textContent));
check(!(await page.isHidden('#all-contacts')) && rows.length >= 6, `"Tutti i contatti" opens the full list: ${rows.join(', ')}`);
await page.keyboard.press('Escape');
check((await page.isHidden('#all-contacts')) && (await page.getAttribute('.ac-toggle', 'aria-expanded')) === 'false', 'Esc closes the contacts panel');
await page.click('.ac-toggle');
await page.click('h1');
check(await page.isHidden('#all-contacts'), 'a click outside closes the contacts panel');
check((await page.textContent('#meta')).startsWith('Versione'), 'meta line: ' + (await page.textContent('#meta')));
await page.screenshot({ path: join(shots, 'desktop.png'), fullPage: true });

/** Decodes an image file in the page: <img> → canvas → jsQR. */
await page.addScriptTag({ path: require.resolve('jsqr/dist/jsQR.js') });
async function decodeImage(file, mime) {
  const b64 = readFileSync(file).toString('base64');
  return page.evaluate(
    async ({ b64, mime }) => {
      const img = new Image();
      img.src = `data:${mime};base64,${b64}`;
      await img.decode();
      const size = 600;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, size, size);
      g.drawImage(img, 0, 0, size, size);
      return { data: window.jsQR(g.getImageData(0, 0, size, size).data, size, size)?.data ?? null, w: img.naturalWidth, h: img.naturalHeight };
    },
    { b64, mime },
  );
}

async function downloadAll(tag, expected) {
  for (const format of ['png', 'jpeg', 'webp', 'svg', 'pdf', 'eps']) {
    await page.check(`input[name=format][value=${format}]`, { force: true });
    const shown = await page
      .waitForFunction((f) => document.querySelector('#download-fmt').textContent === f, format.toUpperCase(), { timeout: 2000 })
      .then(() => true, () => false);
    check(shown, `${tag} "Scarica QR Code" button shows ${format.toUpperCase()}`);
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#download')]);
    const file = join(dl, `${tag}-${download.suggestedFilename()}`);
    await download.saveAs(file);
    const bytes = readFileSync(file);
    if (format === 'eps') {
      const text = bytes.toString('latin1');
      check(text.startsWith('%!PS-Adobe-3.0 EPSF-3.0') && text.includes('%%BoundingBox: 0 0 246 246'), `${tag} EPS header (${bytes.length} B)`);
    } else if (format === 'pdf') {
      execFileSync('pdftoppm', ['-r', '100', '-gray', file, join(dl, `${tag}-pdf`)]);
      const pgm = readdirSync(dl).find((f) => f.startsWith(`${tag}-pdf`) && f.endsWith('.pgm'));
      const buf = readFileSync(join(dl, pgm));
      const m = buf.toString('latin1', 0, 40).match(/^P5\s+(\d+)\s+(\d+)\s+\d+\s/);
      const w = +m[1], h = +m[2];
      const gray = buf.subarray(m[0].length);
      const rgba = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) rgba.set([gray[i], gray[i], gray[i], 255], i * 4);
      const got = jsQR(rgba, w, h)?.data;
      check(got === expected, `${tag} PDF decodes (${w}px page, ${bytes.length} B)`);
    } else {
      const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' }[format];
      const r = await decodeImage(file, mime);
      check(r.data === expected, `${tag} ${format.toUpperCase()} decodes, ${r.w}×${r.h} (${bytes.length} B)${r.data === expected ? '' : ' got ' + r.data}`);
    }
  }
}

// Default: link to wunder.it, logo on, red eyes, 1024 px.
await downloadAll('url', 'https://www.wunder.it/');

// All formats at once.
{
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#download-zip')]);
  const file = join(dl, download.suggestedFilename());
  await download.saveAs(file);
  const listing = execFileSync('python3', ['-c', 'import sys,zipfile\nz=zipfile.ZipFile(sys.argv[1])\nassert z.testzip() is None\nz.extractall(sys.argv[2])\nprint(" ".join(z.namelist()))', file, join(dl, 'zip')]).toString().trim();
  check(download.suggestedFilename() === 'qrcode-wunder.zip' && listing === 'qrcode-wunder.png qrcode-wunder.jpg qrcode-wunder.webp qrcode-wunder.svg qrcode-wunder.pdf qrcode-wunder.eps', `ZIP holds every format: ${listing}`);
  for (const [f, mime] of [['png', 'image/png'], ['jpg', 'image/jpeg'], ['webp', 'image/webp'], ['svg', 'image/svg+xml']]) {
    const r = await decodeImage(join(dl, 'zip', `qrcode-wunder.${f}`), mime);
    check(r.data === 'https://www.wunder.it/', `ZIP ${f.toUpperCase()} decodes`);
  }
}

// Wi-Fi, dots + circle eyes, transparent background.
await page.click('#tab-wifi');
await page.fill('input[name=wifiSsid]', 'Wunder Ospiti');
await page.fill('input[name=wifiPassword]', 'segreta;123');
await page.check('input[value=dots]', { force: true });
await page.check('input[value=circle]', { force: true });
await page.check('input[name=transparent]');
await page.waitForTimeout(100);
await downloadAll('wifi', 'WIFI:T:WPA;S:Wunder Ospiti;P:segreta\\;123;;');
await page.locator('.app').screenshot({ path: join(shots, 'wifi-dots.png') });

// vCard, rounded, no logo, ECC Q, design colour.
await page.click('#tab-vcard');
await page.fill('input[name=vcFirst]', 'Mario');
await page.fill('input[name=vcLast]', 'Rossi');
await page.fill('input[name=vcOrg]', 'Wunder Sa.Bi. Srl');
await page.fill('input[name=vcMobile]', '+39 333 1234567');
await page.fill('input[name=vcEmail]', 'mario.rossi@wunder.it');
await page.check('input[value=rounded][name=moduleStyle]', { force: true });
await page.check('input[value=rounded][name=eyeStyle]', { force: true });
await page.click('.switch');
await page.selectOption('select[name=ecc]', 'Q');
await page.click('.color[data-target=fg] .swatch[data-color="#116374"]');
await page.waitForTimeout(100);
check((await page.textContent('#meta')).includes('correzione Q'), 'ECC menu applies without logo: ' + (await page.textContent('#meta')));
const vcard = ['BEGIN:VCARD', 'VERSION:3.0', 'N:Rossi;Mario;;;', 'FN:Mario Rossi', 'ORG:Wunder Sa.Bi. Srl', 'TEL;TYPE=CELL:+39 333 1234567', 'EMAIL;TYPE=INTERNET:mario.rossi@wunder.it', 'END:VCARD'].join('\r\n');
await downloadAll('vcard', vcard);
await page.locator('.preview-card').screenshot({ path: join(shots, 'vcard-preview.png') });

// The logo forces H and gives the user's choice back afterwards.
await page.click('.switch');
await page.waitForTimeout(50);
check((await page.textContent('#meta')).includes('correzione H') && (await page.isDisabled('select[name=ecc]')), 'logo forces H');
await page.click('.switch');
await page.waitForTimeout(50);
check((await page.inputValue('select[name=ecc]')) === 'Q', 'ECC choice restored after logo off');

// Empty and too-long content.
await page.click('#tab-text');
await page.waitForTimeout(50);
check((await page.isDisabled('#download')) && (await page.isDisabled('#download-zip')) && (await page.textContent('#notice')).length > 0, 'empty content disables the download buttons');
await page.fill('textarea[name=text]', 'x'.repeat(4000));
await page.waitForTimeout(50);
check((await page.locator('#notice.error').count()) === 1, 'too-long content shows an error');

// English.
await page.click('[data-lang=en]');
check((await page.textContent('h1')) === 'QR Code Generator' && (await page.getAttribute('html', 'lang')) === 'en', 'switches to English');
check((await page.textContent('.contacts .c-phone .c-label')) === 'Phone', 'contact labels follow the language');
await page.click('#tab-url');
await page.waitForTimeout(50);
await page.screenshot({ path: join(shots, 'desktop-en.png') });

// Phone layout.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'it-IT', deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p2 = await phone.newPage();
await p2.goto(url);
await p2.waitForSelector('#preview svg');
const overflow = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const icons = await p2.$$eval('.topbar .contacts a', (as) => as.map((a) => { const r = a.getBoundingClientRect(); return r.width >= 40 && r.height >= 40 && r.top < 48; }));
check(icons.length >= 3 && icons.every(Boolean), `phone: contacts are ${icons.length} tappable 40px icons in the top bar`);
check(overflow <= 0, `no horizontal scroll on a phone (overflow ${overflow}px)`);
await p2.screenshot({ path: join(shots, 'phone.png'), fullPage: true });

check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
server.close();
writeFileSync(join(shots, 'result.txt'), failures.length ? failures.join('\n') : 'all ok');
console.log(failures.length ? `\n${failures.length} failure(s)` : '\nall ok');
process.exit(failures.length ? 1 : 0);

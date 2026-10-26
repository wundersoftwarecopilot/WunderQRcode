import './style.css';
import { BRAND } from './brand/colors';
import { contrast, luminance } from './export/color';
import { toEps } from './export/eps';
import { toPdf } from './export/pdf';
import { UnsupportedFormatError, toRasterBlob } from './export/raster';
import { toSvg } from './export/svg';
import { zip } from './export/zip';
import { type Key, type Lang, getLang, setLang, t, translate } from './i18n';
import * as P from './payloads';
import { type Design, type Drawing, type EyeStyle, type ModuleStyle, buildDrawing } from './qr/geometry';
import { type Ecc, QrTooLongError, makeMatrix } from './qr/matrix';

type Format = 'png' | 'jpeg' | 'webp' | 'svg' | 'pdf' | 'eps';
const FORMATS: Format[] = ['png', 'jpeg', 'webp', 'svg', 'pdf', 'eps'];
const FORMAT_HINTS: Record<Format, Key> = { png: 'fmtPng', jpeg: 'fmtJpeg', webp: 'fmtWebp', svg: 'fmtSvg', pdf: 'fmtPdf', eps: 'fmtEps' };
const extension = (f: Format) => (f === 'jpeg' ? 'jpg' : f);

/** Vector exports carry the raster size at 300 dpi: 1024 px → 8.67 cm. */
const DPI = 300;
const FILE_TITLE = 'QR code · Wunder';
const STORE_DESIGN = 'wunder-qr:design';
const STORE_LANG = 'wunder-qr:lang';

const SWATCHES: Record<'fg' | 'eye' | 'bg', string[]> = {
  fg: [BRAND.ink, '#000000', BRAND.red, BRAND.medicale, BRAND.design],
  eye: [BRAND.ink, BRAND.red, BRAND.medicale, BRAND.design],
  bg: [BRAND.white, '#F3F3F2', BRAND.industriale],
};

const form = document.getElementById('qr') as HTMLFormElement;
const preview = document.getElementById('preview') as HTMLDivElement;
const meta = document.getElementById('meta') as HTMLParagraphElement;
const notice = document.getElementById('notice') as HTMLParagraphElement;
const sizeHint = document.getElementById('size-hint') as HTMLSpanElement;
const downloadBtn = document.getElementById('download') as HTMLButtonElement;
const downloadFmt = document.getElementById('download-fmt') as HTMLSpanElement;
const formatHint = document.getElementById('format-hint') as HTMLParagraphElement;
const zipBtn = document.getElementById('download-zip') as HTMLButtonElement;
const copyBtn = document.getElementById('copy') as HTMLButtonElement;
/** Everything that needs a code to act on. */
const actions = [downloadBtn, zipBtn, copyBtn];
const toast = document.getElementById('toast') as HTMLDivElement;

const el = <T extends HTMLElement = HTMLInputElement>(name: string) => form.elements.namedItem(name) as unknown as T;
const val = (name: string) => el<HTMLInputElement>(name).value;
const on = (name: string) => el<HTMLInputElement>(name).checked;
const radio = (name: string) => (form.elements.namedItem(name) as RadioNodeList).value;

let kind: P.Kind = 'url';
let current: Drawing | null = null;
/** The level picked in the menu; the logo overrides it with H without forgetting it. */
let userEcc = val('ecc') as Ecc;

function payload(): string {
  switch (kind) {
    case 'url':
      return P.urlPayload(val('url'));
    case 'text':
      return val('text');
    case 'wifi':
      return P.wifiPayload({ ssid: val('wifiSsid'), password: val('wifiPassword'), security: val('wifiSecurity') as P.WifiData['security'], hidden: on('wifiHidden') });
    case 'vcard':
      return P.vcardPayload({
        firstName: val('vcFirst'), lastName: val('vcLast'), org: val('vcOrg'), title: val('vcTitle'), mobile: val('vcMobile'), work: val('vcWork'),
        email: val('vcEmail'), url: val('vcUrl'), street: val('vcStreet'), city: val('vcCity'), zip: val('vcZip'), country: val('vcCountry'), note: val('vcNote'),
      });
    case 'email':
      return P.emailPayload({ to: val('emailTo'), subject: val('emailSubject'), body: val('emailBody') });
    case 'phone':
      return P.phonePayload(val('phone'));
    case 'sms':
      return P.smsPayload({ number: val('smsNumber'), message: val('smsMessage') });
  }
}

function design(): Design {
  return {
    margin: +val('margin'),
    fg: val('fg'),
    eye: val('eye'),
    bg: on('transparent') ? null : val('bg'),
    moduleStyle: radio('moduleStyle') as ModuleStyle,
    eyeStyle: radio('eyeStyle') as EyeStyle,
    logo: on('logo'),
  };
}

/** The logo hides some modules: the highest correction level keeps the code readable. */
const ecc = (): Ecc => (on('logo') ? 'H' : userEcc);

function setNotice(keys: Key[], vars: Record<string, string | number> = {}, error = false): void {
  notice.textContent = keys.map((k) => t(k, vars)).join(' ');
  notice.classList.toggle('error', error);
}

function update(): void {
  const d = design();
  el<HTMLSelectElement>('ecc').disabled = d.logo;
  el<HTMLSelectElement>('ecc').value = ecc();
  el<HTMLOutputElement>('marginOut').value = t('modulesUnit', { n: d.margin });
  const px = +val('size');
  el<HTMLOutputElement>('sizeOut').value = `${px} px`;
  sizeHint.textContent = t('sizeHint', { cm: ((px / DPI) * 2.54).toLocaleString(getLang(), { maximumFractionDigits: 1 }) });
  preview.classList.toggle('transparent', d.bg === null);
  const format = radio('format') as Format;
  downloadFmt.textContent = format.toUpperCase();
  formatHint.textContent = t(FORMAT_HINTS[format]);
  saveDesign();

  const text = payload();
  current = null;
  actions.forEach((b) => (b.disabled = true));
  if (!text) {
    preview.innerHTML = '';
    preview.classList.add('empty');
    meta.textContent = '';
    setNotice(['empty']);
    return;
  }
  let drawing: Drawing;
  try {
    const m = makeMatrix(text, ecc());
    drawing = buildDrawing(m, d);
    meta.textContent = t('meta', { v: m.version, n: m.size, ecc: m.ecc });
  } catch (e) {
    if (!(e instanceof QrTooLongError)) throw e;
    preview.innerHTML = '';
    preview.classList.add('empty');
    meta.textContent = '';
    setNotice(['tooLong'], { bytes: e.bytes }, true);
    return;
  }
  preview.classList.remove('empty');
  preview.innerHTML = toSvg(drawing, 400, FILE_TITLE);
  current = drawing;
  actions.forEach((b) => (b.disabled = false));

  const warnings: Key[] = [];
  const bg = d.bg ?? '#FFFFFF';
  if (luminance(d.fg) > luminance(bg) || luminance(d.eye) > luminance(bg)) warnings.push('inverted');
  else if (Math.min(contrast(d.fg, bg), contrast(d.eye, bg)) < 3) warnings.push('lowContrast');
  if (d.margin < 2) warnings.push('smallMargin');
  setNotice(warnings);
}

let pending = 0;
function scheduleUpdate(): void {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(update);
}

// ---------- tabs ----------

const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role=tab]')];
function selectTab(tab: HTMLButtonElement, focus = false): void {
  for (const t of tabs) {
    const selected = t === tab;
    t.setAttribute('aria-selected', String(selected));
    t.tabIndex = selected ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')!)!.hidden = !selected;
  }
  kind = tab.dataset.kind as P.Kind;
  if (focus) tab.focus();
  tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  scheduleUpdate();
}
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (step) selectTab(tabs[(i + step + tabs.length) % tabs.length], true);
    else if (e.key === 'Home') selectTab(tabs[0], true);
    else if (e.key === 'End') selectTab(tabs[tabs.length - 1], true);
    else return;
    e.preventDefault();
  });
});

// ---------- colour swatches ----------

for (const box of document.querySelectorAll<HTMLDivElement>('.color')) {
  const target = box.dataset.target as keyof typeof SWATCHES;
  const holder = box.querySelector('.swatches')!;
  for (const c of SWATCHES[target]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.setProperty('--c', c);
    b.dataset.color = c.toLowerCase();
    b.setAttribute('aria-label', c);
    b.title = c;
    b.addEventListener('click', () => {
      el(target).value = c.toLowerCase();
      if (target === 'bg') el('transparent').checked = false;
      markSwatches();
      scheduleUpdate();
    });
    holder.append(b);
  }
}
function markSwatches(): void {
  for (const box of document.querySelectorAll<HTMLDivElement>('.color')) {
    const v = val(box.dataset.target!).toLowerCase();
    box.querySelectorAll<HTMLButtonElement>('.swatch').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === v)));
  }
}

// ---------- downloads ----------

function fileBase(): string {
  const s = val('fileName')
    .trim()
    .replace(/\.(png|jpe?g|webp|svg|pdf|eps|zip)$/i, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-');
  return s || 'qrcode-wunder';
}

async function makeBlob(d: Drawing, format: Format, px: number): Promise<Blob> {
  const pt = (px / DPI) * 72;
  switch (format) {
    case 'png':
    case 'jpeg':
    case 'webp':
      return toRasterBlob(d, px, `image/${format}`);
    case 'svg':
      return new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', toSvg(d, px, FILE_TITLE)], { type: 'image/svg+xml' });
    case 'pdf':
      return new Blob([toPdf(d, pt, FILE_TITLE)], { type: 'application/pdf' });
    case 'eps':
      return new Blob([toEps(d, pt, FILE_TITLE)], { type: 'application/postscript' });
  }
}

function save(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

let toastTimer = 0;
function showToast(message: string, error = false): void {
  toast.textContent = message;
  toast.classList.toggle('error', error);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3200);
}

/**
 * One export at a time: a large ZIP takes seconds, and a second press must not start another
 * download. The button keeps its focus (aria-busy rather than disabled) and says what it is doing.
 */
let busy = false;
async function whileBusy(button: HTMLButtonElement, work: () => Promise<void>): Promise<void> {
  if (busy || !current) return;
  busy = true;
  const label = button.querySelector<HTMLElement>('[data-i18n]');
  button.setAttribute('aria-busy', 'true');
  if (label) label.textContent = t('preparing');
  try {
    await work();
  } finally {
    busy = false;
    button.removeAttribute('aria-busy');
    if (label) label.textContent = t(label.dataset.i18n as Key);
  }
}

downloadBtn.addEventListener('click', () =>
  whileBusy(downloadBtn, async () => {
    const format = radio('format') as Format;
    const name = `${fileBase()}.${extension(format)}`;
    try {
      save(await makeBlob(current!, format, +val('size')), name);
      showToast(t('downloaded', { file: name }));
    } catch (err) {
      showToast(err instanceof UnsupportedFormatError ? t('unsupported', { fmt: format.toUpperCase() }) : t('failed'), true);
    }
  }),
);

/** Every format in one .zip; a format the browser cannot encode (WebP on Safari) is left out. */
zipBtn.addEventListener('click', () =>
  whileBusy(zipBtn, async () => {
    const d = current!;
    const base = fileBase();
    const px = +val('size');
    const files = await Promise.all(
      FORMATS.map(async (f) => {
        try {
          return { name: `${base}.${extension(f)}`, data: new Uint8Array(await (await makeBlob(d, f, px)).arrayBuffer()) };
        } catch (err) {
          if (err instanceof UnsupportedFormatError) return f;
          throw err;
        }
      }),
    ).catch(() => null);
    if (!files) {
      showToast(t('failed'), true);
      return;
    }
    const entries = files.filter((f) => typeof f !== 'string');
    const skipped = files.filter((f) => typeof f === 'string');
    const name = `${base}.zip`;
    save(new Blob([zip(entries)], { type: 'application/zip' }), name);
    showToast([t('downloadedZip', { file: name, n: entries.length }), ...skipped.map((f) => t('zipSkipped', { fmt: f.toUpperCase() }))].join(' '));
  }),
);

// Clipboard images need ClipboardItem (all current browsers on https).
if ('ClipboardItem' in window && navigator.clipboard?.write) {
  copyBtn.hidden = false;
  copyBtn.addEventListener('click', async () => {
    if (!current || busy) return;
    try {
      // The promise form keeps Safari's user-activation requirement satisfied.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': toRasterBlob(current, +val('size'), 'image/png') })]);
      showToast(t('copied'));
    } catch {
      showToast(t('copyFailed'), true);
    }
  });
}

// ---------- all contacts panel (top right) ----------

const acToggle = document.querySelector<HTMLButtonElement>('.ac-toggle');
const acPanel = document.getElementById('all-contacts');
if (acToggle && acPanel) {
  const setOpen = (open: boolean, returnFocus = false) => {
    acToggle.setAttribute('aria-expanded', String(open));
    acPanel.hidden = !open;
    if (returnFocus) acToggle.focus();
  };
  acToggle.addEventListener('click', () => setOpen(acToggle.getAttribute('aria-expanded') !== 'true'));
  acPanel.querySelector('.ac-close')?.addEventListener('click', () => setOpen(false, true));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !acPanel.hidden) setOpen(false, acPanel.contains(document.activeElement));
  });
  document.addEventListener('click', (e) => {
    if (!acPanel.hidden && !(e.target as Element).closest('.contact-bar')) setOpen(false);
  });
  // Tabbing past the panel closes it, so it never covers the controls that take the focus next.
  const bar = acToggle.closest('.contact-bar')!;
  bar.addEventListener('focusout', (e) => {
    const next = (e as FocusEvent).relatedTarget as Node | null;
    if (!acPanel.hidden && next && !bar.contains(next)) setOpen(false);
  });
}

// ---------- persistence and language ----------

const DESIGN_FIELDS = ['fg', 'eye', 'bg', 'transparent', 'moduleStyle', 'eyeStyle', 'logo', 'margin', 'size', 'format'];

function saveDesign(): void {
  try {
    const data: Record<string, string | boolean> = {};
    for (const f of DESIGN_FIELDS) {
      const field = form.elements.namedItem(f);
      data[f] = field instanceof RadioNodeList ? field.value : (field as HTMLInputElement).type === 'checkbox' ? (field as HTMLInputElement).checked : (field as HTMLInputElement).value;
    }
    data.ecc = userEcc;
    localStorage.setItem(STORE_DESIGN, JSON.stringify(data));
  } catch {
    /* storage unavailable: nothing to remember */
  }
}

function loadDesign(): void {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_DESIGN) ?? 'null') as Record<string, string | boolean> | null;
    if (!data) return;
    for (const f of DESIGN_FIELDS) {
      const field = form.elements.namedItem(f);
      const v = data[f];
      if (v === undefined || !field) continue;
      if (field instanceof RadioNodeList) field.value = String(v);
      else if ((field as HTMLInputElement).type === 'checkbox') (field as HTMLInputElement).checked = v === true;
      else (field as HTMLInputElement).value = String(v);
    }
    if (['L', 'M', 'Q', 'H'].includes(String(data.ecc))) userEcc = data.ecc as Ecc;
  } catch {
    /* corrupt or blocked storage: keep the defaults */
  }
}

function applyLang(l: Lang): void {
  setLang(l);
  document.documentElement.lang = l;
  translate();
  document.title = t('docTitle');
  document.querySelector('meta[name=description]')?.setAttribute('content', t('docDescription'));
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
  try {
    localStorage.setItem(STORE_LANG, l);
  } catch {
    /* ignore */
  }
  update();
}

document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang as Lang)));

// ---------- start ----------

form.addEventListener('submit', (e) => e.preventDefault());
el('ecc').addEventListener('change', () => (userEcc = val('ecc') as Ecc));
form.addEventListener('input', (e) => {
  if ((e.target as HTMLElement).matches('input[type=color]')) {
    if ((e.target as HTMLInputElement).name === 'bg') el('transparent').checked = false;
    markSwatches();
  }
  scheduleUpdate();
});
form.addEventListener('change', scheduleUpdate);

document.getElementById('year')!.textContent = String(new Date().getFullYear());
loadDesign();
markSwatches();
let initial: Lang = navigator.language?.toLowerCase().startsWith('it') ? 'it' : 'en';
try {
  const stored = localStorage.getItem(STORE_LANG);
  if (stored === 'it' || stored === 'en') initial = stored;
} catch {
  /* ignore */
}
applyLang(initial);

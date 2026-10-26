/** What a QR code can carry, and the string each kind encodes to. */
export type Kind = 'url' | 'text' | 'wifi' | 'vcard' | 'email' | 'phone' | 'sms';

export interface WifiData {
  ssid: string;
  password: string;
  security: 'WPA' | 'WEP' | 'nopass';
  hidden: boolean;
}

export interface VCardData {
  firstName: string;
  lastName: string;
  org: string;
  title: string;
  mobile: string;
  work: string;
  email: string;
  url: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  note: string;
}

export interface EmailData {
  to: string;
  subject: string;
  body: string;
}

export interface SmsData {
  number: string;
  message: string;
}

/** Adds https:// to a bare host ("wunder.it/x"); anything with a scheme is left alone. */
export function urlPayload(input: string): string {
  const s = input.trim();
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  return 'https://' + s.replace(/^\/+/, '');
}

/** ZXing Wi-Fi format; \ ; , : " are escaped with a backslash. */
export function wifiPayload(d: WifiData): string {
  if (!d.ssid) return '';
  const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
  let out = `WIFI:T:${d.security};S:${esc(d.ssid)};`;
  if (d.security !== 'nopass') out += `P:${esc(d.password)};`;
  if (d.hidden) out += 'H:true;';
  return out + ';';
}

/** vCard 3.0 (RFC 2426): text values escape \ ; , and newlines; lines end in CRLF. */
export function vcardPayload(d: VCardData): string {
  const esc = (s: string) => s.trim().replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([;,])/g, '\\$1');
  const fn = [d.firstName, d.lastName].map((s) => s.trim()).filter(Boolean).join(' ') || d.org.trim();
  if (!fn && !d.mobile.trim() && !d.work.trim() && !d.email.trim()) return '';
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${esc(d.lastName)};${esc(d.firstName)};;;`, `FN:${esc(fn)}`];
  if (d.org.trim()) lines.push(`ORG:${esc(d.org)}`);
  if (d.title.trim()) lines.push(`TITLE:${esc(d.title)}`);
  if (d.mobile.trim()) lines.push(`TEL;TYPE=CELL:${d.mobile.trim()}`);
  if (d.work.trim()) lines.push(`TEL;TYPE=WORK,VOICE:${d.work.trim()}`);
  if (d.email.trim()) lines.push(`EMAIL;TYPE=INTERNET:${d.email.trim()}`);
  if (d.url.trim()) lines.push(`URL:${urlPayload(d.url)}`);
  if ([d.street, d.city, d.zip, d.country].some((s) => s.trim())) lines.push(`ADR;TYPE=WORK:;;${esc(d.street)};${esc(d.city)};;${esc(d.zip)};${esc(d.country)}`);
  if (d.note.trim()) lines.push(`NOTE:${esc(d.note)}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

export function emailPayload(d: EmailData): string {
  const to = d.to.trim();
  if (!to) return '';
  const q: string[] = [];
  if (d.subject.trim()) q.push('subject=' + encodeURIComponent(d.subject.trim()));
  if (d.body.trim()) q.push('body=' + encodeURIComponent(d.body.trim()));
  return `mailto:${to.replace(/\s+/g, '')}${q.length ? '?' + q.join('&') : ''}`;
}

/** Keeps digits and a leading +; spaces, dots and dashes go. */
export function cleanNumber(s: string): string {
  const t = s.trim();
  return (t.startsWith('+') ? '+' : '') + t.replace(/\D/g, '');
}

export function phonePayload(number: string): string {
  const n = cleanNumber(number);
  return n.replace('+', '') ? `tel:${n}` : '';
}

export function smsPayload(d: SmsData): string {
  const n = cleanNumber(d.number);
  if (!n.replace('+', '')) return '';
  return `SMSTO:${n}:${d.message}`;
}

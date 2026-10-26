import { CONTACTS, type Contacts, type Department, type Network, mapsHref, telHref, whatsappHref } from './contacts.ts';

/**
 * Build-time markup for the contact data. vite.config.ts replaces <!--WUNDER_CONTACT_BAR-->,
 * <!--WUNDER_FOOTER_COMPANY-->, <!--WUNDER_FOOTER_CONTACTS--> and <!--WUNDER_FOOTER_SOCIAL-->
 * with it. Labels carry data-i18n keys so they switch with the language.
 */
const icon = (paths: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;

const ICONS = {
  phone: icon('<path d="M5.5 3.5h3.3l1.8 4.6-2.3 1.5a11 11 0 0 0 6.1 6.1l1.5-2.3 4.6 1.8v3.3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3.5 5.5a2 2 0 0 1 2-2Z"/>'),
  whatsapp: icon('<path d="M3.6 20.4 5 16.3a8.6 8.6 0 1 1 3 2.9Z"/><path d="M9.2 8.3c.2 2.9 2.6 5.5 5.6 5.9l1-1.4-1.9-.9-.8.8a4.6 4.6 0 0 1-2.4-2.4l.8-.8-.9-1.9Z"/>'),
  fax: icon('<path d="M7 9V3.5h10V9M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 13.5h10v7H7z"/>'),
  email: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.8 6.5 8.2 6.7 8.2-6.7"/>'),
  address: icon('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  card: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10.5" r="2.3"/><path d="M5.6 16.5a3.8 3.8 0 0 1 6.8 0M15 10h3M15 13.5h3"/>'),
  chevron: icon('<path d="m7 10 5 5 5-5"/>'),
  close: icon('<path d="M6 6l12 12M18 6 6 18"/>'),
};

const SOCIAL_ICONS: Record<Network, string> = {
  facebook: icon('<path class="solid" d="M13.6 21v-7.9h2.6l.4-3.1h-3V8c0-.9.3-1.5 1.5-1.5h1.6V3.7c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4V10H7.9v3.1h2.6V21Z"/>'),
  linkedin: icon('<path class="solid" d="M5.2 9.3h3V19h-3Zm1.5-4.8a1.7 1.7 0 1 1 0 3.5 1.7 1.7 0 0 1 0-3.5ZM10.1 9.3H13v1.3c.4-.8 1.4-1.6 2.9-1.6 3.1 0 3.6 2 3.6 4.6V19h-3v-4.8c0-1.1 0-2.6-1.6-2.6s-1.8 1.2-1.8 2.5V19h-3Z"/>'),
  youtube: icon('<path class="solid" fill-rule="evenodd" d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8A26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3Z"/>'),
};

const NETWORK_NAMES: Record<Network, string> = { facebook: 'Facebook', linkedin: 'LinkedIn', youtube: 'YouTube' };

const DEPARTMENTS: Record<Department, { label: string; i18n: string }> = {
  sales: { label: 'Commerciale', i18n: 'cSales' },
  admin: { label: 'Amministrazione', i18n: 'cAdmin' },
  medical: { label: 'Medicale', i18n: 'cMedical' },
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const link = (href: string, body: string, external = false) => `<a href="${esc(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${body}</a>`;
const label = (i18n: string, text: string, cls = '') => `<span${cls ? ` class="${cls}"` : ''} data-i18n="${i18n}">${text}</span>`;

/** One item of the top bar: icon, a label for screen readers and the visible value. */
function barItem(key: keyof typeof ICONS, i18n: string, text: string, value: string, href?: string, external = false): string {
  const inner = `${ICONS[key]}${label(i18n, text, 'c-label')} <span class="c-value">${esc(value)}</span>`;
  return `<li class="c-${key}">${href ? link(href, inner, external) : `<span class="c-static">${inner}</span>`}</li>`;
}

function socialList(c: Contacts, cls: string): string {
  if (!c.social?.length) return '';
  const items = c.social.map(
    (s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${NETWORK_NAMES[s.network]} ${esc(s.handle)}" title="${NETWORK_NAMES[s.network]}">${SOCIAL_ICONS[s.network]}</a></li>`,
  );
  return `<ul class="${cls}">${items.join('')}</ul>`;
}

/** Every contact, as rows of label and value: the "all contacts" panel. */
function panel(c: Contacts): string {
  const row = (i18n: string, text: string, value: string) => `<div><dt data-i18n="${i18n}">${text}</dt><dd>${value}</dd></div>`;
  const rows = [
    row('cHq', 'Sede', link(mapsHref(c), `${esc(c.street)}<br />${esc(c.zip)} ${esc(c.city)} (${esc(c.province)}), ${label('footCountry', 'Italia')}`, true)),
    row('cPhone', 'Telefono', link(telHref(c.phone), esc(c.phone))),
  ];
  if (c.whatsapp) rows.push(row('cWhatsapp', 'WhatsApp', `${link(whatsappHref(c.whatsapp), esc(c.whatsapp), true)}<small data-i18n="cWhatsappNote">solo messaggi, foto e video</small>`));
  if (c.fax) rows.push(row('cFax', 'Fax', esc(c.fax)));
  rows.push(row('cEmail', 'E-mail', link(`mailto:${c.email}`, esc(c.email))));
  for (const d of c.departments ?? []) rows.push(row(DEPARTMENTS[d.key].i18n, DEPARTMENTS[d.key].label, link(`mailto:${d.email}`, esc(d.email))));
  if (c.pec) rows.push(row('cPec', 'PEC', link(`mailto:${c.pec}`, esc(c.pec))));
  if (c.vat) rows.push(row('cVat', 'P.IVA', esc(c.vat)));
  return (
    `<div class="all-contacts" id="all-contacts" role="region" aria-labelledby="all-contacts-title" hidden>` +
    `<div class="ac-head"><p class="ac-title" id="all-contacts-title">${esc(c.company)}</p>` +
    `<button type="button" class="ac-close" aria-label="Chiudi" data-i18n-aria="close">${ICONS.close}</button></div>` +
    `<dl>${rows.join('')}</dl>${socialList(c, 'social')}</div>`
  );
}

/** The contact bar at the top right of the page, with its "all contacts" panel. */
export function contactBar(c: Contacts = CONTACTS): string {
  const items = [barItem('phone', 'cPhone', 'Telefono', c.phone, telHref(c.phone))];
  if (c.whatsapp) items.push(barItem('whatsapp', 'cWhatsapp', 'WhatsApp', c.whatsapp, whatsappHref(c.whatsapp), true));
  items.push(barItem('email', 'cEmail', 'E-mail', c.email, `mailto:${c.email}`));
  items.push(barItem('address', 'cHq', 'Sede', `${c.city} (${c.province})`, mapsHref(c), true));
  const button =
    `<button type="button" class="ac-toggle" aria-expanded="false" aria-controls="all-contacts">` +
    `${ICONS.card}${label('allContacts', 'Tutti i contatti', 'ac-text')}${ICONS.chevron}</button>`;
  return `<div class="contact-bar"><ul class="contacts" aria-label="Contatti" data-i18n-aria="footContacts">${items.join('')}</ul>${button}${panel(c)}</div>`;
}

/** The footer's company block, contact column (label | value rows) and social links. */
export function footerContacts(c: Contacts = CONTACTS): { company: string; contacts: string; social: string } {
  const company =
    `<strong>${esc(c.company)}</strong><br />${link(mapsHref(c), `${esc(c.street)}<br />${esc(c.zip)} ${esc(c.city)} (${esc(c.province)})`, true)}, ${label('footCountry', 'Italia')}` +
    (c.vat ? `<br />${label('cVat', 'P.IVA')} ${esc(c.vat)}` : '');
  const row = (i18n: string, text: string, value: string) => `<div><dt data-i18n="${i18n}">${text}</dt><dd>${value}</dd></div>`;
  const rows = [row('cPhone', 'Telefono', link(telHref(c.phone), esc(c.phone)))];
  if (c.whatsapp) rows.push(row('cWhatsapp', 'WhatsApp', link(whatsappHref(c.whatsapp), esc(c.whatsapp), true)));
  if (c.fax) rows.push(row('cFax', 'Fax', esc(c.fax)));
  rows.push(row('cEmail', 'E-mail', link(`mailto:${c.email}`, esc(c.email))));
  for (const d of c.departments ?? []) rows.push(row(DEPARTMENTS[d.key].i18n, DEPARTMENTS[d.key].label, link(`mailto:${d.email}`, esc(d.email))));
  if (c.pec) rows.push(row('cPec', 'PEC', link(`mailto:${c.pec}`, esc(c.pec))));
  rows.push(row('vcUrl', 'Sito web', link(c.web, esc(c.web.replace(/^https?:\/\//, '').replace(/\/$/, '')))));
  return { company, contacts: `<dl>${rows.join('')}</dl>`, social: socialList(c, 'social') };
}

import { CONTACTS, type Contacts, addressLine, mapsHref, telHref } from './contacts.ts';

/**
 * Build-time markup for the contact data (vite.config.ts replaces the HTML comments
 * <!--WUNDER_CONTACT_BAR--> and <!--WUNDER_FOOTER_CONTACTS--> with it). Labels carry data-i18n
 * keys so the page switches them with the language.
 */
const icon = (paths: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;

const ICONS = {
  phone: icon('<path d="M5.5 3.5h3.3l1.8 4.6-2.3 1.5a11 11 0 0 0 6.1 6.1l1.5-2.3 4.6 1.8v3.3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3.5 5.5a2 2 0 0 1 2-2Z"/>'),
  fax: icon('<path d="M7 9V3.5h10V9M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 13.5h10v7H7z"/>'),
  email: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.8 6.5 8.2 6.7 8.2-6.7"/>'),
  pec: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.8 6.5 8.2 6.7 8.2-6.7"/><path d="m15 16 1.7 1.7L20 14.3" class="tick"/>'),
  address: icon('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>'),
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Item {
  key: keyof typeof ICONS;
  label: string;
  i18n: string;
  value: string;
  href?: string;
  external?: boolean;
}

function items(c: Contacts): Item[] {
  const list: Item[] = [{ key: 'phone', label: 'Telefono', i18n: 'cPhone', value: c.phone, href: telHref(c.phone) }];
  if (c.fax) list.push({ key: 'fax', label: 'Fax', i18n: 'cFax', value: c.fax });
  list.push({ key: 'email', label: 'E-mail', i18n: 'cEmail', value: c.email, href: `mailto:${c.email}` });
  if (c.pec) list.push({ key: 'pec', label: 'PEC', i18n: 'cPec', value: c.pec, href: `mailto:${c.pec}` });
  list.push({ key: 'address', label: 'Indirizzo', i18n: 'cAddress', value: addressLine(c), href: mapsHref(c), external: true });
  return list;
}

/** The contact bar at the top right of the page. On phones the values collapse to icon buttons. */
export function contactBar(c: Contacts = CONTACTS): string {
  const li = items(c).map((it) => {
    const inner = `${ICONS[it.key]}<span class="c-label" data-i18n="${it.i18n}">${it.label}</span> <span class="c-value">${esc(it.value)}</span>`;
    const body = it.href ? `<a href="${esc(it.href)}"${it.external ? ' target="_blank" rel="noopener"' : ''}>${inner}</a>` : `<span class="c-static">${inner}</span>`;
    return `<li class="c-${it.key}">${body}</li>`;
  });
  return `<ul class="contacts" aria-label="Contatti" data-i18n-aria="footContacts">${li.join('')}</ul>`;
}

/** The footer's company block and contact column. */
export function footerContacts(c: Contacts = CONTACTS): { company: string; contacts: string } {
  const company =
    `<strong>${esc(c.company)}</strong><br />${esc(c.street)}<br />${esc(c.zip)} ${esc(c.city)} (${esc(c.province)}), <span data-i18n="footCountry">Italia</span>` +
    (c.vat ? `<br /><span data-i18n="cVat">P.IVA</span> ${esc(c.vat)}` : '');
  const lines = items(c)
    .filter((it) => it.key !== 'address')
    .map((it) => {
      const label = it.key === 'phone' || it.key === 'email' ? '' : `<span data-i18n="${it.i18n}">${it.label}</span> `;
      return label + (it.href ? `<a href="${esc(it.href)}">${esc(it.value)}</a>` : esc(it.value));
    });
  lines.push(`<a href="${esc(c.web)}">${esc(c.web.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>`);
  return { company, contacts: lines.join('<br />') };
}

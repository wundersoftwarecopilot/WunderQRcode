/**
 * Wunder Sa.Bi. public contact data. The contact bar at the top right, its "all contacts" panel
 * and the footer are all rendered from here at build time (vite.config.ts), so a change is made
 * once. Values are the ones the company itself publishes on wunder.it, cross-checked against
 * registries and directories; old or directory-only values (a fax line last listed in 2018,
 * other phone numbers) are deliberately left out.
 */
export type Department = 'sales' | 'admin' | 'medical';
export type Network = 'facebook' | 'linkedin' | 'youtube';

export interface Contacts {
  company: string;
  street: string;
  zip: string;
  city: string;
  province: string;
  /** Display form; the tel: link keeps only + and digits. */
  phone: string;
  /** WhatsApp line (messages, photos and videos only). */
  whatsapp?: string;
  fax?: string;
  /** General e-mail. */
  email: string;
  departments?: Array<{ key: Department; email: string }>;
  pec?: string;
  vat?: string;
  web: string;
  social?: Array<{ network: Network; url: string; handle: string }>;
}

export const CONTACTS: Contacts = {
  company: 'Wunder Sa.Bi. Srl',
  street: 'Via Vecchia per Monza 20',
  zip: '20056',
  city: 'Trezzo sull’Adda',
  province: 'MI',
  phone: '+39 02 90964566',
  whatsapp: '+39 333 8035628',
  email: 'wunder@wunder.it',
  departments: [
    { key: 'sales', email: 'sales@wunder.it' },
    { key: 'admin', email: 'amministrazione@wunder.it' },
    { key: 'medical', email: 'medical@wunder.it' },
  ],
  vat: '01786290161',
  web: 'https://www.wunder.it/',
  social: [
    { network: 'facebook', url: 'https://www.facebook.com/WunderBilance/', handle: '@WunderBilance' },
    { network: 'linkedin', url: 'https://www.linkedin.com/company/wunder-sa.bi.-s.r.l./', handle: 'Wunder Sa.Bi. srl' },
    { network: 'youtube', url: 'https://www.youtube.com/@wundersabisrl', handle: '@wundersabisrl' },
  ],
};

export const telHref = (n: string): string => 'tel:' + n.replace(/[^\d+]/g, '');

export const whatsappHref = (n: string): string => 'https://wa.me/' + n.replace(/\D/g, '');

export const addressLine = (c: Contacts = CONTACTS): string => `${c.street}, ${c.zip} ${c.city} (${c.province})`;

/** Map search for the address, opened in a new tab. */
export const mapsHref = (c: Contacts = CONTACTS): string =>
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${c.company}, ${c.street}, ${c.zip} ${c.city.replace('’', "'")} ${c.province}`);

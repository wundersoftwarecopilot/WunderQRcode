/**
 * Wunder Sa.Bi. public contact data. The contact bar at the top right and the footer are both
 * rendered from here at build time (vite.config.ts), so a change is made once.
 */
export interface Contacts {
  company: string;
  street: string;
  zip: string;
  city: string;
  province: string;
  /** Display form; the tel: link keeps only + and digits. */
  phone: string;
  fax?: string;
  email: string;
  pec?: string;
  vat?: string;
  web: string;
}

export const CONTACTS: Contacts = {
  company: 'Wunder Sa.Bi. Srl',
  street: 'Via Vecchia per Monza 20',
  zip: '20056',
  city: 'Trezzo sull’Adda',
  province: 'MI',
  phone: '+39 02 9096 4566',
  email: 'wunder@wunder.it',
  web: 'https://www.wunder.it/',
};

export const telHref = (n: string): string => 'tel:' + n.replace(/[^\d+]/g, '');

export const addressLine = (c: Contacts = CONTACTS): string => `${c.street}, ${c.zip} ${c.city} (${c.province})`;

/** Map search for the address, opened in a new tab. */
export const mapsHref = (c: Contacts = CONTACTS): string =>
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${c.company}, ${c.street}, ${c.zip} ${c.city.replace('’', "'")} ${c.province}`);

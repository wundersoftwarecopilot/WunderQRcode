import { describe, expect, it } from 'vitest';
import { contactBar, footerContacts } from '../src/brand/contacts-html';
import { CONTACTS, type Contacts, mapsHref, telHref } from '../src/brand/contacts';

const FULL: Contacts = { ...CONTACTS, fax: '+39 02 1234 5678', pec: 'wunder@pec.example.it', vat: '01234567890' };

describe('contact data markup', () => {
  it('links phone, e-mail and the address map from the top bar', () => {
    const bar = contactBar();
    expect(bar).toContain(`href="${telHref(CONTACTS.phone)}"`);
    expect(telHref('+39 02 9096 4566')).toBe('tel:+390290964566');
    expect(bar).toContain(`href="mailto:${CONTACTS.email}"`);
    expect(bar).toContain('target="_blank" rel="noopener"');
    expect(mapsHref()).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Wunder%20Sa\.Bi\.%20Srl/);
    // Every item has a translatable label for screen readers.
    expect(bar.match(/class="c-label" data-i18n="/g)).toHaveLength(3);
    expect(bar).not.toContain('c-fax');
  });

  it('shows optional fax, PEC and VAT only when set', () => {
    const bar = contactBar(FULL);
    expect(bar).toContain('<li class="c-fax"><span class="c-static">');
    expect(bar).toContain('href="mailto:wunder@pec.example.it"');
    const f = footerContacts(FULL);
    expect(f.company).toContain('<span data-i18n="cVat">P.IVA</span> 01234567890');
    expect(f.contacts).toContain('<span data-i18n="cFax">Fax</span> +39 02 1234 5678');
    expect(f.contacts).toContain('<span data-i18n="cPec">PEC</span> <a href="mailto:wunder@pec.example.it">');
    expect(footerContacts().company).not.toContain('cVat');
  });

  it('escapes markup in the data', () => {
    const bar = contactBar({ ...CONTACTS, street: 'Via <b>&', email: 'a"b@c.it' });
    expect(bar).toContain('Via &lt;b&gt;&amp;');
    expect(bar).toContain('mailto:a&quot;b@c.it');
  });
});

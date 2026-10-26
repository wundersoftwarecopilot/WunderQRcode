import { describe, expect, it } from 'vitest';
import { contactBar, footerContacts } from '../src/brand/contacts-html';
import { CONTACTS, type Contacts, mapsHref, telHref, whatsappHref } from '../src/brand/contacts';

const MINIMAL: Contacts = { company: 'Wunder Sa.Bi. Srl', street: 'Via Vecchia per Monza 20', zip: '20056', city: 'Trezzo sull’Adda', province: 'MI', phone: '+39 02 90964566', email: 'wunder@wunder.it', web: 'https://www.wunder.it/' };

describe('contact data markup', () => {
  it('top bar: phone, WhatsApp, e-mail and head office, then the all-contacts button', () => {
    const bar = contactBar();
    const items = [...bar.matchAll(/<li class="c-(\w+)">/g)].map((m) => m[1]);
    expect(items).toEqual(['phone', 'whatsapp', 'email', 'address']);
    expect(bar).toContain(`href="${telHref(CONTACTS.phone)}"`);
    expect(telHref('+39 02 90964566')).toBe('tel:+390290964566');
    expect(whatsappHref('+39 333 8035628')).toBe('https://wa.me/393338035628');
    expect(bar).toContain(`href="mailto:${CONTACTS.email}"`);
    expect(mapsHref()).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Wunder%20Sa\.Bi\.%20Srl/);
    expect(bar).toContain('<button type="button" class="ac-toggle" aria-expanded="false" aria-controls="all-contacts">');
    // Each bar item has a translatable label for screen readers.
    expect(bar.match(/class="c-label" data-i18n="/g)).toHaveLength(4);
  });

  it('the panel lists every contact, the VAT number and the social pages', () => {
    const bar = contactBar();
    const panel = bar.slice(bar.indexOf('<div class="all-contacts"'));
    expect(panel).toMatch(/^<div class="all-contacts" id="all-contacts" role="region" aria-labelledby="all-contacts-title" hidden>/);
    const labels = [...panel.matchAll(/<dt data-i18n="(\w+)">/g)].map((m) => m[1]);
    expect(labels).toEqual(['cHq', 'cPhone', 'cWhatsapp', 'cEmail', 'cSales', 'cAdmin', 'cMedical', 'cVat']);
    for (const d of CONTACTS.departments!) expect(panel).toContain(`href="mailto:${d.email}"`);
    expect(panel).toContain(`<dd>${CONTACTS.vat}</dd>`);
    for (const s of CONTACTS.social!) expect(panel).toContain(`href="${s.url}" target="_blank" rel="noopener"`);
  });

  it('optional fields appear only when set', () => {
    const bar = contactBar(MINIMAL);
    expect([...bar.matchAll(/<li class="c-(\w+)">/g)].map((m) => m[1])).toEqual(['phone', 'email', 'address']);
    expect(bar).not.toContain('<ul class="social">');
    expect(bar).not.toContain('cVat');
    const full = contactBar({ ...MINIMAL, fax: '+39 02 1234 5678', pec: 'wunder@pec.example.it' });
    expect(full).toContain('<dt data-i18n="cFax">Fax</dt><dd>+39 02 1234 5678</dd>');
    expect(full).toContain('href="mailto:wunder@pec.example.it"');
    const f = footerContacts({ ...MINIMAL, fax: '+39 02 1234 5678' });
    expect(f.contacts).toContain('<div><dt data-i18n="cFax">Fax</dt><dd>+39 02 1234 5678</dd></div>');
    expect(f.company).not.toContain('cVat');
    expect(f.social).toBe('');
  });

  it('footer: company with VAT number, every contact and the social links', () => {
    const f = footerContacts();
    expect(f.company).toContain(`<span data-i18n="cVat">P.IVA</span> ${CONTACTS.vat}`);
    expect(f.contacts).toMatch(/^<dl><div><dt data-i18n="cPhone">Telefono<\/dt><dd><a href="tel:\+390290964566">/);
    expect(f.contacts).toContain('<dt data-i18n="cWhatsapp">WhatsApp</dt><dd><a href="https://wa.me/393338035628" target="_blank" rel="noopener">');
    for (const d of CONTACTS.departments!) expect(f.contacts).toContain(`mailto:${d.email}`);
    expect(f.contacts).toContain('<a href="https://www.wunder.it/">www.wunder.it</a>');
    expect(f.social.match(/<li>/g)).toHaveLength(CONTACTS.social!.length);
  });

  it('escapes markup in the data', () => {
    const bar = contactBar({ ...MINIMAL, street: 'Via <b>&', email: 'a"b@c.it' });
    expect(bar).toContain('Via &lt;b&gt;&amp;');
    expect(bar).toContain('mailto:a&quot;b@c.it');
  });
});

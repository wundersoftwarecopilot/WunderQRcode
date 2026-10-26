import { describe, expect, it } from 'vitest';
import { emailPayload, phonePayload, smsPayload, urlPayload, vcardPayload, wifiPayload } from '../src/payloads';

describe('payloads', () => {
  it('adds https:// only to bare hosts', () => {
    expect(urlPayload(' www.wunder.it/it/ ')).toBe('https://www.wunder.it/it/');
    expect(urlPayload('http://example.com')).toBe('http://example.com');
    expect(urlPayload('mailto:a@b.it')).toBe('mailto:a@b.it');
    expect(urlPayload('')).toBe('');
  });

  it('escapes Wi-Fi fields', () => {
    expect(wifiPayload({ ssid: 'Wunder;Ospiti', password: 'a:b,"c"\\', security: 'WPA', hidden: true })).toBe(
      'WIFI:T:WPA;S:Wunder\\;Ospiti;P:a\\:b\\,\\"c\\"\\\\;H:true;;',
    );
    expect(wifiPayload({ ssid: 'Open', password: 'ignored', security: 'nopass', hidden: false })).toBe('WIFI:T:nopass;S:Open;;');
    expect(wifiPayload({ ssid: '', password: '', security: 'WPA', hidden: false })).toBe('');
  });

  it('builds a vCard 3.0 with escaped values', () => {
    const v = vcardPayload({
      firstName: 'Mario',
      lastName: 'Rossi',
      org: 'Wunder Sa.Bi. Srl',
      title: 'Vendite; Italia',
      mobile: '+39 333 1234567',
      work: '',
      email: 'mario@wunder.it',
      url: 'www.wunder.it',
      street: 'Via Roma, 1',
      city: "Trezzo sull'Adda",
      zip: '20056',
      country: 'Italia',
      note: 'riga 1\nriga 2',
    });
    expect(v.split('\r\n')).toEqual([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Rossi;Mario;;;',
      'FN:Mario Rossi',
      'ORG:Wunder Sa.Bi. Srl',
      'TITLE:Vendite\\; Italia',
      'TEL;TYPE=CELL:+39 333 1234567',
      'EMAIL;TYPE=INTERNET:mario@wunder.it',
      'URL:https://www.wunder.it',
      "ADR;TYPE=WORK:;;Via Roma\\, 1;Trezzo sull'Adda;;20056;Italia",
      'NOTE:riga 1\\nriga 2',
      'END:VCARD',
    ]);
  });

  it('encodes mailto, tel and SMS', () => {
    expect(emailPayload({ to: 'info@wunder.it', subject: 'Richiesta & info', body: 'Ciao\nGrazie' })).toBe(
      'mailto:info@wunder.it?subject=Richiesta%20%26%20info&body=Ciao%0AGrazie',
    );
    expect(emailPayload({ to: 'a@b.it', subject: '', body: '' })).toBe('mailto:a@b.it');
    expect(phonePayload('+39 02 909.645-66')).toBe('tel:+390290964566');
    expect(phonePayload('+')).toBe('');
    expect(smsPayload({ number: '333 123 4567', message: 'Ciao: ok' })).toBe('SMSTO:3331234567:Ciao: ok');
  });
});

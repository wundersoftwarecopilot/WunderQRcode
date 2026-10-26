import { defineConfig } from 'vitest/config';
import { logoSvg } from './src/brand/logo.ts';
import { contactBar, footerContacts } from './src/brand/contacts-html.ts';

// Relative base: the site is served from https://<owner>.github.io/WunderQRcode/.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0 },
  plugins: [
    {
      // The header, footer and favicon logos come from src/brand/logo.ts, like the one in the codes.
      name: 'wunder-logo',
      transformIndexHtml: (html) =>
        html
          .replaceAll('<!--WUNDER_LOGO-->', logoSvg('aria-hidden="true" focusable="false"'))
          .replace('%WUNDER_FAVICON%', 'data:image/svg+xml,' + encodeURIComponent(logoSvg())),
    },
    {
      // Contact data from src/brand/contacts.ts: the bar at the top right and the footer.
      name: 'wunder-contacts',
      transformIndexHtml: (html) => {
        const footer = footerContacts();
        return html
          .replace('<!--WUNDER_CONTACT_BAR-->', contactBar())
          .replace('<!--WUNDER_FOOTER_COMPANY-->', footer.company)
          .replace('<!--WUNDER_FOOTER_CONTACTS-->', footer.contacts)
          .replace('<!--WUNDER_FOOTER_SOCIAL-->', footer.social);
      },
    },
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});

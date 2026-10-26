import { defineConfig } from 'vitest/config';
import { logoSvg } from './src/brand/logo';

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
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});

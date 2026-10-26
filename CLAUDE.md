# Wunder QR Code

Static QR code generator (Vite + TypeScript, no framework). `.github/workflows/pages.yml` tests,
builds and deploys `dist/` with `actions/deploy-pages`, and also force-pushes it to `gh-pages` (the
configured Pages source; never edit it by hand). Pushes to `gh-pages` made with the workflow token
stopped starting Pages builds, hence the direct deploy. `public/.nojekyll` keeps Jekyll off.
UI in Italian and English.

## Rules
- **Look:** Wunder corporate: white and graphite (`--ink #1D1D1B`) with red `#D90000`; division
  colours medicale `#009ADE`, industriale `#FFB300`, design `#116374` (`src/brand/colors.ts`).
  Do not use ESA elements (orange `#FF5F1F`, Montserrat, Bebas Neue, Roboto).
- **Logo** only from `src/brand/logo.ts` (placeholder W monogram until the official SVG arrives).
  `vite.config.ts` injects it into `<!--WUNDER_LOGO-->` and the favicon; the QR codes draw it from
  the same paths. Every header/footer logo links to https://www.wunder.it/.
- **Contact data** only in `src/brand/contacts.ts`; `src/brand/contacts-html.ts` renders the
  contact bar (top right of the top bar; icon buttons on phones) and the footer columns at build
  time. Publish only values confirmed by independent sources (wunder.it is unreachable from the
  build container).
- Everything runs in the browser; never send the content anywhere. Do not persist the content
  (Wi-Fi passwords): only design settings and language go to localStorage.
- Every text in the page goes through `src/i18n.ts` (`data-i18n`, `data-i18n-placeholder`,
  `data-i18n-aria`, `data-i18n-title`); add both languages.

## Pipeline
`payloads.ts` (string) → `qr/matrix.ts` (modules) → `qr/geometry.ts` (`Drawing`: layers of
M/L/C/Z paths in module units, y down) → `export/{svg,raster,pdf,eps}.ts`. All six formats share
the same `Drawing`, so a new style only touches `geometry.ts`. Finder patterns and alignment
patterns are drawn whole in the eye style (loose dots there stop readers); the logo cut-out
hides modules and forces ECC H.

## Downloads
One "Scarica QR Code" button saves the format picked in the chips (`name="format"`, remembered in
localStorage); "Tutti i formati" builds a stored ZIP of all six (`src/export/zip.ts`) and leaves out
a raster type the browser cannot encode (WebP on Safari).

## Commands
- `npm run dev`, `npm run build` (→ `dist/`), `npm run typecheck`, `npm test`
- `npm run smoke` (after build): Playwright drives the built page, downloads every format and
  decodes it back with jsQR (PDF via `pdftoppm`); screenshots in `shots/`.
- Tests decode every module × eye × logo combination at 5 and 24 px/module with jsQR
  (`tests/raster.ts` is an exact scanline rasteriser for `Drawing`).

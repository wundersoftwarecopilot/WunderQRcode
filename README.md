# Wunder QR Code

Generatore di QR code con l'identità visiva Wunder, pubblicato su GitHub Pages:
**https://wundersoftwarecopilot.github.io/WunderQRcode/**

Il logo in alto (e quello nel footer) porta al sito istituzionale https://www.wunder.it/.

## Cosa fa

- **Contenuti:** link, testo, rete Wi-Fi, contatto (vCard 3.0), e-mail, telefono, SMS.
- **Stile:** colori di moduli, occhi e sfondo (con i colori Wunder a portata di clic e lo
  sfondo trasparente), moduli quadrati / arrotondati / a punti, occhi quadrati / arrotondati /
  circolari, logo Wunder al centro, correzione d'errore L–H, margine.
- **Download:** PNG, JPEG, WEBP (128–4096 px), SVG, PDF ed EPS vettoriali (dimensione fisica =
  pixel a 300 dpi), copia negli appunti.
- Tutto avviene nel browser: nessun dato lascia il dispositivo. Interfaccia in italiano e inglese.

Con il logo attivo la correzione d'errore passa automaticamente ad H (30%). Ogni combinazione di
stile è verificata nei test decodificando il QR generato.

## Sviluppo

```bash
npm install
npm run dev          # server di sviluppo
npm test             # test (payload, decodifica di ogni stile, PDF/EPS/SVG)
npm run typecheck
npm run build        # → dist/
npm run smoke        # dopo il build: prova nel browser, scarica e rilegge ogni formato, screenshot in shots/
```

## Struttura

| Percorso | Contenuto |
| --- | --- |
| `index.html`, `src/style.css` | Pagina e stile (rosso `#D90000`, grafite, colori delle divisioni) |
| `src/main.ts` | Collega il modulo all'anteprima e ai download |
| `src/payloads.ts` | Testo codificato per ogni tipo di contenuto (Wi-Fi, vCard, mailto, …) |
| `src/qr/matrix.ts` | Matrice QR (libreria `qrcode-generator`, testo in UTF-8) |
| `src/qr/geometry.ts` | Forme di moduli, occhi, pattern di allineamento e logo |
| `src/export/*` | Un esportatore per formato: SVG, raster (PNG/JPEG/WEBP), PDF, EPS |
| `src/brand/logo.ts` | **Unico punto** in cui è definito il logo |
| `src/brand/contacts.ts` | **Unico punto** con i dati di contatto (barra in alto a destra e footer) |
| `src/i18n.ts` | Testi IT/EN |

## Logo

Il logo attuale è il segnaposto Wunder (W bianca su disco rosso), lo stesso del mondo virtuale.
Per usare il logo ufficiale basta sostituire i percorsi in `src/brand/logo.ts` con quelli del file
SVG ufficiale (`d` e colore di ogni `<path>`): header, footer, favicon e logo dentro i QR code in
tutti e sei i formati si aggiornano da soli.

## Pubblicazione

`.github/workflows/pages.yml`, a ogni push su `main` o sul branch di lavoro, esegue typecheck e
test, compila e pubblica `dist/` sul branch **`gh-pages`**, servito da GitHub Pages
(Settings → Pages → Source: *Deploy from a branch*, `gh-pages`, `/ (root)`). Il branch `gh-pages`
contiene solo il sito compilato e viene riscritto a ogni pubblicazione: non va modificato a mano.

QR Code è un marchio registrato di DENSO WAVE INCORPORATED.

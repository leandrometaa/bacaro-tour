# Bacaro Tour

App mobile-first per trovare dove mangiare e bere vicino a te. Dati reali da OpenStreetMap.

## Funzionalità

- **Geolocalizzazione** o ricerca città/indirizzo (Nominatim)
- **Mappa** con raggio 1–30 km e pin dei locali
- **Filtri**: Aperto adesso, Aperitivo, Vino e tagliere, Pizza, Cena
- **Lista** e **dettaglio**: orari (oggi evidenziato), cucina se disponibile, indirizzo, tag OSM
- **Liste salvate** e **diario visite** (localStorage)
- **Segnala orario sbagliato**: apre una nota su OpenStreetMap
- **PWA**: installabile sulla home screen
- **Demo**: toggle offline con dati di esempio

## Come eseguire

```bash
npm install
npm run dev
```

Apri [http://localhost:5199/bacaro-tour/](http://localhost:5199/bacaro-tour/)  
(`base` Vite è `/bacaro-tour/` per un eventuale hosting su GitHub Pages.)

Build:

```bash
npm run build
npm run preview
```

## Click path

1. Apri l’app → scegli posizione (geolocalizzazione, ricerca, o zona rapida).
2. Mappa con raggio e pin; regola lo slider.
3. Attiva **Aperto adesso** e un mood (es. Pizza).
4. Passa a **Lista** e apri un locale.
5. Dettaglio: orari, mini-mappa, tag; cuore → salva in lista; **Ci sono stato** → visita.
6. Tab **I miei posti**: liste e diario.
7. Cerca un locale per nome.
8. **Segnala orario sbagliato** apre OSM Note.
9. Toggle **Demo** per dati offline di esempio.

## Sorgente dati

- **Default**: Overpass API (`amenity=bar|pub|restaurant|cafe|fast_food|biergarten|ice_cream` e `cuisine=pizza`) con mirror di fallback.
- Orari: libreria `opening_hours`. Se mancano → «Orari non disponibili»; il filtro Aperto adesso li esclude.
- Foto: tag `image` / Wikimedia / Wikidata se presenti, altrimenti illustrazione di categoria.
- Cache localStorage 24h, debounce, max ~80 risultati.
- Credit: **Dati © OpenStreetMap contributors**
- Modulo unico: `src/data/venues.ts` (+ `overpass.ts`, `demoVenues.ts`).

## Cosa è stub / locale

- Liste e visite solo in localStorage (niente account)
- Toggle Demo = JSON offline di esempio
- Nessun backend, prenotazioni o pagamenti

## Stack

Vite + React + TypeScript, Tailwind CSS v4, Leaflet, React Router, `opening_hours`, vite-plugin-pwa.

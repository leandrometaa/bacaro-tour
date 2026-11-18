# Bacaro Tour

PWA mobile-first per trovare bacari, osterie e locali vicino a te (focus Veneto).  
Dati da **OpenStreetMap** (live) + bundle regionali **OSM/Overture** (offline / enrichment).

## Funzionalità

- Geolocalizzazione o città/indirizzo (Nominatim)
- Mappa + lista tipografica, filtri mood/feature, “Aperti / orario n/d”
- Dettaglio: orari, contatti, fonte dati, Giro, segnalazione OSM
- Liste, diario visite (anche foto personali), share con snapshot
- Fallback offline sui bundle; PWA installabile

## Come eseguire

```bash
npm install
npm run dev
```

Apri [http://localhost:5199/](http://localhost:5199/) (`base` Vite = `/`, pensato per **Vercel**).

```bash
npm run build
npm run preview
```

## Deploy (Vercel)

- Build: `npm run build` · Output: `dist`
- `vercel.json` fa da SPA fallback su `index.html`
- Quando il codice è pronto al deploy, usa Grokbot con il prompt Vercel (vedi chat / istruzioni agente)

## Strategia dati (importante)

Non “gonfiare” all’infinito il dataset prima del lancio. Tre livelli:

| Livello | Ruolo | Freschezza |
|--------|--------|------------|
| **Overpass (live)** | Locali nella zona scelta | Aggiornato a ogni ricerca |
| **Bundle OSM regionale** | Copertura hub + offline | Rigenerato a mano / mensile |
| **Bundle Overture** | Locali mancanti + contatti | Stesso ciclo del regionale |
| **enrichment.json** | Note/foto/curatela tua | Quando vuoi (alto valore) |

Dopo la pubblicazione:

1. L’app **non** dipende solo dal bundle: Overpass continua a portare posti nuovi dove c’è rete.
2. I bundle servono a densità, offline e contatti: aggiornali **ogni 1–2 mesi**, non ogni giorno.
3. Comandi:

```bash
npm run data:regional
npm run data:overture:bundle
npm run data:gate
```

4. Qualità > quantità: meglio hub giusti + `enrichment.json` sui bacari storici che 50k record rumorosi.
5. Espandi hub Overture solo se in beta utenti dicono “qui non trovo niente”.

## Crediti

- © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL)
- [Overture Maps Foundation](https://overturemaps.org/) — vedi [attribuzione](https://docs.overturemaps.org/attribution/)
- Wikimedia / Wikipedia per alcune foto

## Stack

Vite + React + TypeScript, Tailwind CSS v4, Leaflet, React Router, `opening_hours`, vite-plugin-pwa.

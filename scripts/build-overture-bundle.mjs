/**
 * Build src/data/overtureBundle.json from cached Overture extracts.
 * - Adds novel food/drink venues (id: overture-…)
 * - Contact hints for OSM matches (phone/website only), keyed by osm id
 *
 * Requires: npm run data:overture (populates scripts/.cache/overture)
 * Usage: node scripts/build-overture-bundle.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VENETO_HUBS } from './veneto-hubs.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const CACHE_DIR = join(__dir, '.cache/overture');
const BUNDLE_PATH = join(ROOT, 'src/data/regionalBundle.json');
const OUT = join(ROOT, 'src/data/overtureBundle.json');

const RADIUS_KM = 5;
const MATCH_M = 80;

const HUBS = VENETO_HUBS;

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function normalizeName(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function namesSimilar(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(' ').filter((t) => t.length > 2));
  const tb = new Set(nb.split(' ').filter((t) => t.length > 2));
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size) >= 0.6;
}

const SKIP_CATEGORIES = new Set([
  'bakery',
  'dessert_shop',
  'pastry_shop',
  'casual_eatery',
  'food_court',
  'food_truck',
  'meal_takeaway',
  'grocery',
  'supermarket',
]);

function mapType(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('pizza')) return 'pizzeria';
  if (c.includes('ice_cream') || c.includes('gelato')) return 'gelateria';
  if (c.includes('wine') || c.includes('enoteca')) return 'enoteca';
  if (c.includes('cafe') || c.includes('coffee')) return 'cafe';
  if (c.includes('pub') || c.includes('brewery')) return 'pub';
  if (c.includes('bar')) return 'bar';
  if (c.includes('restaurant') || c.includes('bistro')) return 'ristorante';
  return 'altro';
}

function shouldSkipPlace(place) {
  const cat = (place.category || '').toLowerCase();
  if (SKIP_CATEGORIES.has(cat)) return true;
  const name = (place.name || '').toLowerCase();
  if (/\b(panificio|pane |pasticceria|forno|fornaio)\b/.test(name)) return true;
  const type = mapType(place.category);
  if (type === 'altro') return true;
  return false;
}

function normalizeWebsite(raw) {
  if (!raw) return undefined;
  const t = String(raw).trim();
  if (!t) return undefined;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function loadCachedPlaces() {
  if (!existsSync(CACHE_DIR)) {
    throw new Error('Missing Overture cache. Run: npm run data:overture');
  }
  const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json'));
  const byId = new Map();
  for (const f of files) {
    const rows = JSON.parse(readFileSync(join(CACHE_DIR, f), 'utf8'));
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row?.id || row.lat == null || row.lon == null || !row.name) continue;
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}

function dedupeOverture(places) {
  const kept = [];
  for (const p of places) {
    const dup = kept.find(
      (k) =>
        haversineKm([k.lat, k.lon], [p.lat, p.lon]) * 1000 <= MATCH_M &&
        namesSimilar(k.name, p.name)
    );
    if (!dup) {
      kept.push(p);
      continue;
    }
    // Prefer the one with more contact fields
    const score = (x) => (x.phone ? 1 : 0) + (x.website ? 1 : 0);
    if (score(p) > score(dup)) {
      kept[kept.indexOf(dup)] = p;
    }
  }
  return kept;
}

function main() {
  const osmBundle = JSON.parse(readFileSync(BUNDLE_PATH, 'utf8'));
  const osmList = Object.values(osmBundle);
  const places = dedupeOverture(loadCachedPlaces());

  const venues = {};
  const contactHints = {}; // osm-id → { phone?, website? }

  let novel = 0;
  let hints = 0;

  for (const hub of HUBS) {
    const center = [hub.lat, hub.lon];
    const nearOsm = osmList.filter(
      (v) => haversineKm(center, v.coordinates) <= RADIUS_KM
    );
    const nearOv = places.filter(
      (p) => haversineKm(center, [p.lat, p.lon]) <= RADIUS_KM
    );

    const usedOsm = new Set();
    for (const o of nearOv) {
      let best = null;
      for (const b of nearOsm) {
        if (usedOsm.has(b.id)) continue;
        const distM = haversineKm([o.lat, o.lon], b.coordinates) * 1000;
        if (distM > MATCH_M) continue;
        if (!namesSimilar(o.name, b.name)) continue;
        if (!best || distM < best.distM) best = { b, distM };
      }

      if (best) {
        usedOsm.add(best.b.id);
        const phone = o.phone || undefined;
        const website = normalizeWebsite(o.website);
        if (phone || website) {
          const prev = contactHints[best.b.id] || {};
          contactHints[best.b.id] = {
            ...(prev.phone || phone ? { phone: prev.phone || phone } : {}),
            ...(prev.website || website
              ? { website: prev.website || website }
              : {}),
          };
          hints++;
        }
        continue;
      }

      if (shouldSkipPlace(o)) continue;

      const id = `overture-${o.id}`;
      if (venues[id]) continue;
      venues[id] = {
        id,
        name: o.name,
        type: mapType(o.category),
        coordinates: [o.lat, o.lon],
        source: 'overture',
        ...(o.phone ? { phone: o.phone } : {}),
        ...(normalizeWebsite(o.website)
          ? { website: normalizeWebsite(o.website) }
          : {}),
        ...(o.category ? { category: o.category } : {}),
      };
      novel++;
    }
  }

  const out = { venues, contactHints, meta: {
    generatedAt: new Date().toISOString(),
    release: '2026-10-21.0',
    hubs: HUBS.map((h) => h.name),
    novelCount: Object.keys(venues).length,
    contactHintCount: Object.keys(contactHints).length,
    licenseNote:
      'Overture Places — keep source attribution; do not rebrand as OSM (ODbL).',
  }};

  writeFileSync(OUT, JSON.stringify(out));
  console.log(
    `Wrote ${OUT}\n  novel venues: ${Object.keys(venues).length}\n  osm contact hints: ${Object.keys(contactHints).length} (writes ${hints})`
  );
}

main();

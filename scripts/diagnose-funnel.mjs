/**
 * Funnel diagnostics for Padova / Vicenza / Bassano.
 * Compares regional bundle density vs live OSM (Overpass) vs UI filters.
 *
 * Usage: node scripts/diagnose-funnel.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const BUNDLE_PATH = join(ROOT, 'src/data/regionalBundle.json');
const OUT_DIR = join(__dir, 'reports');
const OUT_JSON = join(OUT_DIR, 'funnel-report.json');
const OUT_MD = join(OUT_DIR, 'funnel-report.md');

const MAX_RESULTS = 150; // mirrors src/data/overpass.ts
const RADIUS_KM = 5; // default app radius
const UA = 'BacaroTourFunnelDiag/1.0';

const HUBS = [
  { name: 'Padova', lat: 45.4064, lon: 11.8768 },
  { name: 'Vicenza', lat: 45.5455, lon: 11.5353 },
  { name: 'Bassano del Grappa', lat: 45.7667, lon: 11.7333 },
];

const OVERPASS_ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

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

function buildOverpassQuery(lat, lon, radiusM) {
  return `
[out:json][timeout:25];
(
  node["amenity"~"^(bar|pub|restaurant|cafe|fast_food|biergarten|ice_cream|food_court)$"](around:${radiusM},${lat},${lon});
  way["amenity"~"^(bar|pub|restaurant|cafe|fast_food|biergarten|ice_cream|food_court)$"](around:${radiusM},${lat},${lon});
  node["cuisine"~"pizza"](around:${radiusM},${lat},${lon});
  way["cuisine"~"pizza"](around:${radiusM},${lat},${lon});
  node["shop"="wine"](around:${radiusM},${lat},${lon});
  way["shop"="wine"](around:${radiusM},${lat},${lon});
  node["craft"="brewery"](around:${radiusM},${lat},${lon});
  way["craft"="brewery"](around:${radiusM},${lat},${lon});
);
out center tags;
`.trim();
}

async function fetchOverpass(query) {
  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28_000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': UA,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} @ ${endpoint}`);
        continue;
      }
      const data = await res.json();
      return { elements: data.elements ?? [], endpoint };
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error('Overpass failed');
}

function elementCoords(el) {
  if (el.lat != null && el.lon != null) return [el.lat, el.lon];
  if (el.center?.lat != null) return [el.center.lat, el.center.lon];
  return null;
}

function parseLiveVenues(elements, center, radiusKm) {
  const seen = new Set();
  const venues = [];
  for (const el of elements) {
    if (!el.tags?.name) continue;
    const coords = elementCoords(el);
    if (!coords) continue;
    if (haversineKm(center, coords) > radiusKm) continue;
    const id = `osm-${el.type}-${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    venues.push({
      id,
      name: el.tags.name,
      coordinates: coords,
      phone: el.tags.phone || el.tags['contact:phone'] || null,
      website: el.tags.website || el.tags['contact:website'] || null,
      openingHoursRaw: el.tags.opening_hours || null,
      hasPhoto: Boolean(
        el.tags.image || el.tags.wikimedia_commons || el.tags.wikidata
      ),
    });
  }
  venues.sort(
    (a, b) =>
      haversineKm(center, a.coordinates) - haversineKm(center, b.coordinates)
  );
  return venues;
}

function mergeLikeApp(liveCapped, bundleNear) {
  const seen = new Set(liveCapped.map((v) => v.id));
  const extras = [];
  for (const v of bundleNear) {
    if (seen.has(v.id)) continue;
    extras.push(v);
    seen.add(v.id);
  }
  return [...liveCapped, ...extras];
}

function completeness(list) {
  const n = list.length || 1;
  const phone = list.filter((v) => v.phone).length;
  const website = list.filter((v) => v.website).length;
  const photo = list.filter((v) => v.hasPhoto || (v.photos && v.photos.length))
    .length;
  const hours = list.filter((v) => v.openingHoursRaw).length;
  return {
    phone,
    website,
    photo,
    hours,
    phonePct: Math.round((100 * phone) / n),
    websitePct: Math.round((100 * website) / n),
    photoPct: Math.round((100 * photo) / n),
    hoursPct: Math.round((100 * hours) / n),
  };
}

async function diagnoseHub(hub, bundleList) {
  const center = [hub.lat, hub.lon];
  const bundleNear = bundleList
    .filter((v) => haversineKm(center, v.coordinates) <= RADIUS_KM)
    .map((v) => ({
      ...v,
      hasPhoto: Boolean(v.photos?.length),
    }))
    .sort(
      (a, b) =>
        haversineKm(center, a.coordinates) - haversineKm(center, b.coordinates)
    );

  let live = {
    ok: false,
    endpoint: null,
    error: null,
    rawCount: 0,
    cappedCount: 0,
    truncated: false,
    venues: [],
  };

  try {
    const query = buildOverpassQuery(hub.lat, hub.lon, RADIUS_KM * 1000);
    const { elements, endpoint } = await fetchOverpass(query);
    const venues = parseLiveVenues(elements, center, RADIUS_KM);
    live = {
      ok: true,
      endpoint,
      error: null,
      rawCount: venues.length,
      cappedCount: Math.min(venues.length, MAX_RESULTS),
      truncated: venues.length > MAX_RESULTS,
      venues: venues.slice(0, MAX_RESULTS),
    };
  } catch (err) {
    live.error = err instanceof Error ? err.message : String(err);
  }

  // If live failed, estimate cap effect from bundle (proxy for OSM density)
  const liveProxy = live.ok
    ? live.venues
    : bundleNear.slice(0, MAX_RESULTS).map((v) => ({
        ...v,
        _proxy: true,
      }));

  const merged = mergeLikeApp(liveProxy, bundleNear);
  const defaultFilters = merged; // app default: no openNow / moods / features
  const openNowEligible = merged.filter((v) => v.openingHoursRaw);
  const openNowExcludedNoHours = merged.length - openNowEligible.length;

  const onlyInBundle = bundleNear.filter(
    (b) => !liveProxy.some((l) => l.id === b.id)
  ).length;
  const onlyInLive = live.ok
    ? live.venues.filter((l) => !bundleNear.some((b) => b.id === l.id)).length
    : null;

  return {
    hub: hub.name,
    radiusKm: RADIUS_KM,
    maxResults: MAX_RESULTS,
    regionalBundleInRadius: bundleNear.length,
    liveOsm: {
      ok: live.ok,
      endpoint: live.endpoint,
      error: live.error,
      rawBeforeCap: live.ok ? live.rawCount : null,
      afterCap: live.ok ? live.cappedCount : null,
      truncated: live.ok ? live.truncated : bundleNear.length > MAX_RESULTS,
      usedBundleProxy: !live.ok,
    },
    merge: {
      afterMerge: merged.length,
      addedFromBundle: Math.max(0, merged.length - liveProxy.length),
      onlyInBundle,
      onlyInLive,
    },
    ui: {
      defaultFiltersVisible: defaultFilters.length,
      openNowEligibleWithHours: openNowEligible.length,
      openNowExcludedMissingHours: openNowExcludedNoHours,
      note: 'Default UI filters keep all merged venues; openNow drops those without opening_hours.',
    },
    completeness: {
      bundle: completeness(bundleNear),
      merged: completeness(merged),
    },
  };
}

function toMarkdown(report) {
  const lines = [
    '# Funnel report — Padova / Vicenza / Bassano',
    '',
    `Generated: ${report.generatedAt}`,
    `Radius: ${RADIUS_KM} km · Live cap: ${MAX_RESULTS}`,
    `Bundle size: ${report.bundleTotal}`,
    '',
  ];

  for (const h of report.hubs) {
    lines.push(`## ${h.hub}`);
    lines.push('');
    lines.push('| Stage | Count |');
    lines.push('| --- | ---: |');
    lines.push(`| Regional bundle ≤${RADIUS_KM} km | ${h.regionalBundleInRadius} |`);
    if (h.liveOsm.ok) {
      lines.push(`| OSM live (raw) | ${h.liveOsm.rawBeforeCap} |`);
      lines.push(
        `| OSM live after cap (${MAX_RESULTS}) | ${h.liveOsm.afterCap}${h.liveOsm.truncated ? ' (truncated)' : ''} |`
      );
    } else {
      lines.push(
        `| OSM live | FAILED (${h.liveOsm.error}) — used bundle proxy for merge sim |`
      );
      lines.push(
        `| Estimated live after cap | ${Math.min(h.regionalBundleInRadius, MAX_RESULTS)} |`
      );
    }
    lines.push(`| After mergeRegional | ${h.merge.afterMerge} |`);
    lines.push(
      `| UI default (no filters) | ${h.ui.defaultFiltersVisible} |`
    );
    lines.push(
      `| UI openNow-eligible (has hours) | ${h.ui.openNowEligibleWithHours} |`
    );
    lines.push('');
    lines.push(
      `Completeness merged: phone ${h.completeness.merged.phonePct}% · website ${h.completeness.merged.websitePct}% · photo ${h.completeness.merged.photoPct}% · hours ${h.completeness.merged.hoursPct}%`
    );
    lines.push('');
  }

  lines.push('## Reading');
  lines.push('');
  lines.push(
    '- If bundle ≫ live after cap, emptiness with Overpass alone is the **150 cap**; merge should already fix density in PD/TV/VI hubs.'
  );
  lines.push(
    '- If default UI ≈ merge but openNow collapses, “vuoto” with filtro aperto is **missing opening_hours**, not missing venues.'
  );
  lines.push(
    '- Photo % near 0 explains empty-feeling cards even when pin count is high.'
  );
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const bundle = JSON.parse(readFileSync(BUNDLE_PATH, 'utf8'));
  const bundleList = Object.values(bundle);
  const hubs = [];
  for (const hub of HUBS) {
    process.stdout.write(`→ ${hub.name}… `);
    const row = await diagnoseHub(hub, bundleList);
    console.log(
      `bundle ${row.regionalBundleInRadius} | live ${row.liveOsm.ok ? row.liveOsm.afterCap : 'fail'} | merge ${row.merge.afterMerge}`
    );
    hubs.push(row);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    radiusKm: RADIUS_KM,
    maxResults: MAX_RESULTS,
    bundleTotal: bundleList.length,
    hubs,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  writeFileSync(OUT_MD, toMarkdown(report));
  console.log(`\nWrote ${OUT_MD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Prefetch OSM food/drink POIs for Padova / Treviso / Vicenza hubs
 * via the OSM map API (Overpass is often blocked from build agents).
 *
 * Usage: node scripts/build-regional-bundle.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'src', 'data', 'regionalBundle.json');

const UA = 'BacaroTourRegionalBundle/1.0 (https://github.com/local; build script)';

/** City hubs — each gets a small tile grid (~1km cells). */
const HUBS = [
  { name: 'Padova', lat: 45.4064, lon: 11.8768, half: 0.024 },
  { name: 'Abano Terme', lat: 45.357, lon: 11.79, half: 0.016 },
  { name: 'Cittadella', lat: 45.649, lon: 11.784, half: 0.016 },
  { name: 'Treviso', lat: 45.6669, lon: 12.243, half: 0.024 },
  { name: 'Castelfranco Veneto', lat: 45.672, lon: 11.927, half: 0.016 },
  { name: 'Conegliano', lat: 45.887, lon: 12.299, half: 0.016 },
  { name: 'Montebelluna', lat: 45.776, lon: 12.049, half: 0.016 },
  { name: 'Vittorio Veneto', lat: 45.978, lon: 12.371, half: 0.016 },
  { name: 'Valdobbiadene', lat: 45.899, lon: 11.996, half: 0.014 },
  { name: 'Asolo', lat: 45.803, lon: 11.914, half: 0.012 },
  { name: 'Vicenza', lat: 45.5455, lon: 11.5353, half: 0.024 },
  { name: 'Bassano del Grappa', lat: 45.7667, lon: 11.7333, half: 0.02 },
  { name: 'Schio', lat: 45.712, lon: 11.358, half: 0.016 },
  { name: 'Thiene', lat: 45.708, lon: 11.48, half: 0.014 },
  { name: 'Marostica', lat: 45.746, lon: 11.655, half: 0.012 },
];

const STEP = 0.009; // ~1 km — stays under OSM map API node limit in cities
const FOOD = new Set([
  'bar',
  'pub',
  'restaurant',
  'cafe',
  'fast_food',
  'biergarten',
  'ice_cream',
  'food_court',
]);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function tilesForHub(hub) {
  const tiles = [];
  const minLat = hub.lat - hub.half;
  const maxLat = hub.lat + hub.half;
  const minLon = hub.lon - hub.half;
  const maxLon = hub.lon + hub.half;
  for (let lat = minLat; lat < maxLat - 1e-9; lat += STEP) {
    for (let lon = minLon; lon < maxLon - 1e-9; lon += STEP) {
      const north = Math.min(lat + STEP, maxLat);
      const east = Math.min(lon + STEP, maxLon);
      tiles.push({
        west: +lon.toFixed(5),
        south: +lat.toFixed(5),
        east: +east.toFixed(5),
        north: +north.toFixed(5),
      });
    }
  }
  return tiles;
}

async function fetchTile(tile, attempt = 0) {
  const bbox = `${tile.west},${tile.south},${tile.east},${tile.north}`;
  const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${bbox}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/xml', 'User-Agent': UA },
  });
  if (res.status === 429 || res.status === 503) {
    if (attempt >= 4) throw new Error(`HTTP ${res.status}`);
    await sleep(3000 * (attempt + 1));
    return fetchTile(tile, attempt + 1);
  }
  if (res.status === 400) {
    // Area too dense — split into 4
    if (attempt >= 3) return '';
    const midLat = (tile.south + tile.north) / 2;
    const midLon = (tile.west + tile.east) / 2;
    const parts = [
      { west: tile.west, south: tile.south, east: midLon, north: midLat },
      { west: midLon, south: tile.south, east: tile.east, north: midLat },
      { west: tile.west, south: midLat, east: midLon, north: tile.north },
      { west: midLon, south: midLat, east: tile.east, north: tile.north },
    ];
    let xml = '';
    for (const p of parts) {
      xml += await fetchTile(p, attempt + 1);
      await sleep(400);
    }
    return xml;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseTags(tagXml) {
  const tags = {};
  const re = /<tag k="([^"]*)" v="([^"]*)"\s*\/>/g;
  let m;
  while ((m = re.exec(tagXml))) {
    tags[m[1]] = m[2]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
  return tags;
}

function isFood(tags) {
  if (FOOD.has(tags.amenity)) return true;
  if (tags.shop === 'wine') return true;
  if (tags.craft === 'brewery') return true;
  if ((tags.cuisine ?? '').toLowerCase().includes('pizza')) return true;
  return false;
}

function mapType(tags, name) {
  const cuisine = (tags.cuisine ?? '').toLowerCase();
  const n = (name ?? '').toLowerCase();
  if (cuisine.includes('pizza')) return 'pizzeria';
  if (
    tags.shop === 'wine' ||
    cuisine.includes('wine') ||
    /\benoteca\b/.test(n)
  ) {
    return 'enoteca';
  }
  if (/\bosteria\b/.test(n)) return 'osteria';
  if (/\btrattoria\b/.test(n)) return 'trattoria';
  if (tags.craft === 'brewery') return 'pub';
  switch (tags.amenity) {
    case 'restaurant':
      return 'ristorante';
    case 'bar':
      return 'bar';
    case 'pub':
      return 'pub';
    case 'cafe':
      return 'cafe';
    case 'ice_cream':
      return 'gelateria';
    default:
      return 'altro';
  }
}

function buildAddress(tags) {
  const street = [tags['addr:street'], tags['addr:housenumber']]
    .filter(Boolean)
    .join(' ')
    .trim();
  const city =
    tags['addr:city'] || tags['addr:place'] || tags['addr:suburb'] || '';
  return { address: street || undefined, city: city || undefined };
}

function commonsUrl(file) {
  const name = file.replace(/^File:/i, '');
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=800`;
}

function collectDirectPhotos(tags) {
  const photos = [];
  if (tags.image && /^https?:\/\//i.test(tags.image)) photos.push(tags.image);
  if (tags.wikimedia_commons?.startsWith('File:')) {
    photos.push(commonsUrl(tags.wikimedia_commons));
  }
  return [...new Set(photos)];
}

function normalizeWebsite(raw) {
  if (!raw) return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function tagsToEntry(type, idNum, lat, lon, tags) {
  if (!tags.name || lat == null || lon == null) return null;
  if (!isFood(tags)) return null;
  const id = `osm-${type}-${idNum}`;
  const { address, city } = buildAddress(tags);
  const photos = collectDirectPhotos(tags);
  const phone = tags.phone || tags['contact:phone'] || undefined;
  const website = normalizeWebsite(tags.website || tags['contact:website']);
  const wikidata = tags.wikidata
    ? tags.wikidata.startsWith('Q')
      ? tags.wikidata
      : `Q${tags.wikidata}`
    : undefined;

  return {
    id,
    name: tags.name,
    type: mapType(tags, tags.name),
    coordinates: [lat, lon],
    ...(address ? { address } : {}),
    ...(city ? { city } : {}),
    ...(phone ? { phone } : {}),
    ...(website ? { website } : {}),
    ...(photos.length ? { photos } : {}),
    ...(wikidata ? { wikidata } : {}),
    ...(tags.opening_hours ? { openingHoursRaw: tags.opening_hours } : {}),
  };
}

function extractFromXml(xml, nodeIndex) {
  const entries = [];

  // Nodes with tags
  const nodeRe =
    /<node id="(\d+)"[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>([\s\S]*?)<\/node>|<node id="(\d+)"[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*\/>/g;
  let m;
  while ((m = nodeRe.exec(xml))) {
    if (m[5]) {
      // self-closing, no tags
      nodeIndex.set(m[5], [Number(m[6]), Number(m[7])]);
      continue;
    }
    const id = m[1];
    const lat = Number(m[2]);
    const lon = Number(m[3]);
    nodeIndex.set(id, [lat, lon]);
    const tags = parseTags(m[4]);
    const entry = tagsToEntry('node', id, lat, lon, tags);
    if (entry) entries.push(entry);
  }

  // Ways with tags + nd refs — use first node as approx if no center
  const wayRe = /<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g;
  while ((m = wayRe.exec(xml))) {
    const id = m[1];
    const body = m[2];
    const tags = parseTags(body);
    if (!isFood(tags) || !tags.name) continue;
    const nds = [...body.matchAll(/<nd ref="(\d+)"\s*\/>/g)].map((x) => x[1]);
    let lat = null;
    let lon = null;
    for (const ref of nds) {
      const c = nodeIndex.get(ref);
      if (c) {
        lat = c[0];
        lon = c[1];
        break;
      }
    }
    const entry = tagsToEntry('way', id, lat, lon, tags);
    if (entry) entries.push(entry);
  }

  return entries;
}

async function resolveWikidataImage(qid) {
  const id = qid.startsWith('Q') ? qid : `Q${qid}`;
  try {
    const url =
      `https://www.wikidata.org/w/api.php` +
      `?action=wbgetclaims&entity=${encodeURIComponent(id)}` +
      `&property=P18&format=json&origin=*`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    const data = await res.json();
    const filename = data.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    return filename ? commonsUrl(filename) : null;
  } catch {
    return null;
  }
}

async function mapPool(items, concurrency, fn) {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, () =>
      worker()
    )
  );
}

function pct(n, total) {
  if (!total) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

function upsert(byId, entry) {
  if (!byId.has(entry.id)) {
    byId.set(entry.id, entry);
    return true;
  }
  const prev = byId.get(entry.id);
  byId.set(entry.id, {
    ...prev,
    phone: prev.phone || entry.phone,
    website: prev.website || entry.website,
    photos:
      (prev.photos?.length ?? 0) >= (entry.photos?.length ?? 0)
        ? prev.photos
        : entry.photos,
    wikidata: prev.wikidata || entry.wikidata,
    address: prev.address || entry.address,
    city: prev.city || entry.city,
    openingHoursRaw: prev.openingHoursRaw || entry.openingHoursRaw,
  });
  return false;
}

async function main() {
  const byId = new Map();
  const nodeIndex = new Map();

  for (const hub of HUBS) {
    const tiles = tilesForHub(hub);
    console.log(`→ ${hub.name}: ${tiles.length} tiles`);
    let added = 0;
    for (let i = 0; i < tiles.length; i++) {
      try {
        const xml = await fetchTile(tiles[i]);
        if (!xml) continue;
        const entries = extractFromXml(xml, nodeIndex);
        for (const e of entries) {
          if (upsert(byId, e)) added++;
        }
      } catch (err) {
        console.log(
          `  tile ${i + 1}/${tiles.length} failed: ${err.message ?? err}`
        );
      }
      if ((i + 1) % 10 === 0 || i === tiles.length - 1) {
        process.stdout.write(
          `  … ${i + 1}/${tiles.length} (bundle ${byId.size})\r`
        );
      }
      await sleep(350);
    }
    console.log(`\n  +${added} new from ${hub.name} (total ${byId.size})`);
    await sleep(1000);
  }

  const needWiki = [...byId.values()].filter(
    (v) => v.wikidata && !(v.photos && v.photos.length)
  );
  console.log(`\nResolving Wikidata images for ${needWiki.length} venues…`);
  await mapPool(needWiki, 6, async (entry) => {
    const img = await resolveWikidataImage(entry.wikidata);
    if (img) {
      byId.set(entry.id, { ...byId.get(entry.id), photos: [img] });
    }
  });

  const cleaned = {};
  for (const [id, entry] of [...byId.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const { wikidata: _wd, ...rest } = entry;
    cleaned[id] = rest;
  }

  const values = Object.values(cleaned);
  const withPhone = values.filter((v) => v.phone).length;
  const withSite = values.filter((v) => v.website).length;
  const withPhoto = values.filter((v) => v.photos?.length).length;

  writeFileSync(OUT, `${JSON.stringify(cleaned)}\n`, 'utf8');
  console.log('\nWrote', OUT);
  console.log(
    `Stats: ${values.length} venues | phone ${withPhone} (${pct(withPhone, values.length)}) | website ${withSite} (${pct(withSite, values.length)}) | photo ${withPhoto} (${pct(withPhoto, values.length)})`
  );

  if (values.length === 0) {
    console.error('\nBundle empty — check network / OSM API access.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

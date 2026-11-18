/**
 * Build SQL seed files for public.venues from offline OSM + Overture packs.
 *
 * Usage: node scripts/build-supabase-seed.mjs
 *
 * Writes supabase/seed/venues_001.sql, venues_002.sql, … each under 800 KB.
 */
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const REGIONAL = join(ROOT, 'src/data/regionalBundle.json');
const OVERTURE = join(ROOT, 'src/data/overtureBundle.json');
const OUT_DIR = join(ROOT, 'supabase/seed');
const MAX_FILE_BYTES = 800 * 1024;

/** Map app VenueType → OSM amenity / shop tags so client parsing stays valid. */
const TYPE_TO_OSM = {
  cafe: { amenity: 'cafe' },
  bar: { amenity: 'bar' },
  ristorante: { amenity: 'restaurant' },
  pizzeria: { amenity: 'restaurant', cuisine: 'pizza' },
  gelateria: { amenity: 'ice_cream' },
  enoteca: { shop: 'wine' },
  trattoria: { amenity: 'restaurant' },
  osteria: { amenity: 'restaurant' },
  pub: { amenity: 'pub' },
  altro: { amenity: 'bar' },
};

function appIdToCacheId(id, source) {
  const osm = id.match(/^osm-(node|way|relation)-(\d+)$/);
  if (osm) return `osm:${osm[1]}/${osm[2]}`;
  const overture = id.match(/^overture-(.+)$/);
  if (overture) return `overture:${overture[1]}`;
  if (source === 'overture') return `overture:${id}`;
  return id;
}

function splitAddress(address) {
  if (!address || typeof address !== 'string') return {};
  const m = address.trim().match(/^(.*?)(?:\s+(\d+[A-Za-z0-9/-]*))?$/);
  if (!m) return { 'addr:street': address.trim() };
  if (m[2]) {
    return { 'addr:street': m[1].trim(), 'addr:housenumber': m[2] };
  }
  return { 'addr:street': m[1].trim() };
}

function buildTags(entry) {
  const type = entry.type || 'altro';
  const osmBits = TYPE_TO_OSM[type] || TYPE_TO_OSM.altro;
  const tags = {
    name: entry.name,
    ...osmBits,
  };
  if (entry.city) tags['addr:city'] = entry.city;
  Object.assign(tags, splitAddress(entry.address));
  if (entry.phone) tags.phone = entry.phone;
  if (entry.website) tags.website = entry.website;
  if (entry.openingHoursRaw) tags.opening_hours = entry.openingHoursRaw;
  if (entry.category) tags['bacaro:category'] = entry.category;
  if (Array.isArray(entry.photos)) {
    const real = entry.photos.find(
      (p) => typeof p === 'string' && p && !p.startsWith('category:')
    );
    if (real) tags.image = real;
  }
  // Keep type as a hint for Edge Function / debugging.
  tags['bacaro:kind'] = type;
  return tags;
}

/** Escape a SQL string literal (single quotes doubled). */
function sqlString(value) {
  if (value == null) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJsonb(obj) {
  const json = JSON.stringify(obj);
  // Dollar-quote avoids escaping hell inside JSON; tag must not appear in payload.
  let tag = 'tag';
  let n = 0;
  while (json.includes(`$${tag}$`)) {
    n += 1;
    tag = `tag${n}`;
  }
  return `$${tag}$${json}$${tag}$::jsonb`;
}

function rowSql(entry, source) {
  const id = appIdToCacheId(entry.id, source);
  const kind = entry.type || 'altro';
  const [lat, lon] = entry.coordinates || [];
  if (lat == null || lon == null || !entry.name) return null;
  const tags = buildTags(entry);
  const city = entry.city || tags['addr:city'] || null;
  return (
    `(${sqlString(id)}, ${sqlString(source)}, ${sqlString(city)}, ` +
    `${Number(lat)}, ${Number(lon)}, ${sqlString(entry.name)}, ` +
    `${sqlString(kind)}, ${sqlJsonb(tags)})`
  );
}

const UPSERT_TAIL =
  ' on conflict (id) do update set ' +
  'source=excluded.source, city=excluded.city, lat=excluded.lat, ' +
  'lon=excluded.lon, name=excluded.name, kind=excluded.kind, ' +
  'tags=excluded.tags, updated_at=now();';

const INSERT_HEAD =
  'insert into public.venues (id, source, city, lat, lon, name, kind, tags) values\n';

function main() {
  const regional = JSON.parse(readFileSync(REGIONAL, 'utf8'));
  const overtureFile = JSON.parse(readFileSync(OVERTURE, 'utf8'));
  const overtureVenues = overtureFile.venues || {};

  const byId = new Map();

  for (const entry of Object.values(regional)) {
    if (!entry?.id || !entry?.name || !entry?.coordinates) continue;
    byId.set(entry.id, { ...entry, source: 'osm' });
  }

  for (const entry of Object.values(overtureVenues)) {
    if (!entry?.id || !entry?.name || !entry?.coordinates) continue;
    // Prefer OSM pack when the same app id already exists (shouldn't for overture-*).
    if (byId.has(entry.id)) continue;
    byId.set(entry.id, { ...entry, source: 'overture' });
  }

  const rows = [];
  for (const entry of byId.values()) {
    const sql = rowSql(entry, entry.source === 'overture' ? 'overture' : 'osm');
    if (sql) rows.push(sql);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const name of readdirSync(OUT_DIR)) {
    if (/^venues_\d+\.sql$/.test(name)) {
      unlinkSync(join(OUT_DIR, name));
    }
  }

  let fileIndex = 1;
  let batch = [];
  let filesWritten = 0;

  const buildBody = (values) =>
    INSERT_HEAD + values.join(',\n') + UPSERT_TAIL + '\n';

  const flush = () => {
    if (batch.length === 0) return;
    const body = buildBody(batch);
    const name = `venues_${String(fileIndex).padStart(3, '0')}.sql`;
    writeFileSync(join(OUT_DIR, name), body, 'utf8');
    filesWritten += 1;
    fileIndex += 1;
    batch = [];
  };

  for (const row of rows) {
    const candidate = batch.concat(row);
    if (
      batch.length > 0 &&
      Buffer.byteLength(buildBody(candidate), 'utf8') > MAX_FILE_BYTES
    ) {
      flush();
    }
    batch.push(row);
  }
  flush();

  console.log(
    `Wrote ${filesWritten} seed file(s) with ${rows.length} venue row(s) → ${OUT_DIR}`
  );
}

main();

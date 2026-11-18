/**
 * Overture Places vs regional OSM bundle for Veneto Est hubs.
 * Uses DuckDB CLI + S3 GeoParquet (anonymous).
 *
 * Usage: node scripts/compare-overture.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VENETO_HUBS } from './veneto-hubs.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const BUNDLE_PATH = join(ROOT, 'src/data/regionalBundle.json');
const DUCKDB = join(__dir, '.tools/duckdb.exe');
const OUT_DIR = join(__dir, 'reports');
const CACHE_DIR = join(__dir, '.cache/overture');
const OUT_JSON = join(OUT_DIR, 'overture-compare.json');
const OUT_MD = join(OUT_DIR, 'overture-compare.md');

const RELEASE = '2026-10-21.0';
const PARQUET = `s3://overturemaps-us-west-2/release/${RELEASE}/theme=places/type=place/*`;
const RADIUS_KM = 5;
const MATCH_M = 80; // duplicate if within 80m and similar name

const HUBS = VENETO_HUBS;

/** Overture basic_category values that map to Bacaro Tour food/drink. */
const FOOD_BASIC = [
  'restaurant',
  'cafe',
  'bar',
  'pub',
  'brewery',
  'winery',
  'distillery',
  'ice_cream_shop',
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

function bboxForHub(hub, radiusKm) {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos((hub.lat * Math.PI) / 180));
  return {
    xmin: hub.lon - dLon,
    xmax: hub.lon + dLon,
    ymin: hub.lat - dLat,
    ymax: hub.lat + dLat,
  };
}

function escapeSql(s) {
  return s.replace(/'/g, "''");
}

function downloadHubPlaces(hub) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const slug = hub.name.toLowerCase().replace(/\s+/g, '-');
  const outJson = join(CACHE_DIR, `${slug}.json`);
  if (existsSync(outJson)) {
    console.log(`  cache hit ${slug}.json`);
    return JSON.parse(readFileSync(outJson, 'utf8'));
  }

  const bbox = bboxForHub(hub, RADIUS_KM);
  const cats = FOOD_BASIC.map((c) => `'${c}'`).join(', ');
  const outPath = outJson.replace(/\\/g, '/');
  const sql = `
INSTALL httpfs; LOAD httpfs;
INSTALL spatial; LOAD spatial;
SET s3_region='us-west-2';
SET s3_url_style='path';
COPY (
  SELECT
    id,
    names.primary AS name,
    COALESCE(basic_category, taxonomy.primary) AS category,
    COALESCE(phones[1], NULL) AS phone,
    COALESCE(websites[1], NULL) AS website,
    ST_Y(geometry) AS lat,
    ST_X(geometry) AS lon
  FROM read_parquet('${PARQUET}', hive_partitioning=1)
  WHERE bbox.xmin > ${bbox.xmin}
    AND bbox.xmax < ${bbox.xmax}
    AND bbox.ymin > ${bbox.ymin}
    AND bbox.ymax < ${bbox.ymax}
    AND names.primary IS NOT NULL
    AND (
      basic_category IN (${cats})
      OR taxonomy.primary IN (${cats})
      OR list_contains(COALESCE(taxonomy.alternates, []), 'restaurant')
      OR list_contains(COALESCE(taxonomy.alternates, []), 'bar')
      OR list_contains(COALESCE(taxonomy.alternates, []), 'cafe')
    )
) TO '${escapeSql(outPath)}' (FORMAT JSON, ARRAY true);
`;

  const sqlPath = join(CACHE_DIR, `${slug}.sql`);
  writeFileSync(sqlPath, sql);
  console.log(`  duckdb download ${hub.name}…`);
  try {
    execFileSync(DUCKDB, [], {
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 600_000,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    const stderr = err.stderr?.toString?.() || err.message;
    throw new Error(`DuckDB failed for ${hub.name}: ${stderr}`);
  }
  return JSON.parse(readFileSync(outJson, 'utf8'));
}

function withinRadius(places, hub) {
  const center = [hub.lat, hub.lon];
  return places.filter((p) => {
    if (p.lat == null || p.lon == null) return false;
    return haversineKm(center, [p.lat, p.lon]) <= RADIUS_KM;
  });
}

function matchAgainstBundle(overture, bundleNear) {
  const matched = [];
  const novel = [];
  const usedBundle = new Set();

  for (const o of overture) {
    let best = null;
    for (const b of bundleNear) {
      if (usedBundle.has(b.id)) continue;
      const distM = haversineKm([o.lat, o.lon], b.coordinates) * 1000;
      if (distM > MATCH_M) continue;
      if (!namesSimilar(o.name, b.name)) continue;
      if (!best || distM < best.distM) best = { b, distM };
    }
    if (best) {
      usedBundle.add(best.b.id);
      matched.push({ overture: o, bundleId: best.b.id, distM: best.distM });
    } else {
      novel.push(o);
    }
  }

  return { matched, novel, unmatchedBundle: bundleNear.length - usedBundle.size };
}

function completeness(list, phoneKey = 'phone', webKey = 'website') {
  const n = list.length || 1;
  const phone = list.filter((v) => v[phoneKey]).length;
  const website = list.filter((v) => v[webKey]).length;
  return {
    phone,
    website,
    phonePct: Math.round((100 * phone) / n),
    websitePct: Math.round((100 * website) / n),
  };
}

function toMarkdown(report) {
  const lines = [
    '# Overture Places pilot — vs regional bundle',
    '',
    `Generated: ${report.generatedAt}`,
    `Release: ${report.release}`,
    `Radius: ${RADIUS_KM} km · Match: ≤${MATCH_M} m + similar name`,
    '',
  ];

  for (const h of report.hubs) {
    lines.push(`## ${h.hub}`);
    lines.push('');
    lines.push('| Metric | Count |');
    lines.push('| --- | ---: |');
    lines.push(`| Bundle OSM ≤${RADIUS_KM} km | ${h.bundleCount} |`);
    lines.push(`| Overture food/drink ≤${RADIUS_KM} km | ${h.overtureCount} |`);
    lines.push(`| Matched (dup) | ${h.matched} |`);
    lines.push(`| **New from Overture** | **${h.novel}** |`);
    lines.push(
      `| Novel lift vs bundle | ${h.novelLiftPct}% |`
    );
    lines.push('');
    lines.push(
      `Completeness Overture: phone ${h.overtureCompleteness.phonePct}% · website ${h.overtureCompleteness.websitePct}%`
    );
    lines.push(
      `Completeness novel only: phone ${h.novelCompleteness.phonePct}% · website ${h.novelCompleteness.websitePct}%`
    );
    lines.push(
      `Completeness bundle: phone ${h.bundleCompleteness.phonePct}% · website ${h.bundleCompleteness.websitePct}%`
    );
    lines.push('');
  }

  lines.push('## Totals');
  lines.push('');
  lines.push(`- Overture food/drink: ${report.totals.overture}`);
  lines.push(`- Matched: ${report.totals.matched}`);
  lines.push(`- Novel: ${report.totals.novel}`);
  lines.push(`- Avg novel lift: ${report.totals.avgNovelLiftPct}%`);
  lines.push('');
  return lines.join('\n');
}

function main() {
  if (!existsSync(DUCKDB)) {
    console.error('Missing DuckDB at', DUCKDB);
    process.exit(1);
  }

  const bundle = JSON.parse(readFileSync(BUNDLE_PATH, 'utf8'));
  const bundleList = Object.values(bundle);
  const hubs = [];

  for (const hub of HUBS) {
    console.log(`→ ${hub.name}`);
    const raw = downloadHubPlaces(hub);
    const places = withinRadius(Array.isArray(raw) ? raw : [], hub);
    const center = [hub.lat, hub.lon];
    const bundleNear = bundleList.filter(
      (v) => haversineKm(center, v.coordinates) <= RADIUS_KM
    );
    const { matched, novel } = matchAgainstBundle(places, bundleNear);
    const novelLiftPct =
      bundleNear.length === 0
        ? 100
        : Math.round((100 * novel.length) / bundleNear.length);

    hubs.push({
      hub: hub.name,
      bundleCount: bundleNear.length,
      overtureCount: places.length,
      matched: matched.length,
      novel: novel.length,
      novelLiftPct,
      overtureCompleteness: completeness(places),
      novelCompleteness: completeness(novel),
      bundleCompleteness: completeness(bundleNear),
      sampleNovel: novel.slice(0, 8).map((p) => ({
        name: p.name,
        category: p.category,
        phone: p.phone || null,
        website: p.website || null,
      })),
    });
    console.log(
      `  overture ${places.length} | match ${matched.length} | novel ${novel.length} (+${novelLiftPct}%)`
    );
  }

  const totals = {
    overture: hubs.reduce((s, h) => s + h.overtureCount, 0),
    matched: hubs.reduce((s, h) => s + h.matched, 0),
    novel: hubs.reduce((s, h) => s + h.novel, 0),
    avgNovelLiftPct: Math.round(
      hubs.reduce((s, h) => s + h.novelLiftPct, 0) / hubs.length
    ),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    release: RELEASE,
    radiusKm: RADIUS_KM,
    matchMeters: MATCH_M,
    hubs,
    totals,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  writeFileSync(OUT_MD, toMarkdown(report));
  console.log(`\nWrote ${OUT_MD}`);
}

main();

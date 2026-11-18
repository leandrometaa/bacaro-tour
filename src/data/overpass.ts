import type { Mood, Venue, VenueType } from '../types';
import { haversineKm } from '../utils/geo';
import { buildWeeklyHours } from '../utils/openingHours';
import { venueTypeLabel } from '../utils/typeLabels';
import { normalizeWebsiteUrl } from '../utils/url';

/** Prefer our Vercel proxy; on failure race public mirrors from the browser. */
const PROXY_ENDPOINT = '/api/overpass';

const BROWSER_MIRRORS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const MAX_RESULTS = 150;
/** Soft cap after merge so maps stay usable in dense cities. */
export const VENUE_DISPLAY_CAP = 200;
/**
 * Proxy attempt budget. Aligns with the serverless race + fallback window
 * (maxDuration 60) so a slow-but-winning mirror can still return.
 */
const PROXY_TIMEOUT_MS = 55_000;
/** Parallel browser race against public Overpass mirrors. */
const BROWSER_RACE_TIMEOUT_MS = 30_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_PREFIX = 'bacaro_tour_osm_';
const CACHE_VERSION = 2;
const MAX_CACHE_ENTRIES = 10;

export interface OsmFetchResult {
  venues: Venue[];
  truncated: boolean;
  /** True when serving expired local cache after a network failure */
  stale?: boolean;
}

interface OsmTags {
  name?: string;
  amenity?: string;
  cuisine?: string;
  'addr:street'?: string;
  'addr:housenumber'?: string;
  'addr:city'?: string;
  'addr:place'?: string;
  'addr:suburb'?: string;
  opening_hours?: string;
  'opening_hours:kitchen'?: string;
  website?: string;
  'contact:website'?: string;
  phone?: string;
  'contact:phone'?: string;
  outdoor_seating?: string;
  dog?: string;
  wheelchair?: string;
  takeaway?: string;
  delivery?: string;
  internet_access?: string;
  brewery?: string;
  microbrewery?: string;
  wine?: string;
  craft?: string;
  shop?: string;
  description?: string;
  image?: string;
  wikimedia_commons?: string;
  wikidata?: string;
  wikipedia?: string;
  'contact:instagram'?: string;
  'contact:facebook'?: string;
  [key: string]: string | undefined;
}

interface OverpassResponse {
  elements?: OsmElement[];
  remark?: string;
}

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
}

function cacheKey(lat: number, lon: number, radiusKm: number): string {
  // Round to ~100m grid to improve cache hits
  const rLat = Math.round(lat * 1000) / 1000;
  const rLon = Math.round(lon * 1000) / 1000;
  return `${CACHE_PREFIX}${rLat}_${rLon}_${radiusKm}`;
}

interface CacheEntry {
  version?: number;
  savedAt: number;
  venues: Venue[];
  truncated?: boolean;
}

function readCacheEntry(key: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.version !== CACHE_VERSION || !Array.isArray(entry.venues)) {
      localStorage.removeItem(key);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function readCache(key: string): OsmFetchResult | null {
  const entry = readCacheEntry(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > CACHE_TTL_MS) return null;
  return {
    venues: entry.venues,
    truncated: Boolean(entry.truncated),
  };
}

/** Expired cache kept as offline fallback (not removed on read). */
function readStaleCache(key: string): OsmFetchResult | null {
  const entry = readCacheEntry(key);
  if (!entry) return null;
  return {
    venues: entry.venues,
    truncated: Boolean(entry.truncated),
    stale: true,
  };
}

function sweepOsmCache(keepKey?: string): void {
  try {
    const keys: { key: string; savedAt: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const entry = readCacheEntry(key);
      if (!entry) {
        localStorage.removeItem(key);
        continue;
      }
      keys.push({ key, savedAt: entry.savedAt });
    }
    keys.sort((a, b) => b.savedAt - a.savedAt);
    const keep = new Set(
      keys.slice(0, MAX_CACHE_ENTRIES).map((k) => k.key)
    );
    if (keepKey) keep.add(keepKey);
    for (const { key } of keys) {
      if (!keep.has(key)) localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

function writeCache(
  key: string,
  venues: Venue[],
  truncated: boolean
): void {
  // Never persist empty success — Overpass may return [] on timeout/remark.
  if (venues.length === 0) return;
  try {
    sweepOsmCache(key);
    const entry: CacheEntry = {
      version: CACHE_VERSION,
      savedAt: Date.now(),
      venues,
      truncated,
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Quota exceeded — try sweeping then once more
    try {
      sweepOsmCache(key);
      localStorage.setItem(
        key,
        JSON.stringify({
          version: CACHE_VERSION,
          savedAt: Date.now(),
          venues,
          truncated,
        } satisfies CacheEntry)
      );
    } catch {
      // ignore
    }
  }
}

function buildOverpassQuery(lat: number, lon: number, radiusM: number): string {
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

function isBadRemark(remark: string | undefined): boolean {
  return Boolean(remark && /timeout|error|runtime/i.test(remark));
}

type OverpassFetchOk = {
  elements: OsmElement[];
  remark?: string;
  partial: boolean;
};

function parseOverpassPayload(data: OverpassResponse & { error?: string }): OverpassFetchOk {
  if (data.error && !data.elements) {
    throw new Error(data.error);
  }
  const elements = data.elements ?? [];
  const remark = data.remark;
  if (elements.length === 0 && isBadRemark(remark)) {
    throw new Error('Timeout Overpass: riprova o riduci il raggio');
  }
  return {
    elements,
    remark,
    partial: isBadRemark(remark) && elements.length > 0,
  };
}

async function fetchViaProxy(
  query: string,
  signal?: AbortSignal
): Promise<OverpassFetchOk> {
  const timeoutController = new AbortController();
  const onAbort = () => timeoutController.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timeoutId = window.setTimeout(
    () => timeoutController.abort(),
    PROXY_TIMEOUT_MS
  );

  try {
    const response = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query }),
      signal: timeoutController.signal,
    });

    if (!response.ok) {
      throw new Error(`Overpass HTTP ${response.status}`);
    }

    const data = (await response.json()) as OverpassResponse & {
      error?: string;
    };
    return parseOverpassPayload(data);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (signal?.aborted) throw err;
      throw new Error('Timeout Overpass: riprova o riduci il raggio');
    }
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * CORS simple request to a public Overpass mirror (no custom headers).
 */
async function fetchBrowserMirror(
  endpoint: string,
  query: string,
  signal: AbortSignal
): Promise<OverpassFetchOk> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Overpass HTTP ${response.status}`);
  }

  const data = (await response.json()) as OverpassResponse & {
    error?: string;
  };
  return parseOverpassPayload(data);
}

/**
 * Parallel race (Promise.any) across browser mirrors; abort losers on first win.
 */
async function raceBrowserMirrors(
  query: string,
  signal?: AbortSignal
): Promise<OverpassFetchOk> {
  const shared = new AbortController();
  const timeoutId = window.setTimeout(
    () => shared.abort(),
    BROWSER_RACE_TIMEOUT_MS
  );
  const onParentAbort = () => shared.abort();
  signal?.addEventListener('abort', onParentAbort, { once: true });

  try {
    const attempts = BROWSER_MIRRORS.map(async (endpoint) => {
      const result = await fetchBrowserMirror(endpoint, query, shared.signal);
      // First success wins — cancel the remaining mirrors.
      shared.abort();
      return result;
    });
    return await Promise.any(attempts);
  } catch (err) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Timeout Overpass: riprova o riduci il raggio');
    }
    throw new Error('Overpass non raggiungibile');
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onParentAbort);
  }
}

async function fetchOverpass(
  query: string,
  signal?: AbortSignal
): Promise<OverpassFetchOk> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // Prefer Vercel proxy; on non-2xx / network / timeout, race mirrors in-browser.
  try {
    return await fetchViaProxy(query, signal);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError' && signal?.aborted) {
      throw err;
    }
  }

  return raceBrowserMirrors(query, signal);
}

function mapAmenityToType(
  amenity?: string,
  cuisine?: string,
  osmTags?: OsmTags,
  name?: string
): VenueType {
  const cuisines = (cuisine ?? '').toLowerCase();
  const nameLower = (name ?? '').toLowerCase();
  if (cuisines.includes('pizza')) return 'pizzeria';
  if (
    osmTags?.shop === 'wine' ||
    cuisines.includes('wine') ||
    cuisines.includes('vino') ||
    cuisines.includes('enoteca') ||
    /\benoteca\b/.test(nameLower) ||
    /\bvineria\b/.test(nameLower)
  ) {
    return 'enoteca';
  }
  if (/\bosteria\b/.test(nameLower)) return 'osteria';
  if (/\btrattoria\b/.test(nameLower)) return 'trattoria';
  if (osmTags?.craft === 'brewery') return 'pub';
  switch (amenity) {
    case 'restaurant':
      return 'ristorante';
    case 'bar':
      return 'bar';
    case 'pub':
      return 'pub';
    case 'cafe':
      return 'cafe';
    case 'biergarten':
      return 'pub';
    case 'ice_cream':
      return 'gelateria';
    case 'food_court':
      return 'ristorante';
    case 'fast_food':
      return cuisines.includes('pizza') ? 'pizzeria' : 'altro';
    default:
      return 'altro';
  }
}

function deriveMoods(
  amenity: string | undefined,
  cuisine: string[],
  tags: string[],
  osmTags?: OsmTags,
  name?: string
): Mood[] {
  const moods = new Set<Mood>();
  const a = amenity ?? '';
  const cuisineStr = cuisine.join(' ').toLowerCase();
  const tagStr = tags.join(' ').toLowerCase();
  const nameLower = (name ?? '').toLowerCase();

  const bacaroLike =
    /\bbacaro\b/.test(nameLower) ||
    /\bcicchett/.test(nameLower) ||
    /\bosteria\b/.test(nameLower) ||
    /\benoteca\b/.test(nameLower) ||
    /\bvineria\b/.test(nameLower) ||
    tagStr.includes('bacaro') ||
    tagStr.includes('cicchetti');

  const wineSignal =
    bacaroLike ||
    osmTags?.shop === 'wine' ||
    osmTags?.wine === 'yes' ||
    cuisineStr.includes('wine') ||
    cuisineStr.includes('vino') ||
    tagStr.includes('vino') ||
    tagStr.includes('wine') ||
    tagStr.includes('enoteca');

  // Aperitivo: bars/pubs/cafes OR bacaro-like names — not every generic bar alone
  if (
    bacaroLike ||
    a === 'pub' ||
    a === 'biergarten' ||
    (a === 'bar' && (wineSignal || /\bspritz|aperitiv/.test(nameLower))) ||
    a === 'cafe'
  ) {
    moods.add('aperitivo');
  }

  if (wineSignal) {
    moods.add('vino-tagliere');
  }

  if (
    cuisineStr.includes('pizza') ||
    (a === 'fast_food' && cuisineStr.includes('pizza'))
  ) {
    moods.add('pizza');
  }

  if (a === 'restaurant' || a === 'food_court' || /\btrattoria\b/.test(nameLower)) {
    moods.add('cena');
  }

  return Array.from(moods);
}

function buildAddress(tags: OsmTags): { address: string; city: string } {
  const street = [tags['addr:street'], tags['addr:housenumber']]
    .filter(Boolean)
    .join(' ');
  const city =
    tags['addr:city'] ||
    tags['addr:place'] ||
    tags['addr:suburb'] ||
    '';
  return {
    address: street || 'Indirizzo non disponibile',
    city,
  };
}

function buildFeatureTags(tags: OsmTags, cuisine: string[]): string[] {
  const features: string[] = [];
  if (tags.outdoor_seating === 'yes') features.push('dehors');
  if (tags.dog === 'yes') features.push('cani ammessi');
  if (tags.wheelchair === 'yes') features.push('accessibile');
  if (tags.wheelchair === 'limited') features.push('accessibile in parte');
  if (tags.takeaway === 'yes') features.push('asporto');
  if (tags.delivery === 'yes') features.push('consegna');
  if (
    tags.internet_access === 'yes' ||
    tags.internet_access === 'wlan' ||
    tags.internet_access === 'wifi'
  ) {
    features.push('wifi');
  }
  if (tags.brewery === 'yes' || tags.microbrewery === 'yes') {
    features.push('birrificio');
  }
  if (tags.wine === 'yes') features.push('vino');

  for (const [key, value] of Object.entries(tags)) {
    if (key.startsWith('diet:') && value === 'yes') {
      const diet = key.slice(5).replace(/_/g, ' ');
      features.push(diet);
    }
  }

  for (const c of cuisine.slice(0, 3)) {
    if (!features.includes(c)) features.push(c);
  }

  return features;
}

function resolvePhotos(tags: OsmTags, type: VenueType): string[] {
  const photos: string[] = [];

  if (tags.image) photos.push(tags.image);

  if (tags.wikimedia_commons) {
    const commons = tags.wikimedia_commons;
    if (commons.startsWith('File:')) {
      const file = encodeURIComponent(commons.replace(/^File:/, ''));
      photos.push(
        `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=800`
      );
    }
  }

  if (tags.wikidata) {
    const qid = tags.wikidata.startsWith('Q')
      ? tags.wikidata
      : `Q${tags.wikidata}`;
    photos.push(`wikidata:${qid}`);
  }

  if (tags.wikipedia) {
    // OSM format: "it:Cantina_Do_Mori" or "en:Something"
    photos.push(`wikipedia:${tags.wikipedia}`);
  }

  if (photos.length === 0) return [`category:${type}`];
  return [...photos, `category:${type}`];
}

function elementToVenue(el: OsmElement): Venue | null {
  const tags = el.tags;
  if (!tags?.name) return null;

  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;

  const cuisine = (tags.cuisine ?? '')
    .split(';')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  const type = mapAmenityToType(tags.amenity, tags.cuisine, tags, tags.name);
  const { address, city } = buildAddress(tags);
  const featureTags = buildFeatureTags(tags, cuisine);
  const moods = deriveMoods(
    tags.amenity,
    cuisine,
    featureTags,
    tags,
    tags.name
  );
  const openingHoursRaw = tags.opening_hours ?? null;
  const kitchenHoursRaw = tags['opening_hours:kitchen'] ?? null;

  return {
    id: `osm-${el.type}-${el.id}`,
    osmType: el.type,
    osmId: el.id,
    name: tags.name,
    type,
    address,
    city,
    coordinates: [lat, lon],
    openingHoursRaw,
    kitchenHoursRaw,
    hours: buildWeeklyHours(openingHoursRaw, kitchenHoursRaw),
    tags: featureTags.length
      ? featureTags
      : [venueTypeLabel(type).toLowerCase()],
    moods,
    photos: resolvePhotos(tags, type),
    phone: tags.phone || tags['contact:phone'],
    website: normalizeWebsiteUrl(
      tags.website || tags['contact:website']
    ),
    cuisine,
    hasHours: Boolean(openingHoursRaw),
    source: 'osm',
  };
}

/**
 * Map cached OSM/Overture tags (e.g. from Supabase) into the app Venue shape.
 * Reuses the same parsing as live Overpass elements.
 */
export function venueFromOsmElement(
  el: OsmElement,
  options?: { source?: 'osm' | 'overture'; id?: string }
): Venue | null {
  const venue = elementToVenue(el);
  if (!venue) return null;
  if (options?.source === 'overture') {
    venue.source = 'overture';
    venue.osmType = undefined;
    venue.osmId = undefined;
  }
  if (options?.id) venue.id = options.id;
  return venue;
}

export async function fetchOsmVenues(
  center: [number, number],
  radiusKm: number,
  options?: { force?: boolean; signal?: AbortSignal }
): Promise<OsmFetchResult> {
  const key = cacheKey(center[0], center[1], radiusKm);
  if (!options?.force) {
    const cached = readCache(key);
    if (cached) return cached;
  }

  const radiusM = Math.min(Math.round(radiusKm * 1000), 30000);
  const query = buildOverpassQuery(center[0], center[1], radiusM);

  try {
    const { elements, partial } = await fetchOverpass(query, options?.signal);

    const seen = new Set<string>();
    const venues: Venue[] = [];

    for (const el of elements) {
      const venue = elementToVenue(el);
      if (!venue) continue;
      if (seen.has(venue.id)) continue;
      seen.add(venue.id);

      const dist = haversineKm(center, venue.coordinates);
      if (dist > radiusKm) continue;
      venues.push(venue);
    }

    venues.sort(
      (a, b) =>
        haversineKm(center, a.coordinates) - haversineKm(center, b.coordinates)
    );

    const truncated = venues.length > MAX_RESULTS || partial;
    const capped = venues.slice(0, MAX_RESULTS);
    // Partial Overpass responses must not overwrite a good cache as "fresh".
    if (!partial) {
      writeCache(key, capped, truncated);
    }
    return { venues: capped, truncated, stale: partial || undefined };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    const stale = readStaleCache(key);
    if (stale && stale.venues.length > 0) return stale;
    throw err;
  }
}

const OSM_ID_RE = /^osm-(node|way|relation)-(\d+)$/;

/** Fetch a single venue by app id (`osm-node-123`). */
export async function fetchOsmVenueById(
  id: string,
  signal?: AbortSignal
): Promise<Venue | null> {
  const match = id.match(OSM_ID_RE);
  if (!match) return null;

  const [, osmType, osmId] = match;
  const query = `
[out:json][timeout:15];
${osmType}(${osmId});
out center tags;
`.trim();

  const { elements } = await fetchOverpass(query, signal);
  for (const el of elements) {
    const venue = elementToVenue(el);
    if (venue) return venue;
  }
  return null;
}

export function osmEditUrl(venue: Venue): string | null {
  if (!venue.osmType || !venue.osmId) return null;
  return `https://www.openstreetmap.org/edit?${venue.osmType}=${venue.osmId}`;
}

export function osmNoteUrl(venue: Venue): string {
  const [lat, lon] = venue.coordinates;
  const note = encodeURIComponent(
    `Orario errato o mancante per: ${venue.name}`
  );
  return `https://www.openstreetmap.org/note/new?lat=${lat}&lon=${lon}&comment=${note}#map=19/${lat}/${lon}&layers=N`;
}

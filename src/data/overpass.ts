import type { Mood, Venue, VenueType } from '../types';
import { buildWeeklyHours } from '../utils/openingHours';
import { haversineKm } from './demoVenues';

const USER_AGENT =
  'BacaroTour/1.0 (https://github.com/bacaro-tour; mobile web app for finding bars and restaurants; contact: bacaro-tour@example.com)';

const OVERPASS_ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const MAX_RESULTS = 80;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_PREFIX = 'bacaro_tour_osm_';

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
  image?: string;
  wikimedia_commons?: string;
  wikidata?: string;
  [key: string]: string | undefined;
}

interface OsmElement {
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
  savedAt: number;
  venues: Venue[];
}

function readCache(key: string): Venue[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.venues;
  } catch {
    return null;
  }
}

function writeCache(key: string, venues: Venue[]): void {
  try {
    const entry: CacheEntry = { savedAt: Date.now(), venues };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Quota exceeded — ignore
  }
}

function buildOverpassQuery(lat: number, lon: number, radiusM: number): string {
  return `
[out:json][timeout:25];
(
  node["amenity"~"^(bar|pub|restaurant|cafe|fast_food|biergarten|ice_cream)$"](around:${radiusM},${lat},${lon});
  way["amenity"~"^(bar|pub|restaurant|cafe|fast_food|biergarten|ice_cream)$"](around:${radiusM},${lat},${lon});
  node["cuisine"~"pizza"](around:${radiusM},${lat},${lon});
  way["cuisine"~"pizza"](around:${radiusM},${lat},${lon});
);
out center tags;
`.trim();
}

async function fetchOverpass(query: string): Promise<OsmElement[]> {
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      // Browser sends its own User-Agent; we cannot override it from fetch.
      // Referer + Accept identify the app for Overpass usage policy.
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          Referer:
            typeof window !== 'undefined'
              ? window.location.href
              : 'https://bacaro-tour.local/',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        lastError = new Error(`Overpass HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      return (data.elements ?? []) as OsmElement[];
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('Overpass non raggiungibile');
}

function mapAmenityToType(amenity?: string, cuisine?: string): VenueType {
  const cuisines = (cuisine ?? '').toLowerCase();
  if (cuisines.includes('pizza')) return 'pizzeria';
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
    case 'fast_food':
      return cuisines.includes('pizza') ? 'pizzeria' : 'altro';
    default:
      return 'altro';
  }
}

function TYPE_LABEL(type: VenueType): string {
  const map: Record<VenueType, string> = {
    ristorante: 'Ristorante',
    bar: 'Bar',
    pizzeria: 'Pizzeria',
    enoteca: 'Enoteca',
    trattoria: 'Trattoria',
    osteria: 'Osteria',
    cafe: 'Caffè',
    pub: 'Pub',
    gelateria: 'Gelateria',
    altro: 'Locale',
  };
  return map[type];
}

function deriveMoods(
  amenity: string | undefined,
  cuisine: string[],
  tags: string[]
): Mood[] {
  const moods = new Set<Mood>();
  const a = amenity ?? '';
  const cuisineStr = cuisine.join(' ').toLowerCase();
  const tagStr = tags.join(' ').toLowerCase();

  if (['bar', 'pub', 'cafe', 'biergarten'].includes(a)) {
    moods.add('aperitivo');
  }

  if (
    ['bar', 'pub'].includes(a) &&
    (cuisineStr.includes('wine') ||
      tagStr.includes('vino') ||
      cuisineStr.includes('vino') ||
      tagStr.includes('wine'))
  ) {
    moods.add('vino-tagliere');
  }
  if (a === 'bar') {
    moods.add('vino-tagliere');
  }

  if (cuisineStr.includes('pizza') || a === 'fast_food' && cuisineStr.includes('pizza')) {
    moods.add('pizza');
  }

  if (a === 'restaurant' || a === 'fast_food') {
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
  if (tags.image) return [tags.image];

  if (tags.wikimedia_commons) {
    const commons = tags.wikimedia_commons;
    if (commons.startsWith('File:')) {
      const file = encodeURIComponent(commons.replace(/^File:/, ''));
      return [
        `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=800`,
      ];
    }
  }

  if (tags.wikidata) {
    // Caller may resolve P18 later; use category placeholder for now
    return [`wikidata:${tags.wikidata}`, `category:${type}`];
  }

  return [`category:${type}`];
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

  const type = mapAmenityToType(tags.amenity, tags.cuisine);
  const { address, city } = buildAddress(tags);
  const featureTags = buildFeatureTags(tags, cuisine);
  const moods = deriveMoods(tags.amenity, cuisine, featureTags);
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
    tags: featureTags.length ? featureTags : [TYPE_LABEL(type).toLowerCase()],
    moods,
    priceRange: 2,
    photos: resolvePhotos(tags, type),
    phone: tags.phone || tags['contact:phone'],
    website: tags.website || tags['contact:website'],
    cuisine,
    hasHours: Boolean(openingHoursRaw),
    source: 'osm',
  };
}

export async function fetchOsmVenues(
  center: [number, number],
  radiusKm: number,
  options?: { force?: boolean }
): Promise<Venue[]> {
  const key = cacheKey(center[0], center[1], radiusKm);
  if (!options?.force) {
    const cached = readCache(key);
    if (cached) return cached;
  }

  const radiusM = Math.min(Math.round(radiusKm * 1000), 30000);
  const query = buildOverpassQuery(center[0], center[1], radiusM);
  const elements = await fetchOverpass(query);

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

  const capped = venues.slice(0, MAX_RESULTS);
  writeCache(key, capped);
  return capped;
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
  if (venue.osmType && venue.osmId) {
    return `https://www.openstreetmap.org/note/new?lat=${lat}&lon=${lon}#map=19/${lat}/${lon}&layers=N`;
  }
  return `https://www.openstreetmap.org/note/new?lat=${lat}&lon=${lon}#map=19/${lat}/${lon}&layers=N&comment=${note}`;
}

export { USER_AGENT };

import type { Venue, VenueType } from '../types';
import { haversineKm } from '../utils/geo';
import { deriveMoodsFromType } from '../utils/moods';
import { buildWeeklyHours } from '../utils/openingHours';
import { venueTypeLabel } from '../utils/typeLabels';
import { normalizeWebsiteUrl } from '../utils/url';
import raw from './regionalBundle.json';
import overtureRaw from './overtureBundle.json';

export interface RegionalBundleEntry {
  id: string;
  name: string;
  type: VenueType | string;
  coordinates: [number, number];
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
  photos?: string[];
  openingHoursRaw?: string | null;
  source?: 'osm' | 'overture';
  category?: string;
}

type BundleMap = Record<string, RegionalBundleEntry>;

interface OvertureBundleFile {
  venues?: BundleMap;
  contactHints?: Record<string, { phone?: string; website?: string }>;
}

const BUNDLE = raw as unknown as BundleMap;
const BUNDLE_LIST = Object.values(BUNDLE);

const OVERTURE = overtureRaw as unknown as OvertureBundleFile;
const OVERTURE_LIST = Object.values(OVERTURE.venues ?? {});
const OVERTURE_HINTS = OVERTURE.contactHints ?? {};

/** Categories that clutter Bacaro Tour (bakeries, generic eateries, etc.). */
const NOISY_OVERTURE_CATEGORIES = new Set([
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

const DUP_MATCH_KM = 0.08; // ~80 m

function isRealPhoto(src: string): boolean {
  return Boolean(src) && !src.startsWith('category:');
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function namesSimilar(a: string, b: string): boolean {
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

function isNearDuplicate(
  candidate: { name: string; coordinates: [number, number] },
  existing: { name: string; coordinates: [number, number] }[]
): boolean {
  for (const v of existing) {
    if (haversineKm(candidate.coordinates, v.coordinates) > DUP_MATCH_KM) {
      continue;
    }
    // Same/similar name within ~80 m → duplicate. Same coords, different names → keep both.
    if (namesSimilar(candidate.name, v.name)) return true;
  }
  return false;
}

function isNoisyOverture(entry: RegionalBundleEntry): boolean {
  const cat = (entry.category ?? '').toLowerCase();
  if (cat && NOISY_OVERTURE_CATEGORIES.has(cat)) return true;
  const name = normalizeName(entry.name);
  if (
    /\b(panificio|pane|pasticceria|forno|fornaio|supermarket|coop|esselunga)\b/.test(
      name
    )
  ) {
    return true;
  }
  // Generic "Locale" without a useful Bacaro type.
  if ((entry.type === 'altro' || !entry.type) && cat !== 'brewery') return true;
  return false;
}

function mergePhotos(
  existing: string[],
  extra: string[] | undefined
): string[] {
  if (!extra?.length) return existing;
  const category = existing.filter((p) => p.startsWith('category:'));
  const real = existing.filter(isRealPhoto);
  const added = extra.filter((p) => isRealPhoto(p) && !real.includes(p));
  const merged = [...added, ...real.filter((p) => !added.includes(p))];
  if (merged.length === 0) return existing;
  return [...merged, ...category];
}

function entryToVenue(entry: RegionalBundleEntry): Venue {
  const type = (entry.type as VenueType) || 'altro';
  const openingHoursRaw = entry.openingHoursRaw ?? null;
  const photos =
    entry.photos && entry.photos.length > 0
      ? [...entry.photos, `category:${type}`]
      : [`category:${type}`];

  const osmMatch = entry.id.match(/^osm-(node|way|relation)-(\d+)$/);
  const source = entry.source === 'overture' ? 'overture' : 'osm';

  return {
    id: entry.id,
    osmType: osmMatch
      ? (osmMatch[1] as 'node' | 'way' | 'relation')
      : undefined,
    osmId: osmMatch ? Number(osmMatch[2]) : undefined,
    name: entry.name,
    type,
    address: entry.address || 'Indirizzo non disponibile',
    city: entry.city || '',
    coordinates: entry.coordinates,
    openingHoursRaw,
    kitchenHoursRaw: null,
    hours: buildWeeklyHours(openingHoursRaw, null),
    tags: [venueTypeLabel(type).toLowerCase()],
    moods: deriveMoodsFromType(type, entry.name, entry.category),
    photos,
    phone: entry.phone,
    website: normalizeWebsiteUrl(entry.website),
    hasHours: Boolean(openingHoursRaw),
    source,
  };
}

/** Fill missing phone / website / photos from regional + Overture hints. */
export function completeFromRegional(venue: Venue): Venue {
  const extra = BUNDLE[venue.id];
  const hint = OVERTURE_HINTS[venue.id];

  const phone = venue.phone || extra?.phone || hint?.phone;
  const website =
    venue.website ||
    normalizeWebsiteUrl(extra?.website) ||
    normalizeWebsiteUrl(hint?.website) ||
    undefined;
  const photos = mergePhotos(venue.photos, extra?.photos);
  const address =
    venue.address && venue.address !== 'Indirizzo non disponibile'
      ? venue.address
      : extra?.address || venue.address;
  const city = venue.city || extra?.city || '';

  if (
    phone === venue.phone &&
    website === venue.website &&
    photos === venue.photos &&
    address === venue.address &&
    city === venue.city
  ) {
    return venue;
  }

  return { ...venue, phone, website, photos, address, city };
}

/**
 * Merge live OSM results with the PD/TV/VI OSM bundle + Overture novel venues:
 * complete contact fields, then add nearby missing venues (deduped by id / name+coord).
 */
export function mergeRegionalVenues(
  live: Venue[],
  center: [number, number],
  radiusKm: number
): Venue[] {
  const completed = live.map(completeFromRegional);
  const seen = new Set(completed.map((v) => v.id));
  const pool: Venue[] = [...completed];
  const extras: Venue[] = [];

  const tryAdd = (entry: RegionalBundleEntry) => {
    if (seen.has(entry.id)) return;
    const dist = haversineKm(center, entry.coordinates);
    if (dist > radiusKm) return;
    if (isNearDuplicate(entry, pool)) {
      // Still mark id so we don't revisit; enrich contacts if we can.
      seen.add(entry.id);
      return;
    }
    const venue = entryToVenue(entry);
    extras.push(venue);
    pool.push(venue);
    seen.add(entry.id);
  };

  for (const entry of BUNDLE_LIST) {
    tryAdd(entry);
  }

  for (const entry of OVERTURE_LIST) {
    if (isNoisyOverture(entry)) continue;
    tryAdd({ ...entry, source: 'overture' });
  }

  // Final pass: collapse any remaining near-duplicates (e.g. live node+way).
  const deduped: Venue[] = [];
  for (const v of [...completed, ...extras].sort(
    (a, b) =>
      haversineKm(center, a.coordinates) - haversineKm(center, b.coordinates)
  )) {
    if (isNearDuplicate(v, deduped)) {
      // Prefer keeping OSM; if current is OSM and previous was overture, replace.
      const idx = deduped.findIndex(
        (d) =>
          haversineKm(v.coordinates, d.coordinates) <= DUP_MATCH_KM &&
          namesSimilar(v.name, d.name)
      );
      if (
        idx >= 0 &&
        v.source === 'osm' &&
        deduped[idx].source === 'overture'
      ) {
        const kept = {
          ...v,
          phone: v.phone || deduped[idx].phone,
          website: v.website || deduped[idx].website,
        };
        deduped[idx] = kept;
      } else if (idx >= 0) {
        deduped[idx] = {
          ...deduped[idx],
          phone: deduped[idx].phone || v.phone,
          website: deduped[idx].website || v.website,
        };
      }
      continue;
    }
    deduped.push(v);
  }

  return deduped;
}

/** Resolve a venue from regional OSM or Overture bundles by id. */
export function findBundledVenueById(id: string): Venue | undefined {
  const regional = BUNDLE[id];
  if (regional) return entryToVenue(regional);
  const overture = OVERTURE.venues?.[id];
  if (overture) return entryToVenue({ ...overture, source: 'overture' });
  return undefined;
}

export function regionalBundleStats(): {
  total: number;
  withPhone: number;
  withWebsite: number;
  withPhoto: number;
  overtureNovel: number;
  overtureHints: number;
} {
  let withPhone = 0;
  let withWebsite = 0;
  let withPhoto = 0;
  for (const v of BUNDLE_LIST) {
    if (v.phone) withPhone++;
    if (v.website) withWebsite++;
    if (v.photos?.length) withPhoto++;
  }
  return {
    total: BUNDLE_LIST.length,
    withPhone,
    withWebsite,
    withPhoto,
    overtureNovel: OVERTURE_LIST.length,
    overtureHints: Object.keys(OVERTURE_HINTS).length,
  };
}

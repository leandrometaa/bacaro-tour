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

/** Tight radius for fuzzy name matches. */
const DUP_TIGHT_KM = 0.08; // ~80 m
/** Wider radius when phone/website/exact-name strongly agree. */
const DUP_LOOSE_KM = 0.18; // ~180 m

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

function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D+/g, '');
  if (digits.length < 7) return null;
  // Compare on the last 9–10 digits (IT mobile/landline without country prefix).
  return digits.slice(-10);
}

function normalizeWebHost(website?: string | null): string | null {
  if (!website) return null;
  try {
    const url = new URL(
      website.startsWith('http') ? website : `https://${website}`
    );
    return url.hostname.replace(/^www\./, '').toLowerCase() || null;
  } catch {
    return null;
  }
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

type DupCandidate = {
  name: string;
  coordinates: [number, number];
  phone?: string | null;
  website?: string | null;
};

function isNearDuplicate(
  candidate: DupCandidate,
  existing: DupCandidate[]
): boolean {
  const cPhone = normalizePhone(candidate.phone);
  const cWeb = normalizeWebHost(candidate.website);
  const cName = normalizeName(candidate.name);

  for (const v of existing) {
    const dist = haversineKm(candidate.coordinates, v.coordinates);
    if (dist > DUP_LOOSE_KM) continue;

    const phoneMatch =
      Boolean(cPhone) && cPhone === normalizePhone(v.phone);
    const webMatch =
      Boolean(cWeb) && cWeb === normalizeWebHost(v.website);
    const exactName = Boolean(cName) && cName === normalizeName(v.name);
    const fuzzyName = namesSimilar(candidate.name, v.name);

    // Strong identity signals tolerate a wider gap (OSM vs Overture drift).
    if ((phoneMatch || webMatch) && dist <= DUP_LOOSE_KM) return true;
    if (exactName && dist <= DUP_LOOSE_KM) return true;
    // Fuzzy name only within the tight radius.
    if (fuzzyName && dist <= DUP_TIGHT_KM) return true;
  }
  return false;
}

function findDuplicateIndex(
  candidate: DupCandidate,
  existing: DupCandidate[]
): number {
  const cPhone = normalizePhone(candidate.phone);
  const cWeb = normalizeWebHost(candidate.website);
  const cName = normalizeName(candidate.name);

  for (let i = 0; i < existing.length; i++) {
    const v = existing[i];
    const dist = haversineKm(candidate.coordinates, v.coordinates);
    if (dist > DUP_LOOSE_KM) continue;

    const phoneMatch =
      Boolean(cPhone) && cPhone === normalizePhone(v.phone);
    const webMatch =
      Boolean(cWeb) && cWeb === normalizeWebHost(v.website);
    const exactName = Boolean(cName) && cName === normalizeName(v.name);
    const fuzzyName = namesSimilar(candidate.name, v.name);

    if ((phoneMatch || webMatch) && dist <= DUP_LOOSE_KM) return i;
    if (exactName && dist <= DUP_LOOSE_KM) return i;
    if (fuzzyName && dist <= DUP_TIGHT_KM) return i;
  }
  return -1;
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
    const idx = findDuplicateIndex(v, deduped);
    if (idx >= 0) {
      // Prefer keeping OSM; merge contacts either way.
      if (v.source === 'osm' && deduped[idx].source === 'overture') {
        deduped[idx] = {
          ...v,
          phone: v.phone || deduped[idx].phone,
          website: v.website || deduped[idx].website,
        };
      } else {
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

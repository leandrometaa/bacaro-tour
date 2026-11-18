/**
 * Single data-access module for venues (OpenStreetMap + local enrichment).
 */
import type { Venue } from '../types';
import { getSavedVenue } from '../utils/storage';
import { applyEnrichment, applyEnrichmentToAll } from './enrichment';
import {
  fetchOsmVenueById,
  fetchOsmVenues,
  type OsmFetchResult,
} from './overpass';
import { QUICK_CITIES } from './quickCities';
import { findBundledVenueById, mergeRegionalVenues } from './regional';

export { QUICK_CITIES };
export { osmEditUrl, osmNoteUrl } from './overpass';
export type { OsmFetchResult };

/** In-memory OSM results for the current session */
let osmSessionCache: Venue[] = [];

export function setSessionVenues(venues: Venue[]): void {
  osmSessionCache = venues;
}

export function getSessionVenues(): Venue[] {
  return osmSessionCache;
}

/** Instant regional/Overture pool for the current area (no network). */
export function peekRegionalVenues(
  center: [number, number],
  radiusKm: number
): Venue[] {
  return applyEnrichmentToAll(mergeRegionalVenues([], center, radiusKm));
}

export async function loadVenues(
  center: [number, number],
  radiusKm: number,
  options?: { force?: boolean; signal?: AbortSignal }
): Promise<OsmFetchResult> {
  try {
    const result = await fetchOsmVenues(center, radiusKm, options);
    const merged = mergeRegionalVenues(result.venues, center, radiusKm);
    const venues = applyEnrichmentToAll(merged);
    setSessionVenues(venues);
    return { ...result, venues };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;

    // Offline / Overpass down: still serve regional + Overture bundles.
    const venues = peekRegionalVenues(center, radiusKm);
    if (venues.length === 0) throw err;

    setSessionVenues(venues);
    return { venues, truncated: false, stale: true };
  }
}

export function getVenueById(id: string): Venue | undefined {
  const fromSession = osmSessionCache.find((v) => v.id === id);
  if (fromSession) return fromSession;
  const fromSaved = getSavedVenue(id);
  if (fromSaved) return applyEnrichment(fromSaved);
  return undefined;
}

/** Resolve venue for deep links: cache → local bundles → Overpass (OSM ids). */
export async function loadVenueById(
  id: string,
  signal?: AbortSignal
): Promise<Venue | undefined> {
  const existing = getVenueById(id);
  if (existing) return existing;

  const bundled = findBundledVenueById(id);
  if (bundled) {
    const enriched = applyEnrichment(bundled);
    if (!osmSessionCache.some((v) => v.id === enriched.id)) {
      osmSessionCache = [...osmSessionCache, enriched];
    }
    return enriched;
  }

  try {
    const fetched = await fetchOsmVenueById(id, signal);
    if (!fetched) return undefined;
    const enriched = applyEnrichment(fetched);
    if (!osmSessionCache.some((v) => v.id === enriched.id)) {
      osmSessionCache = [...osmSessionCache, enriched];
    }
    return enriched;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return undefined;
  }
}

function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

export function searchVenues(query: string, pool?: Venue[]): Venue[] {
  const q = normalizeSearch(query);
  if (!q) return [];

  const source = pool ?? osmSessionCache;
  return source.filter((v) => {
    const haystack = [v.name, v.city, ...v.tags, ...(v.cuisine ?? [])]
      .map(normalizeSearch)
      .join(' ');
    return haystack.includes(q);
  });
}

export function getVenuesInRadius(
  venues: Venue[],
  center: [number, number],
  radiusKm: number
): Venue[] {
  void center;
  void radiusKm;
  return venues;
}

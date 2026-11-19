/**
 * Single data-access module for venues (OpenStreetMap + local enrichment).
 */
import type { Venue } from '../types';
import { getSavedVenue } from '../utils/storage';
import { applyEnrichment, applyEnrichmentToAll } from './enrichment';
import {
  fetchOsmVenueById,
  fetchOsmVenues,
  VENUE_DISPLAY_CAP,
  type OsmFetchResult,
} from './overpass';
import { QUICK_CITIES } from './quickCities';
import { findBundledVenueById, mergeRegionalVenues } from './regional';
import { fetchSupabaseVenues } from './supabaseVenues';
import { haversineKm } from '../utils/geo';

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

function prioritizeAndCap(
  venues: Venue[],
  center: [number, number]
): { venues: Venue[]; truncated: boolean } {
  // Cap by distance first so "vicini" stays meaningful; hours/contacts only
  // break ties among equally near venues.
  const scored = [...venues].sort((a, b) => {
    const distA = haversineKm(center, a.coordinates);
    const distB = haversineKm(center, b.coordinates);
    if (distA !== distB) return distA - distB;
    const richness = (v: Venue) =>
      (v.hasHours ? 2 : 0) + (v.phone ? 1 : 0) + (v.website ? 1 : 0);
    return richness(b) - richness(a);
  });
  const truncated = scored.length > VENUE_DISPLAY_CAP;
  return { venues: scored.slice(0, VENUE_DISPLAY_CAP), truncated };
}

function finalizeResult(
  live: OsmFetchResult,
  center: [number, number],
  radiusKm: number
): OsmFetchResult {
  const merged = applyEnrichmentToAll(
    mergeRegionalVenues(live.venues, center, radiusKm)
  );
  const capped = prioritizeAndCap(merged, center);
  setSessionVenues(capped.venues);
  return {
    ...live,
    venues: capped.venues,
    truncated: live.truncated || capped.truncated,
  };
}

/** Instant regional/Overture pool for the current area (no network). */
export function peekRegionalVenues(
  center: [number, number],
  radiusKm: number
): Venue[] {
  const merged = applyEnrichmentToAll(mergeRegionalVenues([], center, radiusKm));
  return prioritizeAndCap(merged, center).venues;
}

export async function loadVenues(
  center: [number, number],
  radiusKm: number,
  options?: {
    force?: boolean;
    signal?: AbortSignal;
    /** Progressive upgrade: offline → Supabase → live Overpass. */
    onPartial?: (result: OsmFetchResult) => void;
  }
): Promise<OsmFetchResult> {
  let liveSettled = false;

  const emitPartial = (result: OsmFetchResult) => {
    if (liveSettled) return;
    if (options?.signal?.aborted) return;
    options?.onPartial?.(result);
  };

  // Fire Supabase in parallel; never block the Overpass path on it.
  const supabasePromise = fetchSupabaseVenues(center, radiusKm, {
    signal: options?.signal,
  })
    .then((cached) => {
      if (!cached || cached.venues.length === 0) return null;
      // Live Overpass already won — do not clobber session cache.
      if (liveSettled || options?.signal?.aborted) return null;
      const result = finalizeResult(cached, center, radiusKm);
      emitPartial(result);
      return result;
    })
    .catch((err) => {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      return null;
    });

  try {
    const result = await fetchOsmVenues(center, radiusKm, options);
    liveSettled = true;
    return finalizeResult(result, center, radiusKm);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;

    const fromSupabase = await supabasePromise;
    if (fromSupabase && fromSupabase.venues.length > 0) {
      return fromSupabase;
    }

    // Offline packs as last resort when Overpass + Supabase both fail.
    const merged = applyEnrichmentToAll(mergeRegionalVenues([], center, radiusKm));
    if (merged.length === 0) throw err;
    const capped = prioritizeAndCap(merged, center);
    setSessionVenues(capped.venues);
    return { venues: capped.venues, truncated: capped.truncated, stale: true };
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

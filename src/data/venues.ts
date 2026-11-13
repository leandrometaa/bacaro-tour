/**
 * Single data-access module for venues.
 * Swap between OpenStreetMap (default) and offline demo data.
 */
import type { Venue } from '../types';
import {
  DEMO_CITIES,
  demoVenues,
  getDemoVenueById,
  getDemoVenuesInRadius,
  searchDemoVenues,
} from './demoVenues';
import { fetchOsmVenues } from './overpass';

export { DEMO_CITIES };
export { osmEditUrl, osmNoteUrl } from './overpass';

export type DataMode = 'osm' | 'demo';

const MODE_KEY = 'bacaro_tour_data_mode';

export function getDataMode(): DataMode {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === 'demo' || stored === 'osm') return stored;
  } catch {
    /* ignore */
  }
  return 'osm';
}

export function setDataMode(mode: DataMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** In-memory OSM results for the current session (keyed by query) */
let osmSessionCache: Venue[] = [];

export function setSessionVenues(venues: Venue[]): void {
  osmSessionCache = venues;
}

export function getSessionVenues(): Venue[] {
  return osmSessionCache;
}

export async function loadVenues(
  center: [number, number],
  radiusKm: number,
  mode: DataMode = getDataMode(),
  options?: { force?: boolean }
): Promise<Venue[]> {
  if (mode === 'demo') {
    const venues = getDemoVenuesInRadius(center, radiusKm);
    setSessionVenues(venues);
    return venues;
  }

  const venues = await fetchOsmVenues(center, radiusKm, options);
  setSessionVenues(venues);
  return venues;
}

export function getVenueById(id: string): Venue | undefined {
  const fromSession = osmSessionCache.find((v) => v.id === id);
  if (fromSession) return fromSession;
  return getDemoVenueById(id);
}

export function searchVenues(query: string, pool?: Venue[]): Venue[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const source = pool ?? (osmSessionCache.length ? osmSessionCache : demoVenues);
  return source.filter(
    (v) =>
      v.name.toLowerCase().includes(q) ||
      v.city.toLowerCase().includes(q) ||
      v.tags.some((t) => t.toLowerCase().includes(q)) ||
      (v.cuisine ?? []).some((c) => c.toLowerCase().includes(q))
  );
}

export function getVenuesInRadius(
  venues: Venue[],
  center: [number, number],
  radiusKm: number
): Venue[] {
  // Venues already fetched for radius; filter is a no-op safety net
  void center;
  void radiusKm;
  return venues;
}

export { searchDemoVenues };

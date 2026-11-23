/**
 * Read-through cache of venues from Supabase PostgREST (bbox query).
 * Used before live Overpass; failures are silent so the UI never blocks.
 */
import type { Venue } from '../types';
import { haversineKm } from '../utils/geo';
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  SUPABASE_VENUES_TIMEOUT_MS,
} from './supabaseConfig';
import { venueFromOsmElement, type OsmFetchResult } from './overpass';

export interface SupabaseVenueRow {
  id: string;
  source: string | null;
  city: string | null;
  lat: number;
  lon: number;
  name: string | null;
  kind: string | null;
  tags: Record<string, unknown> | null;
  /** ISO timestamp from the cache row; used for freshness. */
  updated_at?: string | null;
}

/** Cache rows older than this are treated as stale in the UI. */
export const SUPABASE_FRESHNESS_MS = 24 * 60 * 60 * 1000;

/** True when the newest `updated_at` among rows is missing or older than the TTL. */
export function isSupabaseResultStale(
  rows: Pick<SupabaseVenueRow, 'updated_at'>[],
  nowMs: number = Date.now()
): boolean {
  let newest: number | null = null;
  for (const row of rows) {
    if (!row.updated_at) continue;
    const ts = Date.parse(row.updated_at);
    if (!Number.isFinite(ts)) continue;
    if (newest === null || ts > newest) newest = ts;
  }
  if (newest === null) return true;
  return nowMs - newest > SUPABASE_FRESHNESS_MS;
}

const OSM_CACHE_ID_RE = /^osm:(node|way|relation)\/(\d+)$/;
const OVERTURE_CACHE_ID_RE = /^overture:(.+)$/;

function bboxForRadius(
  lat: number,
  lon: number,
  radiusKm: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const dLat = radiusKm / 111.32;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLon = radiusKm / (111.32 * Math.max(cos, 0.01));
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLon: lon - dLon,
    maxLon: lon + dLon,
  };
}

function tagsAsStrings(
  tags: Record<string, unknown> | null | undefined,
  fallbackName?: string | null
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  if (tags && typeof tags === 'object') {
    for (const [key, value] of Object.entries(tags)) {
      if (value == null) continue;
      out[key] = typeof value === 'string' ? value : String(value);
    }
  }
  if (!out.name && fallbackName) out.name = fallbackName;
  return out;
}

/** Convert a Supabase cache row into the app Venue type. */
export function venueFromSupabaseRow(row: SupabaseVenueRow): Venue | null {
  if (row.lat == null || row.lon == null) return null;
  const tags = tagsAsStrings(row.tags, row.name);
  if (!tags.name) return null;

  // Prefer city column when tags lack addr:city.
  if (!tags['addr:city'] && row.city) tags['addr:city'] = row.city;

  const osmMatch = row.id.match(OSM_CACHE_ID_RE);
  if (osmMatch) {
    const osmType = osmMatch[1] as 'node' | 'way' | 'relation';
    const osmId = Number(osmMatch[2]);
    return venueFromOsmElement(
      { type: osmType, id: osmId, lat: row.lat, lon: row.lon, tags },
      { source: 'osm' }
    );
  }

  const overtureMatch = row.id.match(OVERTURE_CACHE_ID_RE);
  if (overtureMatch) {
    const appId = `overture-${overtureMatch[1]}`;
    return venueFromOsmElement(
      {
        type: 'node',
        id: 0,
        lat: row.lat,
        lon: row.lon,
        tags,
      },
      { source: 'overture', id: appId }
    );
  }

  // Unknown id scheme — still try to parse tags as OSM-like.
  const source = row.source === 'overture' ? 'overture' : 'osm';
  return venueFromOsmElement(
    { type: 'node', id: 0, lat: row.lat, lon: row.lon, tags },
    { source, id: row.id }
  );
}

/**
 * Fetch venues in a radius via PostgREST bbox filter on lat/lon.
 * ~6s timeout; returns null on any failure (caller keeps offline / waits for Overpass).
 */
export async function fetchSupabaseVenues(
  center: [number, number],
  radiusKm: number,
  options?: { signal?: AbortSignal }
): Promise<OsmFetchResult | null> {
  const [lat, lon] = center;
  const { minLat, maxLat, minLon, maxLon } = bboxForRadius(lat, lon, radiusKm);

  const params = new URLSearchParams();
  params.set('select', 'id,source,city,lat,lon,name,kind,tags,updated_at');
  // PostgREST AND across lat/lon bounds (indexes on lat, lon).
  // Prefer fresher rows when the 1000-row cap truncates a dense bbox.
  params.set(
    'and',
    `(lat.gte.${minLat},lat.lte.${maxLat},lon.gte.${minLon},lon.lte.${maxLon})`
  );
  params.set('order', 'updated_at.desc.nullslast');
  params.set('limit', '1000');

  const url = `${SUPABASE_URL}/rest/v1/venues?${params.toString()}`;

  const timeoutController = new AbortController();
  const onAbort = () => timeoutController.abort();
  options?.signal?.addEventListener('abort', onAbort, { once: true });
  const timeoutId = globalThis.setTimeout(
    () => timeoutController.abort(),
    SUPABASE_VENUES_TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        Accept: 'application/json',
      },
      signal: timeoutController.signal,
    });

    if (!response.ok) return null;

    const rows = (await response.json()) as SupabaseVenueRow[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return { venues: [], truncated: false, stale: true };
    }

    const seen = new Set<string>();
    const venues: Venue[] = [];
    for (const row of rows) {
      const venue = venueFromSupabaseRow(row);
      if (!venue) continue;
      if (seen.has(venue.id)) continue;
      seen.add(venue.id);
      if (haversineKm(center, venue.coordinates) > radiusKm) continue;
      venues.push(venue);
    }

    venues.sort(
      (a, b) =>
        haversineKm(center, a.coordinates) - haversineKm(center, b.coordinates)
    );

    return {
      venues,
      truncated: rows.length >= 1000,
      stale: isSupabaseResultStale(rows),
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (options?.signal?.aborted) throw err;
      return null;
    }
    return null;
  } finally {
    globalThis.clearTimeout(timeoutId);
    options?.signal?.removeEventListener('abort', onAbort);
  }
}

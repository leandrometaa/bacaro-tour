import type { Venue } from '../types';
import { haversineKm } from './geo';
import { getClosingInfo, isVenueOpenNow } from './openingHours';

export interface GiroStop {
  venue: Venue;
  distanceFromPrevKm: number;
  closesInMinutes: number | null;
}

export interface GiroPlan {
  stops: GiroStop[];
  /** Straight-line total (always present). */
  totalWalkKm: number;
  /** Pedestrian route polyline [lat,lon] when OSRM succeeds. */
  routePath?: [number, number][];
  /** Walking distance from OSRM when available. */
  walkingKm?: number;
  /** Estimated walking minutes from OSRM. */
  walkingMin?: number;
}

const GIRO_STORAGE_KEY = 'bacaro_tour_giro';

function venuePool(venues: Venue[], need: number, at: Date): Venue[] {
  const open = venues.filter((v) => v.hasHours && isVenueOpenNow(v, at));
  return open.length >= need ? open : [...venues];
}

/** Recalculate hop distances and closing info along a fixed venue sequence. */
export function planFromVenues(
  center: [number, number],
  venues: Venue[],
  at = new Date()
): GiroPlan | null {
  if (venues.length < 3) return null;
  const stops: GiroStop[] = [];
  let cursor = center;
  let totalWalkKm = 0;
  for (const venue of venues) {
    const distanceFromPrevKm = haversineKm(cursor, venue.coordinates);
    totalWalkKm += distanceFromPrevKm;
    const closing = getClosingInfo(venue, at);
    stops.push({
      venue,
      distanceFromPrevKm,
      closesInMinutes: closing?.closesIn ?? null,
    });
    cursor = venue.coordinates;
  }
  return { stops, totalWalkKm };
}

/**
 * Greedy walking tour: nearest open venues from the user, hop by hop.
 */
export function buildGiro(
  center: [number, number],
  venues: Venue[],
  stopCount: number,
  at = new Date()
): GiroPlan | null {
  const n = Math.min(5, Math.max(3, stopCount));
  const pool = venuePool(venues, n, at);
  if (pool.length < 3) return null;

  const remaining = [...pool];
  const picked: Venue[] = [];
  let cursor = center;

  for (let i = 0; i < n && remaining.length; i++) {
    remaining.sort(
      (a, b) =>
        haversineKm(cursor, a.coordinates) -
        haversineKm(cursor, b.coordinates)
    );
    // Pick among the 3 nearest so “Rigenera” can vary the route
    const pickCount = Math.min(3, remaining.length);
    const pickIdx = Math.floor(Math.random() * pickCount);
    const [venue] = remaining.splice(pickIdx, 1);
    picked.push(venue);
    cursor = venue.coordinates;
  }

  return planFromVenues(center, picked, at);
}

/**
 * Replace a single stop with the next nearest unused candidate.
 * Returns null if no alternative is available.
 */
export function replaceGiroStop(
  plan: GiroPlan,
  center: [number, number],
  stopIndex: number,
  venues: Venue[],
  at = new Date()
): GiroPlan | null {
  if (stopIndex < 0 || stopIndex >= plan.stops.length) return null;

  const used = new Set(plan.stops.map((s) => s.venue.id));
  const pool = venuePool(venues, plan.stops.length, at).filter(
    (v) => !used.has(v.id)
  );
  if (pool.length === 0) return null;

  const prevCoord =
    stopIndex === 0 ? center : plan.stops[stopIndex - 1].venue.coordinates;
  pool.sort(
    (a, b) =>
      haversineKm(prevCoord, a.coordinates) -
      haversineKm(prevCoord, b.coordinates)
  );
  const pickCount = Math.min(5, pool.length);
  const replacement = pool[Math.floor(Math.random() * pickCount)];

  const nextVenues = plan.stops.map((s) => s.venue);
  nextVenues[stopIndex] = replacement;
  return planFromVenues(center, nextVenues, at);
}

/** Remove a stop (skip). Needs at least 3 stops remaining. */
export function skipGiroStop(
  plan: GiroPlan,
  center: [number, number],
  stopIndex: number,
  at = new Date()
): GiroPlan | null {
  if (plan.stops.length <= 3) return null;
  if (stopIndex < 0 || stopIndex >= plan.stops.length) return null;
  const nextVenues = plan.stops
    .filter((_, i) => i !== stopIndex)
    .map((s) => s.venue);
  return planFromVenues(center, nextVenues, at);
}

interface SavedGiro {
  center: [number, number];
  stopCount: number;
  venueIds: string[];
  savedAt: number;
}

export function saveGiroPlan(
  center: [number, number],
  plan: GiroPlan
): void {
  try {
    const payload: SavedGiro = {
      center,
      stopCount: plan.stops.length,
      venueIds: plan.stops.map((s) => s.venue.id),
      savedAt: Date.now(),
    };
    localStorage.setItem(GIRO_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function loadGiroPlan(
  center: [number, number],
  venues: Venue[],
  at = new Date()
): GiroPlan | null {
  try {
    const raw = localStorage.getItem(GIRO_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedGiro;
    if (
      !saved?.venueIds?.length ||
      !Array.isArray(saved.center) ||
      saved.venueIds.length < 3
    ) {
      return null;
    }
    // Same search area (±~1 km)
    if (
      Math.abs(saved.center[0] - center[0]) > 0.01 ||
      Math.abs(saved.center[1] - center[1]) > 0.01
    ) {
      return null;
    }
    const byId = new Map(venues.map((v) => [v.id, v]));
    const ordered: Venue[] = [];
    for (const id of saved.venueIds) {
      const v = byId.get(id);
      if (!v) return null;
      ordered.push(v);
    }
    return planFromVenues(center, ordered, at);
  } catch {
    return null;
  }
}

export function clearSavedGiro(): void {
  try {
    localStorage.removeItem(GIRO_STORAGE_KEY);
  } catch {
    // ignore
  }
}

const MAX_GIRO_STOPS = 6;

/** Append a venue to the saved giro draft (creates a 1-stop draft if empty). */
export function appendVenueToSavedGiro(
  center: [number, number],
  venue: Venue
): { ok: true; count: number } | { ok: false; reason: 'full' | 'duplicate' } {
  try {
    const raw = localStorage.getItem(GIRO_STORAGE_KEY);
    let venueIds: string[] = [];
    if (raw) {
      const saved = JSON.parse(raw) as SavedGiro;
      if (Array.isArray(saved?.venueIds)) venueIds = [...saved.venueIds];
    }
    if (venueIds.includes(venue.id)) return { ok: false, reason: 'duplicate' };
    if (venueIds.length >= MAX_GIRO_STOPS) return { ok: false, reason: 'full' };
    venueIds.push(venue.id);
    const payload: SavedGiro = {
      center,
      stopCount: venueIds.length,
      venueIds,
      savedAt: Date.now(),
    };
    localStorage.setItem(GIRO_STORAGE_KEY, JSON.stringify(payload));
    return { ok: true, count: venueIds.length };
  } catch {
    return { ok: false, reason: 'full' };
  }
}

export function formatClosesIn(minutes: number | null): string {
  if (minutes == null) return 'Orario non noto';
  if (minutes <= 0) return 'Chiude ora';
  if (minutes < 60) return `Chiude tra ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `Chiude tra ${h}h ${m} min` : `Chiude tra ${h}h`;
}

/**
 * Walking route estimates for the Giro.
 *
 * Public OSRM demo is not a reliable foot backend (profile may be car-like).
 * We prefer a declared air→walk heuristic; OSRM is best-effort only.
 */
import { haversineKm } from './geo';

export interface WalkingLeg {
  distanceKm: number;
  durationMin: number;
}

export interface WalkingRoute {
  coordinates: [number, number][]; // [lat, lon]
  distanceKm: number;
  durationMin: number;
  legs: WalkingLeg[];
  /** True when path is haversine-based, not a real street graph. */
  estimated?: boolean;
}

/** Detour factor air → typical urban walking. */
const WALK_DETOUR = 1.35;
/** Average walking speed km/h. */
const WALK_KMH = 4.5;

function toLonLat(points: [number, number][]): string {
  return points.map(([lat, lon]) => `${lon},${lat}`).join(';');
}

/** Straight-line path with urban walking time (~). */
export function estimateWalkingRoute(
  points: [number, number][]
): WalkingRoute | null {
  if (points.length < 2) return null;
  const legs: WalkingLeg[] = [];
  let distanceKm = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const air = haversineKm(points[i], points[i + 1]);
    const walk = air * WALK_DETOUR;
    distanceKm += walk;
    legs.push({
      distanceKm: walk,
      durationMin: Math.max(1, Math.round((walk / WALK_KMH) * 60)),
    });
  }
  return {
    coordinates: points,
    distanceKm,
    durationMin: Math.max(1, Math.round((distanceKm / WALK_KMH) * 60)),
    legs,
    estimated: true,
  };
}

async function tryOsrmWalkingRoute(
  points: [number, number][],
  signal?: AbortSignal
): Promise<WalkingRoute | null> {
  const url =
    `https://router.project-osrm.org/route/v1/foot/${toLonLat(points)}` +
    `?overview=full&geometries=geojson&steps=false`;

  try {
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates?: [number, number][] };
        legs?: Array<{ distance: number; duration: number }>;
      }>;
    };
    const route = data.routes?.[0];
    if (!route || data.code !== 'Ok') return null;

    const coords = (route.geometry?.coordinates ?? []).map(
      ([lon, lat]) => [lat, lon] as [number, number]
    );
    if (coords.length < 2) return null;

    return {
      coordinates: coords,
      distanceKm: route.distance / 1000,
      durationMin: Math.round(route.duration / 60),
      legs: (route.legs ?? []).map((leg) => ({
        distanceKm: leg.distance / 1000,
        durationMin: Math.round(leg.duration / 60),
      })),
      estimated: false,
    };
  } catch {
    return null;
  }
}

/**
 * Best-effort street route, then honest walking estimate.
 * Callers must treat results as approximate (~).
 */
export async function fetchWalkingRoute(
  points: [number, number][],
  signal?: AbortSignal
): Promise<WalkingRoute | null> {
  if (points.length < 2) return null;
  const osrm = await tryOsrmWalkingRoute(points, signal);
  if (osrm) return osrm;
  return estimateWalkingRoute(points);
}

export function walkingDirectionsUrl(
  from: [number, number],
  to: [number, number]
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from[0]},${from[1]}&destination=${to[0]},${to[1]}&travelmode=walking`;
}

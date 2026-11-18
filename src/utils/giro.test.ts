import { describe, expect, it } from 'vitest';
import type { Venue } from '../types';
import { buildGiro, replaceGiroStop } from './giro';

function venue(
  id: string,
  lat: number,
  lon: number,
  openRaw = '24/7'
): Venue {
  return {
    id,
    name: id,
    type: 'bar',
    address: 'Via',
    city: 'Venezia',
    coordinates: [lat, lon],
    openingHoursRaw: openRaw,
    hours: null,
    tags: [],
    moods: ['aperitivo'],
    photos: [],
    hasHours: Boolean(openRaw),
    source: 'osm',
  };
}

describe('buildGiro', () => {
  it('builds a 3-stop nearest-neighbour tour', () => {
    const center: [number, number] = [45.44, 12.33];
    const venues = [
      venue('a', 45.441, 12.331),
      venue('b', 45.442, 12.332),
      venue('c', 45.443, 12.333),
      venue('d', 45.45, 12.34),
    ];
    const plan = buildGiro(center, venues, 3);
    expect(plan).not.toBeNull();
    expect(plan!.stops).toHaveLength(3);
    expect(new Set(plan!.stops.map((s) => s.venue.id)).size).toBe(3);
    expect(plan!.totalWalkKm).toBeGreaterThan(0);
  });

  it('returns null with too few venues', () => {
    expect(buildGiro([45.44, 12.33], [venue('a', 45.441, 12.331)], 3)).toBeNull();
  });

  it('replaces a single stop and keeps the others', () => {
    const center: [number, number] = [45.44, 12.33];
    const venues = [
      venue('a', 45.441, 12.331),
      venue('b', 45.442, 12.332),
      venue('c', 45.443, 12.333),
      venue('d', 45.4415, 12.3315),
      venue('e', 45.4425, 12.3325),
    ];
    const plan = buildGiro(center, venues, 3);
    expect(plan).not.toBeNull();
    const originalIds = plan!.stops.map((s) => s.venue.id);
    const next = replaceGiroStop(plan!, center, 1, venues);
    expect(next).not.toBeNull();
    expect(next!.stops).toHaveLength(3);
    expect(next!.stops[0].venue.id).toBe(originalIds[0]);
    expect(next!.stops[2].venue.id).toBe(originalIds[2]);
    expect(next!.stops[1].venue.id).not.toBe(originalIds[1]);
  });
});

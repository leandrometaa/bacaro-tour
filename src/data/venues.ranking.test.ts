import { describe, expect, it } from 'vitest';
import { haversineKm } from '../utils/geo';
import { peekRegionalVenues } from './venues';

describe('prioritizeAndCap distance-first', () => {
  it('keeps nearer venues ahead of farther ones in peek results', () => {
    const center: [number, number] = [45.438, 10.992]; // Verona
    const venues = peekRegionalVenues(center, 3);
    expect(venues.length).toBeGreaterThan(5);

    const distances = venues.map((v) => haversineKm(center, v.coordinates));
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1] - 1e-9);
    }
  });
});

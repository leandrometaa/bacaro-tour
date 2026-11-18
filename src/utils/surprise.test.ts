import { describe, expect, it } from 'vitest';
import type { Venue } from '../types';
import { pickSurpriseVenue } from './surprise';

const venues: Venue[] = [
  {
    id: 'a',
    name: 'A',
    type: 'bar',
    address: '1',
    city: 'Venezia',
    coordinates: [45, 12],
    hours: null,
    tags: [],
    moods: ['aperitivo'],
    photos: [],
    hasHours: false,
    source: 'osm',
  },
  {
    id: 'b',
    name: 'B',
    type: 'bar',
    address: '2',
    city: 'Venezia',
    coordinates: [45, 12],
    hours: null,
    tags: [],
    moods: ['aperitivo'],
    photos: [],
    hasHours: false,
    source: 'osm',
  },
];

describe('pickSurpriseVenue', () => {
  it('returns null for empty pool', () => {
    expect(pickSurpriseVenue([])).toBeNull();
  });

  it('returns the only venue', () => {
    expect(pickSurpriseVenue([venues[0]])?.id).toBe('a');
  });

  it('can exclude current venue when alternatives exist', () => {
    const pick = pickSurpriseVenue(venues, 'a');
    expect(pick?.id).toBe('b');
  });
});

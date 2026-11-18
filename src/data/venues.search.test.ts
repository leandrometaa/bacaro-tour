import { describe, expect, it } from 'vitest';
import { searchVenues, setSessionVenues } from './venues';
import type { Venue } from '../types';
import { buildWeeklyHours } from '../utils/openingHours';

function venue(partial: Partial<Venue> & Pick<Venue, 'id' | 'name'>): Venue {
  return {
    type: 'bar',
    address: 'Via Roma 1',
    city: 'Venezia',
    coordinates: [45.44, 12.33],
    hours: null,
    tags: [],
    moods: ['aperitivo'],
    photos: [],
    hasHours: false,
    source: 'osm',
    ...partial,
  };
}

describe('searchVenues accent-insensitive', () => {
  it('matches café without accent', () => {
    const pool = [
      venue({
        id: '1',
        name: 'Café Florian',
        tags: ['aperitivo'],
        hours: buildWeeklyHours(null),
      }),
      venue({ id: '2', name: 'Osteria da Luca', city: 'Padova' }),
    ];
    setSessionVenues(pool);
    const hits = searchVenues('cafe', pool);
    expect(hits.map((v) => v.id)).toContain('1');
  });

  it('matches city with accent stripped', () => {
    const pool = [venue({ id: '3', name: 'Bar Centrale', city: 'Città' })];
    const hits = searchVenues('citta', pool);
    expect(hits).toHaveLength(1);
  });
});

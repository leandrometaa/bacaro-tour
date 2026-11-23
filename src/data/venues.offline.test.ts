import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./overpass', async () => {
  const actual = await vi.importActual<typeof import('./overpass')>('./overpass');
  return {
    ...actual,
    fetchOsmVenues: vi.fn(async () => {
      throw new Error('Overpass down');
    }),
  };
});

vi.mock('./supabaseVenues', async () => {
  const actual = await vi.importActual<typeof import('./supabaseVenues')>(
    './supabaseVenues'
  );
  return {
    ...actual,
    fetchSupabaseVenues: vi.fn(async () => null),
  };
});

import { fetchOsmVenues } from './overpass';
import { fetchSupabaseVenues } from './supabaseVenues';
import { loadVenues, setSessionVenues } from './venues';

describe('loadVenues offline fallback', () => {
  beforeEach(() => {
    setSessionVenues([]);
    vi.mocked(fetchOsmVenues).mockClear();
    vi.mocked(fetchSupabaseVenues).mockClear();
    vi.mocked(fetchSupabaseVenues).mockResolvedValue(null);
  });

  it('serves regional/overture venues when Overpass and Supabase fail', async () => {
    const result = await loadVenues([45.4064, 11.8768], 5);
    expect(result.stale).toBe(true);
    expect(result.venues.length).toBeGreaterThan(0);
  });

  it('prefers a fresh Supabase cache when Overpass fails', async () => {
    vi.mocked(fetchSupabaseVenues).mockResolvedValue({
      venues: [
        {
          id: 'osm-node-1',
          name: 'Bar Test',
          type: 'bar',
          coordinates: [45.4064, 11.8768],
          address: '',
          city: 'Padova',
          hours: null,
          tags: [],
          moods: [],
          photos: [],
          hasHours: false,
          source: 'osm',
        },
      ],
      truncated: false,
      stale: false,
    });

    const result = await loadVenues([45.4064, 11.8768], 5);
    expect(result.stale).toBe(false);
    expect(result.venues.some((v) => v.id === 'osm-node-1')).toBe(true);
  });
});

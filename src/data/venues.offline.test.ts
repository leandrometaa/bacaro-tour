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

import { fetchOsmVenues } from './overpass';
import { loadVenues, setSessionVenues } from './venues';

describe('loadVenues offline fallback', () => {
  beforeEach(() => {
    setSessionVenues([]);
    vi.mocked(fetchOsmVenues).mockClear();
  });

  it('serves regional/overture venues when Overpass fails', async () => {
    const result = await loadVenues([45.4064, 11.8768], 5);
    expect(result.stale).toBe(true);
    expect(result.venues.length).toBeGreaterThan(0);
  });
});

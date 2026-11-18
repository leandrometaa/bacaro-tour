import { beforeEach, describe, expect, it } from 'vitest';
import type { Venue } from '../types';
import {
  addToList,
  exportUserDataJson,
  getSavedVenue,
  getUserData,
  importUserDataJson,
  StorageError,
} from './storage';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    key: (i: number) => [...store.keys()][i] ?? null,
  };
});

const venue: Venue = {
  id: 'demo-1',
  name: 'Bacaro Test',
  type: 'bar',
  address: 'Calle 1',
  city: 'Venezia',
  coordinates: [45.44, 12.33],
  hours: null,
  tags: ['bacaro'],
  moods: ['aperitivo'],
  photos: [],
  hasHours: false,
  source: 'osm',
};

describe('storage snapshots', () => {
  it('migrates old payloads without venuesById', () => {
    store.set(
      'bacaro_tour_user_data',
      JSON.stringify({
        lists: [
          {
            id: 'preferiti',
            name: 'Preferiti',
            venueIds: [],
            createdAt: '2020-01-01',
          },
        ],
        visits: [],
      })
    );
    const data = getUserData();
    expect(data.version).toBe(3);
    expect(data.venuesById).toEqual({});
  });

  it('stores venue snapshot when adding to list', () => {
    addToList('preferiti', venue);
    expect(getSavedVenue('demo-1')?.name).toBe('Bacaro Test');
  });

  it('round-trips export/import', () => {
    addToList('preferiti', venue);
    const json = exportUserDataJson();
    store.clear();
    importUserDataJson(json);
    expect(getSavedVenue('demo-1')?.name).toBe('Bacaro Test');
  });

  it('rejects invalid import', () => {
    expect(() => importUserDataJson('{not-json')).toThrow(StorageError);
    expect(() => importUserDataJson('{"foo":1}')).toThrow(StorageError);
  });
});

import { describe, expect, it } from 'vitest';
import type { Venue } from '../types';
import {
  completeFromRegional,
  mergeRegionalVenues,
  regionalBundleStats,
} from './regional';

const base: Venue = {
  id: 'osm-node-test-live',
  name: 'Locale Test',
  type: 'bar',
  address: 'Via Roma 1',
  city: 'Padova',
  coordinates: [45.4064, 11.8768],
  hours: null,
  tags: ['bar'],
  moods: ['aperitivo'],
  photos: ['category:bar'],
  hasHours: false,
  source: 'osm',
};

describe('regional bundle', () => {
  it('exposes stats for the bundled dataset', () => {
    const stats = regionalBundleStats();
    expect(stats.total).toBeGreaterThanOrEqual(0);
    expect(stats.withPhone).toBeLessThanOrEqual(stats.total);
  });

  it('completeFromRegional is a no-op for unknown ids', () => {
    expect(completeFromRegional(base)).toEqual(base);
  });

  it('mergeRegionalVenues keeps live venues', () => {
    const merged = mergeRegionalVenues([base], [45.4064, 11.8768], 5);
    expect(merged.some((v) => v.id === base.id)).toBe(true);
  });

  it('exposes overture stats fields', () => {
    const stats = regionalBundleStats();
    expect(stats.overtureNovel).toBeGreaterThanOrEqual(0);
    expect(stats.overtureHints).toBeGreaterThanOrEqual(0);
  });

  it('mergeRegionalVenues dedupes near-identical names', () => {
    const twin: Venue = {
      ...base,
      id: 'overture-dup-test',
      source: 'overture',
      coordinates: [45.40645, 11.87685],
    };
    const merged = mergeRegionalVenues(
      [base, twin],
      [45.4064, 11.8768],
      5
    );
    const named = merged.filter((v) => v.name === base.name);
    expect(named.length).toBe(1);
    expect(named[0].source).toBe('osm');
  });
});


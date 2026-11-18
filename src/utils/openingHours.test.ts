import { describe, expect, it } from 'vitest';
import type { Venue } from '../types';
import {
  buildWeeklyHours,
  formatDayHours,
  getOpeningState,
} from './openingHours';

function stubVenue(raw: string | null): Venue {
  return {
    id: 't1',
    name: 'Test',
    type: 'bar',
    address: 'Via Test 1',
    city: 'Venezia',
    coordinates: [45.44, 12.33],
    openingHoursRaw: raw,
    hours: buildWeeklyHours(raw),
    tags: [],
    moods: ['aperitivo'],
    photos: [],
    hasHours: Boolean(raw),
    source: 'osm',
  };
}

describe('buildWeeklyHours', () => {
  it('keeps double shifts as separate intervals', () => {
    const hours = buildWeeklyHours(
      'Mo-Fr 12:00-15:00,19:00-23:00; Sa-Su 12:00-23:00'
    );
    expect(hours).not.toBeNull();
    const monday = hours!.lunedi;
    expect(monday).not.toBeNull();
    expect(monday!.intervals.length).toBeGreaterThanOrEqual(2);
    expect(formatDayHours(monday!)).toContain('12:00');
    expect(formatDayHours(monday!)).toContain('19:00');
  });

  it('returns null for empty hours', () => {
    expect(buildWeeklyHours(null)).toBeNull();
    expect(buildWeeklyHours('')).toBeNull();
  });
});

describe('getOpeningState', () => {
  it('returns unknown without hours', () => {
    expect(getOpeningState(stubVenue(null))).toBe('unknown');
  });

  it('returns open or closed for 24/7', () => {
    expect(getOpeningState(stubVenue('24/7'))).toBe('open');
  });
});

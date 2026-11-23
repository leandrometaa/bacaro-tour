import { describe, expect, it } from 'vitest';
import {
  SUPABASE_FRESHNESS_MS,
  isSupabaseResultStale,
} from './supabaseVenues';

describe('isSupabaseResultStale', () => {
  const now = Date.parse('2026-11-23T12:00:00.000Z');

  it('is stale when no updated_at is present', () => {
    expect(isSupabaseResultStale([{ updated_at: null }], now)).toBe(true);
    expect(isSupabaseResultStale([{}], now)).toBe(true);
  });

  it('is fresh when the newest row is within the TTL', () => {
    const recent = new Date(now - SUPABASE_FRESHNESS_MS / 2).toISOString();
    expect(isSupabaseResultStale([{ updated_at: recent }], now)).toBe(false);
  });

  it('is stale when all rows are older than the TTL', () => {
    const old = new Date(now - SUPABASE_FRESHNESS_MS - 1).toISOString();
    expect(isSupabaseResultStale([{ updated_at: old }], now)).toBe(true);
  });

  it('uses the newest updated_at among rows', () => {
    const old = new Date(now - SUPABASE_FRESHNESS_MS * 2).toISOString();
    const recent = new Date(now - 60_000).toISOString();
    expect(
      isSupabaseResultStale(
        [{ updated_at: old }, { updated_at: recent }],
        now
      )
    ).toBe(false);
  });
});

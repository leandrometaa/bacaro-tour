import { describe, expect, it } from 'vitest';
import {
  CACHE_FULL,
  CACHE_NO_STORE,
  CACHE_PARTIAL,
  FALLBACK_TIMEOUT_MS,
  RACE_TIMEOUT_MS,
  cacheControlForValidated,
  isBadRemark,
  validateOverpassPayload,
} from './overpass';

describe('Overpass proxy payload validation', () => {
  it('rejects non-objects and missing elements arrays', () => {
    expect(validateOverpassPayload(null).ok).toBe(false);
    expect(validateOverpassPayload([]).ok).toBe(false);
    expect(validateOverpassPayload({}).ok).toBe(false);
    expect(validateOverpassPayload({ elements: 'nope' }).ok).toBe(false);
  });

  it('rejects empty elements with a timeout/error remark', () => {
    const result = validateOverpassPayload({
      elements: [],
      remark: 'runtime error: Query timed out in "query" at line 2',
    });
    expect(result.ok).toBe(false);
  });

  it('accepts empty elements without a bad remark (genuine empty area)', () => {
    const result = validateOverpassPayload({ elements: [] });
    expect(result).toEqual({
      ok: true,
      json: { elements: [] },
      partial: false,
    });
  });

  it('marks partial when remark is bad but some elements arrived', () => {
    const payload = {
      elements: [{ type: 'node', id: 1 }],
      remark: 'runtime error: Query timed out',
    };
    const result = validateOverpassPayload(payload);
    expect(result).toEqual({ ok: true, json: payload, partial: true });
  });

  it('detects bad remarks', () => {
    expect(isBadRemark('Query timed out')).toBe(true);
    expect(isBadRemark('runtime error: Query timed out in "query"')).toBe(
      true
    );
    expect(isBadRemark('timeout')).toBe(true);
    expect(isBadRemark('ok')).toBe(false);
    expect(isBadRemark(undefined)).toBe(false);
  });
});

describe('Overpass proxy cache policy', () => {
  it('caches full GET area responses for an hour', () => {
    expect(cacheControlForValidated('GET', 'area', false)).toBe(CACHE_FULL);
  });

  it('uses a short TTL for partial GET area responses', () => {
    expect(cacheControlForValidated('GET', 'area', true)).toBe(CACHE_PARTIAL);
  });

  it('never caches POST or osm-id lookups', () => {
    expect(cacheControlForValidated('POST', 'area', false)).toBe(CACHE_NO_STORE);
    expect(cacheControlForValidated('GET', 'osm', false)).toBe(CACHE_NO_STORE);
  });

  it('keeps race+fallback budget under the 60s Vercel limit with headroom', () => {
    const worstCase =
      RACE_TIMEOUT_MS + FALLBACK_TIMEOUT_MS * 3; /* three fallback mirrors */
    expect(worstCase).toBeLessThanOrEqual(50_000);
  });
});

import { describe, expect, it } from 'vitest';
import type { Venue } from '../types';
import { applyEnrichment } from './enrichment';

const base: Venue = {
  id: 'osm-node-unknown',
  name: 'Cantina Do Mori',
  type: 'bar',
  address: 'Calle',
  city: 'Venezia',
  coordinates: [45.44, 12.33],
  hours: null,
  tags: ['bar'],
  moods: ['aperitivo'],
  photos: ['category:bar'],
  hasHours: false,
  source: 'osm',
};

describe('applyEnrichment', () => {
  it('does not match by name alone (avoids false positives)', () => {
    const enriched = applyEnrichment(base);
    expect(enriched.tags).not.toContain('bacaro');
    expect(enriched.tags).toEqual(['bar']);
  });

  it('matches by osm id', () => {
    const enriched = applyEnrichment({
      ...base,
      id: 'osm-node-4492301499',
      name: 'Other Name',
    });
    expect(enriched.tags).toContain('storico');
  });

  it('does not enrich short generic names like Osteria without id', () => {
    const enriched = applyEnrichment({
      ...base,
      id: 'osm-node-999',
      name: 'Osteria',
    });
    expect(enriched.tags).toEqual(['bar']);
  });
});

describe('applyEnrichment phone/website', () => {
  it('leaves phone/website unchanged when enrichment has none', () => {
    const enriched = applyEnrichment({
      ...base,
      id: 'osm-node-4492301499',
      phone: '123',
      website: 'https://example.com',
    });
    expect(enriched.phone).toBe('123');
    expect(enriched.website).toBe('https://example.com');
  });
});

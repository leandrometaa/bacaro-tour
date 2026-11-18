import type { Mood, Venue } from '../types';
import { normalizeWebsiteUrl } from '../utils/url';
import raw from './enrichment.json';

export interface VenueEnrichment {
  nameHint?: string;
  tags?: string[];
  moods?: Mood[];
  /** Optional direct image URL (Commons / public) */
  photo?: string;
  phone?: string;
  website?: string;
}

type EnrichmentMap = Record<string, VenueEnrichment>;

const ENRICHMENT = raw as EnrichmentMap;

export function getEnrichment(venueId: string): VenueEnrichment | undefined {
  return ENRICHMENT[venueId];
}

/** Merge curated enrichment by OSM id only (no name matching — avoids false positives). */
export function applyEnrichment(venue: Venue): Venue {
  const extra = ENRICHMENT[venue.id];
  if (!extra) return venue;

  const tags = [...venue.tags];
  for (const t of extra.tags ?? []) {
    if (!tags.includes(t)) tags.push(t);
  }

  const moods = [...venue.moods];
  for (const m of extra.moods ?? []) {
    if (!moods.includes(m)) moods.push(m);
  }

  let photos = venue.photos;
  if (extra.photo) {
    const withoutCategory = photos.filter((p) => !p.startsWith('category:'));
    photos = [extra.photo, ...withoutCategory.filter((p) => p !== extra.photo)];
    const cat = venue.photos.find((p) => p.startsWith('category:'));
    if (cat) photos.push(cat);
  }

  const phone = venue.phone || extra.phone;
  const website =
    venue.website || normalizeWebsiteUrl(extra.website) || undefined;

  return { ...venue, tags, moods, photos, phone, website };
}

export function applyEnrichmentToAll(venues: Venue[]): Venue[] {
  return venues.map(applyEnrichment);
}

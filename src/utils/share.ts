import type { SavedList, Venue, VenueType } from '../types';

function appBaseUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${base}`.replace(/\/?$/, '/');
}

export function venueShareUrl(venueId: string): string {
  return `${appBaseUrl()}locale/${encodeURIComponent(venueId)}`;
}

/** Compact snapshot for shared-list URLs (keep small). */
export interface SharedVenueSnap {
  id: string;
  name: string;
  type: VenueType | string;
  coordinates: [number, number];
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
}

const MAX_SHARE_VENUES = 25;

export function toSharedSnap(venue: Venue): SharedVenueSnap {
  return {
    id: venue.id,
    name: venue.name,
    type: venue.type,
    coordinates: venue.coordinates,
    ...(venue.address && venue.address !== 'Indirizzo non disponibile'
      ? { address: venue.address }
      : {}),
    ...(venue.city ? { city: venue.city } : {}),
    ...(venue.phone ? { phone: venue.phone } : {}),
    ...(venue.website ? { website: venue.website } : {}),
  };
}

export function encodeSharedSnaps(snaps: SharedVenueSnap[]): string {
  const json = JSON.stringify(snaps);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function decodeSharedSnaps(raw: string): SharedVenueSnap[] {
  try {
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const binary = atob(padded + pad);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is SharedVenueSnap =>
        Boolean(s) &&
        typeof s === 'object' &&
        typeof (s as SharedVenueSnap).id === 'string' &&
        typeof (s as SharedVenueSnap).name === 'string' &&
        Array.isArray((s as SharedVenueSnap).coordinates)
    );
  } catch {
    return [];
  }
}

export function snapToVenue(snap: SharedVenueSnap): Venue {
  return {
    id: snap.id,
    name: snap.name,
    type: (snap.type as VenueType) || 'altro',
    address: snap.address || 'Indirizzo non disponibile',
    city: snap.city || '',
    coordinates: snap.coordinates,
    hours: null,
    tags: [],
    moods: [],
    photos: [`category:${snap.type || 'altro'}`],
    phone: snap.phone,
    website: snap.website,
    hasHours: false,
    source: snap.id.startsWith('overture-') ? 'overture' : 'osm',
  };
}

export function sharedListUrl(
  listName: string,
  venueIds: string[],
  snaps?: SharedVenueSnap[]
): string {
  const params = new URLSearchParams();
  params.set('name', listName);
  params.set('ids', venueIds.slice(0, MAX_SHARE_VENUES).join(','));
  if (snaps?.length) {
    const encoded = encodeSharedSnaps(snaps.slice(0, MAX_SHARE_VENUES));
    // Keep URLs usable (~6–8k chars practical for many clients)
    if (encoded.length < 6000) {
      params.set('v', encoded);
    }
  }
  return `${appBaseUrl()}condivisa?${params.toString()}`;
}

export async function shareVenue(venue: Venue): Promise<'shared' | 'copied'> {
  const url = venueShareUrl(venue.id);
  const title = venue.name;
  const text = `${venue.name}${venue.city ? ` · ${venue.city}` : ''} — Bacaro Tour`;

  if (typeof navigator !== 'undefined' && navigator.share) {
    await navigator.share({ title, text, url });
    return 'shared';
  }

  await navigator.clipboard.writeText(url);
  return 'copied';
}

export async function shareList(
  list: SavedList,
  venues: Venue[]
): Promise<'shared' | 'copied'> {
  const limited = venues.slice(0, MAX_SHARE_VENUES);
  const ids = limited.map((v) => v.id);
  const snaps = limited.map(toSharedSnap);
  const url = sharedListUrl(
    list.name,
    ids.length ? ids : list.venueIds.slice(0, MAX_SHARE_VENUES),
    snaps
  );
  const names = limited
    .slice(0, 8)
    .map((v) => `• ${v.name}`)
    .join('\n');
  const more = venues.length > 8 ? `\n…e altri ${venues.length - 8}` : '';
  const text = `Lista “${list.name}” su Bacaro Tour\n${names}${more}\n${url}`;
  const title = `Bacaro Tour — ${list.name}`;

  if (typeof navigator !== 'undefined' && navigator.share) {
    await navigator.share({ title, text, url });
    return 'shared';
  }

  await navigator.clipboard.writeText(url);
  return 'copied';
}

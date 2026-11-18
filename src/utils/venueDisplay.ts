import type { Venue } from '../types';
import { haversineKm } from './geo';

/** Human-readable place line — never the OSM placeholder. */
export function venuePlaceLabel(
  venue: Venue,
  opts?: { center?: [number, number] | null }
): string | null {
  const city = venue.city?.trim();
  if (city) return city;

  const address = venue.address?.trim();
  if (
    address &&
    address !== 'Indirizzo non disponibile' &&
    !/^indirizzo non disponibile$/i.test(address)
  ) {
    return address;
  }

  if (opts?.center) {
    const km = haversineKm(opts.center, venue.coordinates);
    if (km < 1) return `a ${Math.round(km * 1000)} m da te`;
    return `a ${km.toFixed(1)} km da te`;
  }

  return null;
}

/** True when there is at least one non-illustration photo source. */
export function hasRealPhoto(photos: string[] | undefined): boolean {
  if (!photos?.length) return false;
  return photos.some((p) => Boolean(p) && !p.startsWith('category:'));
}

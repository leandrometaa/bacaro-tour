import type { Venue } from '../types';

/** Pick a random venue from the current filtered pool. */
export function pickSurpriseVenue(
  venues: Venue[],
  excludeId?: string | null
): Venue | null {
  if (!venues.length) return null;
  const pool =
    excludeId && venues.length > 1
      ? venues.filter((v) => v.id !== excludeId)
      : venues;
  if (!pool.length) return venues[0] ?? null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

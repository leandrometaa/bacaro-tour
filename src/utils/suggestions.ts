import type { Mood, Venue } from '../types';
import { haversineKm } from './geo';
import { isVenueOpenNow } from './openingHours';

export interface SuggestionPrompt {
  id: string;
  title: string;
  subtitle: string;
  venues: Venue[];
}

/**
 * Lightweight contextual suggestions from the already-loaded venue pool.
 */
export function buildSuggestionPrompts(
  venues: Venue[],
  center: [number, number],
  opts?: {
    visitedIds?: Set<string>;
    at?: Date;
  }
): SuggestionPrompt[] {
  const at = opts?.at ?? new Date();
  const visited = opts?.visitedIds ?? new Set<string>();
  const nearby = [...venues]
    .filter((v) => haversineKm(center, v.coordinates) <= 3)
    .sort(
      (a, b) =>
        haversineKm(center, a.coordinates) - haversineKm(center, b.coordinates)
    );

  const prompts: SuggestionPrompt[] = [];

  const aperitivo = nearby
    .filter(
      (v) =>
        v.moods.includes('aperitivo' as Mood) ||
        v.type === 'bar' ||
        v.type === 'enoteca' ||
        v.type === 'pub'
    )
    .filter((v) => !visited.has(v.id))
    .filter((v) => !v.hasHours || isVenueOpenNow(v, at))
    .slice(0, 3);
  if (aperitivo.length >= 2) {
    prompts.push({
      id: 'aperitivo',
      title: 'Aperitivo vicino?',
      subtitle: 'Tre locali adatti a uno spritz',
      venues: aperitivo,
    });
  }

  const openNow = nearby
    .filter((v) => v.hasHours && isVenueOpenNow(v, at))
    .slice(0, 3);
  if (openNow.length >= 2) {
    prompts.push({
      id: 'open',
      title: 'Aperti adesso',
      subtitle: 'I più vicini tra quelli con orario noto',
      venues: openNow,
    });
  }

  const untried = nearby.filter((v) => !visited.has(v.id)).slice(0, 3);
  if (untried.length >= 2) {
    prompts.push({
      id: 'new',
      title: 'Da scoprire',
      subtitle: 'Vicini che non hai ancora segnato come visitati',
      venues: untried,
    });
  }

  return prompts.slice(0, 2);
}

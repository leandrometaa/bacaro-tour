import type { Mood, VenueType } from '../types';

/** Derive moods from venue type + name when OSM amenity tags are missing. */
export function deriveMoodsFromType(
  type: VenueType | string,
  name = '',
  category = ''
): Mood[] {
  const moods = new Set<Mood>();
  const nameLower = name.toLowerCase();
  const cat = category.toLowerCase();
  const t = type.toLowerCase();

  const bacaroLike =
    /\bbacaro\b/.test(nameLower) ||
    /\bcicchett/.test(nameLower) ||
    /\bosteria\b/.test(nameLower) ||
    /\benoteca\b/.test(nameLower) ||
    /\bvineria\b/.test(nameLower);

  const wineSignal =
    bacaroLike ||
    t === 'enoteca' ||
    t === 'bacaro' ||
    cat === 'winery' ||
    /\b(vino|wine|enoteca)\b/.test(nameLower);

  if (
    bacaroLike ||
    t === 'bacaro' ||
    t === 'bar' ||
    t === 'pub' ||
    t === 'cafe' ||
    t === 'caffè' ||
    cat === 'bar' ||
    cat === 'cafe' ||
    cat === 'coffee_shop' ||
    cat === 'brewery'
  ) {
    moods.add('aperitivo');
  }

  if (wineSignal) {
    moods.add('vino-tagliere');
  }

  if (
    t === 'pizzeria' ||
    cat.includes('pizza') ||
    /\bpizza\b/.test(nameLower)
  ) {
    moods.add('pizza');
  }

  if (
    t === 'ristorante' ||
    t === 'trattoria' ||
    t === 'osteria' ||
    cat === 'restaurant' ||
    /\b(trattoria|ristorante)\b/.test(nameLower)
  ) {
    moods.add('cena');
  }

  return Array.from(moods);
}

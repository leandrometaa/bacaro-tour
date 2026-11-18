import type { Venue } from '../types';
import { getClosingInfo, isVenueOpenNow } from './openingHours';

export type FeatureFilterId =
  | 'tipo-bar'
  | 'tipo-pub'
  | 'tipo-enoteca'
  | 'tipo-pizzeria'
  | 'dehors'
  | 'cani'
  | 'accessibile'
  | 'wifi'
  | 'asporto'
  | 'tardi';

type FeatureDef = {
  id: FeatureFilterId;
  label: string;
  match: (v: Venue, at: Date) => boolean;
};

/** Filterable types + amenity tags derived from OSM enrichment */
export const FEATURE_FILTERS: FeatureDef[] = [
  {
    id: 'tipo-bar',
    label: 'Bar',
    match: (v) => v.type === 'bar' || v.type === 'cafe',
  },
  {
    id: 'tipo-pub',
    label: 'Pub / birrerie',
    match: (v) => v.type === 'pub',
  },
  {
    id: 'tipo-enoteca',
    label: 'Enoteche',
    match: (v) => v.type === 'enoteca',
  },
  {
    id: 'tipo-pizzeria',
    label: 'Pizzerie',
    match: (v) => v.type === 'pizzeria',
  },
  {
    id: 'dehors',
    label: 'Dehors',
    match: (v) => v.tags.includes('dehors'),
  },
  {
    id: 'cani',
    label: 'Cani',
    match: (v) => v.tags.some((t) => t.includes('cani') || t === 'dog'),
  },
  {
    id: 'accessibile',
    label: 'Accessibile',
    match: (v) => v.tags.some((t) => t.startsWith('accessibile')),
  },
  {
    id: 'wifi',
    label: 'Wi‑Fi',
    match: (v) => v.tags.includes('wifi'),
  },
  {
    id: 'asporto',
    label: 'Asporto',
    match: (v) => v.tags.includes('asporto'),
  },
  {
    id: 'tardi',
    label: 'Fino a tardi',
    match: (v, at) => {
      if (!isVenueOpenNow(v, at)) return false;
      const info = getClosingInfo(v, at);
      return info != null && info.closesIn >= 120;
    },
  },
];

export function venueMatchesFeatures(
  venue: Venue,
  selected: FeatureFilterId[],
  at = new Date()
): boolean {
  if (!selected.length) return true;
  return selected.every((id) => {
    const def = FEATURE_FILTERS.find((f) => f.id === id);
    return def ? def.match(venue, at) : true;
  });
}

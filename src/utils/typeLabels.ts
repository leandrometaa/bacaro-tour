import type { VenueType } from '../types';

const TYPE_LABELS: Record<VenueType, string> = {
  ristorante: 'Ristorante',
  bar: 'Bar',
  pizzeria: 'Pizzeria',
  enoteca: 'Enoteca',
  trattoria: 'Trattoria',
  osteria: 'Osteria',
  cafe: 'Caffè',
  pub: 'Pub',
  gelateria: 'Gelateria',
  altro: 'Locale',
};

export function venueTypeLabel(type: VenueType | string): string {
  return TYPE_LABELS[type as VenueType] ?? 'Locale';
}

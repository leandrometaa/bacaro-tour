import {
  Beer,
  Coffee,
  IceCreamCone,
  Pizza,
  Store,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import type { VenueType } from '../types';

const TYPE_ICONS: Record<VenueType, LucideIcon> = {
  ristorante: UtensilsCrossed,
  trattoria: UtensilsCrossed,
  osteria: Wine,
  enoteca: Wine,
  bar: Wine,
  pub: Beer,
  cafe: Coffee,
  pizzeria: Pizza,
  gelateria: IceCreamCone,
  altro: Store,
};

export function venueTypeIcon(type: VenueType | string): LucideIcon {
  return TYPE_ICONS[type as VenueType] ?? Store;
}

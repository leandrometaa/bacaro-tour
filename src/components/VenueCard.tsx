import { Clock, Heart, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Venue } from '../types';
import {
  formatKitchenStatus,
  formatOpeningStatus,
  isVenueOpenNow,
} from '../utils/openingHours';
import { VenuePhoto } from './VenuePhoto';

interface VenueCardProps {
  venue: Venue;
  isSaved?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
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

export function VenueCard({ venue, isSaved }: VenueCardProps) {
  const hasHours = venue.hasHours;
  const isOpen = hasHours && isVenueOpenNow(venue);
  const openingStatus = formatOpeningStatus(venue);
  const kitchenStatus = formatKitchenStatus(venue);

  return (
    <Link
      to={`/locale/${venue.id}`}
      className="block bg-white rounded-xl shadow-sm border border-surface-100 overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="relative h-36">
        <VenuePhoto
          src={venue.photos[0]}
          type={venue.type}
          alt={venue.name}
          className="w-full h-full"
        />
        {isSaved && (
          <div className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5">
            <Heart size={16} className="text-red-500 fill-red-500" />
          </div>
        )}
        <div className="absolute bottom-2 left-2 flex gap-1.5">
          <span className="bg-white/90 text-surface-700 text-xs font-medium px-2 py-1 rounded-full">
            {TYPE_LABELS[venue.type] ?? 'Locale'}
          </span>
        </div>
      </div>

      <div className="p-3">
        <h3 className="font-semibold text-brand-ink truncate">{venue.name}</h3>

        <div className="flex items-center gap-1 text-surface-500 text-sm mt-1">
          <MapPin size={14} />
          <span className="truncate">
            {venue.city || venue.address}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              !hasHours
                ? 'text-surface-500'
                : isOpen
                  ? 'text-open'
                  : 'text-closed'
            }`}
          >
            <Clock size={14} />
            <span>{openingStatus}</span>
          </div>
        </div>

        {kitchenStatus && isOpen && (
          <div className="text-xs text-surface-500 mt-1">{kitchenStatus}</div>
        )}

        <div className="flex flex-wrap gap-1 mt-2">
          {venue.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="bg-brand-50 text-brand-700 text-xs px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

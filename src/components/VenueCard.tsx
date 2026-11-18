import { Clock, Heart, MapPin, Star } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Venue } from '../types';
import {
  formatOpeningStatus,
  getOpeningState,
} from '../utils/openingHours';
import { venueTypeIcon } from '../utils/typeIcons';
import { venueTypeLabel } from '../utils/typeLabels';
import { venuePlaceLabel } from '../utils/venueDisplay';

interface VenueCardProps {
  venue: Venue;
  isSaved?: boolean;
  distanceKm?: number | null;
  myRating?: number | null;
  center?: [number, number] | null;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function statusPill(state: ReturnType<typeof getOpeningState>): {
  label: string;
  className: string;
} {
  if (state === 'open') {
    return {
      label: 'Aperto',
      className: 'bg-open-bg text-open',
    };
  }
  if (state === 'closed') {
    return {
      label: 'Chiuso',
      className: 'bg-closed-bg text-closed',
    };
  }
  return {
    label: 'Orari n/d',
    className: 'bg-elev text-subtle',
  };
}

function stopNav(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

export function VenueCard({
  venue,
  isSaved,
  distanceKm,
  myRating,
  center,
}: VenueCardProps) {
  const openingState = getOpeningState(venue);
  const openingStatus = formatOpeningStatus(venue);
  const pill = statusPill(openingState);
  const TypeIcon = venueTypeIcon(venue.type);
  const typeLabel = venueTypeLabel(venue.type);
  const cuisine = venue.cuisine?.[0]?.trim();
  const place = venuePlaceLabel(venue, {
    center:
      center ?? (distanceKm != null ? undefined : null),
  });

  const subtitle = [typeLabel, cuisine].filter(Boolean).join(' · ');
  const showHours = openingState !== 'unknown';

  return (
    <Link
      to={`/locale/${venue.id}`}
      className="flex gap-3 items-start py-3.5 border-b border-line last:border-b-0 hover:bg-elev/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <h3 className="font-display text-[1.15rem] leading-snug text-ink truncate">
            {venue.name}
          </h3>
          <span
            className={`shrink-0 text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded-full ${pill.className}`}
          >
            {pill.label}
          </span>
          {isSaved && (
            <Heart
              size={13}
              className="shrink-0 text-red-500 fill-red-500 translate-y-0.5"
              aria-label="Salvato"
            />
          )}
          {myRating != null && myRating > 0 && (
            <span className="shrink-0 inline-flex items-center gap-0.5 text-accent-text text-xs font-medium">
              <Star size={12} className="fill-current" />
              {myRating}
            </span>
          )}
        </div>

        <p className="text-sm text-muted mt-0.5 truncate">{subtitle}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-subtle mt-1.5">
          {distanceKm != null && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} className="shrink-0 opacity-70" aria-hidden />
              {formatDistance(distanceKm)}
            </span>
          )}
          {distanceKm == null && place && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin size={13} className="shrink-0 opacity-70" aria-hidden />
              <span className="truncate">{place}</span>
            </span>
          )}
          {showHours && (
            <span
              className={`inline-flex items-center gap-1 ${
                openingState === 'open' ? 'text-open' : 'text-closed'
              }`}
            >
              <Clock size={13} className="shrink-0" aria-hidden />
              <span className="truncate">{openingStatus}</span>
            </span>
          )}
        </div>

        {(venue.phone || venue.website) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-sm">
            {venue.phone && (
              <a
                href={`tel:${venue.phone}`}
                onClick={stopNav}
                className="text-primary/80 hover:text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              >
                Telefono
              </a>
            )}
            {venue.website && (
              <a
                href={venue.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={stopNav}
                className="text-primary/80 hover:text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              >
                Sito web
              </a>
            )}
          </div>
        )}
      </div>

      <div
        className="shrink-0 flex flex-col items-center justify-start gap-1 w-12 text-center text-muted"
        aria-hidden
      >
        <TypeIcon size={22} strokeWidth={1.5} />
        <span className="text-[10px] leading-tight text-subtle">{typeLabel}</span>
      </div>
    </Link>
  );
}

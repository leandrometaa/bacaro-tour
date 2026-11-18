import { Clock, MapPin, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Venue } from '../types';
import {
  formatOpeningStatus,
  getOpeningState,
} from '../utils/openingHours';
import { venueTypeLabel } from '../utils/typeLabels';
import { venuePlaceLabel } from '../utils/venueDisplay';
import { VenuePhoto } from './VenuePhoto';

interface VenuePreviewSheetProps {
  venue: Venue | null;
  onClose: () => void;
}

/** Non-modal bottom card — map stays interactive so you can tap another pin. */
export function VenuePreviewSheet({ venue, onClose }: VenuePreviewSheetProps) {
  const navigate = useNavigate();

  if (!venue) return null;

  const openingState = getOpeningState(venue);
  const openingStatus = formatOpeningStatus(venue);
  const place = venuePlaceLabel(venue);

  return (
    <div
      role="dialog"
      aria-label={venue.name}
      className="absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 right-3 z-[25] pointer-events-none"
    >
      <div className="pointer-events-auto bg-card rounded-2xl w-full max-w-lg mx-auto shadow-xl border border-line animate-slide-up overflow-hidden">
        <div className="flex gap-3 p-3">
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
            <VenuePhoto
              src={venue.photos[0]}
              type={venue.type}
              alt={venue.name}
              className="w-full h-full"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-semibold text-ink truncate">{venue.name}</h2>
                <p className="text-sm text-muted">{venueTypeLabel(venue.type)}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-subtle hover:text-ink shrink-0 focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                aria-label="Chiudi"
              >
                <X size={20} />
              </button>
            </div>

            {place && (
              <div className="flex items-center gap-1 text-muted text-sm mt-1">
                <MapPin size={14} className="shrink-0" />
                <span className="truncate">{place}</span>
              </div>
            )}

            <div
              className={`flex items-center gap-1 text-sm font-medium mt-1.5 ${
                openingState === 'unknown'
                  ? 'text-subtle'
                  : openingState === 'open'
                    ? 'text-open'
                    : 'text-closed'
              }`}
            >
              <Clock size={14} />
              <span>{openingStatus}</span>
            </div>
          </div>
        </div>

        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(`/locale/${venue.id}`);
            }}
            className="w-full py-2.5 bg-accent text-on-accent font-medium rounded-xl hover:opacity-90 transition-opacity text-sm focus-visible:ring-2 focus-visible:ring-primary"
          >
            Vedi dettaglio
          </button>
        </div>
      </div>
    </div>
  );
}

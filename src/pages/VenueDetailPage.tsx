import L from 'leaflet';
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Heart,
  MapPin,
  Star,
} from 'lucide-react';
import { useState } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { useNavigate, useParams } from 'react-router-dom';
import { AddVisitModal } from '../components/AddVisitModal';
import { SaveToListModal } from '../components/SaveToListModal';
import { CategoryIllustration, isCategoryPhoto } from '../components/VenuePhoto';
import { getVenueById, osmNoteUrl } from '../data/venues';
import { useUserData } from '../hooks/useUserData';
import {
  formatKitchenStatus,
  formatOpeningStatus,
  getAllDays,
  getCurrentDay,
  getDayLabel,
  isVenueOpenNow,
} from '../utils/openingHours';

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

const miniMapIcon = L.divIcon({
  className: 'custom-marker',
  html: `
    <div style="
      width: 24px;
      height: 24px;
      background: #69a6ab;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(26,69,73,0.3);
      border: 2px solid white;
    "></div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

export function VenueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const venue = id ? getVenueById(id) : undefined;
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);

  const {
    data,
    addToList,
    removeFromList,
    createList,
    isInList,
    isInAnyList,
    addVisit,
    getVisitsForVenue,
  } = useUserData();

  if (!venue) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 pb-16">
        <p className="text-surface-500 text-lg">Locale non trovato</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 text-brand-600 font-medium"
        >
          Torna indietro
        </button>
      </div>
    );
  }

  const hasHours = venue.hasHours;
  const isOpen = hasHours && isVenueOpenNow(venue);
  const openingStatus = formatOpeningStatus(venue);
  const kitchenStatus = formatKitchenStatus(venue);
  const isSaved = isInAnyList(venue.id);
  const visits = getVisitsForVenue(venue.id);
  const today = getCurrentDay();
  const photos = venue.photos.length ? venue.photos : [`category:${venue.type}`];

  const nextPhoto = () => {
    setCurrentPhotoIndex((i) => (i + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((i) => (i === 0 ? photos.length - 1 : i - 1));
  };

  const openGoogleMaps = () => {
    const [lat, lng] = venue.coordinates;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      '_blank'
    );
  };

  const reportWrongHours = () => {
    window.open(osmNoteUrl(venue), '_blank', 'noopener,noreferrer');
  };

  const currentPhoto = photos[currentPhotoIndex];

  return (
    <div className="flex flex-col h-full bg-white pb-16 overflow-y-auto">
      <div className="relative h-64">
        {isCategoryPhoto(currentPhoto) ? (
          <CategoryIllustration type={venue.type} className="w-full h-full" />
        ) : (
          <img
            src={currentPhoto}
            alt={venue.name}
            className="w-full h-full object-cover"
          />
        )}

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-white/90 rounded-full p-2 shadow-md"
        >
          <ArrowLeft size={24} className="text-surface-700" />
        </button>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevPhoto}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1.5 shadow"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={nextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1.5 shadow"
            >
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {photos.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentPhotoIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="p-4 space-y-5">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-brand-ink">{venue.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-surface-600">
                  {TYPE_LABELS[venue.type] ?? 'Locale'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSaveModal(true)}
              className={`p-3 rounded-full transition-colors ${
                isSaved
                  ? 'bg-red-50 text-red-500'
                  : 'bg-surface-100 text-surface-500'
              }`}
            >
              <Heart size={24} className={isSaved ? 'fill-current' : ''} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                !hasHours
                  ? 'bg-surface-100 text-surface-600'
                  : isOpen
                    ? 'bg-open-bg text-open'
                    : 'bg-closed-bg text-closed'
              }`}
            >
              <Clock size={16} />
              {openingStatus}
            </div>
            {kitchenStatus && isOpen && (
              <span className="text-sm text-surface-500">{kitchenStatus}</span>
            )}
          </div>
        </div>

        <div className="bg-surface-50 rounded-xl p-4">
          <h2 className="font-semibold text-brand-ink mb-3 flex items-center gap-2">
            <Clock size={18} />
            Orari di apertura
          </h2>
          {venue.hours ? (
            <div className="space-y-2">
              {getAllDays().map((day) => {
                const hours = venue.hours![day];
                const isToday = day === today;
                return (
                  <div
                    key={day}
                    className={`flex justify-between text-sm ${
                      isToday
                        ? 'font-semibold text-brand-700'
                        : 'text-surface-700'
                    }`}
                  >
                    <span>{getDayLabel(day)}</span>
                    {hours ? (
                      <div className="text-right">
                        <span>
                          {hours.open} – {hours.close}
                        </span>
                        {hours.kitchenClose && (
                          <span className="text-surface-400 text-xs block">
                            cucina fino alle {hours.kitchenClose}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-surface-400">Chiuso</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-surface-500">Orari non disponibili</p>
          )}
        </div>

        <div className="bg-surface-50 rounded-xl p-4">
          <h2 className="font-semibold text-brand-ink mb-3 flex items-center gap-2">
            <MapPin size={18} />
            Posizione
          </h2>
          <p className="text-surface-700 mb-3">
            {venue.address}
            {venue.city ? `, ${venue.city}` : ''}
          </p>
          <div className="h-36 rounded-lg overflow-hidden mb-3">
            <MapContainer
              center={venue.coordinates}
              zoom={15}
              className="h-full w-full"
              zoomControl={false}
              dragging={false}
              scrollWheelZoom={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={venue.coordinates} icon={miniMapIcon} />
            </MapContainer>
          </div>
          <button
            type="button"
            onClick={openGoogleMaps}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors"
          >
            <ExternalLink size={18} />
            Apri in Google Maps
          </button>
        </div>

        {venue.tags.length > 0 && (
          <div>
            <h2 className="font-semibold text-brand-ink mb-3">
              Caratteristiche
            </h2>
            <div className="flex flex-wrap gap-2">
              {venue.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-brand-50 text-brand-700 px-3 py-1.5 rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {(venue.phone || venue.website) && (
          <div className="text-sm text-surface-600 space-y-1">
            {venue.phone && <p>Tel: {venue.phone}</p>}
            {venue.website && (
              <a
                href={venue.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline break-all"
              >
                {venue.website}
              </a>
            )}
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowVisitModal(true)}
            className="w-full py-3 bg-brand-ink text-white rounded-xl font-medium hover:bg-brand-900 transition-colors"
          >
            Ci sono stato
          </button>
        </div>

        {visits.length > 0 && (
          <div>
            <h2 className="font-semibold text-brand-ink mb-3">Le tue visite</h2>
            <div className="space-y-3">
              {visits.slice(0, 3).map((visit) => (
                <div key={visit.id} className="bg-surface-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-surface-500">
                      {new Date(visit.date).toLocaleDateString('it-IT', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={14}
                          className={
                            star <= visit.rating
                              ? 'text-brand-400 fill-brand-400'
                              : 'text-surface-300'
                          }
                        />
                      ))}
                    </div>
                  </div>
                  {visit.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {visit.tags.map((tag) => (
                        <span
                          key={tag}
                          className="bg-white text-surface-600 px-2 py-0.5 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {visit.note && (
                    <p className="text-sm text-surface-600">{visit.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={reportWrongHours}
          className="flex items-center justify-center gap-2 w-full py-3 text-surface-500 text-sm hover:text-brand-700 transition-colors"
        >
          <AlertCircle size={16} />
          Segnala orario sbagliato
        </button>
      </div>

      <SaveToListModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        lists={data.lists}
        venueId={venue.id}
        onSaveToList={addToList}
        onRemoveFromList={removeFromList}
        onCreateList={createList}
        isInList={isInList}
      />

      <AddVisitModal
        isOpen={showVisitModal}
        onClose={() => setShowVisitModal(false)}
        venueId={venue.id}
        venueName={venue.name}
        onAddVisit={addVisit}
      />
    </div>
  );
}

import L from 'leaflet';
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Flag,
  Footprints,
  Globe,
  Heart,
  MapPinned,
  Navigation,
  Phone,
  Share2,
  Star,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { useNavigate, useParams } from 'react-router-dom';
import { AddVisitModal } from '../components/AddVisitModal';
import { SaveToListModal } from '../components/SaveToListModal';
import { Toast } from '../components/Toast';
import { VenuePhotoCarousel } from '../components/VenuePhotoCarousel';
import { getVenueById, loadVenueById, osmEditUrl, osmNoteUrl } from '../data/venues';
import { useUserData } from '../hooks/useUserData';
import type { Venue } from '../types';
import { haversineKm } from '../utils/geo';
import {
  formatDayHours,
  formatKitchenStatus,
  formatOpeningStatus,
  getAllDays,
  getCurrentDay,
  getDayLabel,
  getOpeningState,
} from '../utils/openingHours';
import { appendVenueToSavedGiro } from '../utils/giro';
import { shareVenue } from '../utils/share';
import { venueTypeLabel } from '../utils/typeLabels';
import { websiteHostname } from '../utils/url';
import { venuePlaceLabel } from '../utils/venueDisplay';

function readUserCenter(): [number, number] | null {
  try {
    const raw = localStorage.getItem('bacaro_tour_last_location');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { coordinates?: [number, number] };
    if (
      Array.isArray(parsed.coordinates) &&
      parsed.coordinates.length === 2
    ) {
      return parsed.coordinates;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const miniMapIcon = L.divIcon({
  className: 'custom-marker',
  html: `
    <div style="
      width: 24px;
      height: 24px;
      background: var(--color-accent, #8b3a4a);
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(42,31,34,0.3);
      border: 2px solid white;
    "></div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function VenueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userCenter = readUserCenter();
  const [venue, setVenue] = useState<Venue | undefined>(() =>
    id ? getVenueById(id) : undefined
  );
  const [loadingVenue, setLoadingVenue] = useState(() =>
    Boolean(id && !getVenueById(id))
  );
  const [loadError, setLoadError] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const {
    data,
    storageError,
    addToList,
    removeFromList,
    createList,
    isInList,
    isInAnyList,
    addVisit,
    getVisitsForVenue,
  } = useUserData();

  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!id) {
      setVenue(undefined);
      setLoadingVenue(false);
      setLoadError(false);
      return;
    }

    const cached = getVenueById(id);
    if (cached) {
      setVenue(cached);
      setLoadingVenue(false);
      setLoadError(false);
      return;
    }

    const controller = new AbortController();
    setLoadingVenue(true);
    setLoadError(false);
    setVenue(undefined);

    void loadVenueById(id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setVenue(result ?? undefined);
        setLoadError(!result);
        setLoadingVenue(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setVenue(undefined);
        setLoadError(true);
        setLoadingVenue(false);
      });

    return () => controller.abort();
  }, [id]);

  if (loadingVenue) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 pb-[calc(4rem+env(safe-area-inset-bottom))] bg-app">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-muted">Caricamento locale…</p>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 pb-[calc(4rem+env(safe-area-inset-bottom))] bg-app">
        <p className="text-muted text-lg">
          {loadError
            ? 'Impossibile caricare questo locale'
            : 'Locale non trovato'}
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 text-primary font-medium"
        >
          Torna indietro
        </button>
      </div>
    );
  }

  const openingState = getOpeningState(venue);
  const isOpen = openingState === 'open';
  const openingStatus = formatOpeningStatus(venue);
  const kitchenStatus = formatKitchenStatus(venue);
  const isSaved = isInAnyList(venue.id);
  const visits = getVisitsForVenue(venue.id);
  const today = getCurrentDay();
  const distanceKm = userCenter
    ? haversineKm(userCenter, venue.coordinates)
    : null;
  const place = venuePlaceLabel(venue, { center: userCenter });
  const hasRealAddress =
    Boolean(venue.address?.trim()) &&
    venue.address !== 'Indirizzo non disponibile';
  const editUrl = osmEditUrl(venue);

  const openWalkingDirections = () => {
    const [lat, lng] = venue.coordinates;
    const isApple =
      typeof navigator !== 'undefined' &&
      /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) &&
      'ontouchend' in document;
    const url = isApple
      ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const shareVenueAction = async () => {
    try {
      const result = await shareVenue(venue);
      if (result === 'copied') setToast('Link copiato');
    } catch {
      /* cancelled */
    }
  };

  const addToGiro = () => {
    const center = userCenter ?? venue.coordinates;
    const result = appendVenueToSavedGiro(center, venue);
    if (result.ok) {
      setToast(`Aggiunto al Giro (${result.count} tappe)`);
      return;
    }
    if (result.reason === 'duplicate') {
      setToast('Già nel Giro');
      return;
    }
    setToast('Giro pieno (max 6 tappe)');
  };

  return (
    <div className="flex flex-col h-full bg-app overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-[calc(8.5rem+env(safe-area-inset-bottom))]">
        <VenuePhotoCarousel
          photos={venue.photos}
          type={venue.type}
          alt={venue.name}
          topLeft={
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="absolute top-4 left-4 bg-black/40 rounded-full p-2 shadow-md z-10"
              aria-label="Indietro"
            >
              <ArrowLeft size={24} className="text-white" />
            </button>
          }
          topRight={
            <button
              type="button"
              onClick={() => void shareVenueAction()}
              className="absolute top-4 right-4 bg-black/40 rounded-full p-2 shadow-md z-10"
              aria-label="Condividi"
            >
              <Share2 size={20} className="text-white" />
            </button>
          }
        />

        <div className="p-4 space-y-5">
          <div>
            <h1 className="font-display text-2xl text-ink">{venue.name}</h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-muted">
              <span>{venueTypeLabel(venue.type)}</span>
              {distanceKm != null && (
                <>
                  <span className="text-line">·</span>
                  <span className="inline-flex items-center gap-1 text-sm">
                    <MapPinned size={14} />
                    {formatDistanceKm(distanceKm)}
                  </span>
                </>
              )}
            </div>
            <p className="mt-2 text-xs text-subtle">
              Fonte:{' '}
              {venue.source === 'overture'
                ? 'Overture Maps'
                : 'OpenStreetMap'}
              {!venue.hasHours ? ' · orari non verificati' : ''}
            </p>
          </div>

          <div className="bg-card rounded-xl border border-line p-4">
            <h2 className="font-semibold text-ink mb-3 flex items-center gap-2">
              <Clock size={18} />
              Orari
            </h2>
            {venue.hours ? (
              <>
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium mb-3 ${
                    openingState === 'unknown'
                      ? 'bg-elev text-muted'
                      : openingState === 'open'
                        ? 'bg-open-bg text-open'
                        : 'bg-closed-bg text-closed'
                  }`}
                >
                  {openingStatus}
                </div>
                {kitchenStatus && isOpen && (
                  <p className="text-sm text-muted mb-3">{kitchenStatus}</p>
                )}
                <div className="space-y-2">
                  {getAllDays().map((day) => {
                    const hours = venue.hours![day];
                    const isToday = day === today;
                    return (
                      <div
                        key={day}
                        className={`flex justify-between gap-3 text-sm ${
                          isToday ? 'font-semibold text-primary' : 'text-muted'
                        }`}
                      >
                        <span className="shrink-0">{getDayLabel(day)}</span>
                        {hours ? (
                          <div className="text-right">
                            <span>{formatDayHours(hours)}</span>
                            {hours.kitchenClose && (
                              <span className="text-subtle text-xs block">
                                cucina fino alle {hours.kitchenClose}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-subtle">Chiuso</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-subtle flex items-center gap-1.5">
                  <Clock size={14} />
                  Orari non disponibili
                </p>
                {editUrl && (
                  <a
                    href={editUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-accent text-on-accent font-medium text-sm focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <ExternalLink size={16} />
                    Aggiungi gli orari su OpenStreetMap
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="bg-card rounded-xl border border-line p-4">
            <h2 className="font-semibold text-ink mb-3 flex items-center gap-2">
              <MapPinned size={18} />
              Posizione
            </h2>
            {(hasRealAddress || place) && (
              <p className="text-muted mb-3">
                {hasRealAddress
                  ? `${venue.address}${venue.city ? `, ${venue.city}` : ''}`
                  : place}
              </p>
            )}
            <button
              type="button"
              onClick={openWalkingDirections}
              className="block w-full h-36 rounded-lg overflow-hidden mb-1 relative group text-left border border-line"
              aria-label="Apri indicazioni"
            >
              <MapContainer
                center={venue.coordinates}
                zoom={15}
                className="h-full w-full pointer-events-none"
                zoomControl={false}
                dragging={false}
                scrollWheelZoom={false}
                attributionControl
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  crossOrigin=""
                />
                <Marker position={venue.coordinates} icon={miniMapIcon} />
              </MapContainer>
              <span className="absolute bottom-2 right-2 text-xs font-medium bg-card/95 px-2 py-1 rounded-lg text-ink shadow border border-line">
                Indicazioni
              </span>
            </button>
          </div>

          <div>
            <h2 className="font-semibold text-ink mb-3">Caratteristiche</h2>
            {venue.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {venue.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-elev text-primary px-3 py-1.5 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-subtle">
                Nessuna caratteristica OSM disponibile per questo locale.
              </p>
            )}
            <button
              type="button"
              onClick={addToGiro}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-line bg-card text-primary font-medium text-sm hover:bg-elev focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Footprints size={18} />
              Aggiungi al Giro
            </button>
          </div>

          {(venue.phone || venue.website) && (
            <div className="text-sm text-muted space-y-2">
              {venue.phone && (
                <a
                  href={`tel:${venue.phone}`}
                  className="flex items-center gap-2 text-primary font-medium"
                >
                  <Phone size={16} />
                  {venue.phone}
                </a>
              )}
              {venue.website && (
                <a
                  href={venue.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <Globe size={16} className="shrink-0" />
                  {websiteHostname(venue.website)}
                </a>
              )}
            </div>
          )}

          {visits.length > 0 && (
            <div>
              <h2 className="font-semibold text-ink mb-3">Le tue visite</h2>
              <div className="space-y-3">
                {visits.slice(0, 3).map((visit) => (
                  <div
                    key={visit.id}
                    className="bg-card border border-line rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted">
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
                                ? 'text-accent fill-accent'
                                : 'text-line'
                            }
                          />
                        ))}
                      </div>
                    </div>
                    {visit.note && (
                      <p className="text-sm text-muted">{visit.note}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 pb-2">
            <button
              type="button"
              onClick={() =>
                window.open(osmNoteUrl(venue), '_blank', 'noopener,noreferrer')
              }
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-line bg-elev text-ink text-sm font-medium hover:bg-card focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Flag size={16} className="text-accent" />
              Segnala info errate su OpenStreetMap
            </button>
            {editUrl && (
              <a
                href={editUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 text-muted text-sm underline hover:text-ink transition-colors"
              >
                Modifica su OpenStreetMap
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="fixed left-0 right-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 bg-card/95 backdrop-blur border-t border-line px-3 py-2">
        <div className="max-w-lg mx-auto grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={openWalkingDirections}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-accent text-on-accent font-medium text-xs focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Navigation size={18} />
            Indicazioni
          </button>
          <button
            type="button"
            onClick={() => setShowSaveModal(true)}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-card border border-line text-ink font-medium text-xs focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Heart
              size={18}
              className={isSaved ? 'fill-red-500 text-red-500' : ''}
            />
            Salva
          </button>
          <button
            type="button"
            onClick={() => setShowVisitModal(true)}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-card border border-line text-ink font-medium text-xs focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Star size={18} />
            Ci sono stato
          </button>
        </div>
      </div>

      <SaveToListModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        lists={data.lists}
        venue={venue}
        onSaveToList={(listId, v) => {
          addToList(listId, v);
          setToast('Salvato nelle tue liste');
        }}
        onRemoveFromList={removeFromList}
        onCreateList={createList}
        isInList={isInList}
        storageError={storageError}
      />

      <AddVisitModal
        isOpen={showVisitModal}
        onClose={() => setShowVisitModal(false)}
        venue={venue}
        onAddVisit={(visit, v) => {
          addVisit(visit, v);
          setToast('Visita registrata');
        }}
        storageError={storageError}
      />

      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}

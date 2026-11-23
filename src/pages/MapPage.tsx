import {
  Crosshair,
  Dices,
  Ellipsis,
  Footprints,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiltersSheet } from '../components/FiltersSheet';
import { GiroSheet } from '../components/GiroSheet';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { VenueMap } from '../components/VenueMap';
import { VenuePreviewSheet } from '../components/VenuePreviewSheet';
import { useAppContext } from '../context/AppContext';
import { searchVenues } from '../data/venues';
import { usePlaceSearch } from '../hooks/usePlaceSearch';
import type { Venue } from '../types';
import type { GiroPlan } from '../utils/giro';
import { localiTrovati } from '../utils/i18n';
import { pickSurpriseVenue } from '../utils/surprise';

export function MapPage() {
  const {
    center,
    locationName,
    onChangeLocation,
    onSelectLocation,
    searchThisArea,
    resetSearchToUser,
    radius,
    setRadius,
    openNow,
    setOpenNow,
    selectedMoods,
    toggleMood,
    selectedFeatures,
    toggleFeature,
    hideVisited,
    setHideVisited,
    onlyToTry,
    setOnlyToTry,
    clearFilters,
    activeFilterCount,
    filteredVenues,
    venues,
    truncated,
    stale,
    loading,
    error,
    retry,
    visitedIds,
    toTryIds,
  } = useAppContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<Venue[]>([]);
  const { places: placeResults } = usePlaceSearch(searchQuery);
  const [previewVenue, setPreviewVenue] = useState<Venue | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [giroSheetOpen, setGiroSheetOpen] = useState(false);
  const [activeGiro, setActiveGiro] = useState<GiroPlan | null>(null);
  const [mapMovedAway, setMapMovedAway] = useState(false);
  const [flyNonce, setFlyNonce] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const viewCenterRef = useRef<[number, number]>(center);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  const giroStops = useMemo(
    () => activeGiro?.stops.map((s) => s.venue) ?? null,
    [activeGiro]
  );
  const giroRoutePath = activeGiro?.routePath ?? null;

  const handleSearch = useCallback(
    (query: string) => {
      if (query.trim()) {
        // Search within active filters (open now, moods, etc.), not the full pool.
        setSearchResults(searchVenues(query, filteredVenues));
      } else {
        setSearchResults([]);
      }
    },
    [filteredVenues]
  );

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  };

  const handleRecenter = () => {
    resetSearchToUser();
    setFlyNonce((n) => n + 1);
    setMapMovedAway(false);
    setPreviewVenue(null);
  };

  const handleSearchThisArea = () => {
    searchThisArea(viewCenterRef.current);
    setMapMovedAway(false);
    setPreviewVenue(null);
  };

  const handleSurprise = () => {
    const pick = pickSurpriseVenue(filteredVenues, previewVenue?.id);
    if (pick) setPreviewVenue(pick);
  };

  return (
    <div className="flex flex-col h-full relative pb-[calc(4rem+env(safe-area-inset-bottom))] bg-app">
      <div className="absolute top-0 left-0 right-0 z-10 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] space-y-2 bg-gradient-to-b from-card/95 to-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search
              size={20}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
                setShowSearch(true);
              }}
              onFocus={() => setShowSearch(true)}
              placeholder="Locale o zona…"
              className="w-full pl-10 pr-10 py-2.5 bg-card border border-line rounded-xl text-ink placeholder-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-subtle focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                aria-label="Cancella ricerca"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="relative shrink-0 p-2.5 rounded-xl bg-card border border-line text-ink shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Filtri"
          >
            <SlidersHorizontal size={20} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-on-accent text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showSearch &&
          searchQuery.trim().length >= 2 &&
          (placeResults.length > 0 || searchResults.length > 0) && (
          <div className="bg-card rounded-xl border border-line shadow-lg max-h-64 overflow-y-auto">
            {placeResults.length > 0 && (
              <p className="px-4 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted">
                Zone
              </p>
            )}
            {placeResults.map((place) => (
              <button
                type="button"
                key={`place-${place.coordinates[0]}-${place.coordinates[1]}-${place.name}`}
                onClick={() => {
                  onSelectLocation(place.coordinates, place.name);
                  clearSearch();
                }}
                className="w-full text-left px-4 py-3 hover:bg-elev border-b border-line"
              >
                <p className="font-medium text-ink flex items-center gap-2">
                  <MapPin size={14} className="text-primary shrink-0" />
                  {place.name}
                </p>
                {place.detail && place.detail !== place.name && (
                  <p className="text-sm text-muted truncate pl-5">
                    {place.detail}
                  </p>
                )}
              </button>
            ))}
            {searchResults.length > 0 && (
              <p className="px-4 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted">
                Locali qui
              </p>
            )}
            {searchResults.map((venue) => (
              <button
                type="button"
                key={venue.id}
                onClick={() => {
                  setPreviewVenue(venue);
                  clearSearch();
                }}
                className="w-full text-left px-4 py-3 hover:bg-elev border-b border-line last:border-b-0"
              >
                <p className="font-medium text-ink">{venue.name}</p>
                <p className="text-sm text-muted">
                  {venue.city || venue.address}
                </p>
              </button>
            ))}
          </div>
        )}

        {showSearch &&
          searchQuery.trim().length >= 2 &&
          placeResults.length === 0 &&
          searchResults.length === 0 && (
          <div className="bg-card rounded-xl border border-line shadow-lg px-4 py-3">
            <p className="text-sm text-muted">
              Nessun locale con questo nome qui. Prova una città nelle Zone
              rapide o tocca «{locationName}» in basso.
            </p>
          </div>
        )}
      </div>

      {showSearch && searchQuery && (
        <div
          className="absolute inset-0 z-[5]"
          onClick={clearSearch}
          onKeyDown={() => undefined}
          role="presentation"
        />
      )}

      <div className="flex-1 pt-16">
        <VenueMap
          center={center}
          radius={radius}
          venues={filteredVenues}
          selectedVenueId={previewVenue?.id}
          visitedIds={visitedIds}
          toTryIds={toTryIds}
          giroStops={giroStops}
          giroRoutePath={giroRoutePath}
          flyNonce={flyNonce}
          onVenueClick={setPreviewVenue}
          onMovedAway={setMapMovedAway}
          onViewCenter={(c) => {
            viewCenterRef.current = c;
          }}
        />
      </div>

      <LoadingOverlay loading={loading} error={error} onRetry={retry} />

      {!giroSheetOpen && (
        <div className="absolute right-3 top-[5.5rem] z-[1100] flex flex-col gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={handleRecenter}
            className="p-3 rounded-xl bg-card border border-line shadow-lg text-primary focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Centra su di me"
          >
            <Crosshair size={20} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeGiro) {
                setActiveGiro(null);
                return;
              }
              setGiroSheetOpen(true);
              setPreviewVenue(null);
            }}
            aria-pressed={Boolean(activeGiro)}
            aria-label={
              activeGiro ? 'Termina giro di locali' : 'Apri giro di locali'
            }
            title={activeGiro ? 'Termina giro' : 'Giro di locali'}
            className={`p-3 rounded-xl shadow-lg ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary ${
              activeGiro
                ? 'bg-accent text-on-accent ring-2 ring-accent/40'
                : 'bg-card border border-line text-primary'
            }`}
          >
            <Footprints size={20} />
          </button>
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              className="p-3 rounded-xl bg-card border border-line shadow-lg text-primary focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Altre azioni"
              aria-expanded={moreOpen}
            >
              <Ellipsis size={20} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-line rounded-xl shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    handleSurprise();
                    setMoreOpen(false);
                  }}
                  disabled={filteredVenues.length === 0 || loading}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-ink hover:bg-elev disabled:opacity-40 text-left"
                >
                  <Dices size={16} className="text-primary" />
                  Sorprendimi
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeGiro && !giroSheetOpen && (
        <div className="absolute left-3 right-[4.5rem] top-[5.5rem] z-[1100]">
          <div className="flex items-center gap-2 bg-accent text-on-accent rounded-xl px-3 py-2 shadow-lg">
            <Footprints size={16} className="shrink-0" />
            <p className="text-sm font-medium truncate flex-1">
              Giro · {activeGiro.stops.length} tappe · ~
              {activeGiro.totalWalkKm < 1
                ? `${Math.round(activeGiro.totalWalkKm * 1000)} m`
                : `${activeGiro.totalWalkKm.toFixed(1)} km`}{' '}
              aria
            </p>
            <button
              type="button"
              onClick={() => {
                setGiroSheetOpen(true);
                setPreviewVenue(null);
              }}
              className="text-xs font-semibold underline shrink-0 focus-visible:ring-2 focus-visible:ring-on-accent"
            >
              Modifica
            </button>
            <button
              type="button"
              onClick={() => setActiveGiro(null)}
              className="px-2.5 py-1 rounded-lg bg-card text-ink text-xs font-semibold shrink-0 focus-visible:ring-2 focus-visible:ring-on-accent"
            >
              Termina
            </button>
          </div>
        </div>
      )}

      <GiroSheet
        open={giroSheetOpen}
        active={Boolean(activeGiro)}
        onClose={() => setGiroSheetOpen(false)}
        onStart={async (plan) => {
          const { fetchWalkingRoute } = await import('../utils/routing');
          const points: [number, number][] = [
            center,
            ...plan.stops.map((s) => s.venue.coordinates),
          ];
          const route = await fetchWalkingRoute(points);
          const enriched = route
            ? {
                ...plan,
                routePath: route.coordinates,
                walkingKm: route.distanceKm,
                walkingMin: route.durationMin,
              }
            : plan;
          setActiveGiro(enriched);
          setGiroSheetOpen(false);
          setPreviewVenue(null);
        }}
        onEnd={() => {
          setActiveGiro(null);
          setGiroSheetOpen(false);
        }}
      />

      {mapMovedAway && !loading && (
        <div className="absolute left-1/2 -translate-x-1/2 top-[5.5rem] z-10">
          <button
            type="button"
            onClick={handleSearchThisArea}
            className="px-4 py-2 rounded-full bg-accent text-on-accent text-sm font-medium shadow-lg whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary"
          >
            Cerca in quest&apos;area
          </button>
        </div>
      )}

      {!previewVenue && (
        <div className="absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 right-3 z-10">
          <div className="bg-card/95 backdrop-blur rounded-full px-3.5 py-2 shadow-lg border border-line space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted min-w-0">
                <span className="font-semibold text-primary">
                  {localiTrovati(filteredVenues.length)}
                </span>
              </p>
              {locationName && (
                <button
                  type="button"
                  onClick={onChangeLocation}
                  className="shrink-0 inline-flex items-center gap-1 text-xs text-primary font-medium focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <MapPin size={14} />
                  <span className="truncate max-w-[9rem]">{locationName}</span>
                </button>
              )}
            </div>
            {loading && venues.length > 0 && (
              <p className="text-xs text-muted">Aggiorno da OpenStreetMap…</p>
            )}
            {stale && !loading && (
              <p className="text-xs text-accent-text">
                OSM non risponde — dati salvati nell&apos;app.
              </p>
            )}
            {truncated && !loading && !stale && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-accent-text">Raggio saturato.</p>
                <button
                  type="button"
                  onClick={() => setRadius(Math.min(radius, 2))}
                  className="text-xs font-medium text-accent-text shrink-0 underline focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Restringi a 2 km
                </button>
              </div>
            )}
            {!loading && filteredVenues.length === 0 && !error && (
              <p className="text-xs text-muted">
                Nessun locale: aumenta il raggio o togli un filtro.
              </p>
            )}
          </div>
        </div>
      )}

      <FiltersSheet
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        radius={radius}
        onRadiusChange={setRadius}
        openNow={openNow}
        onOpenNowChange={setOpenNow}
        selectedMoods={selectedMoods}
        onToggleMood={toggleMood}
        selectedFeatures={selectedFeatures}
        onToggleFeature={toggleFeature}
        hideVisited={hideVisited}
        onHideVisitedChange={setHideVisited}
        onlyToTry={onlyToTry}
        onOnlyToTryChange={setOnlyToTry}
        onReset={clearFilters}
        activeCount={activeFilterCount}
        resultCount={filteredVenues.length}
      />

      <VenuePreviewSheet
        venue={previewVenue}
        onClose={() => setPreviewVenue(null)}
      />
    </div>
  );
}

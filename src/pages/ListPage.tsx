import { Dices, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { FiltersSheet } from '../components/FiltersSheet';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { VenueCard } from '../components/VenueCard';
import { VenueCardSkeleton } from '../components/VenueCardSkeleton';
import { useAppContext } from '../context/AppContext';
import { searchVenues } from '../data/venues';
import { useUserData } from '../hooks/useUserData';
import type { Venue } from '../types';
import { FEATURE_FILTERS } from '../utils/featureFilters';
import { haversineKm } from '../utils/geo';
import { localiCount, risultatiCount } from '../utils/i18n';
import { isVenueOpenNow } from '../utils/openingHours';
import { buildSuggestionPrompts } from '../utils/suggestions';
import { pickSurpriseVenue } from '../utils/surprise';

type ListSort = 'nearby' | 'open' | 'rating' | 'alpha';

const PAGE_SIZE = 30;
const MOOD_LABELS: Record<string, string> = {
  aperitivo: 'Aperitivo',
  'vino-tagliere': 'Vino e tagliere',
  pizza: 'Pizza',
  cena: 'Cena',
};

export function ListPage() {
  const navigate = useNavigate();
  const {
    center,
    locationName,
    onChangeLocation,
    radius,
    setRadius,
    openNow,
    setOpenNow,
    selectedMoods,
    toggleMood,
    setSelectedMoods,
    selectedFeatures,
    toggleFeature,
    setSelectedFeatures,
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
    now,
    ratingByVenueId,
    visitedIds,
  } = useAppContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Venue[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sort, setSort] = useState<ListSort>('nearby');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saturateDismissed, setSaturateDismissed] = useState(false);
  const { isInAnyList } = useUserData();

  const distanceOf = useCallback(
    (v: Venue) => haversineKm(center, v.coordinates),
    [center]
  );

  const sorted = useMemo(() => {
    const list = [...filteredVenues];
    if (sort === 'nearby') {
      list.sort((a, b) => distanceOf(a) - distanceOf(b));
    } else if (sort === 'open') {
      list.sort((a, b) => {
        const aOpen = a.hasHours && isVenueOpenNow(a, now);
        const bOpen = b.hasHours && isVenueOpenNow(b, now);
        if (aOpen && !bOpen) return -1;
        if (!aOpen && bOpen) return 1;
        return distanceOf(a) - distanceOf(b);
      });
    } else if (sort === 'rating') {
      list.sort((a, b) => {
        const ra = ratingByVenueId.get(a.id) ?? -1;
        const rb = ratingByVenueId.get(b.id) ?? -1;
        if (rb !== ra) return rb - ra;
        return distanceOf(a) - distanceOf(b);
      });
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name, 'it'));
    }
    return list;
  }, [filteredVenues, sort, distanceOf, now, ratingByVenueId]);

  const handleSearch = useCallback(
    (query: string) => {
      if (query.trim()) {
        setSearchResults(searchVenues(query, venues));
        setIsSearching(true);
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
      setVisibleCount(PAGE_SIZE);
    },
    [venues]
  );

  const displayedVenues = isSearching ? searchResults : sorted;
  const pageVenues = displayedVenues.slice(0, visibleCount);

  const suggestions = useMemo(
    () =>
      isSearching
        ? []
        : buildSuggestionPrompts(filteredVenues, center, {
            visitedIds,
            at: now,
          }),
    [isSearching, filteredVenues, center, visitedIds, now]
  );

  const handleSurprise = () => {
    const pick = pickSurpriseVenue(displayedVenues);
    if (pick) navigate(`/locale/${pick.id}`);
  };

  return (
    <div className="flex flex-col h-full pb-[calc(4.5rem+env(safe-area-inset-bottom))] bg-app relative">
      <div className="sticky top-0 z-10 p-3 space-y-2 bg-card border-b border-line">
        <div className="flex gap-2">
          <div className="relative flex-1">
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
              }}
              placeholder="Cerca un locale..."
              className="w-full pl-10 pr-4 py-2.5 bg-app border border-line rounded-xl text-ink placeholder-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="relative shrink-0 p-2.5 rounded-xl border border-line bg-card text-ink focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Filtri"
          >
            <SlidersHorizontal size={20} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-on-accent text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={handleSurprise}
            disabled={displayedVenues.length === 0 || loading}
            className="shrink-0 p-2.5 rounded-xl border border-line bg-card text-primary disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Sorprendimi"
          >
            <Dices size={20} />
          </button>
        </div>

        {!isSearching && (
          <>
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {radius !== 5 && (
                  <button
                    type="button"
                    onClick={() => setRadius(5)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-elev text-ink font-medium"
                  >
                    {radius} km <X size={12} />
                  </button>
                )}
                {openNow && (
                  <button
                    type="button"
                    onClick={() => setOpenNow(false)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-open-bg text-open font-medium"
                  >
                    Aperto adesso <X size={12} />
                  </button>
                )}
                {selectedMoods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMood(m)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-accent-soft text-accent-text font-medium"
                  >
                    {MOOD_LABELS[m] ?? m} <X size={12} />
                  </button>
                ))}
                {selectedFeatures.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFeature(f)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-elev text-primary font-medium"
                  >
                    {FEATURE_FILTERS.find((x) => x.id === f)?.label ?? f}{' '}
                    <X size={12} />
                  </button>
                ))}
                {hideVisited && (
                  <button
                    type="button"
                    onClick={() => setHideVisited(false)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-elev text-ink font-medium"
                  >
                    Nascondi visitati <X size={12} />
                  </button>
                )}
                {onlyToTry && (
                  <button
                    type="button"
                    onClick={() => setOnlyToTry(false)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-elev text-ink font-medium"
                  >
                    Solo da provare <X size={12} />
                  </button>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['nearby', 'Vicini'],
                  ['open', 'Aperti'],
                  ['rating', 'Miei voti'],
                  ['alpha', 'A–Z'],
                ] as const
              ).map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => {
                    setSort(id);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border focus-visible:ring-2 focus-visible:ring-primary ${
                    sort === id
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-elev text-ink border-line'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-2 text-sm text-muted">
          <div className="min-w-0">
            {isSearching ? (
              <>
                <span className="font-semibold text-primary">
                  {risultatiCount(displayedVenues.length)}
                </span>{' '}
                per &quot;{searchQuery}&quot;
              </>
            ) : (
              <span className="font-semibold text-primary">
                {localiCount(displayedVenues.length)}
              </span>
            )}
          </div>
          {!isSearching && locationName && (
            <button
              type="button"
              onClick={onChangeLocation}
              className="shrink-0 inline-flex items-center gap-1.5 text-primary hover:text-accent-text font-medium focus-visible:ring-2 focus-visible:ring-primary"
            >
              <MapPin size={16} />
              <span className="truncate max-w-[10rem]">{locationName}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-6 relative">
        <LoadingOverlay
          loading={loading && venues.length > 0}
          error={error}
          onRetry={retry}
        />

        {stale && !loading && (
          <div className="mb-3 bg-accent-soft rounded-xl px-4 py-2 border border-line text-sm text-accent-text">
            Dati locali offline — possono non essere aggiornati.
          </div>
        )}

        {!isSearching && !loading && suggestions.length > 0 && (
          <div className="mb-3 space-y-2">
            {suggestions.map((prompt) => (
              <div
                key={prompt.id}
                className="bg-card rounded-xl border border-line px-3 py-2.5"
              >
                <p className="font-display text-ink text-base">{prompt.title}</p>
                <p className="text-xs text-muted mb-2">{prompt.subtitle}</p>
                <div className="flex flex-wrap gap-2">
                  {prompt.venues.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => navigate(`/locale/${v.id}`)}
                      className="text-sm px-2.5 py-1 rounded-full bg-elev text-primary font-medium hover:bg-line focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {truncated && !loading && !isSearching && !stale && !saturateDismissed && (
          <div className="mb-3 bg-accent-soft rounded-xl px-3 py-2 border border-line text-sm text-accent-text flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="min-w-0 flex-1">
              Troppi locali: raggio saturato.
            </span>
            <button
              type="button"
              onClick={() => setRadius(2)}
              className="font-medium text-accent-text underline shrink-0"
            >
              Restringi a 2 km
            </button>
            <button
              type="button"
              onClick={() => setSaturateDismissed(true)}
              className="p-1 text-subtle shrink-0 ml-auto"
              aria-label="Chiudi"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {loading && venues.length === 0 ? (
          <div className="grid gap-0 bg-card rounded-xl border border-line px-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <VenueCardSkeleton key={i} />
            ))}
          </div>
        ) : displayedVenues.length === 0 && !loading ? (
          <EmptyState
            title={
              isSearching
                ? 'Nessun locale trovato'
                : error
                  ? 'Caricamento non riuscito'
                  : 'Nessun locale in questa zona'
            }
            description={
              isSearching
                ? 'Prova con un altro termine'
                : 'Aumenta il raggio o togli un filtro'
            }
            illustration={isSearching ? 'search' : 'map'}
          />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-0 bg-card rounded-xl border border-line px-3">
              {pageVenues.map((venue) => (
                <VenueCard
                  key={venue.id}
                  venue={venue}
                  isSaved={isInAnyList(venue.id)}
                  distanceKm={distanceOf(venue)}
                  myRating={ratingByVenueId.get(venue.id) ?? null}
                  center={center}
                />
              ))}
            </div>
            {visibleCount < displayedVenues.length && (
              <button
                type="button"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="w-full py-3 rounded-xl border border-line bg-card text-primary font-medium focus-visible:ring-2 focus-visible:ring-primary"
              >
                Mostra altri ({displayedVenues.length - visibleCount}{' '}
                rimanenti)
              </button>
            )}
          </div>
        )}
      </div>

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
        onReset={() => {
          clearFilters();
          setSelectedMoods([]);
          setSelectedFeatures([]);
        }}
        activeCount={activeFilterCount}
        resultCount={filteredVenues.length}
      />
    </div>
  );
}

import { Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { FilterChips } from '../components/FilterChips';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { RadiusSlider } from '../components/RadiusSlider';
import { VenueCard } from '../components/VenueCard';
import { useAppContext } from '../context/AppContext';
import { searchVenues } from '../data/venues';
import { useUserData } from '../hooks/useUserData';
import type { Venue } from '../types';
import { localiCount, risultatiCount } from '../utils/i18n';
import { isVenueOpenNow } from '../utils/openingHours';

export function ListPage() {
  const {
    locationName,
    radius,
    setRadius,
    openNow,
    setOpenNow,
    selectedMood,
    setSelectedMood,
    filteredVenues,
    venues,
    loading,
    error,
    mode,
    switchMode,
    retry,
  } = useAppContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Venue[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { isInAnyList } = useUserData();

  const sorted = useMemo(() => {
    return [...filteredVenues].sort((a, b) => {
      const aOpen = a.hasHours && isVenueOpenNow(a);
      const bOpen = b.hasHours && isVenueOpenNow(b);
      if (aOpen && !bOpen) return -1;
      if (!aOpen && bOpen) return 1;
      return a.name.localeCompare(b.name, 'it');
    });
  }, [filteredVenues]);

  const handleSearch = useCallback(
    (query: string) => {
      if (query.trim()) {
        setSearchResults(searchVenues(query, venues));
        setIsSearching(true);
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    },
    [venues]
  );

  const displayedVenues = isSearching ? searchResults : sorted;

  return (
    <div className="flex flex-col h-full pb-16 bg-surface-50 relative">
      <div className="sticky top-0 z-10 p-3 space-y-2 bg-white border-b border-surface-200">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={20}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              placeholder="Cerca un locale..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-brand-ink placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            />
          </div>
          <button
            type="button"
            onClick={() => switchMode(mode === 'demo' ? 'osm' : 'demo')}
            className={`shrink-0 px-2.5 py-2 rounded-xl text-xs font-semibold border ${
              mode === 'demo'
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-surface-600 border-surface-200'
            }`}
          >
            Demo
          </button>
        </div>

        {!isSearching && (
          <>
            <RadiusSlider value={radius} onChange={setRadius} />
            <FilterChips
              openNow={openNow}
              onOpenNowChange={setOpenNow}
              selectedMood={selectedMood}
              onMoodChange={setSelectedMood}
            />
          </>
        )}

        <div className="text-sm text-surface-500">
          {isSearching ? (
            <>
              <span className="font-semibold text-brand-600">
                {risultatiCount(displayedVenues.length)}
              </span>{' '}
              per &quot;{searchQuery}&quot;
            </>
          ) : (
            <>
              <span className="font-semibold text-brand-600">
                {localiCount(displayedVenues.length)}
              </span>
              {locationName && ` vicino a ${locationName}`}
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 relative">
        <LoadingOverlay loading={loading} error={error} onRetry={retry} />

        {displayedVenues.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <p className="text-surface-500 text-lg mb-2">
              {isSearching
                ? 'Nessun locale trovato'
                : error
                  ? 'Caricamento non riuscito'
                  : 'Nessun locale in questa zona'}
            </p>
            <p className="text-surface-400 text-sm">
              {isSearching
                ? 'Prova con un altro termine di ricerca'
                : 'Prova ad aumentare il raggio o disattiva i filtri'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {displayedVenues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                isSaved={isInAnyList(venue.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

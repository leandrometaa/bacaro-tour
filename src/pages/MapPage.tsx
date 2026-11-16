import { Search } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilterChips } from '../components/FilterChips';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { RadiusSlider } from '../components/RadiusSlider';
import { VenueMap } from '../components/VenueMap';
import { useAppContext } from '../context/AppContext';
import { searchVenues } from '../data/venues';
import type { Venue } from '../types';
import { localiTrovati } from '../utils/i18n';

export function MapPage() {
  const navigate = useNavigate();
  const {
    center,
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
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<Venue[]>([]);

  const handleSearch = useCallback(
    (query: string) => {
      if (query.trim()) {
        setSearchResults(searchVenues(query, venues));
      } else {
        setSearchResults([]);
      }
    },
    [venues]
  );

  return (
    <div className="flex flex-col h-full pb-16 relative">
      <div className="absolute top-0 left-0 right-0 z-10 p-3 space-y-2 bg-gradient-to-b from-white/95 to-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
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
                setShowSearch(true);
              }}
              onFocus={() => setShowSearch(true)}
              placeholder="Cerca un locale..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-surface-200 rounded-xl text-brand-ink placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent shadow-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => switchMode(mode === 'demo' ? 'osm' : 'demo')}
            className={`shrink-0 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              mode === 'demo'
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-surface-600 border-surface-200'
            }`}
            title="Attiva/disattiva dati demo offline"
          >
            Demo
          </button>
        </div>

        {showSearch && searchResults.length > 0 && (
          <div className="bg-white rounded-xl border border-surface-200 shadow-lg max-h-48 overflow-y-auto">
            {searchResults.map((venue) => (
              <button
                type="button"
                key={venue.id}
                onClick={() => {
                  navigate(`/locale/${venue.id}`);
                  setShowSearch(false);
                  setSearchQuery('');
                }}
                className="w-full text-left px-4 py-3 hover:bg-brand-50 border-b border-surface-100 last:border-b-0"
              >
                <p className="font-medium text-brand-ink">{venue.name}</p>
                <p className="text-sm text-surface-500">
                  {venue.city || venue.address}
                </p>
              </button>
            ))}
          </div>
        )}

        {!showSearch && (
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
      </div>

      {showSearch && searchResults.length === 0 && searchQuery && (
        <div
          className="absolute inset-0 z-[5]"
          onClick={() => {
            setShowSearch(false);
            setSearchQuery('');
          }}
        />
      )}

      <div className="flex-1 pt-36">
        <VenueMap
          center={center}
          radius={radius}
          venues={filteredVenues}
          onVenueClick={(venue) => navigate(`/locale/${venue.id}`)}
        />
      </div>

      <LoadingOverlay loading={loading} error={error} onRetry={retry} />

      <div className="absolute bottom-20 left-3 right-3 z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg border border-surface-200">
          <p className="text-sm text-surface-600">
            <span className="font-semibold text-brand-600">
              {localiTrovati(filteredVenues.length)}
            </span>
            {locationName && (
              <span className="text-surface-400"> vicino a {locationName}</span>
            )}
            {mode === 'demo' && (
              <span className="ml-2 text-xs text-brand-500">(demo)</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

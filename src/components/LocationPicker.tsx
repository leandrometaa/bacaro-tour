import { Loader2, MapPin, Navigation, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DEMO_CITIES } from '../data/venues';
import type { DemoCity } from '../types';
import { searchLocation, type GeocodingResult } from '../utils/geocoding';

interface LocationPickerProps {
  onLocationSelect: (coordinates: [number, number], name: string) => void;
  onRequestGeolocation: () => void;
  geolocationLoading: boolean;
  geolocationError: string | null;
}

export function LocationPicker({
  onLocationSelect,
  onRequestGeolocation,
  geolocationLoading,
  geolocationError,
}: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const results = await searchLocation(searchQuery);
    setSearchResults(results);
    setSearching(false);
  }, [searchQuery]);

  useEffect(() => {
    const timeout = setTimeout(handleSearch, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery, handleSearch]);

  const handleDemoCitySelect = (city: DemoCity) => {
    onLocationSelect(city.coordinates, city.name);
  };

  const handleSearchResultSelect = (result: GeocodingResult) => {
    const shortName = result.displayName.split(',')[0];
    onLocationSelect([result.lat, result.lon], shortName);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-brand-50 via-surface-50 to-brand-100 z-50 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
        <div className="w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center mb-6 ring-4 ring-brand-200/60">
          <MapPin size={40} className="text-brand-600" />
        </div>

        <h1 className="text-2xl font-bold text-brand-ink text-center mb-2 tracking-tight">
          Bacaro Tour
        </h1>
        <p className="text-surface-600 text-center mb-8">
          Trova dove mangiare e bere vicino a te
        </p>

        <button
          type="button"
          onClick={onRequestGeolocation}
          disabled={geolocationLoading}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white font-medium py-3 px-4 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50 mb-4"
        >
          {geolocationLoading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Navigation size={20} />
          )}
          Usa la mia posizione
        </button>

        {geolocationError && (
          <p className="text-red-600 text-sm mb-4 text-center">
            {geolocationError}
          </p>
        )}

        <div className="w-full mb-4">
          <div className="flex items-center">
            <div className="flex-1 h-px bg-surface-300" />
            <span className="px-3 text-sm text-surface-500">oppure</span>
            <div className="flex-1 h-px bg-surface-300" />
          </div>
        </div>

        <div className="w-full relative mb-4">
          <Search
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca una città o un indirizzo..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-surface-200 rounded-xl text-brand-ink placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
          />
          {searching && (
            <Loader2
              size={20}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 animate-spin"
            />
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="w-full bg-white rounded-xl border border-surface-200 mb-4 max-h-48 overflow-y-auto">
            {searchResults.map((result, index) => (
              <button
                type="button"
                key={index}
                onClick={() => handleSearchResultSelect(result)}
                className="w-full text-left px-4 py-3 hover:bg-brand-50 border-b border-surface-100 last:border-b-0"
              >
                <p className="text-sm text-brand-ink truncate">
                  {result.displayName}
                </p>
              </button>
            ))}
          </div>
        )}

        <div className="w-full">
          <p className="text-sm text-surface-500 mb-3 text-center">
            Zone rapide
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {DEMO_CITIES.map((city) => (
              <button
                type="button"
                key={city.name}
                onClick={() => handleDemoCitySelect(city)}
                className="px-3 py-1.5 bg-white border border-surface-200 rounded-full text-sm text-surface-700 hover:bg-brand-50 hover:border-brand-300 transition-colors"
              >
                {city.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <footer className="p-4 text-center">
        <p className="text-xs text-surface-400">
          Dati © OpenStreetMap contributors
        </p>
      </footer>
    </div>
  );
}

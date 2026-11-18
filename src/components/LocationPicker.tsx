import { Loader2, MapPin, Navigation, Search } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { QUICK_CITIES, type QuickCity } from '../data/quickCities';
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
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async (e?: FormEvent) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setSearchError(null);
    const results = await searchLocation(q);
    setSearchResults(results);
    setSearching(false);
    if (results.length === 0) {
      setSearchError('Nessun risultato. Prova un altro nome.');
    }
  };

  const handleCitySelect = (city: QuickCity) => {
    onLocationSelect(city.coordinates, city.name);
  };

  const handleSearchResultSelect = (result: GeocodingResult) => {
    const shortName = result.displayName.split(',')[0];
    onLocationSelect([result.lat, result.lon], shortName);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-elev via-app to-accent-soft z-50 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
        <div className="w-20 h-20 bg-elev rounded-full flex items-center justify-center mb-6 ring-4 ring-line">
          <MapPin size={40} className="text-primary" />
        </div>

        <h1 className="font-display text-3xl text-ink text-center mb-2 tracking-tight">
          Bacaro Tour
        </h1>
        <p className="text-muted text-center mb-8">
          Scegli dove cercare locali, bacari e osterie
        </p>

        <button
          type="button"
          onClick={onRequestGeolocation}
          disabled={geolocationLoading}
          className="w-full flex items-center justify-center gap-2 bg-accent text-on-accent font-medium py-3 px-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 mb-4 focus-visible:ring-2 focus-visible:ring-primary"
        >
          {geolocationLoading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Navigation size={20} />
          )}
          Usa la mia posizione
        </button>

        {geolocationError && (
          <p className="text-red-700 text-sm mb-4 text-center">{geolocationError}</p>
        )}

        <div className="w-full mb-4">
          <div className="flex items-center">
            <div className="flex-1 h-px bg-line" />
            <span className="px-3 text-sm text-muted">oppure</span>
            <div className="flex-1 h-px bg-line" />
          </div>
        </div>

        <form onSubmit={(e) => void handleSearch(e)} className="w-full mb-4">
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchError(null);
                }}
                placeholder="Città o indirizzo…"
                enterKeyHint="search"
                className="w-full pl-10 pr-4 py-3 bg-app border border-line rounded-xl text-ink placeholder-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="shrink-0 px-4 py-3 rounded-xl bg-ink text-on-primary font-medium disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary"
            >
              {searching ? <Loader2 size={20} className="animate-spin" /> : 'Cerca'}
            </button>
          </div>
        </form>

        {searchError && (
          <p className="text-sm text-muted mb-3 text-center w-full">{searchError}</p>
        )}

        {searchResults.length > 0 && (
          <div className="w-full bg-card rounded-xl border border-line mb-4 max-h-48 overflow-y-auto">
            {searchResults.map((result, index) => (
              <button
                type="button"
                key={`${result.lat}-${result.lon}-${index}`}
                onClick={() => handleSearchResultSelect(result)}
                className="w-full text-left px-4 py-3 hover:bg-elev border-b border-line last:border-b-0"
              >
                <p className="text-sm text-ink truncate">{result.displayName}</p>
              </button>
            ))}
          </div>
        )}

        <div className="w-full">
          <p className="text-sm text-muted mb-3 text-center">Zone rapide</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {QUICK_CITIES.map((city) => (
              <button
                type="button"
                key={city.name}
                onClick={() => handleCitySelect(city)}
                className="px-3 py-1.5 bg-card border border-line rounded-full text-sm text-ink hover:bg-elev transition-colors focus-visible:ring-2 focus-visible:ring-primary"
              >
                {city.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <footer className="p-4 text-center pb-[max(1rem,env(safe-area-inset-bottom))] space-y-1">
        <Link to="/info" className="text-xs text-primary font-medium">
          Info e crediti
        </Link>
        <p className="text-xs text-subtle">Dati © OpenStreetMap contributors</p>
      </footer>
    </div>
  );
}

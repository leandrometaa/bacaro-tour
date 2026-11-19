import { useEffect, useState } from 'react';
import { QUICK_CITIES } from '../data/quickCities';
import { searchLocation, type GeocodingResult } from '../utils/geocoding';

export interface PlaceSuggestion {
  name: string;
  coordinates: [number, number];
  detail?: string;
  source: 'quick' | 'geocode';
}

function matchQuickCities(query: string): PlaceSuggestion[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return QUICK_CITIES.filter((c) => c.name.toLowerCase().includes(q)).map(
    (c) => ({
      name: c.name,
      coordinates: c.coordinates,
      detail: 'Zona rapida',
      source: 'quick' as const,
    })
  );
}

/**
 * Suggests cities/addresses while typing in the main search bar.
 * Complements venue search so “Bassano” can move the map, not only filter names.
 */
export function usePlaceSearch(query: string): {
  places: PlaceSuggestion[];
  searching: boolean;
} {
  const [places, setPlaces] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setPlaces([]);
      setSearching(false);
      return;
    }

    const quick = matchQuickCities(q);
    setPlaces(quick);

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchLocation(q).then((results: GeocodingResult[]) => {
        if (cancelled) return;
        const fromGeo: PlaceSuggestion[] = results.map((r) => ({
          name: r.displayName.split(',')[0] || r.displayName,
          coordinates: [r.lat, r.lon],
          detail: r.displayName,
          source: 'geocode' as const,
        }));

        // Prefer quick cities first; drop geocode dupes by rounded coords.
        const seen = new Set(
          quick.map(
            (p) =>
              `${p.coordinates[0].toFixed(3)},${p.coordinates[1].toFixed(3)}`
          )
        );
        const merged = [...quick];
        for (const p of fromGeo) {
          const key = `${p.coordinates[0].toFixed(3)},${p.coordinates[1].toFixed(3)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(p);
        }
        setPlaces(merged.slice(0, 6));
        setSearching(false);
      });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return { places, searching };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDataMode,
  loadVenues,
  setDataMode,
  type DataMode,
} from '../data/venues';
import type { Venue } from '../types';

interface UseVenuesOptions {
  center: [number, number] | null;
  radiusKm: number;
  debounceMs?: number;
}

export function useVenues({
  center,
  radiusKm,
  debounceMs = 600,
}: UseVenuesOptions) {
  const [mode, setModeState] = useState<DataMode>(() => getDataMode());
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const switchMode = useCallback((next: DataMode) => {
    setDataMode(next);
    setModeState(next);
  }, []);

  const fetchVenues = useCallback(
    async (force = false) => {
      if (!center) return;
      const id = ++requestId.current;
      setLoading(true);
      setError(null);

      try {
        const result = await loadVenues(center, radiusKm, mode, { force });
        if (id !== requestId.current) return;
        setVenues(result);
      } catch (err) {
        if (id !== requestId.current) return;
        setVenues([]);
        setError(
          err instanceof Error
            ? err.message
            : 'Impossibile caricare i locali. Riprova.'
        );
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [center, radiusKm, mode]
  );

  useEffect(() => {
    if (!center) return;
    const timer = setTimeout(() => {
      void fetchVenues(false);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [center, radiusKm, mode, debounceMs, fetchVenues]);

  return {
    venues,
    loading,
    error,
    mode,
    switchMode,
    retry: () => fetchVenues(true),
  };
}

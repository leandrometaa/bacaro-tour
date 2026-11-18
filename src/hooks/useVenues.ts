import { useCallback, useEffect, useRef, useState } from 'react';
import { loadVenues, peekRegionalVenues } from '../data/venues';
import type { Venue } from '../types';

interface UseVenuesOptions {
  center: [number, number] | null;
  radiusKm: number;
  /** Debounce only radius changes (center loads immediately) */
  radiusDebounceMs?: number;
}

export function useVenues({
  center,
  radiusKm,
  radiusDebounceMs = 600,
}: UseVenuesOptions) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(Boolean(center));
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const lastCenterKey = useRef<string | null>(null);

  const fetchVenues = useCallback(
    async (force = false) => {
      if (!center) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const id = ++requestId.current;
      setLoading(true);
      setError(null);

      try {
        const result = await loadVenues(center, radiusKm, {
          force,
          signal: controller.signal,
        });
        if (id !== requestId.current) return;
        setVenues(result.venues);
        setTruncated(result.truncated);
        setStale(Boolean(result.stale));
        setError(null);
      } catch (err) {
        if (id !== requestId.current) return;
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        // Keep map empty for this area — do not show previous zone's pins.
        setVenues([]);
        setTruncated(false);
        setStale(false);
        setError(
          err instanceof Error
            ? err.message
            : 'Impossibile caricare i locali. Riprova.'
        );
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [center, radiusKm]
  );

  useEffect(() => {
    if (!center) return;

    const centerKey = `${center[0].toFixed(5)},${center[1].toFixed(5)}`;
    const centerChanged = lastCenterKey.current !== centerKey;
    lastCenterKey.current = centerKey;

    // Immediate fetch on first load / center change; debounce only radius tweaks
    const delay = centerChanged ? 0 : radiusDebounceMs;
    if (centerChanged) {
      // Paint bundle venues immediately so the UI is not blank for ~Overpass timeout.
      const quick = peekRegionalVenues(center, radiusKm);
      setVenues(quick);
      setTruncated(false);
      setStale(quick.length > 0);
      setError(null);
      setLoading(true);
    } else if (delay === 0) {
      setLoading(true);
    }

    const timer = setTimeout(() => {
      void fetchVenues(false);
    }, delay);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [center, radiusKm, radiusDebounceMs, fetchVenues]);

  return {
    venues,
    truncated,
    stale,
    loading,
    error,
    retry: () => fetchVenues(true),
  };
}

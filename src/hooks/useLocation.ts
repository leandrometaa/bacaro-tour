import { useCallback, useEffect, useState } from 'react';
import { reverseGeocode } from '../utils/geocoding';

const LOCATION_STORAGE_KEY = 'bacaro_tour_last_location';

interface StoredLocation {
  coordinates: [number, number];
  locationName: string;
}

interface LocationState {
  coordinates: [number, number] | null;
  locationName: string | null;
  loading: boolean;
  error: string | null;
  permissionDenied: boolean;
  /** True until user picks a place or we restore a saved one */
  needsWelcome: boolean;
}

function readStoredLocation(): StoredLocation | null {
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLocation;
    if (
      !Array.isArray(parsed.coordinates) ||
      parsed.coordinates.length !== 2 ||
      typeof parsed.locationName !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredLocation(coords: [number, number], name: string): void {
  try {
    const payload: StoredLocation = {
      coordinates: coords,
      locationName: name,
    };
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function clearStoredLocation(): void {
  try {
    localStorage.removeItem(LOCATION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function useLocation() {
  const [state, setState] = useState<LocationState>(() => {
    const stored = readStoredLocation();
    if (stored) {
      return {
        coordinates: stored.coordinates,
        locationName: stored.locationName,
        loading: false,
        error: null,
        permissionDenied: false,
        needsWelcome: false,
      };
    }
    return {
      coordinates: null,
      locationName: null,
      loading: false,
      error: null,
      permissionDenied: false,
      needsWelcome: true,
    };
  });

  const requestLocation = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Geolocalizzazione non supportata',
        permissionDenied: true,
      }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ];
        setState({
          coordinates,
          locationName: 'La tua posizione',
          loading: false,
          error: null,
          permissionDenied: false,
          needsWelcome: false,
        });
        writeStoredLocation(coordinates, 'La tua posizione');
        void reverseGeocode(coordinates[0], coordinates[1]).then((name) => {
          if (!name) return;
          writeStoredLocation(coordinates, name);
          setState((prev) =>
            prev.coordinates?.[0] === coordinates[0] &&
            prev.coordinates?.[1] === coordinates[1]
              ? { ...prev, locationName: name }
              : prev
          );
        });
      },
      (error) => {
        const permissionDenied = error.code === error.PERMISSION_DENIED;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: permissionDenied
            ? 'Permesso negato'
            : 'Impossibile ottenere la posizione',
          permissionDenied,
        }));
      },
      {
        // Coarse fix is enough for “near me” and saves battery / wait time.
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 120000,
      }
    );
  }, []);

  const setManualLocation = useCallback(
    (coordinates: [number, number], name: string) => {
      writeStoredLocation(coordinates, name);
      setState({
        coordinates,
        locationName: name,
        loading: false,
        error: null,
        permissionDenied: false,
        needsWelcome: false,
      });
    },
    []
  );

  const clearLocation = useCallback(() => {
    clearStoredLocation();
    setState({
      coordinates: null,
      locationName: null,
      loading: false,
      error: null,
      permissionDenied: false,
      needsWelcome: true,
    });
  }, []);

  // Soft-refresh reverse geocode name if we only have the generic label
  useEffect(() => {
    if (
      !state.coordinates ||
      state.locationName !== 'La tua posizione'
    ) {
      return;
    }
    const [lat, lon] = state.coordinates;
    void reverseGeocode(lat, lon).then((name) => {
      if (!name) return;
      writeStoredLocation([lat, lon], name);
      setState((prev) =>
        prev.coordinates?.[0] === lat && prev.coordinates?.[1] === lon
          ? { ...prev, locationName: name }
          : prev
      );
    });
  }, [state.coordinates, state.locationName]);

  return {
    ...state,
    requestLocation,
    setManualLocation,
    clearLocation,
  };
}

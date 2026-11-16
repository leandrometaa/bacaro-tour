import { useCallback, useEffect, useState } from 'react';

interface LocationState {
  coordinates: [number, number] | null;
  locationName: string | null;
  loading: boolean;
  error: string | null;
  permissionDenied: boolean;
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({
    coordinates: null,
    locationName: null,
    loading: true,
    error: null,
    permissionDenied: false,
  });

  const requestLocation = useCallback(() => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Geolocalizzazione non supportata',
        permissionDenied: true,
      }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          coordinates: [position.coords.latitude, position.coords.longitude],
          locationName: 'La tua posizione',
          loading: false,
          error: null,
          permissionDenied: false,
        });
      },
      (error) => {
        const permissionDenied = error.code === error.PERMISSION_DENIED;
        setState({
          coordinates: null,
          locationName: null,
          loading: false,
          error: permissionDenied
            ? 'Permesso negato'
            : 'Impossibile ottenere la posizione',
          permissionDenied,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

  const setManualLocation = useCallback((
    coordinates: [number, number],
    name: string
  ) => {
    setState({
      coordinates,
      locationName: name,
      loading: false,
      error: null,
      permissionDenied: false,
    });
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return {
    ...state,
    requestLocation,
    setManualLocation,
  };
}

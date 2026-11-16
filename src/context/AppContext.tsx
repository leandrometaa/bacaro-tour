import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { DataMode } from '../data/venues';
import { useVenues } from '../hooks/useVenues';
import type { Mood, Venue } from '../types';
import { isVenueOpenNow } from '../utils/openingHours';

interface AppContextValue {
  center: [number, number];
  locationName: string;
  radius: number;
  setRadius: (r: number) => void;
  openNow: boolean;
  setOpenNow: (v: boolean) => void;
  selectedMood: Mood | null;
  setSelectedMood: (m: Mood | null) => void;
  venues: Venue[];
  filteredVenues: Venue[];
  loading: boolean;
  error: string | null;
  mode: DataMode;
  switchMode: (m: DataMode) => void;
  retry: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  center,
  locationName,
  children,
}: {
  center: [number, number];
  locationName: string;
  children: ReactNode;
}) {
  const [radius, setRadius] = useState(5);
  const [openNow, setOpenNow] = useState(false);
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);

  const { venues, loading, error, mode, switchMode, retry } = useVenues({
    center,
    radiusKm: radius,
  });

  const filteredVenues = useMemo(() => {
    let result = venues;

    if (openNow) {
      result = result.filter((v) => v.hasHours && isVenueOpenNow(v));
    }

    if (selectedMood) {
      result = result.filter((v) => v.moods.includes(selectedMood));
    }

    return result;
  }, [venues, openNow, selectedMood]);

  return (
    <AppContext.Provider
      value={{
        center,
        locationName,
        radius,
        setRadius,
        openNow,
        setOpenNow,
        selectedMood,
        setSelectedMood,
        venues,
        filteredVenues,
        loading,
        error,
        mode,
        switchMode,
        retry,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

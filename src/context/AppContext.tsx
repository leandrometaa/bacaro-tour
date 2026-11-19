import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNow } from '../hooks/useNow';
import { useUserData } from '../hooks/useUserData';
import { useVenues } from '../hooks/useVenues';
import type { Mood, Venue } from '../types';
import {
  type FeatureFilterId,
  venueMatchesFeatures,
} from '../utils/featureFilters';
import { isVenueOpenNow } from '../utils/openingHours';

interface AppContextValue {
  userCenter: [number, number];
  center: [number, number];
  locationName: string;
  onChangeLocation: () => void;
  /** Jump to a city/address without going through the welcome picker. */
  onSelectLocation: (coordinates: [number, number], name: string) => void;
  searchThisArea: (mapCenter: [number, number]) => void;
  resetSearchToUser: () => void;
  radius: number;
  setRadius: (r: number) => void;
  openNow: boolean;
  setOpenNow: (v: boolean) => void;
  selectedMoods: Mood[];
  toggleMood: (m: Mood) => void;
  setSelectedMoods: (m: Mood[]) => void;
  selectedFeatures: FeatureFilterId[];
  toggleFeature: (f: FeatureFilterId) => void;
  setSelectedFeatures: (f: FeatureFilterId[]) => void;
  hideVisited: boolean;
  setHideVisited: (v: boolean) => void;
  onlyToTry: boolean;
  setOnlyToTry: (v: boolean) => void;
  clearFilters: () => void;
  activeFilterCount: number;
  venues: Venue[];
  filteredVenues: Venue[];
  truncated: boolean;
  stale: boolean;
  loading: boolean;
  error: string | null;
  retry: () => void;
  now: Date;
  visitedIds: Set<string>;
  toTryIds: Set<string>;
  ratingByVenueId: Map<string, number>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  center: userCenter,
  locationName,
  onChangeLocation,
  onSelectLocation,
  children,
}: {
  center: [number, number];
  locationName: string;
  onChangeLocation: () => void;
  onSelectLocation: (coordinates: [number, number], name: string) => void;
  children: ReactNode;
}) {
  const [queryCenter, setQueryCenter] = useState<[number, number]>(userCenter);
  const [radius, setRadius] = useState(3);
  const [openNow, setOpenNow] = useState(false);
  const [selectedMoods, setSelectedMoods] = useState<Mood[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<FeatureFilterId[]>(
    []
  );
  const [hideVisited, setHideVisited] = useState(false);
  const [onlyToTry, setOnlyToTry] = useState(false);
  const now = useNow();
  const { data } = useUserData();

  useEffect(() => {
    setQueryCenter(userCenter);
  }, [userCenter]);

  const { venues, truncated, stale, loading, error, retry } = useVenues({
    center: queryCenter,
    radiusKm: radius,
  });

  const visitedIds = useMemo(
    () => new Set(data.visits.map((v) => v.venueId)),
    [data.visits]
  );

  const toTryIds = useMemo(() => {
    const ids =
      data.lists.find((l) => l.id === 'da-provare')?.venueIds ?? [];
    return new Set(ids);
  }, [data.lists]);

  const ratingByVenueId = useMemo(() => {
    const map = new Map<string, number>();
    for (const visit of data.visits) {
      if (!map.has(visit.venueId)) map.set(visit.venueId, visit.rating);
    }
    return map;
  }, [data.visits]);

  const searchThisArea = useCallback((mapCenter: [number, number]) => {
    setQueryCenter(mapCenter);
  }, []);

  const resetSearchToUser = useCallback(() => {
    setQueryCenter(userCenter);
  }, [userCenter]);

  const toggleMood = useCallback((m: Mood) => {
    setSelectedMoods((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }, []);

  const toggleFeature = useCallback((f: FeatureFilterId) => {
    setSelectedFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setOpenNow(false);
    setSelectedMoods([]);
    setSelectedFeatures([]);
    setHideVisited(false);
    setOnlyToTry(false);
    setRadius(3);
  }, []);

  const activeFilterCount =
    (openNow ? 1 : 0) +
    selectedMoods.length +
    selectedFeatures.length +
    (hideVisited ? 1 : 0) +
    (onlyToTry ? 1 : 0) +
    (radius !== 3 ? 1 : 0);

  const filteredVenues = useMemo(() => {
    let result = venues;

    if (openNow) {
      // Strict: only venues that are known open right now.
      result = result.filter((v) => v.hasHours && isVenueOpenNow(v, now));
    }

    if (selectedMoods.length) {
      result = result.filter((v) =>
        selectedMoods.some((m) => v.moods.includes(m))
      );
    }

    if (selectedFeatures.length) {
      result = result.filter((v) =>
        venueMatchesFeatures(v, selectedFeatures, now)
      );
    }

    if (hideVisited) {
      result = result.filter((v) => !visitedIds.has(v.id));
    }

    if (onlyToTry) {
      result = result.filter((v) => toTryIds.has(v.id));
    }

    return result;
  }, [
    venues,
    openNow,
    selectedMoods,
    selectedFeatures,
    hideVisited,
    onlyToTry,
    visitedIds,
    toTryIds,
    now,
  ]);

  const value = useMemo<AppContextValue>(
    () => ({
      userCenter,
      center: queryCenter,
      locationName,
      onChangeLocation,
      onSelectLocation,
      searchThisArea,
      resetSearchToUser,
      radius,
      setRadius,
      openNow,
      setOpenNow,
      selectedMoods,
      toggleMood,
      setSelectedMoods,
      selectedFeatures,
      toggleFeature,
      setSelectedFeatures,
      hideVisited,
      setHideVisited,
      onlyToTry,
      setOnlyToTry,
      clearFilters,
      activeFilterCount,
      venues,
      filteredVenues,
      truncated,
      stale,
      loading,
      error,
      retry,
      now,
      visitedIds,
      toTryIds,
      ratingByVenueId,
    }),
    [
      userCenter,
      queryCenter,
      locationName,
      onChangeLocation,
      onSelectLocation,
      searchThisArea,
      resetSearchToUser,
      radius,
      openNow,
      selectedMoods,
      toggleMood,
      selectedFeatures,
      toggleFeature,
      hideVisited,
      onlyToTry,
      clearFilters,
      activeFilterCount,
      venues,
      filteredVenues,
      truncated,
      stale,
      loading,
      error,
      retry,
      now,
      visitedIds,
      toTryIds,
      ratingByVenueId,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

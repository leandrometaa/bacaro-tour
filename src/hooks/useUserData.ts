import { useCallback, useEffect, useState } from 'react';
import type { SavedList, UserData, Venue, Visit } from '../types';
import * as storage from '../utils/storage';

export function useUserData() {
  const [data, setData] = useState<UserData>(() => storage.getUserData());
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    const handleStorage = () => {
      setData(storage.getUserData());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const refresh = useCallback(() => {
    setData(storage.getUserData());
  }, []);

  const runWrite = useCallback(
    (fn: () => void) => {
      try {
        fn();
        setStorageError(null);
        refresh();
      } catch (err) {
        const message =
          err instanceof storage.StorageError
            ? err.message
            : 'Impossibile salvare i dati.';
        setStorageError(message);
        throw err;
      }
    },
    [refresh]
  );

  const addToList = useCallback(
    (listId: string, venue: Venue) => {
      runWrite(() => storage.addToList(listId, venue));
    },
    [runWrite]
  );

  const removeFromList = useCallback(
    (listId: string, venueId: string) => {
      runWrite(() => storage.removeFromList(listId, venueId));
    },
    [runWrite]
  );

  const createList = useCallback(
    (name: string): SavedList => {
      let list!: SavedList;
      runWrite(() => {
        list = storage.createList(name);
      });
      return list;
    },
    [runWrite]
  );

  const deleteList = useCallback(
    (listId: string) => {
      runWrite(() => storage.deleteList(listId));
    },
    [runWrite]
  );

  const renameList = useCallback(
    (listId: string, name: string) => {
      runWrite(() => storage.renameList(listId, name));
    },
    [runWrite]
  );

  const addVisit = useCallback(
    (visit: Omit<Visit, 'id'>, venue: Venue): Visit => {
      let newVisit!: Visit;
      runWrite(() => {
        newVisit = storage.addVisit(visit, venue);
      });
      return newVisit;
    },
    [runWrite]
  );

  const deleteVisit = useCallback(
    (visitId: string) => {
      runWrite(() => storage.deleteVisit(visitId));
    },
    [runWrite]
  );

  const updateVisit = useCallback(
    (
      visitId: string,
      patch: Partial<Omit<Visit, 'id' | 'venueId'>>
    ): Visit | null => {
      let updated: Visit | null = null;
      runWrite(() => {
        updated = storage.updateVisit(visitId, patch);
      });
      return updated;
    },
    [runWrite]
  );

  const exportData = useCallback((): string => {
    return storage.exportUserDataJson();
  }, []);

  const importData = useCallback(
    (json: string) => {
      runWrite(() => {
        storage.importUserDataJson(json);
      });
    },
    [runWrite]
  );

  const getPersonalVenues = useCallback((): Venue[] => {
    return storage.getPersonalVenues();
  }, [data]);

  const isInList = useCallback((listId: string, venueId: string): boolean => {
    return storage.isInList(listId, venueId);
  }, []);

  const isInAnyList = useCallback((venueId: string): boolean => {
    return storage.isInAnyList(venueId);
  }, []);

  const getListsForVenue = useCallback((venueId: string): SavedList[] => {
    return storage.getListsForVenue(venueId);
  }, []);

  const getVisitsForVenue = useCallback((venueId: string): Visit[] => {
    return storage.getVisitsForVenue(venueId);
  }, []);

  return {
    data,
    storageError,
    clearStorageError: () => setStorageError(null),
    addToList,
    removeFromList,
    createList,
    deleteList,
    renameList,
    addVisit,
    updateVisit,
    deleteVisit,
    exportData,
    importData,
    getPersonalVenues,
    isInList,
    isInAnyList,
    getListsForVenue,
    getVisitsForVenue,
    refresh,
  };
}

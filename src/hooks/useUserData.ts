import { useCallback, useEffect, useState } from 'react';
import type { SavedList, UserData, Visit } from '../types';
import * as storage from '../utils/storage';

export function useUserData() {
  const [data, setData] = useState<UserData>(() => storage.getUserData());

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

  const addToList = useCallback((listId: string, venueId: string) => {
    storage.addToList(listId, venueId);
    refresh();
  }, [refresh]);

  const removeFromList = useCallback((listId: string, venueId: string) => {
    storage.removeFromList(listId, venueId);
    refresh();
  }, [refresh]);

  const createList = useCallback((name: string): SavedList => {
    const list = storage.createList(name);
    refresh();
    return list;
  }, [refresh]);

  const deleteList = useCallback((listId: string) => {
    storage.deleteList(listId);
    refresh();
  }, [refresh]);

  const addVisit = useCallback((visit: Omit<Visit, 'id'>): Visit => {
    const newVisit = storage.addVisit(visit);
    refresh();
    return newVisit;
  }, [refresh]);

  const deleteVisit = useCallback((visitId: string) => {
    storage.deleteVisit(visitId);
    refresh();
  }, [refresh]);

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
    addToList,
    removeFromList,
    createList,
    deleteList,
    addVisit,
    deleteVisit,
    isInList,
    isInAnyList,
    getListsForVenue,
    getVisitsForVenue,
    refresh,
  };
}

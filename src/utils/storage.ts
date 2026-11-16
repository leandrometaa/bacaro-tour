import type { SavedList, UserData, Visit } from '../types';

const STORAGE_KEY = 'bacaro_tour_user_data';

const DEFAULT_DATA: UserData = {
  lists: [
    {
      id: 'da-provare',
      name: 'Da provare',
      venueIds: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'preferiti',
      name: 'Preferiti',
      venueIds: [],
      createdAt: new Date().toISOString(),
    },
  ],
  visits: [],
};

export function getUserData(): UserData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return structuredClone(DEFAULT_DATA);
    const data = JSON.parse(stored) as UserData;
    if (!data.lists || data.lists.length === 0) {
      data.lists = structuredClone(DEFAULT_DATA.lists);
    }
    return data;
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

export function saveUserData(data: UserData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function addToList(listId: string, venueId: string): void {
  const data = getUserData();
  const list = data.lists.find((l) => l.id === listId);
  if (list && !list.venueIds.includes(venueId)) {
    list.venueIds.push(venueId);
    saveUserData(data);
  }
}

export function removeFromList(listId: string, venueId: string): void {
  const data = getUserData();
  const list = data.lists.find((l) => l.id === listId);
  if (list) {
    list.venueIds = list.venueIds.filter((id) => id !== venueId);
    saveUserData(data);
  }
}

export function isInList(listId: string, venueId: string): boolean {
  const data = getUserData();
  const list = data.lists.find((l) => l.id === listId);
  return list?.venueIds.includes(venueId) ?? false;
}

export function isInAnyList(venueId: string): boolean {
  const data = getUserData();
  return data.lists.some((l) => l.venueIds.includes(venueId));
}

export function getListsForVenue(venueId: string): SavedList[] {
  const data = getUserData();
  return data.lists.filter((l) => l.venueIds.includes(venueId));
}

export function createList(name: string): SavedList {
  const data = getUserData();
  const newList: SavedList = {
    id: `list-${Date.now()}`,
    name,
    venueIds: [],
    createdAt: new Date().toISOString(),
  };
  data.lists.push(newList);
  saveUserData(data);
  return newList;
}

export function deleteList(listId: string): void {
  const data = getUserData();
  data.lists = data.lists.filter((l) => l.id !== listId);
  saveUserData(data);
}

export function addVisit(visit: Omit<Visit, 'id'>): Visit {
  const data = getUserData();
  const newVisit: Visit = {
    ...visit,
    id: `visit-${Date.now()}`,
  };
  data.visits.unshift(newVisit);
  saveUserData(data);
  return newVisit;
}

export function getVisitsForVenue(venueId: string): Visit[] {
  const data = getUserData();
  return data.visits.filter((v) => v.venueId === venueId);
}

export function deleteVisit(visitId: string): void {
  const data = getUserData();
  data.visits = data.visits.filter((v) => v.id !== visitId);
  saveUserData(data);
}

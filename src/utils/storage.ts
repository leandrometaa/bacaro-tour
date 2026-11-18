import type { SavedList, UserData, Venue, Visit } from '../types';
import { USER_DATA_VERSION } from '../types';
import { createId } from './ids';

const STORAGE_KEY = 'bacaro_tour_user_data';

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

const DEFAULT_DATA: UserData = {
  version: USER_DATA_VERSION,
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
  venuesById: {},
};

function isValidList(list: unknown): list is SavedList {
  if (!list || typeof list !== 'object') return false;
  const l = list as SavedList;
  return (
    typeof l.id === 'string' &&
    typeof l.name === 'string' &&
    Array.isArray(l.venueIds) &&
    l.venueIds.every((id) => typeof id === 'string')
  );
}

function isValidVisit(visit: unknown): visit is Visit {
  if (!visit || typeof visit !== 'object') return false;
  const v = visit as Visit;
  return (
    typeof v.id === 'string' &&
    typeof v.venueId === 'string' &&
    typeof v.date === 'string' &&
    typeof v.rating === 'number' &&
    Array.isArray(v.tags) &&
    typeof v.note === 'string'
  );
}

function isValidVenueSnapshot(venue: unknown): venue is Venue {
  if (!venue || typeof venue !== 'object') return false;
  const v = venue as Venue;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    Array.isArray(v.coordinates) &&
    v.coordinates.length === 2 &&
    typeof v.coordinates[0] === 'number' &&
    typeof v.coordinates[1] === 'number'
  );
}

function migrateUserData(raw: Partial<UserData>): UserData {
  const lists = Array.isArray(raw.lists)
    ? raw.lists.filter(isValidList)
    : [];
  const visits = Array.isArray(raw.visits)
    ? raw.visits.filter(isValidVisit)
    : [];
  const venuesById: Record<string, Venue> = {};
  if (raw.venuesById && typeof raw.venuesById === 'object') {
    for (const [id, venue] of Object.entries(raw.venuesById)) {
      if (isValidVenueSnapshot(venue)) venuesById[id] = venue;
    }
  }

  return {
    version: USER_DATA_VERSION,
    lists: lists.length > 0 ? lists : structuredClone(DEFAULT_DATA.lists),
    visits,
    venuesById,
  };
}

export function getUserData(): UserData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return structuredClone(DEFAULT_DATA);
    const parsed = JSON.parse(stored) as Partial<UserData>;
    if (!parsed || typeof parsed !== 'object') {
      return structuredClone(DEFAULT_DATA);
    }
    return migrateUserData(parsed);
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

export function saveUserData(data: UserData): void {
  try {
    const toSave: UserData = {
      ...data,
      version: USER_DATA_VERSION,
      venuesById: data.venuesById ?? {},
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    throw new StorageError(
      'Impossibile salvare: spazio locale pieno o non disponibile.'
    );
  }
}

function rememberVenue(data: UserData, venue: Venue): void {
  data.venuesById[venue.id] = venue;
}

export function getSavedVenue(venueId: string): Venue | undefined {
  return getUserData().venuesById[venueId];
}

export function addToList(listId: string, venue: Venue): void {
  const data = getUserData();
  const list = data.lists.find((l) => l.id === listId);
  if (!list) return;

  rememberVenue(data, venue);
  if (!list.venueIds.includes(venue.id)) {
    list.venueIds.push(venue.id);
  }
  saveUserData(data);
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
    id: createId('list'),
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

export function renameList(listId: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const data = getUserData();
  const list = data.lists.find((l) => l.id === listId);
  if (!list) return;
  list.name = trimmed;
  saveUserData(data);
}

export function getLatestRating(venueId: string): number | null {
  const visits = getVisitsForVenue(venueId);
  if (!visits.length) return null;
  return visits[0].rating;
}

export function addVisit(
  visit: Omit<Visit, 'id'>,
  venue: Venue
): Visit {
  const data = getUserData();
  rememberVenue(data, venue);
  const newVisit: Visit = {
    ...visit,
    id: createId('visit'),
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

export function updateVisit(
  visitId: string,
  patch: Partial<Omit<Visit, 'id' | 'venueId'>>
): Visit | null {
  const data = getUserData();
  const visit = data.visits.find((v) => v.id === visitId);
  if (!visit) return null;
  Object.assign(visit, patch);
  saveUserData(data);
  return visit;
}

export function exportUserDataJson(): string {
  return JSON.stringify(getUserData(), null, 2);
}

export function importUserDataJson(json: string): UserData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new StorageError('File non valido: JSON illegibile.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new StorageError('File non valido: formato sconosciuto.');
  }

  const raw = parsed as Partial<UserData>;
  if (!Array.isArray(raw.lists) || !Array.isArray(raw.visits)) {
    throw new StorageError(
      'File non valido: mancano liste o visite Bacaro Tour.'
    );
  }

  for (const list of raw.lists) {
    if (
      !list ||
      typeof list !== 'object' ||
      typeof (list as SavedList).id !== 'string' ||
      typeof (list as SavedList).name !== 'string' ||
      !Array.isArray((list as SavedList).venueIds)
    ) {
      throw new StorageError('File non valido: lista malformata.');
    }
  }

  for (const visit of raw.visits) {
    if (
      !visit ||
      typeof visit !== 'object' ||
      typeof (visit as Visit).id !== 'string' ||
      typeof (visit as Visit).venueId !== 'string' ||
      typeof (visit as Visit).date !== 'string'
    ) {
      throw new StorageError('File non valido: visita malformata.');
    }
  }

  if (raw.venuesById && typeof raw.venuesById === 'object') {
    for (const [id, venue] of Object.entries(raw.venuesById)) {
      if (
        !venue ||
        typeof venue !== 'object' ||
        typeof (venue as Venue).id !== 'string' ||
        typeof (venue as Venue).name !== 'string' ||
        !Array.isArray((venue as Venue).coordinates)
      ) {
        throw new StorageError(
          `File non valido: snapshot locale “${id}” incompleto.`
        );
      }
    }
  }

  const migrated = migrateUserData(raw);
  saveUserData(migrated);
  return migrated;
}

export function getPersonalVenues(): Venue[] {
  const data = getUserData();
  const ids = new Set<string>();
  for (const list of data.lists) {
    for (const id of list.venueIds) ids.add(id);
  }
  for (const visit of data.visits) ids.add(visit.venueId);

  const venues: Venue[] = [];
  for (const id of ids) {
    const venue = data.venuesById[id];
    if (venue) venues.push(venue);
  }
  return venues;
}

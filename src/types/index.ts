export interface TimeInterval {
  open: string;
  close: string;
}

export interface DayHours {
  /** All open intervals for the day (supports lunch + dinner splits) */
  intervals: TimeInterval[];
  /** First interval open — convenience for simple displays */
  open: string;
  /** Last interval close — convenience for simple displays */
  close: string;
  kitchenClose?: string;
}

export type OpeningState = 'open' | 'closed' | 'unknown';

export interface WeeklyHours {
  lunedi: DayHours | null;
  martedi: DayHours | null;
  mercoledi: DayHours | null;
  giovedi: DayHours | null;
  venerdi: DayHours | null;
  sabato: DayHours | null;
  domenica: DayHours | null;
}

export type DayOfWeek = keyof WeeklyHours;

export type VenueType =
  | 'ristorante'
  | 'bar'
  | 'pizzeria'
  | 'enoteca'
  | 'trattoria'
  | 'osteria'
  | 'cafe'
  | 'pub'
  | 'gelateria'
  | 'altro';

export type Mood = 'aperitivo' | 'vino-tagliere' | 'pizza' | 'cena';

export interface Venue {
  id: string;
  osmType?: 'node' | 'way' | 'relation';
  osmId?: number;
  name: string;
  type: VenueType;
  address: string;
  city: string;
  coordinates: [number, number];
  /** Raw OSM opening_hours string when available */
  openingHoursRaw?: string | null;
  /** Raw OSM opening_hours:kitchen string when available */
  kitchenHoursRaw?: string | null;
  hours: WeeklyHours | null;
  tags: string[];
  moods: Mood[];
  /** Present only when we have real price signals */
  priceRange?: 1 | 2 | 3;
  photos: string[];
  phone?: string;
  website?: string;
  cuisine?: string[];
  hasHours: boolean;
  source: 'osm' | 'overture';
}

export interface SavedList {
  id: string;
  name: string;
  venueIds: string[];
  createdAt: string;
}

export interface Visit {
  id: string;
  venueId: string;
  date: string;
  rating: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  note: string;
  /** Optional personal photo as data URL (kept small). */
  photoDataUrl?: string;
}

export interface UserData {
  /** Schema version for localStorage migrations */
  version: number;
  lists: SavedList[];
  visits: Visit[];
  /** Snapshots of saved/visited venues so they survive city changes */
  venuesById: Record<string, Venue>;
}

export const USER_DATA_VERSION = 3;

export interface VenueQuery {
  center: [number, number];
  radiusKm: number;
}

export type VenueLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; venues: Venue[] }
  | { status: 'error'; message: string };

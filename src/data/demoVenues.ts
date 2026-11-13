import type { DemoCity, Venue } from '../types';
import { buildWeeklyHours } from '../utils/openingHours';

export const DEMO_CITIES: DemoCity[] = [
  { name: 'Milano', coordinates: [45.4642, 9.19] },
  { name: 'Roma', coordinates: [41.9028, 12.4964] },
  { name: 'Bologna', coordinates: [44.4949, 11.3426] },
  { name: 'Venezia', coordinates: [45.4408, 12.3155] },
  { name: 'Napoli', coordinates: [40.8518, 14.2681] },
  { name: 'Padova', coordinates: [45.4064, 11.8768] },
  { name: 'Verona', coordinates: [45.4384, 10.9916] },
  { name: 'Bassano del Grappa', coordinates: [45.7667, 11.7333] },
];

/** Offline demo venues — used only when Demo mode is on */
const DEMO_RAW: Omit<Venue, 'hours' | 'hasHours' | 'source'>[] = [
  {
    id: 'demo-mi-1',
    name: 'Osteria del Naviglio',
    type: 'osteria',
    address: 'Via Alzaia Naviglio Grande 42',
    city: 'Milano',
    coordinates: [45.4512, 9.1678],
    openingHoursRaw: 'Tu-Su 12:00-15:00,Th-Sa 12:00-23:00; Mo off',
    kitchenHoursRaw: 'Tu-Su 12:00-14:30,Th-Sa 12:00-22:00',
    tags: ['dehors', 'vini naturali', 'cucina lombarda'],
    moods: ['cena', 'vino-tagliere'],
    priceRange: 2,
    photos: [],
  },
  {
    id: 'demo-mi-2',
    name: 'Bar Brera Centrale',
    type: 'bar',
    address: 'Via Brera 18',
    city: 'Milano',
    coordinates: [45.4722, 9.1875],
    openingHoursRaw: 'Mo-Fr 07:00-01:00; Sa 08:00-02:00; Su 09:00-23:00',
    tags: ['cocktail', 'aperitivo', 'wifi'],
    moods: ['aperitivo'],
    priceRange: 2,
    photos: [],
  },
  {
    id: 'demo-mi-3',
    name: 'Pizzeria da Gennaro',
    type: 'pizzeria',
    address: 'Corso Buenos Aires 67',
    city: 'Milano',
    coordinates: [45.4805, 9.2123],
    openingHoursRaw: 'Mo-Su 12:00-23:30',
    kitchenHoursRaw: 'Mo-Su 12:00-23:00',
    tags: ['pizza napoletana', 'forno a legna', 'cani ammessi'],
    moods: ['pizza', 'cena'],
    priceRange: 1,
    photos: [],
    cuisine: ['pizza'],
  },
  {
    id: 'demo-bs-1',
    name: 'Osteria Ponte Vecchio',
    type: 'osteria',
    address: 'Via Angarano 12',
    city: 'Bassano del Grappa',
    coordinates: [45.7669, 11.7315],
    openingHoursRaw: 'Tu-Su 11:00-23:00; Mo off',
    kitchenHoursRaw: 'Tu-Su 12:00-14:30,19:00-22:00',
    tags: ['grappa', 'dehors', 'taglieri'],
    moods: ['aperitivo', 'vino-tagliere', 'cena'],
    priceRange: 2,
    photos: [],
  },
  {
    id: 'demo-bs-2',
    name: 'Bar Centrale Bassano',
    type: 'bar',
    address: 'Piazza Libertà 3',
    city: 'Bassano del Grappa',
    coordinates: [45.7678, 11.7342],
    openingHoursRaw: 'Mo-Su 07:00-24:00',
    tags: ['aperitivo', 'spritz', 'pasticceria'],
    moods: ['aperitivo'],
    priceRange: 1,
    photos: [],
  },
  {
    id: 'demo-bs-3',
    name: 'Pizzeria Monte Grappa',
    type: 'pizzeria',
    address: 'Via Roma 45',
    city: 'Bassano del Grappa',
    coordinates: [45.7655, 11.7368],
    openingHoursRaw: 'We-Mo 18:30-23:30; Tu off',
    kitchenHoursRaw: 'We-Mo 18:30-23:00',
    tags: ['pizza', 'famiglia', 'birre artigianali'],
    moods: ['pizza', 'cena'],
    priceRange: 1,
    photos: [],
    cuisine: ['pizza'],
  },
];

export const demoVenues: Venue[] = DEMO_RAW.map((v) => ({
  ...v,
  hours: buildWeeklyHours(v.openingHoursRaw, v.kitchenHoursRaw),
  hasHours: Boolean(v.openingHoursRaw),
  source: 'demo' as const,
  photos: v.photos.length ? v.photos : [`category:${v.type}`],
}));

export function getDemoVenueById(id: string): Venue | undefined {
  return demoVenues.find((v) => v.id === id);
}

export function searchDemoVenues(query: string): Venue[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return demoVenues.filter(
    (v) =>
      v.name.toLowerCase().includes(q) ||
      v.city.toLowerCase().includes(q) ||
      v.tags.some((t) => t.toLowerCase().includes(q))
  );
}

export function getDemoVenuesInRadius(
  center: [number, number],
  radiusKm: number
): Venue[] {
  return demoVenues.filter((v) => haversineKm(center, v.coordinates) <= radiusKm);
}

export function haversineKm(
  [lat1, lon1]: [number, number],
  [lat2, lon2]: [number, number]
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

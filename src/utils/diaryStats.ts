import type { UserData, Venue, Visit } from '../types';

export interface DiaryStats {
  visitCount: number;
  uniqueVenues: number;
  averageRating: number | null;
  favoriteArea: string | null;
  topTags: { tag: string; count: number }[];
  citiesExplored: string[];
  topRated: { venueId: string; name: string; rating: number }[];
  thisMonthCount: number;
}

export function computeDiaryStats(
  data: UserData,
  resolveVenue: (id: string) => Venue | undefined
): DiaryStats {
  const visits = data.visits;
  const visitCount = visits.length;
  const uniqueVenues = new Set(visits.map((v) => v.venueId)).size;

  let averageRating: number | null = null;
  if (visits.length) {
    const sum = visits.reduce((acc, v) => acc + v.rating, 0);
    averageRating = Math.round((sum / visits.length) * 10) / 10;
  }

  const areaCounts = new Map<string, number>();
  for (const visit of visits) {
    const venue = resolveVenue(visit.venueId) ?? data.venuesById[visit.venueId];
    const area = venue?.city?.trim() || null;
    if (!area) continue;
    areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
  }
  let favoriteArea: string | null = null;
  let best = 0;
  for (const [area, count] of areaCounts) {
    if (count > best) {
      best = count;
      favoriteArea = area;
    }
  }

  const tagCounts = new Map<string, number>();
  for (const visit of visits) {
    for (const tag of visit.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  const citiesExplored = [...areaCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([city]) => city);

  const bestByVenue = new Map<string, number>();
  for (const visit of visits) {
    const prev = bestByVenue.get(visit.venueId) ?? 0;
    if (visit.rating > prev) bestByVenue.set(visit.venueId, visit.rating);
  }
  const topRated = [...bestByVenue.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([venueId, rating]) => {
      const venue = resolveVenue(venueId) ?? data.venuesById[venueId];
      return {
        venueId,
        name: venue?.name ?? 'Locale',
        rating,
      };
    });

  const monthKey = new Date().toISOString().slice(0, 7);
  const thisMonthCount = visits.filter((v) => v.date.startsWith(monthKey))
    .length;

  return {
    visitCount,
    uniqueVenues,
    averageRating,
    favoriteArea,
    topTags,
    citiesExplored,
    topRated,
    thisMonthCount,
  };
}

export function visitsByVenueId(visits: Visit[]): Map<string, Visit[]> {
  const map = new Map<string, Visit[]>();
  for (const v of visits) {
    const list = map.get(v.venueId) ?? [];
    list.push(v);
    map.set(v.venueId, list);
  }
  return map;
}

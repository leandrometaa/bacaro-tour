import opening_hours from 'opening_hours';
import type {
  DayHours,
  DayOfWeek,
  OpeningState,
  TimeInterval,
  Venue,
  WeeklyHours,
} from '../types';

const DAY_NAMES: DayOfWeek[] = [
  'domenica',
  'lunedi',
  'martedi',
  'mercoledi',
  'giovedi',
  'venerdi',
  'sabato',
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  lunedi: 'Lunedì',
  martedi: 'Martedì',
  mercoledi: 'Mercoledì',
  giovedi: 'Giovedì',
  venerdi: 'Venerdì',
  sabato: 'Sabato',
  domenica: 'Domenica',
};

const ohCache = new Map<string, opening_hours | null>();

export function getCurrentDay(): DayOfWeek {
  return DAY_NAMES[new Date().getDay()];
}

export function getDayLabel(day: DayOfWeek): string {
  return DAY_LABELS[day];
}

export function getAllDays(): DayOfWeek[] {
  return [
    'lunedi',
    'martedi',
    'mercoledi',
    'giovedi',
    'venerdi',
    'sabato',
    'domenica',
  ];
}

function formatHm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function minutesUntil(target: Date, from = new Date()): number {
  return Math.max(0, Math.round((target.getTime() - from.getTime()) / 60000));
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m} min`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
}

export function parseOpeningHoursString(
  raw: string | null | undefined
): opening_hours | null {
  if (!raw?.trim()) return null;
  const key = raw.trim();
  if (ohCache.has(key)) return ohCache.get(key) ?? null;
  try {
    const oh = new opening_hours(key);
    ohCache.set(key, oh);
    return oh;
  } catch {
    ohCache.set(key, null);
    return null;
  }
}

export function buildWeeklyHours(
  raw: string | null | undefined,
  kitchenRaw?: string | null
): WeeklyHours | null {
  const oh = parseOpeningHoursString(raw);
  if (!oh) return null;

  const kitchenOh = parseOpeningHoursString(kitchenRaw);
  const result = {} as WeeklyHours;
  const now = new Date();

  for (let i = 0; i < 7; i++) {
    const day = DAY_NAMES[i];
    const dayOffset = (i - now.getDay() + 7) % 7;
    const dayStart = new Date(now);
    dayStart.setDate(now.getDate() + dayOffset);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const rawIntervals = oh.getOpenIntervals(dayStart, dayEnd);
    if (!rawIntervals.length) {
      result[day] = null;
      continue;
    }

    const intervals: TimeInterval[] = rawIntervals.map(([start, end]) => ({
      open: formatHm(start),
      close: formatHm(end),
    }));

    let kitchenClose: string | undefined;
    if (kitchenOh) {
      const kIntervals = kitchenOh.getOpenIntervals(dayStart, dayEnd);
      if (kIntervals.length) {
        kitchenClose = formatHm(kIntervals[kIntervals.length - 1][1]);
      }
    }

    result[day] = {
      intervals,
      open: intervals[0].open,
      close: intervals[intervals.length - 1].close,
      kitchenClose,
    };
  }

  return result;
}

export function formatDayHours(hours: DayHours): string {
  return hours.intervals.map((i) => `${i.open} – ${i.close}`).join(', ');
}

export function getOpeningState(venue: Venue, at = new Date()): OpeningState {
  if (!venue.hasHours || !venue.openingHoursRaw) return 'unknown';
  const oh = parseOpeningHoursString(venue.openingHoursRaw);
  if (!oh) return 'unknown';
  try {
    return oh.getState(at) ? 'open' : 'closed';
  } catch {
    return 'unknown';
  }
}

export function isVenueOpenNow(venue: Venue, at = new Date()): boolean {
  if (!venue.hasHours || !venue.openingHoursRaw) return false;
  const oh = parseOpeningHoursString(venue.openingHoursRaw);
  if (!oh) return false;
  try {
    return oh.getState(at);
  } catch {
    return false;
  }
}

export function getClosingInfo(
  venue: Venue,
  at = new Date()
): { closesIn: number; kitchenUntil?: string } | null {
  if (!venue.hasHours || !venue.openingHoursRaw) return null;
  const oh = parseOpeningHoursString(venue.openingHoursRaw);
  if (!oh) return null;

  try {
    if (!oh.getState(at)) return null;
    const nextChange = oh.getNextChange(at);
    if (!nextChange) return null;

    const closesIn = minutesUntil(nextChange, at);
    let kitchenUntil: string | undefined;
    if (venue.kitchenHoursRaw) {
      const koh = parseOpeningHoursString(venue.kitchenHoursRaw);
      if (koh) {
        const kChange = koh.getNextChange(at);
        if (kChange && koh.getState(at)) {
          kitchenUntil = formatHm(kChange);
        }
      }
    } else if (venue.hours) {
      const today = getCurrentDay();
      kitchenUntil = venue.hours[today]?.kitchenClose;
    }

    return { closesIn, kitchenUntil };
  } catch {
    return null;
  }
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function isTomorrow(next: Date, from: Date): boolean {
  const tomorrow = new Date(from);
  tomorrow.setDate(from.getDate() + 1);
  return isSameCalendarDay(next, tomorrow);
}

export function formatOpeningStatus(venue: Venue, at = new Date()): string {
  if (!venue.hasHours) return 'Orari non disponibili';

  const oh = parseOpeningHoursString(venue.openingHoursRaw);
  if (!oh) return 'Orari non disponibili';

  try {
    const open = oh.getState(at);
    if (open) {
      const next = oh.getNextChange(at);
      if (next) {
        const mins = minutesUntil(next, at);
        if (mins <= 60) return `Chiude tra ${formatMinutes(mins)}`;
        return `Aperto fino alle ${formatHm(next)}`;
      }
      return 'Aperto';
    }

    const next = oh.getNextChange(at);
    if (next) {
      if (isSameCalendarDay(next, at)) return `Apre alle ${formatHm(next)}`;
      if (isTomorrow(next, at)) return `Apre domani alle ${formatHm(next)}`;
      const dayName = next.toLocaleDateString('it-IT', { weekday: 'long' });
      return `Apre ${dayName} alle ${formatHm(next)}`;
    }
    return 'Chiuso';
  } catch {
    return 'Orari non disponibili';
  }
}

export function formatKitchenStatus(venue: Venue, at = new Date()): string | null {
  if (!venue.kitchenHoursRaw && !venue.hours) return null;

  if (venue.kitchenHoursRaw) {
    const koh = parseOpeningHoursString(venue.kitchenHoursRaw);
    if (!koh) return null;
    try {
      if (!koh.getState(at)) return null;
      const next = koh.getNextChange(at);
      if (next) return `Cucina fino alle ${formatHm(next)}`;
      return 'Cucina aperta';
    } catch {
      return null;
    }
  }

  const today = getCurrentDay();
  const kitchenClose = venue.hours?.[today]?.kitchenClose;
  if (!kitchenClose) return null;
  if (!isVenueOpenNow(venue, at)) return null;
  return `Cucina fino alle ${kitchenClose}`;
}

export function getTodayHours(hours: WeeklyHours | null): DayHours | null {
  if (!hours) return null;
  return hours[getCurrentDay()];
}

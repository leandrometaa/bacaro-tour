export interface QuickCity {
  name: string;
  coordinates: [number, number];
}

/** Shortcuts on the location picker (not offline demo data). */
export const QUICK_CITIES: QuickCity[] = [
  { name: 'Padova', coordinates: [45.4064, 11.8768] },
  { name: 'Treviso', coordinates: [45.6669, 12.243] },
  { name: 'Vicenza', coordinates: [45.5455, 11.5353] },
  { name: 'Bassano del Grappa', coordinates: [45.7667, 11.7333] },
  { name: 'Castelfranco Veneto', coordinates: [45.672, 11.927] },
  { name: 'Conegliano', coordinates: [45.887, 12.299] },
  { name: 'Montebelluna', coordinates: [45.776, 12.049] },
  { name: 'Schio', coordinates: [45.712, 11.358] },
  { name: 'Asolo', coordinates: [45.803, 11.914] },
  { name: 'Marostica', coordinates: [45.746, 11.655] },
  { name: 'Venezia', coordinates: [45.4408, 12.3155] },
  { name: 'Verona', coordinates: [45.4384, 10.9916] },
];

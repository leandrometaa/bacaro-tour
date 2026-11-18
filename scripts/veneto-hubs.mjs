/**
 * Shared hubs for regional OSM + Overture offline extracts.
 * Each hub is a center + ~5 km search radius at build/runtime merge.
 */
export const VENETO_HUBS = [
  // Padova
  { name: 'Padova', lat: 45.4064, lon: 11.8768 },
  { name: 'Abano Terme', lat: 45.357, lon: 11.79 },
  { name: 'Cittadella', lat: 45.649, lon: 11.784 },
  // Treviso
  { name: 'Treviso', lat: 45.6669, lon: 12.243 },
  { name: 'Castelfranco Veneto', lat: 45.672, lon: 11.927 },
  { name: 'Conegliano', lat: 45.887, lon: 12.299 },
  { name: 'Montebelluna', lat: 45.776, lon: 12.049 },
  { name: 'Vittorio Veneto', lat: 45.978, lon: 12.371 },
  { name: 'Valdobbiadene', lat: 45.899, lon: 11.996 },
  { name: 'Asolo', lat: 45.803, lon: 11.914 },
  // Vicenza
  { name: 'Vicenza', lat: 45.5455, lon: 11.5353 },
  { name: 'Bassano del Grappa', lat: 45.7667, lon: 11.7333 },
  { name: 'Schio', lat: 45.712, lon: 11.358 },
  { name: 'Thiene', lat: 45.708, lon: 11.48 },
  { name: 'Marostica', lat: 45.746, lon: 11.655 },
  // Also offered as quick cities — need offline coverage or Overpass is the only path
  { name: 'Verona', lat: 45.4384, lon: 10.9916 },
  { name: 'Venezia', lat: 45.4408, lon: 12.3155 },
];

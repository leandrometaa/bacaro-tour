/**
 * Server-side Overpass proxy for Bacaro Tour (Vercel serverless).
 *
 * Security: never forwards arbitrary QL. Clients may only pass lat/lon/radius
 * (area search) or osmType/osmId (single element). The query is built here.
 */

export const config = { maxDuration: 60 };

const FAST_MIRRORS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const FALLBACK_MIRRORS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

/** Parallel race budget (wall clock). */
const RACE_TIMEOUT_MS = 35_000;
/** Per-mirror budget for sequential fallback. Worst case: 35 + 3×8 = 59s < 60. */
const FALLBACK_TIMEOUT_MS = 8_000;

const USER_AGENT =
  'BacaroTour/1.0 (+https://bacaro-tour-iota.vercel.app; OSM data consumer)';

/** Rough NE-Italy / Veneto coverage with a small margin. */
const BOUNDS = {
  minLat: 44.5,
  maxLat: 47.1,
  minLon: 10.0,
  maxLon: 13.8,
};

const MAX_RADIUS_KM = 30;
const OSM_TYPES = new Set(['node', 'way', 'relation']);

type VercelRequest = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  send: (body: string) => void;
};

type MirrorOk = { ok: true; json: unknown };
type MirrorFail = { ok: false; error: string };
type MirrorResult = MirrorOk | MirrorFail;

type AreaRequest = { kind: 'area'; lat: number; lon: number; radiusKm: number };
type OsmIdRequest = {
  kind: 'osm';
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
};
type ParsedRequest = AreaRequest | OsmIdRequest;

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickQueryParam(
  query: VercelRequest['query'],
  key: string
): string | undefined {
  const raw = query?.[key];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function readBodyObject(body: unknown): Record<string, unknown> | null {
  if (!body) return null;
  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as unknown;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function parseRequest(req: VercelRequest): ParsedRequest | { error: string } {
  const body = readBodyObject(req.body);
  const q = req.query ?? {};

  const osmTypeRaw =
    (body?.osmType as string | undefined) ?? pickQueryParam(q, 'osmType');
  const osmId = asNumber(body?.osmId ?? pickQueryParam(q, 'osmId'));

  if (osmTypeRaw || osmId !== null) {
    const osmType = (osmTypeRaw ?? '').toLowerCase();
    if (!OSM_TYPES.has(osmType) || osmId === null || osmId <= 0 || !Number.isInteger(osmId)) {
      return { error: 'Invalid osmType/osmId' };
    }
    return {
      kind: 'osm',
      osmType: osmType as 'node' | 'way' | 'relation',
      osmId,
    };
  }

  const lat = asNumber(body?.lat ?? pickQueryParam(q, 'lat'));
  const lon = asNumber(body?.lon ?? pickQueryParam(q, 'lon'));
  const radiusKm = asNumber(
    body?.radiusKm ?? body?.radius ?? pickQueryParam(q, 'radiusKm')
  );

  if (lat === null || lon === null || radiusKm === null) {
    return { error: 'Missing lat, lon, radiusKm' };
  }

  if (
    lat < BOUNDS.minLat ||
    lat > BOUNDS.maxLat ||
    lon < BOUNDS.minLon ||
    lon > BOUNDS.maxLon
  ) {
    return { error: 'Coordinates outside supported area' };
  }

  if (radiusKm <= 0 || radiusKm > MAX_RADIUS_KM) {
    return { error: `radiusKm must be between 0 and ${MAX_RADIUS_KM}` };
  }

  // Reject legacy open-proxy payloads.
  if (body && ('query' in body || 'data' in body)) {
    return { error: 'Raw Overpass query is not allowed' };
  }

  return {
    kind: 'area',
    lat: Math.round(lat * 1000) / 1000,
    lon: Math.round(lon * 1000) / 1000,
    radiusKm: Math.round(radiusKm * 10) / 10,
  };
}

function buildAreaQuery(lat: number, lon: number, radiusKm: number): string {
  const radiusM = Math.min(Math.round(radiusKm * 1000), MAX_RADIUS_KM * 1000);
  return `
[out:json][timeout:25];
(
  node["amenity"~"^(bar|pub|restaurant|cafe|fast_food|biergarten|ice_cream|food_court)$"](around:${radiusM},${lat},${lon});
  way["amenity"~"^(bar|pub|restaurant|cafe|fast_food|biergarten|ice_cream|food_court)$"](around:${radiusM},${lat},${lon});
  node["cuisine"~"pizza"](around:${radiusM},${lat},${lon});
  way["cuisine"~"pizza"](around:${radiusM},${lat},${lon});
  node["shop"="wine"](around:${radiusM},${lat},${lon});
  way["shop"="wine"](around:${radiusM},${lat},${lon});
  node["craft"="brewery"](around:${radiusM},${lat},${lon});
  way["craft"="brewery"](around:${radiusM},${lat},${lon});
);
out center tags;
`.trim();
}

function buildOsmIdQuery(
  osmType: 'node' | 'way' | 'relation',
  osmId: number
): string {
  return `
[out:json][timeout:15];
${osmType}(${osmId});
out center tags;
`.trim();
}

async function fetchMirror(
  endpoint: string,
  query: string,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<MirrorResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      return { ok: false, error: 'Aborted' };
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json, text/plain, */*',
        'User-Agent': USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    const json = await response.json();
    if (!json || typeof json !== 'object' || !('elements' in (json as object))) {
      return { ok: false, error: 'Invalid Overpass payload' };
    }
    return { ok: true, json };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

async function raceMirrors(
  endpoints: string[],
  query: string
): Promise<{ ok: true; json: unknown } | { ok: false; errors: string[] }> {
  const controllers = endpoints.map(() => new AbortController());
  const errors: string[] = new Array(endpoints.length);

  const attempts = endpoints.map(async (endpoint, index) => {
    const result = await fetchMirror(
      endpoint,
      query,
      RACE_TIMEOUT_MS,
      controllers[index].signal
    );
    if (!result.ok) {
      errors[index] = `${endpoint}: ${result.error}`;
      throw new Error(result.error);
    }
    for (let i = 0; i < controllers.length; i++) {
      if (i !== index) controllers[i].abort();
    }
    return result.json;
  });

  try {
    const json = await Promise.any(attempts);
    return { ok: true, json };
  } catch {
    return {
      ok: false,
      errors: errors.filter((e): e is string => typeof e === 'string'),
    };
  }
}

async function runOverpass(
  query: string
): Promise<{ ok: true; json: unknown } | { ok: false; errors: string[] }> {
  const errors: string[] = [];
  const raced = await raceMirrors(FAST_MIRRORS, query);
  if (raced.ok) return raced;
  errors.push(...raced.errors);

  for (const mirror of FALLBACK_MIRRORS) {
    const result = await fetchMirror(mirror, query, FALLBACK_TIMEOUT_MS);
    if (result.ok) return { ok: true, json: result.json };
    errors.push(`${mirror}: ${result.error}`);
  }

  return { ok: false, errors };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const method = (req.method ?? 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(204).send('');
    return;
  }

  if (method !== 'GET' && method !== 'POST') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const parsed = parseRequest(req);
  if ('error' in parsed) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(400).json({ error: parsed.error });
    return;
  }

  const query =
    parsed.kind === 'area'
      ? buildAreaQuery(parsed.lat, parsed.lon, parsed.radiusKm)
      : buildOsmIdQuery(parsed.osmType, parsed.osmId);

  // GET area searches are cacheable at the CDN (rounded lat/lon already).
  if (method === 'GET' && parsed.kind === 'area') {
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400'
    );
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }

  const result = await runOverpass(query);
  if (result.ok) {
    res.status(200).json(result.json);
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(502).json({
    error: 'Overpass unreachable',
    details: result.errors,
  });
}

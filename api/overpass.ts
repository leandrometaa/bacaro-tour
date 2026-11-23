/**
 * Server-side Overpass proxy for Bacaro Tour (Vercel serverless).
 *
 * Security: never forwards arbitrary QL. Clients may only pass lat/lon/radius
 * (area search) or osmType/osmId (single element). The query is built here.
 *
 * Caching: CDN Cache-Control is applied only after the Overpass payload is
 * validated. Error remarks and empty timeout responses are never cached.
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

/**
 * Parallel race budget (wall clock). Kept well under maxDuration so fallback
 * mirrors and Vercel overhead still fit: 25 + 3×8 = 49s < 60.
 */
export const RACE_TIMEOUT_MS = 25_000;
/** Per-mirror budget for sequential fallback. */
export const FALLBACK_TIMEOUT_MS = 8_000;

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

/** Full successful area responses — CDN may cache for an hour. */
export const CACHE_FULL =
  'public, s-maxage=3600, stale-while-revalidate=86400';
/** Partial payloads (remark + some elements) — short CDN TTL only. */
export const CACHE_PARTIAL = 'public, s-maxage=60, stale-while-revalidate=300';
export const CACHE_NO_STORE = 'no-store';

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

type MirrorOk = { ok: true; json: unknown; partial: boolean };
type MirrorFail = { ok: false; error: string };
type MirrorResult = MirrorOk | MirrorFail;

type AreaRequest = { kind: 'area'; lat: number; lon: number; radiusKm: number };
type OsmIdRequest = {
  kind: 'osm';
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
};
type ParsedRequest = AreaRequest | OsmIdRequest;

export type ValidatedOverpass =
  | { ok: true; json: Record<string, unknown>; partial: boolean }
  | { ok: false; error: string };

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

/** True when Overpass signals timeout / runtime / error in `remark`. */
export function isBadRemark(remark: unknown): boolean {
  return (
    typeof remark === 'string' &&
    /timeout|timed\s*out|error|runtime/i.test(remark)
  );
}

/**
 * Validate an Overpass JSON body before CDN caching.
 * Empty payloads with error remarks are rejected so they never hit the edge cache.
 */
export function validateOverpassPayload(json: unknown): ValidatedOverpass {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { ok: false, error: 'Invalid Overpass payload' };
  }
  const body = json as Record<string, unknown>;
  if (!('elements' in body) || !Array.isArray(body.elements)) {
    return { ok: false, error: 'Invalid Overpass payload' };
  }

  const elements = body.elements;
  const remark = body.remark;
  const bad = isBadRemark(remark);

  if (elements.length === 0 && bad) {
    return {
      ok: false,
      error:
        typeof remark === 'string' && remark.trim()
          ? remark
          : 'Overpass remark without elements',
    };
  }

  return { ok: true, json: body, partial: bad && elements.length > 0 };
}

/** Cache policy for a validated area GET response. */
export function cacheControlForValidated(
  method: string,
  kind: ParsedRequest['kind'],
  partial: boolean
): string {
  if (method !== 'GET' || kind !== 'area') return CACHE_NO_STORE;
  return partial ? CACHE_PARTIAL : CACHE_FULL;
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
    const validated = validateOverpassPayload(json);
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }
    return { ok: true, json: validated.json, partial: validated.partial };
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
): Promise<
  | { ok: true; json: unknown; partial: boolean }
  | { ok: false; errors: string[] }
> {
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
    return { json: result.json, partial: result.partial };
  });

  try {
    const winner = await Promise.any(attempts);
    return { ok: true, json: winner.json, partial: winner.partial };
  } catch {
    return {
      ok: false,
      errors: errors.filter((e): e is string => typeof e === 'string'),
    };
  }
}

async function runOverpass(
  query: string
): Promise<
  | { ok: true; json: unknown; partial: boolean }
  | { ok: false; errors: string[] }
> {
  const errors: string[] = [];
  const raced = await raceMirrors(FAST_MIRRORS, query);
  if (raced.ok) return raced;
  errors.push(...raced.errors);

  for (const mirror of FALLBACK_MIRRORS) {
    const result = await fetchMirror(mirror, query, FALLBACK_TIMEOUT_MS);
    if (result.ok) {
      return { ok: true, json: result.json, partial: result.partial };
    }
    errors.push(`${mirror}: ${result.error}`);
  }

  return { ok: false, errors };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const method = (req.method ?? 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    res.setHeader('Cache-Control', CACHE_NO_STORE);
    res.status(204).send('');
    return;
  }

  if (method !== 'GET' && method !== 'POST') {
    res.setHeader('Cache-Control', CACHE_NO_STORE);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const parsed = parseRequest(req);
  if ('error' in parsed) {
    res.setHeader('Cache-Control', CACHE_NO_STORE);
    res.status(400).json({ error: parsed.error });
    return;
  }

  const query =
    parsed.kind === 'area'
      ? buildAreaQuery(parsed.lat, parsed.lon, parsed.radiusKm)
      : buildOsmIdQuery(parsed.osmType, parsed.osmId);

  const result = await runOverpass(query);
  if (result.ok) {
    // Cache only after validation succeeded (fetchMirror already validated).
    res.setHeader(
      'Cache-Control',
      cacheControlForValidated(method, parsed.kind, result.partial)
    );
    res.status(200).json(result.json);
    return;
  }

  res.setHeader('Cache-Control', CACHE_NO_STORE);
  res.status(502).json({
    error: 'Overpass unreachable',
    details: result.errors,
  });
}

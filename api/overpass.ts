/**
 * Server-side Overpass proxy for Bacaro Tour (Vercel serverless).
 * Avoids flaky browser→Overpass calls (timeouts, blocking).
 *
 * Overpass returns HTTP 406 for missing/default library User-Agents
 * (Node fetch, axios, etc.). Identify the app explicitly.
 */

/** Vercel Node serverless: allow enough time for race + sequential fallback. */
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
const RACE_TIMEOUT_MS = 16_000;
/** Per-mirror budget for sequential fallback. Worst case: 16 + 3×13 = 55s < 60. */
const FALLBACK_TIMEOUT_MS = 13_000;

const USER_AGENT =
  'BacaroTour/1.0 (+https://bacaro-tour-iota.vercel.app; OSM data consumer)';

type VercelRequest = {
  method?: string;
  body?: unknown;
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

function readQuery(body: unknown): string | null {
  if (!body) return null;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as { query?: string };
      if (parsed?.query) return parsed.query;
    } catch {
      if (body.startsWith('data=')) {
        return decodeURIComponent(body.slice(5));
      }
      return body;
    }
  }
  if (typeof body === 'object' && body !== null && 'query' in body) {
    const q = (body as { query?: unknown }).query;
    return typeof q === 'string' ? q : null;
  }
  return null;
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

/**
 * Race mirrors in parallel; first successful JSON wins and aborts the rest.
 */
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const query = readQuery(req.body);
  if (!query || query.length < 8) {
    res.status(400).json({ error: 'Missing Overpass query' });
    return;
  }

  const errors: string[] = [];

  const raced = await raceMirrors(FAST_MIRRORS, query);
  if (raced.ok) {
    res.status(200).json(raced.json);
    return;
  }
  errors.push(...raced.errors);

  for (const mirror of FALLBACK_MIRRORS) {
    const result = await fetchMirror(mirror, query, FALLBACK_TIMEOUT_MS);
    if (result.ok) {
      res.status(200).json(result.json);
      return;
    }
    errors.push(`${mirror}: ${result.error}`);
  }

  res.status(502).json({
    error: 'Overpass unreachable',
    details: errors,
  });
}

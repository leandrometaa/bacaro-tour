/**
 * Server-side Overpass proxy for Bacaro Tour (Vercel serverless).
 * Avoids flaky browser→Overpass calls (timeouts, blocking).
 */
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

const TIMEOUT_MS = 22_000;

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
  query: string
): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
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
  for (const mirror of MIRRORS) {
    const result = await fetchMirror(mirror, query);
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

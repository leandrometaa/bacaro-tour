const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

function commonsFileUrl(filename: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=800`;
}

/**
 * Resolve Wikidata P18 (image) to a Commons FilePath URL.
 * Free, no API key. Results are memoized for the session.
 */
export async function resolveWikidataImage(
  qid: string
): Promise<string | null> {
  const id = qid.startsWith('Q') ? qid : `Q${qid}`;
  const cacheKey = `wd:${id}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const url =
        `https://www.wikidata.org/w/api.php` +
        `?action=wbgetclaims&entity=${encodeURIComponent(id)}` +
        `&property=P18&format=json&origin=*`;
      const res = await fetch(url);
      if (!res.ok) {
        cache.set(cacheKey, null);
        return null;
      }
      const data = (await res.json()) as {
        claims?: {
          P18?: Array<{
            mainsnak?: { datavalue?: { value?: string } };
          }>;
        };
      };
      const filename = data.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (!filename) {
        cache.set(cacheKey, null);
        return null;
      }
      const imageUrl = commonsFileUrl(filename);
      cache.set(cacheKey, imageUrl);
      return imageUrl;
    } catch {
      cache.set(cacheKey, null);
      return null;
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, promise);
  return promise;
}

/**
 * Resolve OSM wikipedia tag (`it:Page_Title`) via Wikipedia REST summary thumbnail.
 */
export async function resolveWikipediaImage(
  wikiRef: string
): Promise<string | null> {
  const cacheKey = `wp:${wikiRef}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const colon = wikiRef.indexOf(':');
      const lang = colon > 0 ? wikiRef.slice(0, colon) : 'it';
      const title = colon > 0 ? wikiRef.slice(colon + 1) : wikiRef;
      if (!title) {
        cache.set(cacheKey, null);
        return null;
      }

      const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        cache.set(cacheKey, null);
        return null;
      }
      const data = (await res.json()) as {
        originalimage?: { source?: string };
        thumbnail?: { source?: string };
      };
      // Prefer thumbnail on mobile — originalimage is often huge
      const imageUrl =
        data.thumbnail?.source ?? data.originalimage?.source ?? null;
      cache.set(cacheKey, imageUrl);
      return imageUrl;
    } catch {
      cache.set(cacheKey, null);
      return null;
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, promise);
  return promise;
}

/** Resolve photo placeholders: wikidata:Q… or wikipedia:lang:Title */
export async function resolveMediaPhoto(src: string): Promise<string | null> {
  if (src.startsWith('wikidata:')) {
    return resolveWikidataImage(src.slice('wikidata:'.length));
  }
  if (src.startsWith('wikipedia:')) {
    return resolveWikipediaImage(src.slice('wikipedia:'.length));
  }
  return null;
}

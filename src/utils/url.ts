/** Ensure website URLs are absolute https links. */
export function normalizeWebsiteUrl(
  raw: string | null | undefined
): string | undefined {
  if (!raw?.trim()) return undefined;
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

export function websiteHostname(url: string): string {
  try {
    return new URL(normalizeWebsiteUrl(url) ?? url).hostname.replace(
      /^www\./,
      ''
    );
  } catch {
    return url.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0];
  }
}

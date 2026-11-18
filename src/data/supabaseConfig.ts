/**
 * Public Supabase project settings for the venues cache.
 * Publishable key is safe in client code (RLS enforces public read).
 */
export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  'https://evpgxgsygppqqodnxroy.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
  (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
  )?.trim() || 'sb_publishable_O0T7WXA56lzZRgvR5HV7Ew_kIVXtNu9';

/** Soft budget for cache reads — never block the map on a slow PostgREST. */
export const SUPABASE_VENUES_TIMEOUT_MS = 6_000;

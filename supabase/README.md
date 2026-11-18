# Supabase venues cache

Bacaro Tour reads venues from Supabase first (bbox query on `public.venues`), then upgrades from live Overpass when mirrors respond, and falls back to the offline OSM/Overture packs shipped in the app.

## Schema (already applied)

- `public.venues` — cached POIs (`id`, `source`, `city`, `lat`, `lon`, `name`, `kind`, `tags`, `updated_at`). Public **read** via RLS. Indexes on `(lat, lon)` and `city`.
- `public.cache_meta` — opaque key/value metadata for refresh jobs (`key`, `value`, `updated_at`). Public **read**.

Do not change the schema from this repo; migrations live in the Supabase project.

## Row shape

| column | meaning |
|--------|---------|
| `id` | Stable cache id: `osm:node/123`, `osm:way/456`, or `overture:<uuid>` |
| `source` | `osm` or `overture` |
| `city` | Best-known city label (may be null) |
| `lat` / `lon` | WGS84 coordinates |
| `name` | Display name |
| `kind` | App venue type: `bar`, `cafe`, `ristorante`, `pizzeria`, `gelateria`, `enoteca`, `trattoria`, `osteria`, `pub`, `altro` |
| `tags` | JSONB of original OSM-like tags (`name`, `amenity`/`shop`/`cuisine`, `addr:*`, `phone`, `website`, `opening_hours`, `image`, …) so the client can reuse Overpass parsing |

## Seed from offline packs

```bash
node scripts/build-supabase-seed.mjs
```

Writes chunked SQL under `supabase/seed/venues_001.sql`, `venues_002.sql`, … (each under 800 KB) using:

```sql
insert into public.venues (id, source, city, lat, lon, name, kind, tags) values
  (...)
on conflict (id) do update set
  source=excluded.source, city=excluded.city, lat=excluded.lat, lon=excluded.lon,
  name=excluded.name, kind=excluded.kind, tags=excluded.tags, updated_at=now();
```

Apply with the Supabase SQL editor or `psql` against the project database.

## Refresh contract (Edge Function)

An Edge Function (or scheduled job) should **upsert the same row shape** from Overpass:

1. Query Overpass for the food/drink amenities the app already uses.
2. For each element with a name and coordinates, upsert:

```ts
{
  id: `osm:${type}/${id}`,       // e.g. osm:node/123
  source: 'osm',
  city: tags['addr:city'] ?? null,
  lat, lon,
  name: tags.name,
  kind: mappedVenueType,         // same kind vocabulary as seed
  tags: { ...originalOsmTags },  // keep raw tags for client parsing
}
```

3. Optionally write a `cache_meta` row (e.g. `key = 'venues:last_refresh'`) with counts and a timestamp.

Clients never write to these tables; refresh is server-side only.

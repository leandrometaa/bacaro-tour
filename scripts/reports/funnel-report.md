# Funnel report — Padova / Vicenza / Bassano

Generated: 2026-11-17T15:41:08.311Z
Radius: 5 km · Live cap: 150
Bundle size: 1733

## Padova

| Stage | Count |
| --- | ---: |
| Regional bundle ≤5 km | 498 |
| OSM live (raw) | 722 |
| OSM live after cap (150) | 150 (truncated) |
| After mergeRegional | 528 |
| UI default (no filters) | 528 |
| UI openNow-eligible (has hours) | 194 |

Completeness merged: phone 35% · website 23% · photo 0% · hours 37%

## Vicenza

| Stage | Count |
| --- | ---: |
| Regional bundle ≤5 km | 343 |
| OSM live (raw) | 494 |
| OSM live after cap (150) | 150 (truncated) |
| After mergeRegional | 371 |
| UI default (no filters) | 371 |
| UI openNow-eligible (has hours) | 62 |

Completeness merged: phone 29% · website 23% · photo 0% · hours 17%

## Bassano del Grappa

| Stage | Count |
| --- | ---: |
| Regional bundle ≤5 km | 191 |
| OSM live (raw) | 312 |
| OSM live after cap (150) | 150 (truncated) |
| After mergeRegional | 232 |
| UI default (no filters) | 232 |
| UI openNow-eligible (has hours) | 33 |

Completeness merged: phone 19% · website 13% · photo 0% · hours 14%

## Reading

- If bundle ≫ live after cap, emptiness with Overpass alone is the **150 cap**; merge should already fix density in PD/TV/VI hubs.
- If default UI ≈ merge but openNow collapses, “vuoto” with filtro aperto is **missing opening_hours**, not missing venues.
- Photo % near 0 explains empty-feeling cards even when pin count is high.

# Dataset gate decision

Generated: 2026-11-17T15:46:54.278Z

## Decision: **INTEGRATE_OVERTURE_OFFLINE**

Overture adds large density and much better phone/website completeness than OSM bundle. Proceed with offline merge (source-tagged), not a live API dependency.

## Thresholds

- Novel lift ≥ 25% → observed **229%**
- Novel phone ≥ 40% → observed **90%**
- Novel website (info) → **48%**
- Novel venues (3 hubs) → **2381**

## Funnel context (why it still feels empty)

| Hub | Bundle | Live after cap | After merge | openNow-eligible | Photo % |
| --- | ---: | ---: | ---: | ---: | ---: |
| Padova | 498 | 150 | 528 | 194 | 0% |
| Vicenza | 343 | 150 | 371 | 62 | 0% |
| Bassano del Grappa | 191 | 150 | 232 | 33 | 0% |

Live OSM alone hits the **150 cap**; merge already recovers density in-hub. Photos stay ~0%. openNow excludes most venues missing `opening_hours`.

## Next actions (this gate)

1. Build `overtureBundle.json` offline from the pilot extracts (novel + contact enrichment for matches).
2. Merge at runtime with `source: overture`, keep OSM ids untouched.
3. Keep attribution/license notes; do not claim Overture rows as OSM.
4. Later: municipal open data + user reports for photos/hours.

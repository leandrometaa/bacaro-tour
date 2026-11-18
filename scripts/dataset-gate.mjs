/**
 * Gate decision from funnel + Overture pilot reports.
 * Usage: node scripts/dataset-gate.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dir, 'reports');
const FUNNEL = join(OUT_DIR, 'funnel-report.json');
const OVERTURE = join(OUT_DIR, 'overture-compare.json');
const OUT_MD = join(OUT_DIR, 'dataset-gate-decision.md');
const OUT_JSON = join(OUT_DIR, 'dataset-gate-decision.json');

/** Integrate if avg novel lift ≥ 25% AND novel phone completeness ≥ 40%. */
const MIN_LIFT_PCT = 25;
const MIN_NOVEL_PHONE_PCT = 40;

function main() {
  if (!existsSync(FUNNEL) || !existsSync(OVERTURE)) {
    console.error('Missing reports. Run npm run data:funnel && npm run data:overture first.');
    process.exit(1);
  }

  const funnel = JSON.parse(readFileSync(FUNNEL, 'utf8'));
  const overture = JSON.parse(readFileSync(OVERTURE, 'utf8'));

  const avgLift = overture.totals.avgNovelLiftPct;
  const novelPhonePct = Math.round(
    overture.hubs.reduce((s, h) => s + h.novelCompleteness.phonePct, 0) /
      overture.hubs.length
  );
  const novelWebsitePct = Math.round(
    overture.hubs.reduce((s, h) => s + h.novelCompleteness.websitePct, 0) /
      overture.hubs.length
  );

  const integrate =
    avgLift >= MIN_LIFT_PCT && novelPhonePct >= MIN_NOVEL_PHONE_PCT;

  const decision = {
    generatedAt: new Date().toISOString(),
    decision: integrate ? 'INTEGRATE_OVERTURE_OFFLINE' : 'STOP_FOCUS_UX_OPEN_DATA',
    thresholds: { MIN_LIFT_PCT, MIN_NOVEL_PHONE_PCT },
    metrics: {
      avgNovelLiftPct: avgLift,
      novelPhonePct,
      novelWebsitePct,
      novelCount: overture.totals.novel,
      matchedCount: overture.totals.matched,
    },
    funnelHighlights: funnel.hubs.map((h) => ({
      hub: h.hub,
      bundle: h.regionalBundleInRadius,
      liveAfterCap: h.liveOsm.afterCap,
      afterMerge: h.merge.afterMerge,
      openNowEligible: h.ui.openNowEligibleWithHours,
      photoPct: h.completeness.merged.photoPct,
    })),
    rationale: integrate
      ? 'Overture adds large density and much better phone/website completeness than OSM bundle. Proceed with offline merge (source-tagged), not a live API dependency.'
      : 'Overture lift or contact completeness is too weak to justify license/dedup complexity. Prefer funnel UX (cap, openNow, photos) and municipal open data.',
  };

  const md = [
    '# Dataset gate decision',
    '',
    `Generated: ${decision.generatedAt}`,
    '',
    `## Decision: **${decision.decision}**`,
    '',
    decision.rationale,
    '',
    '## Thresholds',
    '',
    `- Novel lift ≥ ${MIN_LIFT_PCT}% → observed **${avgLift}%**`,
    `- Novel phone ≥ ${MIN_NOVEL_PHONE_PCT}% → observed **${novelPhonePct}%**`,
    `- Novel website (info) → **${novelWebsitePct}%**`,
    `- Novel venues (3 hubs) → **${overture.totals.novel}**`,
    '',
    '## Funnel context (why it still feels empty)',
    '',
    '| Hub | Bundle | Live after cap | After merge | openNow-eligible | Photo % |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...decision.funnelHighlights.map(
      (h) =>
        `| ${h.hub} | ${h.bundle} | ${h.liveAfterCap} | ${h.afterMerge} | ${h.openNowEligible} | ${h.photoPct}% |`
    ),
    '',
    'Live OSM alone hits the **150 cap**; merge already recovers density in-hub. Photos stay ~0%. openNow excludes most venues missing `opening_hours`.',
    '',
    integrate
      ? [
          '## Next actions (this gate)',
          '',
          '1. Build `overtureBundle.json` offline from the pilot extracts (novel + contact enrichment for matches).',
          '2. Merge at runtime with `source: overture`, keep OSM ids untouched.',
          '3. Keep attribution/license notes; do not claim Overture rows as OSM.',
          '4. Later: municipal open data + user reports for photos/hours.',
          '',
        ].join('\n')
      : [
          '## Next actions (this gate)',
          '',
          '1. Do not import Overture.',
          '2. Improve perceived density via UX (cap messaging, openNow honesty, non-photo list).',
          '3. Pilot 1–2 municipal open-data importers.',
          '',
        ].join('\n'),
  ].join('\n');

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(decision, null, 2));
  writeFileSync(OUT_MD, md);
  console.log(decision.decision);
  console.log(`Wrote ${OUT_MD}`);
}

main();

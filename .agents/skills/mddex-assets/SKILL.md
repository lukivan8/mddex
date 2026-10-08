---
name: mddex-assets
description: Regenerate MDDEX UI artwork or the checked-in melee reference projection using existing deterministic scripts and source attribution.
---

# mddex-assets

Select only the requested asset operation from the repo root:

- UI logo/cost WebP variants: `node scripts/generate-ui-assets.mjs`.
- Full favicon/app icon plus UI assets: `npm run assets:generate` (Chromium required). Preserve the checked-in social preview.
- Melee data projection: `python3 scripts/import-melee-chart.py`, reading `docs/sources/melee-chart-snapshot.csv` into `src/features/resources/melee-weapons.json`. This transforms a checked-in snapshot; it does not fetch a newer source.

Inspect the generator and current paths before running. Preserve source PNGs, reference credits and deliberate corrected values. A source refresh must be explicitly requested and retain dated provenance; do not expand into the private catalog publisher.

Review only expected output paths, dimensions/transparency and changed bytes or data. Run relevant resource unit tests/browser coverage for data changes and visually inspect artwork changes. Stop on unexpected overwritten paths or repeated generator failure; retain source data. Do not commit unrelated assets, update dependencies or deploy unless requested.

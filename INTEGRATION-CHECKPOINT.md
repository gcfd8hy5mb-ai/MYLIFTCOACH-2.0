# MYLIFTCOACH 2.0 — Coach/cloud integration checkpoint (2026-11-20)

## Verified code state
- Integration branch created from `feature/exercise-placeholder-migration-prep` (draft PR #2).
- The development UI references `exercise-catalog-344.js`, `coach-migration.js`, `custom-workouts.js` and `cloud-sync-preview.js`. Files exist and were fetched.
- Approved presentation is included after the other stylesheets via `rich-teal-cards.css?v=6`: card color `#04252D`, gold trim preserved, one mobile fixed marble wallpaper.
- The isolated-sync work belongs to a **different divergent** draft branch: `feature/restore-original-extras-sidebar` (PR #1).
- Neither draft has been merged into `main`; this branch is only a candidate. No production or Supabase changes.

## Import discipline
1. Do not copy PR #1's root `app.js` or `index.html` over PR #2's versions. Preserve the 344-exercise, custom-plan, and Coach wiring.
2. Review PR #1's `sync/sync-journal.js`, `sync/supabase-transport.js` and `sync/aux-data.js` for account ownership, read-only staging, conflict checks, and isolated schema dependencies.
3. Integrate cloud capabilities behind an explicit disabled-by-default feature flag; do not enable writes or invoke production migrations.
4. Add account-scoped beta Free/Pro mode only once the entitlement interface has been mapped. Do not treat a local switch as paid subscription authorization.
5. Validate actual signed-in iPhone + second-device recovery before promoting any branch, and preserve existing workout data through backup and recovery tests.

## Current acceptance
- **Code presence and CSS wiring: verified** through GitHub file fetches.
- **Running browser regressions: not performed** as part of this checkpoint.
- **Physical iPhone parity, full Coach parity, subscription wiring, cloud writes, and release: not verified**.

## Release boundary
No merge to `main`, no changes to the original `workout-tracker` app and no database schema or records changes without separate approval and evidence.

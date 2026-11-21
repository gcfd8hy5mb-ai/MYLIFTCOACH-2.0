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

## Next staged integration batch
- Brought forward exact `sync/sync-journal.js`, `sync/supabase-transport.js`, and `sync/aux-data.js` implementations from PR #1, plus their three existing Node test files.
- Added these scripts to the Coach/catalog branch HTML **without instantiating the transport or enabling writes**. No account identity, token, or remote mutation is initiated by these imports alone.
- Extended `tests/run-all.js` with the three isolated sync tests and configured the regression workflow for this integration branch.
- Verified committed presence and HTML references for all three modules and all three tests by reading the branch back from GitHub.
- **Not yet done:** binding authenticated owner-scoped completed workouts to the journal, authenticating the isolated RPC on two devices, executing/confirming fresh CI results, or publishing a test preview for this branch.

## Data model concern before enabling cloud writes
The richer workout branch still stores 2.0 demo history under `mlc2-demo-workouts-v1`, whereas auxiliary recovery expects owner-scoped keys. Connect writes only after mapping account ownership and session IDs, verifying no guest/session leakage, and defining first-sync behavior for existing local records.

## Completed-workout account binding (next batch)
- Added `sync/completed-workout-bridge.js`: opt-in only, no network calls, requires matching owner IDs and a validated completed session, and deduplicates through an owner-scoped receipt and pending journal inspection.
- In the richer workout implementation, **new** completed sessions gain an `ownerId` only when the beta has a signed-in account and token. Guest sessions and pre-existing unowned demo sessions remain unowned; they are not implicitly eligible for cloud upload.
- Local workout persistence still completes **before** calling the bridge. The runtime invocation is hard-disabled (`enabled:false`, `journal:null`); this release neither queues uploads nor uploads any workout.
- Added `tests/completed-workout-bridge.test.cjs` covering disabled behavior, owner rejection, invalid sessions, deduplication, journal mismatch, and receipt-write failure; included in the offline regression runner. The tests are committed but **not independently executed in this session**.
- Original application, production Supabase tables, and live beta remain unchanged.

### Required before enabling writes
1. Verify the user session against Supabase Auth on every sync session, refreshing expired credentials and binding the journal to the exact owner.
2. Ensure committed workouts are durably account-scoped at rest, including sign-out/account switching; the current demo history namespace is browser-wide.
3. Integrate an isolated, explicitly enabled journal plus transport only against the approved `mlc2_v1_*` RPCs and verify live RLS/account separation.
4. Prevent replay and avoid destructive eviction of locally completed sessions before cloud acknowledgement; test across iPhone + desktop.
5. Add a visible queued/acknowledged/conflict status and recovery path, then run automated and physical-browser verification.

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

## Account separation / verified Auth batch (2026-11-20)
- Introduced `sync/account-workout-store.js`. Verified accounts now persist completed 2.0 workouts under `mlc2-account-workouts-v1:<owner>`, while guest history remains at the preexisting demo key. Signed-in account history is switched only after a confirmed `auth/v1/user` lookup. Sign-out switches back to guest data and does not delete account history.
- Legacy shared demo rows bearing `ownerId` are hidden from guest presentation and preserved across guest saves and guest clears. They are **not automatically migrated** into owner namespaces or sent to cloud.
- New account-tagged workout completion writes to account-scoped local history first. The existing isolated journal bridge remains explicitly disabled (`journal:null,enabled:false`). No automatic upload, cloud recovery or new RPC call was enabled.
- Added an asynchronous token-refresh epoch guard to prevent a stale refresh from reestablishing identity after account changes.
- Added `sync/verified-auth.js` as an opt-in, read-only Supabase Auth boundary for later transport wiring. It requires a matching owner, non-expiring token, server-confirmed ID, and stable session after the request. It is **not activated** for cloud sync.
- Added `tests/account-workout-store.test.cjs` and `tests/verified-auth.test.cjs` to the regression runner, covering account cross-contamination, guest record preservation, corrupt/failed storage, expiry, server mismatch, and mid-request account changes.
- Verified repository files and script references after commits. The full Node regression suite was **not run locally** because the container could not reach GitHub for clone; CI outcomes and browser acceptance are unconfirmed.

### Remaining release blockers
1. Account-verified cloud transport initialization, explicit sync enablement, conflict-safe journal recovery, and non-destructive local history retention.
2. Audit historical shared demo sessions for any explicitly approved, owner-specific migration. Do not auto-claim them.
3. Migrate auxiliary feature views still inspecting old demo keys, then verify all local-first Coach/workout/history views align after account changes.
4. Run automated regressions on the integration branch and physical iPhone plus laptop acceptance.
5. Only after verified RLS and recovery tests, separately authorize any real cloud writes and beta release promotion.

## Read-only cloud inspection and no-eviction batch (2026-11-21)
- Added `sync/cloud-session-inspection.js` with explicit owner-verified, paged read-only inspection of isolated 2.0 workout sessions. Checks remote owner and revision, rejects duplicate IDs/overlarge scans and account switching, compares IDs against signed-in local sessions. Returns counts only; **never restores or writes records**.
- Added `Check cloud workouts` under Settings, wired to verified Supabase Auth and the existing isolated `mlc2_v1_list_sessions` RPC transport only on user click. Reports cloud-only/overlapping counts; rejects unverifiable accounts or unavailable RPCs without touching local data. Automatic upload remains OFF.
- Fixed a malformed `catch` in the workout-completion handler; added explicit detection of owner change between opening and completing a workout.
- Replaced silent `slice(0,100)` workout-history eviction with bounded, fail-closed storage up to 500 sessions. Old history is never dropped merely to save a new session.
- Updated data-health reporting to examine active account sessions. Disabled the old guest-only recovery-export/restore UI for signed-in accounts to avoid a falsely complete backup or cross-account restore; account-aware recovery export remains outstanding.
- Added `tests/cloud-session-inspection.test.cjs` and account-history retention cases to the test suite, plus CI `node --check` syntax checks for integration JavaScript.
- Read-back verified new modules, HTML Settings button, script reference, regression runner inclusion, and preserved approved CSS link. **No passing CI result or browser/device acceptance is claimed here.** The container could not reach GitHub to run Node locally.

### Next remaining critical tasks
1. Verify GitHub Actions CI result, fix any test failure, and run physical iPhone/laptop inspection.
2. Implement proper account-specific backup export/import with conflict-safe restore and on-device view refresh.
3. Review isolated RPC availability/RLS with real two-account tests; only then introduce explicitly enabled upload and durable ack/retry.
4. Confirm custom-plan priority, Coach and full exercise catalog on the integrated preview.
5. Protect original production app and Supabase records from migration without separate authorization.

## Account-specific recovery and draft isolation (2026-11-21)
- New `sync/account-recovery.js` implements a local JSON backup containing only the verified account's completed workouts. The file includes no authentication token or photo data. Restoration is additive only; matching IDs with different content block the entire operation and no existing workout is replaced.
- New Settings actions: `Download account workouts`, choose backup file, `Restore missing workouts`. Account owner is rechecked after file reading and after confirmation. Successful restores refresh the current Home/Progress/History/Coach views. No Supabase writes.
- The previous guest-only backup remains separate; signed-in users now have their own account-workout export and recovery, instead of a misleading guest-only export.
- New `sync/account-draft-store.js` scopes unfinished 2.0 workout drafts by owner. Guest data stays in the original draft key; account A and B drafts cannot be cross-resumed. Set logging and undo reject account switching during an active workout.
- Added `tests/account-recovery.test.cjs` and `tests/account-draft-store.test.cjs` to the offline runner. CI syntax verification expanded for the new modules.
- **Scope:** Integration branch only. Existing production app, GitHub Pages main beta, and original Supabase records remain unchanged. Automatic cloud upload remains OFF.
- **Verification:** GitHub fetch confirms committed code and test files. GitHub Actions green status, physical-browser testing, and the new Settings UI are not independently confirmed in this session. An attempted local GitHub clone failed because github.com DNS was unavailable.
- Existing prior automated cloud-sync test results remain retained. This is a new integration surface, not a request to repeat completed core sync testing.

### Release blockers remain
1. Full integration regression CI must pass, including login, account switch, completed workout, drafts, new backup/restore and Coach.
2. Integrate the proven isolated automatic sync and recovery logic from the separate draft branch without overwriting the richer Coach/library branch.
3. Confirm genuine 2.0 account-specific recovery on a second device as the integration acceptance delta; no production migration before sign-off.
4. Finish beta Free/Pro entitlement and subscription separation.

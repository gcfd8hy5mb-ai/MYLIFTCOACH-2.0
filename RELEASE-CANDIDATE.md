# MYLIFTCOACH 2.0 — Development release-candidate gate

This draft branch is **not approved for merge or deployment**. Keep production MYLIFTCOACH and all existing Supabase records unchanged until the checks below pass.

## Offline automated checks (no paid APIs)

Run from the repository root on a computer with Node.js installed:

```bash
node tests/run-all.js
```

The command invokes three independent test files: static integration contracts (344 catalog records, script ordering, UI hooks, no cloud-preview write calls), local migration/recovery invariants (unfinished session drafts, backup/restore conflicts, malformed data, data health) and Coach progression rules (session ordering, warm-up handling, insufficient history, exercise-specific load increments, selected-plan alignment).

These checks do **not** prove that Safari, desktop browsers, Supabase auth, or photo downloads work. Do not promote a branch based only on an offline PASS.

## Manual acceptance — run on an iPhone and desktop preview before merge

- [ ] Existing-account sign-in works without freezing. Failed login and token expiry are recoverable.
- [ ] A saved custom workout is prioritized over presets whenever it is selected.
- [ ] Home Today's Workout, the Workouts selection marker, the opened workout and Coach all show the same plan and exercise order.
- [ ] Create, edit and delete a custom routine; refresh; selected workout remains correct.
- [ ] Log multiple sets across two exercises. Refresh before finishing; resume the same exercise list and verify sets persist.
- [ ] Attempt to switch to another workout with an unfinished draft. Cancel retains the draft; confirmation makes the new plan explicit.
- [ ] Complete a workout. History, home totals, progress charts and Coach agree after refresh; no phantom entries if storage fails.
- [ ] Export a local recovery file, inspect the file type, and restore **only on a separate empty test browser**. Conflicting existing records must be rejected without changes.
- [ ] Save a copy of an IndexedDB progress photo. Confirm that it is **not included** in the JSON recovery backup.
- [ ] Read-only cloud account comparison returns data for the authenticated user only. Test wrong-account and expired-session handling without writing.
- [ ] Check full 344-exercise library for matching descriptions, muscle groups, technique notes, and nonblank placeholders.
- [ ] Verify approved demonstrations only after obtaining the matching private media manifest/files and license status.

## Release blockers

1. **Cloud sync incomplete:** Original backend account record shapes, owner-bound revision checkpoints, and explicit cross-app migration still need integration and real account testing. The present controls are read-only previews, not working cross-device sync.
2. **Demonstrations incomplete:** The latest 268 approved media files are not available in the 2.0 repository. The imported catalog contains 344 exercise entries, not 344 approved visuals.
3. **Coach incomplete:** Only migrated local workout progression, substitution, weekly readiness, selected-plan review and catalog technique notes have been verified in development.
4. **End-to-end acceptance incomplete:** No physical-device test has been performed through this tool session.

## Rollout protections

- Keep pull request #2 in draft until all release blockers are addressed.
- Do not replace original Supabase policies, tables, or user records.
- Do not silently claim or overwrite original users' local data.
- Never treat an empty client-side history as evidence of an empty original cloud account.
- Keep the original production app available until an explicit cutover/rollback decision.

## GitHub-hosted automated verification — November 18, 2026

A draft-branch GitHub Actions workflow now runs `node tests/run-all.js` on changes to `feature/exercise-placeholder-migration-prep` and pull requests targeting `main`. It uses Node 22, standard GitHub-hosted compute, and no external API credentials or deployment tokens.

**Verified completed run:** workflow run `44430476871`, job `135246265357`, conclusion `success`. Its logs confirmed PASS for:

1. Static integration contracts (catalog, script order, UI controls, read-only cloud-preview safeguards).
2. Recovery/migration regression (drafts, local export/import, conflict rejection, original mapping).
3. Coach regression (progression, history ordering, selected workout).

This clears the **offline automated test gate only**. Real iPhone/desktop acceptance, 268 approved image transfer, production account sync and full Coach parity remain blockers. The GitHub job emitted a Node runtime deprecation warning from its runner/actions; it did not affect test completion.

## Coach weekly goal — verified development batch

The Coach readiness panel now provides a persisted 1–7 workout weekly target, defaulting to four. Weekly progress uses the selected target instead of a permanent hard-coded four-workout goal. The target remains private to the 2.0 browser: `mlc2-weekly-goal-v1`. The existing versioned recovery JSON includes it and the restore validator rejects out-of-range values; local integrity inspection also checks the goal. The Coach description was updated to reflect current implementation.

**GitHub Actions run #44437207479: SUCCESS.** Logs confirmed the updated Coach and migration regression tests passed, including weekly goal saving and restore-validation cases. This verifies offline Node behavior, not iPhone/Safari behavior or production account synchronization. No production rules, user accounts, or cloud records modified.

## Coach training consistency (November 18 development batch)

Added `coach-trends.js`, a local read-only comparison of this week's and last week's **actually completed** 2.0 sessions: training days, session count, weighted sets and set volume. Coach reflects the user's selected 1–7 workout weekly goal, shows the remaining number of workouts to that target and does not invent missing progress. Comparisons are descriptive and cannot diagnose health or readiness. Updated static UI and script-order checks and Coach regression fixtures for Monday/Sunday week boundaries, empty history, training volume and goal completion. Readiness check-in saves now verify browser persistence.

**Verified GitHub Actions run #44439274820: SUCCESS.** Job #135275774067 logs show PASS for static, migration/recovery, and Coach regression tests. This is offline Node testing only, not mobile/browser acceptance. No original records, production cloud tables, or deployments were modified.

## Authenticated original cloud archive (November 18 development batch)

Settings now includes an **explicitly confirmed, GET-only export** of the signed-in original MYLIFTCOACH account's accessible Supabase records. It validates the identity at `/auth/v1/user`, queries only `prism_account_*` tables enumerated by the original `PRISMStorageModel.TABLES` allowlist, requires every returned row's `user_id` to match the signed-in account, and checks the authenticated identity again before offering the file. If any query or ownership check fails, no partial archive is downloaded. Per-table page count is capped at 5,000 rows, with a 30 MB serialized archive limit. The private download is intentionally **not a restore format** and can include personal records; keep it secure.

**GitHub Actions #44440084955: SUCCESS.** Logs verify static contracts, migration/recovery, Coach and new cloud-archive tests, including GET-only requests, owner mismatch rejection, failed reads and secret-token exclusion. Tests use synthetic responses; no production account export, browser download or live-device testing has been completed. This does **not** mean full account synchronization or a safe bidirectional merge is complete.

## Original cloud versus 2.0 migration readiness preview

A new Settings control accepts an **original cloud archive JSON from the signed-in account** and compares it locally to 2.0 custom workouts and practice sessions. The archive must match the current account ID and original table manifest, every record must have the same owner, all table counts and overall row counts must match, and duplicate cloud IDs are rejected. The original `PRISMStorageModel.restoreSnapshot` function rebuilds legacy workouts/sessions only **in memory**. The existing legacy mapper then identifies convertible 2.0 workouts, sessions, and sets; rejects malformed items and flags collisions. The preview highlights missing original source categories but never interprets absence as proof of no cloud data.

**Fail-closed:** `canWrite:false`, `canMerge:false` and `requiresCheckpoint:true` are unconditional. The preview does not fetch, store, restore, merge, or write account records. The downloaded JSON may contain sensitive personal information; it is not uploaded. Neither account identity checks against a live backend nor real device archive selection have yet been verified.

**GitHub Actions #44440511919: SUCCESS.** Five offline test groups passed, including new synthetic archive owner mismatch, duplicate ID, malformed manifest, record count, and rejected-conversion cases. Account-safe revision checkpoints, original-compatible numeric ID migration and cloud rollback remain outstanding.

## Original-account revision checkpoint comparison (November 18)

Added `cloud-checkpoint-review.js`, a **pure offline comparison** of two user-supplied original account archives. Settings now accepts an older baseline and newer snapshot for the **same signed-in account** and displays counts of unchanged, new, modified and deleted records, as well as suspicious revisions. Each archive must pass the original manifest, owner, count and duplicate-ID validations. Archive chronology must strictly increase. An unchanged revision with changed payload, a declining revision, missing revision, or deleted row is marked as a blocker. Contents of user records are never displayed in the comparison, and neither file is uploaded.

**GitHub Actions #44443812172: SUCCESS** (job #135290919969): static UI contracts, local migration/recovery, Coach, original account archiving, migration readiness and new checkpoint drift tests all passed. The comparison is **not a live atomic checkpoint**; `canWrite:false` and `canMerge:false` remain unconditional. Actual revision-safe cloud writes, rollback verification, production account sync, and real-device testing are not completed.

## Original cloud workout-history viewer — November 18 batch

The **Workout History** page now has a distinct read-only original cloud archive viewer. While authenticated with the matching account, users can choose their previously exported original account JSON and see original workouts, exercises, sets and weights in a separate panel. The original `PRISMStorageModel.restoreSnapshot` decodes the archived cloud records **in memory only**. Archive owner/table/count validation is inherited from `MLC2MigrationReadiness.inspectArchive`. It displays up to the 80 newest original sessions (the full downloaded archive remains intact). The viewer does **not** promote original cloud history to 2.0 completed practice sessions, Coach analytics, or selected routines. The cloud archive view is explicitly cleared on account sign-out or when the user selects Clear archive view. A refresh does not persist the viewed archive.

**GitHub Actions run #44445435881: SUCCESS.** All seven test groups passed, including new synthetic archive tests for owner mismatches, original exercise and set fidelity, display separation and no writes. The new feature has not yet been tested against a real account archive in Safari or desktop browser. It does not constitute a cloud sync or account migration.

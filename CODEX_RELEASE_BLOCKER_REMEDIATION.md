# MYLIFTCOACH 2.0 release blocker remediation

**NO-GO for replacing the original app.** The candidate passes the offline suite and can move to isolated acceptance after an authorized preview is available. Same-origin separation, server-side deletion protection, and installed iPhone acceptance remain open.

Base commit `1972e5317a7bc3e03dec8b3ca64cdf8ff02aa3d4`. Remediation commit `2f977f2116454bce548648d7ddcf722a44429946` on local branch `review/release-blocker-remediation-20261123`.

## Findings

This batch fixed 10 application issues. It confirmed one additional server-side defect and prepared a change for isolated database verification. Seven historical test failures were corrected separately.

| Severity | Issue | Correction and principal files |
|---|---|---|
| High | An older window could renew or clear the persistent token after another account signed in. | Automatic refresh and invalid-session cleanup match the previous credentials before writing. Explicit sign-in retains its existing behavior. `app.js`, `sync/auth-session-store.js` |
| High | Terminating the app between writes could split a routine, weekday schedule and manual selection, or a goal calendar, program source and calorie profile. | Owner-scoped write-ahead journal with verified roll-forward or rollback. Recovery stops on divergent values and keeps the transaction for review. The correlated cloud restore categories use the same journal. `custom-workouts.js`, `app.js`, `sync/aux-data.js` |
| High | Concurrent windows could overwrite each other's draft or finish and clear a newer draft. | Draft mutations and completion use the owner history lock on browsers with Web Locks. The scoped adapter also compares the exact stored draft before mutation. `app.js`, `sync/account-draft-store.js` |
| High | A deliberately cleared local workout could return from an older backup or still upload from a queued retry. | Record owner-scoped local deletion markers before clearing. Cloud recovery, file recovery and queued upserts respect those markers. Local clearing continues to leave cloud records intact. `sync/account-workout-store.js`, `sync/automatic-workouts.js`, `sync/account-recovery.js`, `sync/sync-journal.js` |
| High | Completed-workout recovery treated an unchanged ID as sufficient evidence after the confirmation prompt. | Compare the approved revision and payload on reinspection. Recheck local history and deletion markers within the write lock. `sync/automatic-workouts.js` |
| High | Auxiliary recovery allowed the same category to return with different content after approval. | Recover only the confirmed category snapshot and revision. Explicit empty routine, schedule and selection values retain the previous review's protection. `sync/auxiliary-cloud.js`, `sync/aux-data.js` |
| High | Retrying queued auxiliary data could publish an obsolete schedule or profile before replaying a newer local edit. | Reconcile known lost acknowledgements using the exact remote content and revision. Supersede obsolete upserts and check the local payload again immediately before each send. `sync/auxiliary-cloud.js`, `sync/sync-journal.js` |
| Medium | A stale editor or async action could write a day or routine over another window's edit. | Serialize plan mutations by owner where Web Locks are available; recheck the owner, affected routine and assigned weekdays before applying the corresponding edit. `app.js`, `custom-workouts.js`, `full-week-builder.js`, `weekly-workout-schedule.js`, `coach-program-builder.js` |
| Medium | A Coach preference change copied unrelated form values from a stale window. | Read the latest owner record inside the lock and write only the changed field. `app.js` |
| High | An update could automatically replace an existing document or force a reload after a narrow set of dialog checks. | Stage the complete shell in a new cache, let the previous worker retire when its clients close, and remove automatic page reload. Keep foreground update checks. `offline-shell.js`, `offline-worker.js`, `index.html` |
| High | The deployed RPC's revision check does not prohibit an upsert of a tombstoned record at its current revision. | Prepared `review/mlc2-commit-tombstones.sql`. It retains caller RLS and receipt replay semantics, rejects records with a deletion marker and adds the expected revision to the final write condition. The SQL was not run. |

## Verification

| Check | Result |
|---|---|
| `node tests/run-all.js` | 79 registered files passed, with 417 passing Node subtests and 0 failing, plus standalone assertions. |
| `node --test tests/*.test.cjs tests/*.test.js` | 440 passed, 0 failed, 0 skipped. These totals include the release tests. |
| Historical 11-21N checks | 8 passed. Three immutable checks now compare the actual historical enhancement SHA against its approved baseline. Four DOM fixtures supply `window` and verify the controller export. Both check families still run. The historical checks require their Git objects in a fresh checkout. |
| Targeted exercise media and guides | 31 passed. The catalog contains 344 exercises, including 263 approved full-size and thumbnail pairs and 81 withheld demonstrations. No approved art, mappings, or CSS files changed. |
| Syntax and diff | 154 tracked JavaScript/CommonJS files passed `node --check`. `git diff --check` passed. |
| Browser and iPhone | The local Chromium process could not start because the execution environment denied its required socket. Automated DOM, storage, and service-worker fixtures passed. No physical device or native Safari behavior was tested. |
| Supabase | Read-only production catalog inspection and synthetic transport tests completed. No authenticated production recovery, data write, SQL application, or permissions change was performed. |

New behavioral regressions exercise guarded drafts, token isolation during account changes, interrupted and divergent plan journals, coordinated goal-profile rollback, same-ID/same-category recovery races, lost acknowledgements, stale queued schedule writes, and local deletion with pending sync or unavailable storage. Existing guards continue to exercise Home workout precedence, rest days, Coach, workout logging, Free/Pro beta entitlements, and exercise mappings.

## Supabase and storage isolation

Catalog inspection confirmed that `mlc2_v1_read`, `mlc2_v1_list_sessions`, and `mlc2_v1_commit` run as the caller. The effective `anon` role cannot execute the three RPCs. They derive ownership from `auth.uid()`; the private records and receipts tables have RLS enabled and owner-bound policies. Authenticated table access is subject to those policies. The production commit function uses a per-record advisory lock, an expected revision, and per-owner operation receipts. Those controls do not make a tombstone final under the current function. Verify the prepared SQL against an isolated copy of the schema with synthetic accounts, covering anonymous execution, ownership, competing revisions, receipt replays and deletion. Applying it to the production project requires explicit approval.

The two existing routes share the `gcfd8hy5mb-ai.github.io` origin. Namespaced auth, plan and draft keys prevent accidental application collisions. Page paths and service-worker scopes do not provide a browser storage security boundary. The proposed cutover is to approve a dedicated HTTPS origin, leave current installations available, sign in again through the same approved Supabase project on the new origin, and review any configured auth callback URLs before launch. Device-only drafts, routines, clear markers and photos need verified recovery or a separate approved transfer before retiring either installation. Authentication tokens should not be transferred. The new origin and recovery flow have not been created or exercised.

A browser without Web Locks still has exact-value conflict checks and a write-ahead journal. Those checks cannot guarantee strict serialization across independent tabs or older clients. A signed-in app can keep saving locally when a running, verified session loses connectivity. A cold offline launch cannot establish a previously cached owner without contacting Supabase. Account data and credentials remain stored, and reopening online revalidates the owner. If cold offline account access is a release requirement, it needs an approved offline identity design and separate acceptance.

## Remaining acceptance on one iPhone

1. On the authorized isolated candidate, keep the existing installation and data intact. Check Safari and an installed Home Screen instance for the status-bar and Dynamic Island area, fixed marble continuity, bottom navigation, scrolling and keyboard focus. Compare a refreshed installation with a fresh isolated shortcut if the former retains old status-bar metadata.
2. Log sets, then background, close, and reopen. Confirm the correct Resume entry and the exact sets. Finish while a verified account is offline, reconnect, and verify one backup and one completed workout. Confirm how cold offline launch behaves for the same account.
3. Stage an update while a workout and, separately, an unsaved program are open. Confirm neither is reloaded. Close naturally and check the next launch shows the updated shell and preserves saved data.
4. Perform a live backup/recovery check only against an authorized isolated test account. Use synthetic data to verify clears stay cleared, and confirm Free/Pro beta switching and synced data stay scoped to the signed-in account.

The 81 withheld demonstrations remain placeholders. The beta switch continues to preview Free and Pro without conferring a paid entitlement. No branch was pushed, no deployment was created, no production settings or data were changed, and nothing was merged.

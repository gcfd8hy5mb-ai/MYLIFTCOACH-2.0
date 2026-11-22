# MYLIFTCOACH 2.0 final integration review

- **Release recommendation — BLOCKED**
- **Review branch** `review/codex-final-integration-20261122`
- **Frozen integration baseline** `e525e962124c2d8fad503c9bd9139d79e69e2bb4`
- **Fix commits** `7aeced0c77248b31ae269967bd630c5a5db1b305` and `d6c4e3c`
- **Review date** November 22, 2026

The review found **26 distinct findings**, with **20 fixed** and **6 open**. The review branch remains local. Draft PR #7 still points to the frozen integration branch. No Pages deployments, production database operations, merges, or artwork changes took place.

## Fixed findings

The reproduction column describes the pre-fix behavior. The test column identifies behavioral regressions or updated integration coverage. Browser-facing paths still require device acceptance.

| # | Severity | Reproduction and root cause | Correction and files | Regression evidence |
|---|---|---|---|---|
| 1 | High | Complete a workout from an open screen after another screen saved a session. Finish replaced durable history with its stale in-memory copy. | Read durable history immediately before adding the record in `sync/account-workout-store.js` and use that operation from `app.js`. | `account-workout-store.test.cjs` |
| 2 | High | Interrupt completion after history persisted and before draft cleanup. The remaining draft could be completed again with a new ID. | Carry the same workout ID through draft saves and completion, suppress a completed draft, and match cleanup to its ID. `app.js`, `session-draft.js`, `sync/account-workout-store.js`. | `account-workout-store.test.cjs`, `resume-workout-cta.test.cjs` |
| 3 | Medium | Log more than 250 sets. The old draft limit exceeded the completed-workout and cloud limits, preventing Finish. | Guard new set entry at 250 and continue reading legacy drafts with more sets. `app.js`, `session-draft.js`. | Completion-store, draft and active-workout integration checks. |
| 4 | High | Enqueue from a second journal while the first awaits a cloud acknowledgement. The first persisted its stale snapshot and removed the second operation. | Re-read the journal before mutations and apply receipts to the current contents by operation ID. `sync/sync-journal.js`. | `sync-journal.test.cjs` |
| 5 | High | Place workout and auxiliary records in the same queue. Either drain could consume the other pipeline's operations or be blocked by its conflicts. | Filter both drains, with per-pipeline pending counts. `sync/sync-journal.js`, `sync/automatic-workouts.js`, `sync/auxiliary-cloud.js`. | `sync-journal.test.cjs`, `automatic-workouts.test.cjs`, `auxiliary-cloud.test.cjs` |
| 6 | High | Edit a category after the server accepted a write whose acknowledgement was lost. The retry classified the new local value as a conflict with its own queued snapshot. | Replay the immutable operation and retain its confirmed baseline before removing it from the journal. Schedule a follow-up for the newer value. `sync/auxiliary-cloud.js`, `sync/sync-journal.js`. | `auxiliary-revision.test.cjs` |
| 7 | Medium | Close sign-in while the password request is pending. Its callback could sign in after the user dismissed the form or throw while trying to update it. | Capture the form and auth epoch and check that the attempt remains active after each await. `app.js`. | `auth-persistence-iphone.test.cjs` |
| 8 | Medium | Reopen while offline with saved authentication, then reconnect. The online listener scheduled sync with an unverified owner and never retried session validation. | Revalidate saved identity on reconnect before starting owner-scoped sync. `app.js`. | Existing auth persistence, token refresh and offline transport suites. Reconnect on iPhone remains unverified. |
| 9 | High | Change accounts after opening private views or while a cloud read is pending. Account inputs and output elements retained values, and some callbacks could paint an earlier account's result. | Clear owner-specific forms and results, close the modal, protect affected callbacks with the auth epoch, and bind sync engines to that epoch. `app.js`. | Owner-scoping and auth tests. Account-switch rendering still requires browser acceptance. |
| 10 | High | Open the custom editor, then change owner or encounter unreadable saved routines. An open editor could save into the new workspace, or a parse fallback could overwrite unreadable storage. | Dismiss the editor on owner change, reject its stale handler, require readable storage for writes and detect routines deleted while editing. `custom-workouts.js`. | `account-custom-scoping.test.cjs`, `custom-home-priority.test.cjs`, `coach-save-custom.test.cjs`. |
| 11 | Medium | Try to pin an already recommended routine, or edit an unrelated routine while a workout is selected. The pin control was disabled for any current suggestion, and editing could switch Today. | Disable the pin control only for explicit selection and preserve the current choice when editing. New personal routines retain the existing auto-select behavior. `app.js`, `custom-workouts.js`. | `custom-home-priority.test.cjs`, `coach-save-custom.test.cjs`. |
| 12 | Medium | Change the day's selection or a generated day's exercises after the preview renders. Start could open a different prescription under the same ID. | Check the rendered title, ID, exercises and program week before opening. On change, refresh the preview and let the user review it. `app.js`. | `custom-home-priority.test.cjs`, `coach-live-handoff.test.cjs`. |
| 13 | Medium | Add a future-dated or unusable record with a nonempty set array. The central Coach evidence filter counted it as completed. | Exclude invalid dates, future dates and sessions without qualifying sets. Keep existing owner and preview guards. `app.js`, `workout-active-ux.js`. | `coach-live-workout.test.cjs`, `coach-consistent-history.test.cjs`. |
| 14 | Medium | Supply blank or null historical weight, or load without the active-workout helper. The former could coerce to zero and the latter supplied a fallback of 40 lb × 10. | Reject blank or malformed saved values, exclude future history and render empty defaults when unavailable. `app.js`, `workout-active-ux.js`. | `active-workout-ux.test.cjs`, `progress-real-volume.test.cjs`. |
| 15 | Medium | Include an invalid legacy set in the chart or open Strength's pounds-lifted card. The chart used an unvalidated calculation and the card had no renderer call. | Use the same validated volume function as records and connect the existing per-set breakdown. `app.js`. | `progress-real-volume.test.cjs`, `progress-compact.test.cjs`. |
| 16 | Low | Open a completed workout containing an exercise outside the preset subset. History displayed the catalog ID as if it were the exercise name. | Resolve history names against all 344 exercises. `app.js`. | `progress-weekly-summary.test.cjs`. |
| 17 | Low | Restore a valid legacy profile with a height at either metric boundary. Rounding could display feet and inches that the estimator then rejected. | Round to a valid whole-inch value and require an explicit inches entry. `calorie-goal-estimate.js`. | `calorie-goal-estimate.test.cjs`. |
| 18 | High | Save a progress photo, then switch between accounts or guest mode. The device photo list, export and delete paths were unscoped. | Bind new photos to their owner, filter all access paths, and invalidate late reads across account changes. Legacy unowned rows remain stored and hidden. `body-progress.js`. | `body-photo-owner.test.cjs`. The test covers owner filtering and an out-of-order render. |
| 19 | Low | Save a draft and exit to an already open Home or Today screen. The visible action could still say Start until another render or reload. | Refresh both buttons after closing an active session and clear closed modal contents. `app.js`. | `resume-workout-cta.test.cjs`, `workout-auth-ux-fix.test.cjs`. |
| 20 | Medium | Refresh a token with a changed account beta preference. Settings updated, but workout and Coach views could still show the previous mode. | Refresh Home, Workouts and Coach when verified metadata changes the mode. Preserve the existing open beta policy and paid entitlement boundary. `app.js`. | `beta-access.test.cjs`, `beta-live-refresh.test.cjs`, `refresh-session.test.cjs`. |

`index.html` updates cache versions for changed runtime files. CSS, artwork, image manifests and catalog source were verified unchanged. The regression runner now includes media, progress and Coach modules that existed outside the standard run. Some older tests asserted hard-coded script versions, retired markup, or the prior completion call. Where the candidate still implements the same behavior, those contracts were updated to check its current entry points.

## Verification

| Check | Result |
|---|---|
| `node tests/run-all.js` | **PASS**. 65 files, 333 Node subtests passed, plus successful standalone assertion scripts. |
| `node --test tests/*.test.cjs tests/*.test.js` | **356 passed, 14 failed**, out of 370. The original review-branch baseline had 336 passing and 26 failing out of 362. All 14 remaining failures reproduced on the baseline. |
| `node --check` across tracked JavaScript and CommonJS | **PASS**, 139 files including the new photo-owner test. |
| Replacement media and workout-card tests | **PASS**, 24 checks including the 344 catalog IDs, all 263 mappings, 81 placeholders and the artwork-loading path. |
| Image decoding and duplication | **PASS**. Decoded 526 WebP files and the shared placeholder. Zero identical-byte file groups. Mappings match the approval manifest. This verifies the existing approval inventory and file contents; the review did not re-adjudicate artistic or anatomical approval. |
| HTML entry-point inspection | **PASS**, 84 local static asset paths and 184 unique element IDs. |
| Browser smoke | **NOT VERIFIED**. The local Chromium process failed to start because the execution environment disallowed a required socket operation. |
| Physical iPhone | Prior reported acceptance retained for workout persistence, Resume Workout and guest Free/Pro switching with totals retained. No fresh physical Safari or Home Screen assessment of the review commits. |
| Supabase | Offline identity, token renewal, idempotent operation, revision conflict and recovery fixtures passed. Live account verification and post-fix backup/recovery were not run. The separate public preview intentionally blocks cloud access. |

### Remaining test failures

| Count | Files | Finding |
|---|---|---|
| 3 | `coach-weekly-schedule.test.cjs` | Expects the separate Coach scheduling panel. The combined route uses the existing weekly editor to select saved routines. |
| 4 | `workout-simulation-integration.test.cjs`, `workout-simulation.test.cjs` | Expects 30/90-day simulation controls in the regular History and Progress screens. The combined app has separate Coach-only preview sample history. The legacy simulation modules' computational tests pass. |
| 7 | `workouts-tab-regression.test.cjs`, `workouts-tabs-dom.test.cjs` | Three tests require byte-identical files from the older 11-21N checkpoint and four use a DOM fixture for its inactive enhancer that lacks a browser `window`. The combined page has native tab markup and its own routing checks. |

## Open findings

| # | Severity | Issue and release impact |
|---|---|---|
| 21 | High | Workout completion and journal updates preserve newer observed records but still use multi-step localStorage read-modify-write operations. Independent tabs committing at precisely the same time lack an atomic transaction across contexts. An approved storage change or browser-supported locking and device testing are required to close that race. |
| 22 | High | Full offline cold start is unverified, and the root candidate does not provide a service-worker app-shell cache. A currently loaded app can persist offline writes, but a signed-in workspace reopened offline still waits for identity verification before opening private records. This behavior protects account boundaries. |
| 23 | Medium | Durable completed-workout history is capped at 500 local records and cloud inspection at fewer than 1,000 rows under the current paging guard. Long-running accounts will need an archive/paging strategy that preserves existing workout IDs and recovery. |
| 24 | Medium | Older progress photo rows lack an owner field. They remain on the device and are excluded from guest and account views because their ownership cannot be proven. Any recovery requires an explicit, reviewed assignment path. |
| 25 | Medium | The combined Schedule screen lacks the prior Coach-specific shortcut panel. Manual assignment of a saved Coach routine remains available through the weekly editor. The earlier dedicated panel's three assertions remain unresolved. |
| 26 | Low | The combined candidate does not expose the earlier 30/90-day simulation dashboard. Its diagnostic tests and the current isolated Coach sample mode cover different entry points. |

No styling or payment-policy changes were needed to address the findings. The repository's approved beta policy allows guests and authenticated accounts to choose Free or Pro as a preview; no mode grants a paid subscription.

## Merge and release safety

The merge base is `5f8f5b7cd528ec7a39297519f1125fc3103f97e6`. The integration branch is **705 commits ahead and 39 behind** `main`. The base-to-integration diff touches 691 files, with most additions in exercise assets, application modules and tests. The main-only tip changes touch seven files, including the Pages workflow and six files under `review/`. Main's Pages workflow checks out pinned references from a different repository and the approved visual branch. A successful application merge would not establish that the published artifact uses the combined candidate. Review the intended packaging source, reversible original release snapshot, and deployment trigger together before selecting a merge strategy.

The candidate remains blocked for release until signed-in recovery and updated iPhone/PWA behavior are verified in authorized staging, the open data durability and cutover risks are resolved or explicitly accepted, and the original deployment's rollback path is established. Earlier successful iPhone acceptance remains part of the release evidence and does not need to be rerun merely because an unrelated code path changed.

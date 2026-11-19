# Exercise library import status

**Completed on this development branch:** `exercise-catalog-344.js` has been committed and loaded before `app.js`. It includes 344 unique exercise IDs, names, categories, equipment, cues and supporting instruction fields. Search and filters now cover Chest, Arms, Back, Legs, Shoulders, Core and Cardio. A charcoal-and-gold generic illustration appears for any withheld or unavailable demonstration.

**Important release safeguard:** The recovered archive predates the latest Work-approved image manifest. Consequently **all 344 demonstration statuses are withheld in this branch**, including the 268 whose actual images were reportedly approved and integrated in the separate private Work workspace. This is a safe placeholder state, not a revocation of those private approvals. Import only the latest checksum-verified approved image files and matching manifest before showing thumbnails in the development app.

**Not yet migrated:** The workout creator and current session logic still use the earlier 12-item starter data set and demo local history. The complete 344-item catalog is available in the Exercise Library view, but must also be wired into custom workout editing, the home screen's workout selection, and workout logging without changing production Supabase data.

**Do not merge or deploy as finished:** Browser acceptance testing and the private media transfer remain outstanding; keep this pull request a draft. No production workout data is written.

## Cloud migration staging (not activated)

The public 2.0 development build now includes the **exact pure original storage model and three-way reconciliation planner**, plus a manually triggered **read-only cloud dry run** in Settings. The cloud check revalidates the signed-in user, fetches account-scoped rows without caching, and reports overlap and potential conflicts. It has **no write APIs or restore logic**.

This dry run may see **zero original local keys**, because the original app uses account-scoped storage and the 2.0 app has separate `mlc2-*` storage. A zero count does not prove the original app or account has no data. Its findings are advisory, not permission to merge. Safe synchronization needs an explicit 2.0-to-original mapping, verified owner-scoped local reads, a shared checkpoint, recovery archive, conflict-resolution UI and physical device tests.

No production schema changes, records, or images were modified.

## Local recovery export (new)

Settings now offers **Download recovery copy**. This downloads a versioned, allowlisted 2.0 JSON snapshot of local custom workouts, selected workout, practice session history, water/weight tracking, body measurements, and readiness check-ins. It expressly excludes original-app keys, Supabase tokens and photo binaries; the photo store remains separately in IndexedDB. No import/restore button exists yet, and exporting does not mean data is synced to the cloud. Keep this file securely and back up photos separately.

The dry-run original-format converter remains intentionally non-writing. The original app's numeric custom-workout IDs, scoped storage, and revision checkpoint semantics must be reconciled before any upload. Do not use this recovery export as an input to the original app's cloud backup endpoint.

## Guarded recovery import (new)

Settings also supports selecting the exported **MYLIFTCOACH-2.0-recovery v1 JSON file** and previewing it. The importer validates supported categories, bounded item counts, dates, weighted sets, and IDs; rejects corrupted/unknown/unsafe content; and **does not restore over any non-identical existing 2.0 category**. All conflicts block the operation before any write. The restore button stays disabled until the preview passes and the user confirms, then restores **absent browser-storage keys only**; new-key writes are rolled back if a storage error occurs. No legacy keys, Supabase calls, account tokens, or private progress photos are imported.

After a successful restore, the page must be reloaded to update in-memory application state. The UI currently describes this step; it does not force an automatic reload. A separate photo backup/restore and verified cloud migration are still outstanding. Tests here are code-level/mock storage only, not on-device Safari acceptance.

## Large-batch migration integrity improvements

- **Practice-session persistence:** A completed practice workout is now stored and read back successfully **before** replacing in-memory session history or closing the workout. A failed browser storage write keeps the workout open, so the student can retry instead of seeing a phantom completion.
- **Private photo safety:** Device-only progress photo cards now provide an individual **Save copy** action. This is a separate JPEG download (no network). The JSON recovery export still excludes IndexedDB photo blobs; photos must be downloaded separately.
- **Local data health:** A new read-only Settings action inspects 2.0 workout references, duplicate IDs, session sets, daily tracking, measurements, and selected workout integrity. It does not fix, delete, overwrite, or transmit records.
- **Deeper cloud comparison:** The opt-in authenticated cloud dry run now rehydrates an **in-memory only** original-format snapshot from account-scoped GET results. It shows counts of original cloud workouts/sessions and local 2.0 workouts/sessions, plus potential ID collisions. The original account data is never written to 2.0 storage. Even if there are zero reported conflicts, `cannotAutoMerge` stays `true` because there is no shared revision baseline or approved final mapping.

### Verification for this batch

JavaScript syntax checks passed for modified modules; static HTML check found no duplicate IDs among the feature controls; mock cloud preview performed 40 requests, all **GET**, and did not authorize synchronization. A normal device-local fixture passed the integrity check; duplicate workout IDs, broken session JSON, orphan selected workout IDs, and unknown exercises were surfaced as failures or warnings. Browser and iPhone acceptance testing **has not happened**, and no production cloud data was changed.

### Major outstanding gates

1. Obtain the latest privately approved 268 demonstrations and their IDs, source rights, and checksums. Older preview media statuses are not approval.
2. Complete owner-scoped checkpoint/revision reconciliation and a test account with conflict/recovery tests before cloud writes are ever enabled.
3. Verify 2.0 features on real mobile and desktop devices. The current branch is not production-ready.

## Unfinished workout recovery and consistency (Nov 18 batch)

The development app now saves a validated `mlc2-active-session-v1` draft on every added or removed set. When the user opens the same plan after a refresh, logged sets can be restored locally. Drafts expire after seven days, and ID/exercise-list mismatches are rejected. Opening a different workout, or changing the exercise list of the original workout, prompts before replacing a saved draft with logged sets. Once a completed session has been persisted and verified, the matching draft is cleared; if session saving fails, the draft remains.

The versioned 2.0 JSON recovery export/import now includes this draft with validation, and the local data-health checker reports missing or changed plan references. A rest timer now looks up exercises in the full imported catalog as well as the 12-item fallback. Syntax, draft persistence/resumption, recovery round-trip, and stale-plan checks passed on test fixtures. **These are not physical-device/browser acceptance tests**, and cloud synchronization remains disabled.

## Integrated workout flow regression batch (Nov 18)

- Rechecked the original user-reported **Today / custom-workout mismatch**: Home and the Workouts selected marker both resolve through `MLC2Custom.currentPlan`; opening Today passes the same plan ID as the workout grid. Preset exercises were cross-checked against the imported 344-entry catalog and all current preset IDs exist.
- Custom plan creation now uses a time-plus-random suffix instead of only `Date.now()` to reduce rapid-creation ID collisions. Writes to custom plans and the Today selection verify browser persistence. Selection-save failure after creating/editing a plan is surfaced separately rather than wrongly reporting the workout itself was lost.
- Practice-session IDs also include a random suffix, and completed-session sets are copied into saved history rather than retaining a mutable array reference.
- A reusable regression script `tests/migration-regression.test.js` covers unfinished workout resume and expiration, recovery export/import round-trip, conflict refusal, original-format conversion staying non-writing, and stale-plan warnings. It uses only Node built-in assertions. The script was exercised with a compatible injected test harness in this turn and passed; real browser and GitHub CI tests remain outstanding.

No production account records, authentication tables, storage rules or deployments were changed.

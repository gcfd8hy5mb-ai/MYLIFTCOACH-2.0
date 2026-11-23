# MYLIFTCOACH 2.0 release authorization

**Production cutover remains NO-GO.** The deployment package is ready for the existing [MYLIFTCOACH Pages URL](https://gcfd8hy5mb-ai.github.io/workout-tracker/). The remaining gates are real-account data handling, independent cloud recovery and the original installed shortcut handoff, then separate SQL and cutover authorizations.

## Accepted iPhone evidence

The owner already verified the installed 2.0 Home Screen app. Custom workouts survived logout and login; the unfinished workout survived closing and reopening; Resume remained available after logout and login; logged sets, reps and weights were preserved; completed workouts appeared correctly in History. These checks are complete for the tested installation. This batch changed review and deployment tooling only. It did not change the tested application runtime, styles, or approved exercise files.

Independent cloud restore into an empty store is separate from logout/login persistence. Use an authorized synthetic account and an empty context on the same iPhone or an approved hosted synthetic test, without clearing the owner's current app data.

## Verified production configuration

- The public GitHub Pages deployment still reports original commit `24b3e3a40076f8d6aeb6fe6c603068652b268351`, deployment `7933407576`. The current live root index hash matches the rollback baseline. The rebuilt replacement and rollback worker hashes match the previously verified packages.
- The package keeps `/workout-tracker/`, the existing manifest identity `./?app=myliftcoach`, and the scoped `sw.js` registration. In the packaged fixture the existing launch query reopens offline. The replacement worker waits for open clients, while the rollback worker avoids origin-wide cache deletion and force-navigation. The original exact ZIP remains separate from the ready-to-deploy rollback with its safer worker.
- Read-only production metadata shows PostgreSQL 17.6, authenticated execution and anonymous denial on all three 2.0 RPCs, caller execution mode, and owner-scoped table RLS. The live commit RPC takes a per-record advisory lock and compares revisions. The existing function can accept a new operation against a deleted row at the latest revision. The prepared forward change closes that gap. Production table columns, keys and types are compatible with the prepared SQL. Forty original account tables continue to have RLS enabled.
- The actual production commit body SHA-256 is `57547456e8e3cca3d88e1af471d417f51e0cc498b2ab74f447b7309198028efd`. The forward script requires that exact normalized body. Rollback requires the exact reviewed forward body. Both require the expected signature, execution mode and effective grants before replacement. No hosted database function or account was modified.
- The uninstalled [manual Pages template](github-pages-cutover.yml) is limited to the original repository and verifies the approved candidate SHA, live original HTML and manifest and worker hashes, and the destination Pages URL. It contains no SQL or database credentials. The original repository still has competing Pages publish workflows, which must be paused before installing or dispatching the cutover workflow.

## Data preservation and shadow migration

The existing Supabase project and verified user IDs stay in place. The original and 2.0 use separate local credential keys, device scopes and cloud data tables. Original records and 2.0 backups remain intact. A real sign-in after cutover may be necessary. The original and 2.0 hosted pages share a browser origin. Namespace separation and scope controls protect normal application operation without isolating unrelated scripts on that origin.

The [review-only migration preview](migration-preview.cjs) compares verified owner IDs, two revision-bearing original cloud archives, an owner-bound device checkpoint, and destination data and deletion markers. It proposes only additions. It uses exact exercise IDs, translates weekday numbering, refuses stale or divergent records, and stops for an original unfinished workout, pending deletions, conflicts, or an explicitly cleared destination schedule. The synthetic rehearsal exercised the native account-history restore with an in-memory destination and checked how 2.0 resolves the proposed schedule. This tool has no production UI, write endpoint, or automatic import. Historical custom indexes are unstable, so completed sessions retain their original workout key as metadata without being linked to a current custom routine by index.

Original device history, workout plans and available account photos remain readable through the existing compatibility views. Legacy Coach settings, profile preferences, cloud-only or guest photos and older draft state still require preservation or an explicit acceptance decision. Check the current account and verified archives, finish active original sessions where present, and confirm any missing data before retiring either install. For an active carryover, approve an owner-bound path for the previewed additions after confirming the account's current revisions and exact mappings. Keep the original records and checkpoint available if any category cannot be mapped. The detailed [preservation and rollback runbook](PRODUCTION_REPLACEMENT.md) describes each data store and the available actions.

## Remaining authorizations and exact deployment order

1. Authorize the synthetic hosted recovery check and settle which original records must become active in 2.0 immediately. Check the approved owner scope and the active-data mappings, and verify independent recovery into an empty synthetic store. Rehearse the original Home Screen shortcut handoff and rollback without clearing storage or forcing a reload. The five accepted 2.0 iPhone checks need no repeat for this batch.
2. Separately authorize the production Supabase migration. Recapture RPC metadata and compare the body and grants, apply [the guarded SQL](../mlc2-commit-tombstones.sql) in the reviewed transaction, and verify the hosted result with authorized synthetic data. If required, run [the guarded SQL rollback](../mlc2-commit-tombstones.rollback.sql). This restores the prior function behavior, not user data.
3. Explicitly authorize production cutover and the exact candidate SHA. Pause other original Pages publishers first, make the approved commit available to GitHub, and install or review the manual template in the original repository. Dispatch **replacement** with the approved SHA. Confirm the resulting root HTML, manifest, worker, and served Pages URL. Allow existing clients to close normally so the worker can activate without interrupting an open workout.
4. If the authorized cutover fails, dispatch **rollback** with the same pinned candidate and original snapshot. Reopen the original app normally and verify the retained account. Keep any 2.0 records created after the switch in their existing stores. Do not restore a whole storage backup, clear the Home Screen app, or run a database rollback as a side effect of restoring Pages.

## Focused verification

| Check | Passed | Failed |
|---|---:|---:|
| Focused migration and application safeguards | 23 | 0 |
| Packaged replacement and rollback | 4 | 0 |
| Isolated PostgreSQL | 5 | 0 |

The earlier full runs of 430 release and 453 broader tests are baseline evidence. They were not rerun because the app runtime is unchanged. The physical iPhone confirmations are owner-reported and hosted recovery remains pending. Nothing was pushed, merged, deployed, migrated, or cleared.

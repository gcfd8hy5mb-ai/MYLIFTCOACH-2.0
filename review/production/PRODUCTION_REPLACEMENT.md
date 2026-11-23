# MYLIFTCOACH in-place production replacement

**NO-GO for production cutover.** The direct replacement package is prepared for [the existing MYLIFTCOACH URL](https://gcfd8hy5mb-ai.github.io/workout-tracker/). It uses the original repository and URL, the existing Supabase project, and the existing Home Screen identity. A second site, GitHub owner, or paid service is unnecessary.

## Verified baseline and package

The live Pages deployment `7933407576` was successful for original commit `24b3e3a40076f8d6aeb6fe6c603068652b268351`. The companion preview deployment used the same source commit. Eight files downloaded from Pages matched the original checkout byte-for-byte, including the root HTML, manifest, service worker, auth configuration, account sync, private photo sync, and legacy backup script. The production repository was only cloned and read.

The exact ZIP was reconstructed from the pinned deployed source and checked against all 495 tracked files. Its SHA-256 is `ad5202d0443e3b76f1df5ec1df529a6b0f31636594149c614387ee2015ca1513`. This is a verified source reconstruction from the published commit, since an original Actions upload was unavailable. It contains application files, not browser state or cloud backups. The generated safe rollback tree differs from that ZIP only in its service worker. It retains the original code and routes while removing origin-wide cache deletion and forced client navigation.

The [packaging script](package.cjs) creates `replacement/`, `rollback/`, an exact original ZIP, and checksums. It refuses a different original commit or auth project. It preserves the original manifest ID and start URL `./?app=myliftcoach`, the `/workout-tracker/` worker scope, and the original worker URL `sw.js`. The replacement worker installs without forcing activation. It uses its own versioned cache, warms the preserved launch manifest and restores the original installed launch query offline. The replacement contains only the 2.0 app and approved media. It does not expose the old preview as a second production entry point.

## What happens to existing data

| Category | Original | 2.0 cutover behavior |
|---|---|---|
| Accounts and sign-in | Existing Supabase Auth user UUIDs; local key `prismSupabaseSessionV1` | Same project and UUID after fresh sign-in. 2.0 independently verifies the authenticated user and uses `mlc2-auth-session-v1`. It leaves the old credentials in place and does not copy their contents. Sign-in status may change at cutover, while credentials and account records remain intact. |
| Signed-in local history and custom workouts | `prismAccountLocalV1:<owner>:workoutHistoryV52`, `customWorkoutsV5`, and related keys | Original browser history, routines and tracking can be viewed read-only. The same account's current original cloud history also has a read-only view. Copies are not automatically added to 2.0 history, active plans, training totals or Coach recommendations. |
| Schedules and Coach | `myliftcoachWeeklyDayOverridesV1` and original Coach keys; normalized cloud tables | Retained in original storage and exportable in a verified owner's device checkpoint. 2.0 uses its own schedules and Coach model. Active recreation or conversion requires a reviewed mapping and confirmation against the latest original records. |
| Profile, measurements, nutrition and preferences | Original profile, tracking, measurements and preference schemas | Retained under the original keys and supported account-cloud archive. Some data can be viewed read-only; full operational import into equivalent 2.0 fields has not been verified. Mark unmapped data before authorizing cutover. |
| Active workouts and guest data | Original active workout and set history; unqualified guest keys | Same-origin browser data stays where it is. Finish and verify original workouts before switching. Older guest and 2.0 guest records are distinct. Never claim guest records for an account automatically. |
| Progress photos | Two original IndexedDB databases with guest/account variants and optional private Supabase photo storage | 2.0 can show or save a copy of original signed-in photos already on that iPhone. It opens only the verified account's databases, cancels accidental creation, skips pending local deletions and revokes display URLs on account change. Photos present only in the old private bucket or guest databases need preservation using the original app before cutover. The legacy photo cloud data is left intact. |
| Cloud history and backups | Legacy backup snapshots, normalized `prism_account_*` tables, and private photo objects | Remain intact. 2.0 writes to its separate record and receipt tables. Sharing an authentication project does not merge the two data models. Use owner-verified reads of the current original data for comparison. A historical export must not restore newer edits or deleted data. |
| Existing 2.0 data | Namespaced browser data and the 2.0 cloud records | A same-origin 2.0 browser context may already have its 2.0 keys, but installed iPhone app storage availability must be checked. Restore only verified missing 2.0 backups under the same UUID. Keep the current 2.0 install until data verification is complete. |
| Free/Pro | Original entitlements and beta preferences use original fields | 2.0 Free/Pro behavior remains available. Existing entitlement rows are untouched. Real paid or lifetime entitlement parity must be verified before release if such accounts are in use. |

Keeping the same origin and URL preserves browser storage keys and install identity, but paths cannot isolate scripts using the same origin. The package limits network destinations with a CSP and keeps old and new writers on separate keys and tables. The app does not clear localStorage, IndexedDB, auth, or photos. iPhone storage presentation and access after replacing the installed shell still require physical verification.

### Non-destructive preservation and migration

1. On the existing iPhone installation, finish active sessions and verify that Recent History, custom routines, weekdays, Coach settings, measurements and progress photos look right. Wait for current sync to finish before using these records as the migration baseline. Use **Data & Backup → Download backup** in the original app to preserve the current session data and included private photos; check the export succeeded. Preserve any photos from the other progress-photo gallery separately if they are absent from that export. Keep all archives private.
2. Sign in to 2.0 with the same existing account. From its original-data tools, obtain the original cloud archive and, where the old account-scoped device data is visible on the same iPhone, the new original device checkpoint. The checkpoint preserves allowlisted values and any pending deletion markers for that verified owner. It contains no auth tokens or photo files. Keep both current installations and the archives until acceptance succeeds.
3. Compare the original local and cloud views and the new owner UUID. List expected history counts and dates, recent deletions, preserved photos, custom-plan exercise IDs, weekdays, and profile/Coach settings. Resolve any missing category before cutover. Existing 2.0 cloud backups can use the verified fill-only restore. Historical original exports must be kept as evidence and are not inputs to 2.0's restore tools. In particular, the original **Restore backup** action replaces data and is inappropriate for this migration.
4. If original workouts and plans must stay active in the new history, Coach and schedule immediately, complete and rehearse an owner-bound import against fresh shadow data. A migration must have stable mappings, retain the original records, honor the source deletion markers, compare the current origin and destination revisions, and preview proposed additions. Scope any unavoidable manual recreation to explicitly approved items on the same iPhone. No verified importer currently maps all original categories. Pause rather than infer or invent old settings or convert unknown exercise IDs.
5. Before cutover, keep a latest owner-specific archive and the immutable application ZIP. If rollback is necessary, keep new 2.0 writes in their own stores and export or reconcile them explicitly. Restoring the old UI does not transfer data created after the switch.

## Supabase status and ordered cutover

The production read-only catalog recheck confirmed RLS enabled on 40 original account tables and owner-bound policies on history, workouts, preferences, private photos and legacy backups. Private photo object access is scoped to the owner folder. All three 2.0 RPCs run as the caller and deny execution to the effective anonymous role. Records and receipts use owner-bound RLS. The live commit RPC definition matched the checked-in prior rollback definition. The forward SQL's signature and inspected column types match the production schema. No real rows or private photos were read for this audit.

[Forward SQL](../mlc2-commit-tombstones.sql) and [rollback SQL](../mlc2-commit-tombstones.rollback.sql) passed the embedded PostgreSQL tests. Hosted claims, live account-specific data, API grants and a real-user sync path still need authorized synthetic-account verification. The forward change prevents reusing a tombstoned ID in 2.0 even at its latest revision. The existing client also rejects stale local 2.0 restores and skips orphaned custom schedule references. An original export is not a verified exception to deletion protection.

1. Verify hosted account behavior and the original-to-2.0 data recovery plan on the same iPhone with synthetic data. A private or existing approved rehearsal is sufficient; no permanent site is necessary. Record workload and rollback checks.
2. After separate SQL approval, capture and recompare the live RPC and ACL, then run the tested forward transaction only after confirming the expected backend. Recheck grants, owner policies, and fresh synthetic account sync. [Detailed database commands and rollback](../RELEASE_ACCEPTANCE_RUNBOOK.md#supabase-change).
3. Verify no newer original Pages deployment supersedes the pinned rollback baseline. If one does, rebuild the baseline and prove the relevant worker and auth compatibility again. Do not use an older ZIP as an exact current rollback.
4. Only after explicit cutover approval, review and install [the manual workflow](github-pages-cutover.yml) in the original repository. Its current root and preview workflows can both publish the site, so pause competing deployment triggers and freeze unrelated releases before dispatch. Keep the original repository history. Deploy only the generated `replacement/` to the current Pages environment. Verify the live root hash and preserved manifest and worker URLs immediately afterward.
5. If rollback is required and authorized, publish the generated `rollback/` to the same environment. That puts the original HTML, styles and runtime back and uses the non-destructive worker variant. Keep the exact ZIP for independent verification and recovery. Close the installed app and any open Safari copies naturally, reopen online, then verify the original account and newest data. Keep 2.0 storage and cloud data available. Database rollback is a separate decision and reopens the original 2.0 tombstone gap; it does not roll back user data.

## Minimum acceptance on one iPhone

1. Check the intended installed launch and Safari at the original path. Verify fixed marble, teal and gold styling, navigation, and fresh launch without clearing storage or deleting the shortcut.
2. Sign in to the same authorized synthetic account and verify the previous UUID. Check old and 2.0 history, plan names and exercise mappings, schedules and rest days, Coach settings, photos, and Free/Pro. Log a set, leave the app and reopen to resume, then finish once. Check the newer record, backup and deletion state.
3. Confirm the worker does not reload an open workout, closing and reopening honors the update, and offline guest launch works. Check verified-account logging offline during an active authenticated session. A cold offline account launch requires reconnection.
4. Rehearse rollback and confirm both old records and post-cutover 2.0 records survive. A second device is unnecessary.

## Verification summary

| Check | Result |
|---|---|
| Release regression runner | 430 passed, 0 failed across 82 registered files, plus standalone assertions |
| Broad Node sweep | 453 passed, 0 failed, 0 skipped |
| Exact packaged release and rollback integration | 4 passed, 0 failed |
| Embedded PostgreSQL | 4 passed, 0 failed |
| Targeted exercise media and guides | 31 passed, 0 failed |
| Approved styles and media | Unchanged. 344 exercises, 263 approved demonstration pairs, 81 withheld |
| Syntax and archive | JavaScript syntax and diff check passed. Exact source ZIP verified against all 495 files |
| Physical iPhone and authorized live records | Pending |

No deployment, branch push, SQL change, or existing-account data migration was performed.

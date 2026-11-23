# MYLIFTCOACH 2.0 final launch decision

**NO-GO for production deployment.** The tested replacement is ready to package for [the original GitHub Pages URL](https://gcfd8hy5mb-ai.github.io/workout-tracker/). The proven local recovery path still needs owner-approved hosted verification and a real-data carryover decision. No second site is required.

## Final changes and evidence

- Recovery now treats any stored auxiliary category, including an empty one, as existing data. This prevents old backups from reviving measurements, tracking or other data cleared on the device. The worker cache and asset revision changed so an older cached shell cannot silently re-enable the old behavior.
- The read-only migration preview now also projects supported circumference measurements and compatible Coach preferences. Synthetic tests restored the projected values through native 2.0 storage paths. Unknown exercise IDs, deleted IDs, pending source deletes, conflicting values and deliberately cleared destination categories block the projection. Legacy phase, body-fat, weight, and unmapped Coach fields stay in the original archive. The preview cannot write to a real account or the cloud.
- The manual deployment workflow now requires the reviewed commit in `MLC2_APPROVED_RELEASE_SHA` and checks immediately before deployment that both legacy Pages publishers are manually disabled and have no unfinished runs. An unverified Actions response stops deployment.
- The local embedded PostgreSQL rehearsal now uses the captured production read and list RPC definitions, the reviewed commit correction, and the app's actual transport and workout recovery logic. It restored a completed workout into empty storage, excluded a tombstoned workout, kept a different synthetic owner isolated, and performed no commit during recovery. The HTTP and Supabase authentication boundary was simulated. The hosted authentication, Data API and user-record recovery path have not been exercised.

| Verification | Passed | Failed |
|---|---:|---:|
| Release regression runner | 431 | 0 |
| Full Node regression sweep | 454 | 0 |
| Migration, deployment gate and package integration | 13 | 0 |
| Local PostgreSQL | 6 | 0 |

The broad sweep includes the app regressions. Approved design and media are unchanged. The catalog retains 263 approved demonstration pairs and 81 withheld demonstrations. The owner's five existing iPhone confirmations stand. This batch changed cloud recovery behavior and the worker cache version. Check the original shortcut update and the separately scoped recovery smoke test before approval. Repeating the already accepted workout and Resume checks is unnecessary.

## Production and data preservation

The original production repository still resolves to `24b3e3a40076f8d6aeb6fe6c603068652b268351`. Live copies of the root index, manifest and worker matched the pinned baseline byte-for-byte. The rebuilt rollback tree is identical to the previously verified safe rollback. The exact original source ZIP is unchanged, with SHA-256 `ad5202d0443e3b76f1df5ec1df529a6b0f31636594149c614387ee2015ca1513`. The replacement targets `/workout-tracker/`, preserves `./?app=myliftcoach`, precaches the approved shell and has no automatic reload or data-clearing action. The deployable rollback uses the original runtime with the scoped worker that avoids clearing unrelated caches or force-navigating clients.

Existing account UUIDs, original records, and both cloud backup namespaces stay in place. Matching data can be projected from an owner-bound archive and fresh checkpoints. There is no automatic activation of legacy records in the deployed app. Before retiring the original app, verify the required account data and use an approved owner-bound carryover for records required in active 2.0. Retain anything unmappable in the verified original archive. If older data only exists on the iPhone, finish or retain the original draft, and save private photos or device-only records from the original installation before replacing it. Skip these actions when the data has already been independently recovered or does not exist. Never delete the shortcut or clear either application's data as part of migration.

## Supabase approval scope

Target `kirlpjflaoriiusfamsk`, the existing MYLIFTCOACH production Supabase project. The catalog check confirmed PostgreSQL 17.6, caller execution, authenticated execution and anonymous denial for the three reviewed RPCs. Records and receipts use owner-bound RLS, with the expected primary keys and Auth references. The live commit body still matches the forward migration's guard. The reviewed correction retains the owner and revision checks and removes the ability to reuse tombstoned IDs.

Authorize only [the exact forward SQL](../mlc2-commit-tombstones.sql) on the named project. It replaces the guarded commit function and preserves grants and stored rows. It can reject clients attempting to recreate an already deleted ID. If verification fails after the change, use [the guarded SQL rollback](../mlc2-commit-tombstones.rollback.sql) on the same project. Rollback restores the previous function and reopens the former tombstone behavior. Neither SQL file deletes or rewrites real records. No SQL was applied to production during preparation.

## Remaining sequence

1. Verify independent recovery against an authorized hosted synthetic account with an empty destination. Confirm required original data is retained or approved for owner-bound activation. Preserve any inaccessible device-only items on the owner's iPhone. Rehearse the existing Home Screen shortcut update and rollback without clearing storage, using an authorized reversible rehearsal. This is the only physical check outside the completed workout acceptance except for a hosted recovery smoke check if done on the same iPhone.
2. After separate approval, verify the production function still matches the captured body, apply the exact guarded SQL, then recheck grants and deletion protection with authorized synthetic data. Use the guarded rollback only if needed.
3. After explicit production cutover approval, make the reviewed commit available to the original repo's Actions workflow. Set `MLC2_APPROVED_RELEASE_SHA` to that full commit SHA. Pause both competing Pages workflows and let existing runs finish before installing or dispatching the manual workflow. Dispatch **replacement**, then verify the same public URL, manifest, worker, and published assets. Dispatch **rollback** with that same approved pin if required. The exact original archive remains the independent fallback. No production deployment or database migration is part of this preparation.

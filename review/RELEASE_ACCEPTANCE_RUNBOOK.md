# MYLIFTCOACH 2.0 infrastructure and acceptance runbook

## Verification summary

| Check | Result |
|---|---|
| Release regression runner | 424 subtests passed, 0 failed, across 80 files, plus standalone assertions |
| Broad Node regression sweep | 447 passed, 0 failed, 0 skipped |
| Embedded PostgreSQL integration | 4 passed, 0 failed |
| Exercise media and guide checks | 31 passed, 0 failed |
| Media and style comparison | 344 exercises, 263 approved image pairs, 81 withheld. No artwork, mapping, or design changes |
| Physical iPhone and hosted Supabase | Pending. No deployment or production SQL operation was performed |

The broad test sweep includes the release and media suites. The PostgreSQL suite runs separately with `npm ci --prefix review/postgres --ignore-scripts` and `npm test --prefix review/postgres`. To run the full broad suite on a fresh source checkout, fetch the historical Git objects needed by the existing 11-21N exact-source checks.

## Supabase change

The prior read-only production catalog audit found that the three 2.0 RPCs run as the caller, deny execution to `anon`, derive ownership from `auth.uid()`, and use owner-scoped RLS on records and receipts. The record updates use a per-record lock and a revision check. The prepared correction makes a deletion final for a record ID and restricts the final write to the expected revision. A retry with an existing matching operation receipt still returns that receipt. Cloud restores now check that any custom routine referenced by a recovered schedule, manual choice, or program source is present in the eligible plan set.

The embedded PostgreSQL tests exercise the exact SQL on a synthetic schema. They cover owner changes, permission denials, conflicting revisions, record deletion, operation replay, interrupted transactions, and rollback. They do not exercise real Supabase Auth JWT issuance, hosted PostgREST exposure, simultaneous independent connections, or production data. Neither forward nor rollback SQL has been run on production.

### Approval and application

1. Obtain explicit approval for the exact production project and reviewed commit. Use an authorized operator and the existing database migration/change process. Keep this change separate from the Pages release.
2. Capture the current function definition with `pg_get_functiondef('public.mlc2_v1_commit(uuid,text,text,bigint,boolean,jsonb)'::regprocedure)`. Also capture its owner, ACL, execution mode, effective execution privileges, the private schema's Data API exposure setting, and the owner policies on both tables. Recheck the read and list RPCs. Compare the captured body with [the rollback reference](mlc2-commit-tombstones.rollback.sql). If they differ, stop and prepare rollback from the captured production definition. Keep the capture securely until the change is signed off.
3. Verify the same functions, grants and policies in an approved nonproduction Supabase project against synthetic accounts. Confirm the private tables cannot be reached through exposed Data API schemas, and run the account-switch, stale-revision, receipt replay, and deletion checks through the actual API. The production migration changes only the commit function. Escalate if the hosted schema or grants differ.
4. Apply [the forward SQL](mlc2-commit-tombstones.sql) in one transaction using an operator-side SQL client configured to stop on errors. For example, with the approved target configured in the operator's local service credentials, use `PGSERVICE=mlc2-production-review psql --no-psqlrc --set ON_ERROR_STOP=1 --file review/mlc2-commit-tombstones.sql`. It checks the existing signature and grants first. Lock and statement timeouts fail the change instead of waiting indefinitely. No data backfill, table DDL, policy change, hard delete, or account migration belongs to this release.
5. Compare the function and access metadata after application. Verify hosted reads and sync with an explicitly approved synthetic test account before using the release for real accounts. An expected revision conflict preserves the existing record. Never retry a tombstoned record with a newer revision to bypass the conflict.

### Rollback

An error before commit rolls back the transaction. If a committed change must be reverted, suspend acceptance sync or stop the cutover first, then reapply the captured prior definition inside a transaction. The [checked-in rollback reference](mlc2-commit-tombstones.rollback.sql) is executable after confirming it matches the captured definition. Use the same operator connection and `ON_ERROR_STOP`, substituting the rollback filename. Recheck the ACL, owner, and RLS. The rollback leaves rows and receipts intact but reopens the prior tombstone gap. Keep production rollout paused until the gap is closed again. Do not restore a database snapshot over user records to roll back this function.

## Independent GitHub Pages origin

Use a dedicated, approved GitHub Free owner or organization and a public user/organization site repository named `<owner>.github.io`. The resulting origin is `https://<owner>.github.io`. This needs no domain purchase and leaves `gcfd8hy5mb-ai.github.io/workout-tracker/` available. A second repository under the current Pages owner would still share the existing host. An already-owned domain can be considered as an alternative if its DNS and use are separately approved.

Free Pages serves the static build publicly. Review the approved asset publication decision and GitHub Pages usage terms before enabling it. Use synthetic credentials for any explicitly authorized isolated backend. Before real-account release, evaluate the current direct password form against the hosting terms and approve the sign-in flow, with provider-hosted sign-in preferred where available. Treat each host's local/session storage, IndexedDB, service worker, install identity, and caches as distinct. Keep app cookies host-only if introduced. Supabase is a separate backend origin. Its data is separated by verified account ownership and access policy.

After approval, configure GitHub Pages to use Actions on the new site repository. Install [the manual workflow template](pages/github-pages-acceptance.yml) in that repository under `.github/workflows/`. Set `MLC2_PAGES_OWNER` to the approved owner. If the source repository needs credentials, use a narrowly scoped read-only source token kept in that repository's Actions secrets. Supply the exact approved source commit to the workflow. The workflow verifies the source SHA, requires the separate owner, verifies the configured Pages origin before deploy, and defaults to a cloud-blocked package. With separate approval, supply only a nonproduction Supabase URL and publishable key to enable a test backend. The packager rejects the production URL and production key and restricts network connections via CSP. The workflow is staged as a template and has no trigger in the current source repository.

For local packaging, run `node review/pages/stage.cjs <new-output-directory-outside-the-repo>`. For an isolated cloud test, set `MLC2_TEST_URL` and `MLC2_TEST_PUBLISHABLE_KEY` to the approved sandbox. The staged configuration contains no production backend connection. The current workflow is for acceptance only. A production-linked Pages package needs its own approved sign-in and deployment configuration.

For hosting rollback, maintain the previous approved artifact SHA. Disable test login or redeploy that artifact on the **same acceptance host**, and keep the original app and old 2.0 installation available. A service-worker update can wait until open clients close. Verify the served artifact before reopening. Never clear browser site data to force an update or redirect an old app to an unverified site.

## Preserve existing app records

1. Keep the current 2.0 installation and original app usable. On the old 2.0 origin, confirm the signed-in account, review workout counts, custom routines, weekly schedule and Coach settings, and check each backup status. If a draft exists, retain the old shortcut or finish it there and confirm its history entry and backup before cutover. Record recent deletions and explicit schedule clears so stale snapshots can be identified. Pause migration on pending sync, disputed revisions, or an unexpected old routine.
2. Use the existing account workout export as an owner-bound, local fallback. Store it privately. Verify the account identifier at import, inspect its fill-only preview, and prefer verified current cloud revisions over old exports. Use the guest recovery file only for guest data. It cannot establish account ownership. Never import a historical file that includes a workout subsequently deleted. The existing exports do not cover every account-only draft, deletion marker, or setting. Keep the old origin available when neither a verified backup nor an owner-bound recovery route covers an item.
3. Export private progress photos individually from the old application if desired. Verify the files on the same iPhone. Photos remain device-only and are outside the account JSON and cloud recovery. Re-add only with the user's approval in the verified destination account. Keep originals until confirmed.
4. When a production-linked release is separately authorized, sign in fresh on the new origin. Verify Supabase resolves the same user ID before previewing only missing cloud data. Confirm counts, recent entries, routines, rest days, selections, and Coach settings. Stop on any difference before accepting recovery. Unsynced device-only data, local-only deletion markers, and failed cloud clears must be reconciled on the old origin. Never transfer tokens, cookies or raw browser storage. No transfer runs during preparation or guest acceptance.
5. If verification fails, keep using the old installation and obtain an owner-bound recovery route for the missing items. Rollback never deletes either site's local storage or overwrites cloud records. Keep both shortcuts and backups until verification is complete. All user acceptance can be completed on one iPhone.

## Minimal one-iPhone acceptance

1. Open the approved isolated URL in Safari, add its Home Screen app, and check fixed marble during scroll, safe areas and Dynamic Island, keyboard focus, and navigation.
2. In guest mode, verify Free/Pro switching, create a full weekly program including a rest day, and check Next Session and Coach against the selected program. Open a mapped exercise demonstration.
3. Log two sets, background or close the installed app, reopen, and check Resume and both saved sets. Finish once and verify history contains one workout. Verify the installed app reopens offline and that an update does not reload an open workout or program editor.
4. In the separately approved synthetic-account build, sign in, sync and confirm one backup. Check that a second synthetic account on the same iPhone cannot see the first account's history and that deleted routines and deliberately cleared preferences stay cleared. A previously verified open account can log offline. A cold offline account launch requires reconnection to verify identity.

The offline package is ready to publish for acceptance after approval. Cloud acceptance needs an approved sandbox or authorized synthetic accounts. Replacement remains blocked pending same-iPhone approval, deployed SQL confirmation, and a verified owner-bound data recovery and authentication plan.

[GitHub Pages availability and usage limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) · [GitHub Pages origin and domain setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages) · [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)

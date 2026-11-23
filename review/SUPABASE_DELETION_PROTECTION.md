# MYLIFTCOACH 2.0 Supabase deletion protection

**GO for separate production authorization.** Project `kirlpjflaoriiusfamsk`. This package is for independent review. The production function remains on its original definition.

- Review branch `review/supabase-deletion-protection-20261123`. Pin approval to the full GitHub commit SHA containing this report and both SQL files.
- Forward migration [review/mlc2-commit-tombstones.sql](mlc2-commit-tombstones.sql).
- Rollback [review/mlc2-commit-tombstones.rollback.sql](mlc2-commit-tombstones.rollback.sql).

## iPhone and database verification

The owner verified cloud recovery on an iPhone with the same Supabase account in Private Safari and regular Safari. Custom workout recovery, weekly schedule recovery, and the Monday workout assignment passed. The app reported existing data preserved and no manual file import was needed. These are completed manual checks for those features. The full automated authenticated hosted rehearsal was not run.

The read-only production catalog check on November 23, 2026 returned PostgreSQL 17.6 and the exact installed definition of `public.mlc2_v1_commit(uuid,text,text,bigint,boolean,jsonb)`. The captured definition matches the rollback statement with its SQL terminator removed. The function runs with caller privileges and an empty `search_path`. Its execution ACL was `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`. RLS was enabled on `mlc2_private.records` and `mlc2_private.receipts`. The policies check `auth.uid() = user_id` for record reads, inserts and updates, and receipt reads and inserts. Record updates use both `USING` and `WITH CHECK`.

| Function definition | SHA-256 of `pg_get_functiondef` |
| --- | --- |
| Captured production and expected after rollback | `43410a29b5a326729d33f3fb5ae8dff7473948aba478cd02383ebf752fa81ebf` |
| Expected after forward migration, verified in isolated PostgreSQL | `1418f676d179c4bff8894f5b8911cd5f65861e851b90456cb1badc02aae26cb8` |

The current function allows a new operation to recreate a deleted ID if it supplies the tombstone's revision. The forward file replaces only this function. It preserves caller execution, ownership checks, existing grants, RLS, operation hashing and per-record serialization. The receipt lookup still comes first and returns the original acknowledgement for an exact retry. The new check rejects a subsequent operation against a tombstone with `PT409`. The conflict-update predicate also checks the expected revision and requires a live record before updating. Both scripts use a transaction, a five-second lock timeout, a 30-second statement timeout, and a full-definition hash guard.

An intentional recreate must use a fresh record ID. Clients that try to reuse a deleted ID will see a conflict. Replacement can briefly wait on locks. Coordinate the change with other database administration and stop on any drift or timeout. Rollback restores the original function without rewriting records or receipts and reopens the matching-revision deletion gap.

## Isolated test results

Run `npm ci --prefix review/postgres --ignore-scripts`, then `node --test review/postgres/commit.test.cjs review/postgres/hosted-existing-pair.test.cjs` from the repository root.

**11 passed, 0 failed.** The isolated PostgreSQL suite checks authenticated owner enforcement and isolation, execution grants, tombstones for workouts, custom routines, schedules and workout selections, stale revision conflicts, exact create/delete receipt replay, interrupted transactions, guarded rollback, and rejection of function definition drift. The full recovery rehearsal checks history, custom routines, schedules, and backup integrity against both function definitions in populated synthetic accounts. Three runner tests also verify that incomplete configuration, duplicate identities and incorrect account verification fail before recovery operations.

## Production procedure after separate authorization

1. Pin the approved commit and confirm the Supabase project reference is `kirlpjflaoriiusfamsk`. Immediately before application, capture `pg_get_functiondef`, function owner and execution privileges, and RLS policy definitions for both private tables. Compare them with the reviewed baseline above. Stop if any differ. Use the same change session for preflight and application and coordinate to avoid concurrent DDL on this function.
2. Execute the pinned forward file as a single transaction. Apply only that file. If it aborts, end or roll back the transaction and investigate before retrying.
3. Verify the installed definition hash is the expected corrected hash above and confirm the owner, ACL, caller execution and both RLS policy sets still match preflight. Then use separately approved synthetic accounts and fresh IDs to verify creation, deletion, an exact receipt replay, and `PT409` for a later matching-revision write against the deleted ID. Confirm the tombstone remains and the other test account cannot retrieve the record. These are post-authorization checks against the installed production correction. The completed iPhone recovery checks need no repeat for this function-only package.
4. If rollback is needed and approved, repeat the preflight with the corrected definition hash as the expected baseline. Apply the pinned rollback file and confirm the original hash, owner, ACL, caller execution and policies are restored. Record the return of the deletion-protection gap. Leave application cutover for its separate release decision.

Use this read-only catalog query for the function portion of preflight and postflight.

```sql
SELECT pg_get_functiondef(oid) AS definition,
       encode(sha256(convert_to(pg_get_functiondef(oid), 'UTF8')), 'hex') AS definition_sha256,
       pg_get_userbyid(proowner) AS function_owner,
       prosecdef AS security_definer,
       proacl AS execution_acl
FROM pg_proc
WHERE oid = to_regprocedure('public.mlc2_v1_commit(uuid,text,text,bigint,boolean,jsonb)');

SELECT c.relname, c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'mlc2_private' AND c.relname IN ('records', 'receipts')
ORDER BY c.relname;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'mlc2_private' AND tablename IN ('records', 'receipts')
ORDER BY tablename, policyname;
```

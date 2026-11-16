# MYLIFTCOACH 2.0 — Phase 4: Isolated Supabase schema deployed and rollback tests

**Date:** 2026-11-15 Central / Supabase migration version `20261116024621`.

**Project:** existing `PRISM` Supabase project (`kirlpjflaoriiusfamsk`). Changes restricted to new `mlc2_private` namespace and two `public.mlc2_v1_*` RPC functions; no original PRISM tables, production workout records, app Auth users, buckets or deployment code modified.

## Applied migration

- **Name:** `create_mlc2_isolated_sync_v1` — confirmed in the Supabase migrations list.
- **Source:** `sync/PROPOSED-ISOLATED-SCHEMA.sql` (now deployed after fixing malformed dollar quoting, null checks, and payload size limits). This remains the source file used for the migration. Do not apply it again.
- `mlc2_private.records`: revisioned per-user record storage with `user_id`, `record_type`, `record_id`, JSON payload, `revision`, and deletion timestamp.
- `mlc2_private.receipts`: durable idempotency receipts keyed by owner and operation ID.
- `public.mlc2_v1_commit`: security-invoker optimistic concurrency and replay protection.
- `public.mlc2_v1_read`: security-invoker owner-scoped read-only recovery inspection.
- Both new tables have **RLS enabled**, five ownership policies in total. Both RPC functions are denied to `anon`, allowed to `authenticated`, and **neither uses SECURITY DEFINER**.

## Tests executed against live PRISM Postgres (all passed)

Executed in explicit transactions with **ROLLBACK** and two session-level simulated authenticated identities (existing Auth identity IDs were referenced only to satisfy FK constraints; no original account data inspected or changed).

1. Owner A creates and reads a new isolated session record.
2. Repeating exactly the same operation ID and payload produces revision 1 and `replayed=true`; no duplicate.
3. Out-of-date `baseRevision=0` after revision 1 raises PostgreSQL `PT409`.
4. Owner B cannot read Owner A's record with `mlc2_v1_read`.
5. Owner B sees zero Owner A records in a direct SELECT through RLS.
6. Owner B cannot INSERT a row claiming Owner A's ID.
7. A revision-aware tombstone records deletion at revision 2.
8. Anonymous role cannot execute either RPC.
9. Post-transaction record count **0**, receipt count **0**.

## Security advisors

Supabase advisor reported **one existing auth-level warning**: leaked-password protection disabled. No new schema-specific warning was returned. Remediation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. Do not change Auth settings without separate review.

## Still not verified / no activation

- Authenticated **HTTP** requests with two disposable genuine JWT accounts, including 401/403/409 response correctness and actual PostgREST Data API schema exposure.
- Multi-device full cycle, offline queue replays, import/restore, version conflicts and app auth refresh on iPhone.
- Cloud sync UI integration: the preview does **not load or invoke** the sync modules and **both are disabled by default**. No real app workout data has been uploaded.
- Separate review of API schema exposure and data retention/receipt pruning before production activation.

**Release gate:** keep draft PR unmerged, web preview device-only, and live 2.0 cloud writes OFF until the above end-to-end tests pass. All original production website content and PRISM workout tables remain unchanged.

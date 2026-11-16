# MYLIFTCOACH 2.0 — Cloud Synchronization Foundation (Phase 3)

**Status:** code and test-only development; backend NOT deployed; browser preview does NOT enable cloud writes. The original PRISM workout records, security policies and authentication records are unchanged.

## Implemented in development source

1. `sync/sync-journal.js`: per-owner durable operation queue in a new `mlc2-sync-journal-v1:<verified-owner>` browser namespace. Supported record types: sessions, custom plans, tracking, measurements, meals and goals. Each operation has an immutable ID and explicit starting server revision. Storage failure prevents reporting a saved operation. No automatic destructive merging or backfill.
2. `sync/supabase-transport.js`: disabled by default. When separately configured and enabled **after backend approvals**, verifies authenticated owner before sending to `/rest/v1/rpc/mlc2_v1_commit`. It validates server ownership and operation ID, and maps revision conflicts. Read-only `mlc2_v1_read` supports inspection without changing local records.
3. `sync/PROPOSED-ISOLATED-SCHEMA.sql`: **UNAPPLIED** SQL proposal. New `mlc2_private.records` and `mlc2_private.receipts` under a schema that must remain outside the Data API's exposed schemas, with RLS for owner-only access. Security-invoker RPC functions handle revision checking, tombstones and idempotency inside one database transaction.
4. `tests/sync-journal.test.cjs` and `tests/supabase-transport.test.cjs` run in GitHub Actions with a fake server and identity provider. No real user credentials, user workout records or production SQL writes are involved.

## Crucial behavior

- **Offline / failed network:** durable operations stay queued under the same operation ID; no silent loss, no false upload success.
- **Repeat delivery:** fake server acknowledges repeat operation once; exactly one remote revision results.
- **Two accounts:** journal keys and owner verification prevent cross-account upload; backend RLS proposed separately.
- **Two devices / stale edits:** compare-and-swap revision mismatch blocks automatic overwrite and records an explicit conflict.
- **Deletion:** requires a known existing server revision and produces a tombstone; not a blind delete.
- **Restore:** read-only inspection can show a remote record, but does not silently replace pending local data.

## NOT YET DONE — hard release gates

- No PRISM Supabase `mlc2_private` schema or `mlc2_v1_*` RPC is deployed. Read-only metadata check found no `mlc2_private` schema nor public `mlc2_*` tables.
- No account test-users A/B have completed actual HTTP RLS tests for read/create/change/delete, forged owner, invalid JWT, replay/ack, conflicts or server-side receipts.
- No general-purpose server-side batch download/pagination or account recovery/merge UI yet.
- No automatic app events are wired into the journal; real app data remains device-only. `enabled` defaults to `false` in both modules.
- The user's iPhone saved Home Screen PWA, offline replay, background wake and cross-device behavior still require device testing.
- Do NOT deploy schema, turn on live writes, merge source branch or move to production without separate approval and safe data tests.

## Proposed next safe step

Review the SQL proposal, then obtain explicit approval before installing only this isolated schema and RPC into the PRISM Supabase project (not the original workout tables). After that, create disposable authenticated users and execute ownership/RLS plus two-device sync/recovery tests before wiring any app UI to network commits. Keep the existing Home Screen app and its live PRISM tables untouched.

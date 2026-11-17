# MYLIFTCOACH 2.0 — Phase 5: Manual Cloud Workout Sync

Date: November 15, 2026 (Central). Repository: `gcfd8hy5mb-ai/MYLIFTCOACH-2.0`.

## Scope and safety
The existing PRISM Supabase project's **original** `prism_account_*` and `prism_backups` tables are unchanged. MYLIFTCOACH 2.0 uses only `mlc2_private.records`, `mlc2_private.receipts`, and the `public.mlc2_v1_*` authenticated RPCs. Cloud upload and restore require the signed-in user to click Settings actions and confirm. **No automatic workout or sign-in uploads.**

## Implementation
- New read-only, owner-scoped, paginated `public.mlc2_v1_list_sessions` RPC deployed by migration `mlc2_read_only_session_pagination_v1`. It exposes only `session` records owned by `auth.uid()`; only authenticated roles can execute it.
- `sync/supabase-transport.js` now implements authenticated listing and existing owner-checked commits.
- Settings shows **Sync workouts** and **Check for workouts** actions.
- Explicit upload reconciles device-local completed 2.0 sessions against cloud list, queues missing sessions in a durable per-user journal, and sends with immutable operation IDs. Server revision conflicts are surfaced, never overwritten.
- Explicit restore lists cloud sessions, validates their shape and ownership, restores only missing records after confirmation, and never overwrites existing local sessions. It declines to restore if the local history limit would be exceeded.
- Guest sessions do not upload; only completed 2.0 records are eligible. Existing original PRISM workout records are not imported or uploaded.

## Verification
- Live Postgres rollback-only test of new list RPC: owner A can list their test record; cursor advances; owner B sees no A rows; anonymous role cannot execute it. All test writes rolled back.
- Browser Playwright: mocked Supabase login and RPCs exercised completed workout upload, no duplicate second upload, and restoring a missing 2.0 workout into device-local history. This is **not** proof of real HTTP syncing with personal account credentials.
- Unit tests test owner validation and paginated list RPC response handling.
- GitHub Actions job `43796383333` succeeded, including UI and sync unit tests.

## Still required before declaring cloud sync complete
1. Actual iPhone Safari/installed PWA sign-in with the existing PRISM account.
2. Explicitly upload **one disposable preview workout** and verify acknowledgement.
3. Re-check cloud list, reload, and recover a missing record on a test browser/device; do **not** remove production workout data.
4. Confirm account isolation using genuine authenticated HTTP requests from disposable accounts A/B.
5. Add robust background retry, cloud sync status, expiration handling, offline recovery, and automatic synchronization only after full approval.

**Release status:** manual opt-in cloud sync only. It must not be presented as background or fully validated cross-device synchronization.

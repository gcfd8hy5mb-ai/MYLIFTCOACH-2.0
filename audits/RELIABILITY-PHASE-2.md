# Reliability Phase 2 — account, offline and cloud-readiness audit

Date: 2026-11-15 (Central). Scope: source review, read-only Supabase metadata, mocked browser regressions. **No original account rows, authentication records, photo objects, or live policies were modified.**

## Verified Supabase metadata
- Connected Supabase projects include `PRISM`, ref `kirlpjflaoriiusfamsk`, matching the original MYLIFTCOACH browser's configuration and the new preview's Auth base URL.
- Read-only metadata query identified **41** `public.prism_*` tables, including `prism_backups`. Each reported RLS enabled and at least one policy. Example owner-only policies for `prism_account_sessions`, `prism_account_workouts`, `prism_account_tracking`, and `prism_backups` use `auth.uid() = user_id`.
- This is **not** a proof of live cross-account isolation, full schema correctness, quotas, conflict handling or an end-to-end cloud backup. No live user rows were queried.

## Changes to MYLIFTCOACH 2.0 preview branch
1. **Owner-scoped device data:** guest preview keys remain unchanged; signed-in preview records use `mlc2-<feature>-v1:user:<verified-auth-user-id>` rather than sharing guest records. A sign-out changes the currently visible workspace without deleting prior data.
2. **Trusted auth restore:** on reload, the app treats a stored session as unverified until a Supabase Auth `/user` response confirms the user ID. It does not expose the previously signed-in user's private local data during an outage. A transient network failure leaves the stored session intact; a confirmed unauthorized or invalid session is cleared.
3. **Device-first operation:** local workouts, unfinished-session journal, custom plans, meals, measurements and water/weight tracking remain available without cloud writes. The Settings page explicitly reports connection state and says cloud synchronization is not active.
4. **Private recovery export:** Settings can download JSON containing preview-local workout sessions and draft, meals, goals and measurements, without auth credentials or original-app records. This is export-only; restore/import is not implemented.
5. **Connectivity recheck:** reconnect or returning to the visible tab retries Auth verification if an unverified session exists.

## Must pass before enabling ANY cloud writes
- Separate database table/namespace with deliberately versioned schema and owner-only RLS, verified using disposable test users A and B; no grants from client-controlled values.
- Create/read/update/delete tests as each user (including attempts to read or write the other user's row), not just metadata inspection.
- An offline queue with durable event IDs, upload acknowledgement, retry limits, conflict detection, server revision checks and deletion tombstones.
- Real iPhone PWA background/foreground, airplane-mode, multi-tab, date rollover, and storage quota failure tests.
- Identical workout history after cross-device sign-in with no duplicate sets, sessions, missing data or accidental last-write-wins.
- Backup/import recovery tested with disposable data and explicit user confirmation.
- Cloud sync and deletion must not touch original PRISM account tables without a separately reviewed mapping and authorization.

## Current status
**Cloud saving: not enabled.** The stage improves account segregation and local recovery. A successful GitHub Pages deployment or scripted test does not establish working cloud sync. The original production website and Supabase records remain untouched.

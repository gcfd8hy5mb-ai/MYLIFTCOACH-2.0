# MYLIFTCOACH 2.0 — Reliability Phase 6: Automatic completed-workout sync

Date: November 15, 2026 (US Central). Status: development implementation passed automated tests; **physical iPhone test pending**.

## Scope
- Completed MYLIFTCOACH 2.0 workouts are saved to account-scoped device storage FIRST. After local completion succeeds, a matching durable, owner-specific sync-journal operation is queued with a UUID.
- An authenticated session triggers automatic reconciliation against the isolated Supabase `mlc2_v1_list_sessions` endpoint. Missing completed sessions upload through `mlc2_v1_commit`; an interrupted response is retried with the SAME UUID, using server-side receipt idempotency.
- If offline, workouts remain on-device and queued. Reconnect, opening the app, returning to the foreground, and an active-page 90-second check trigger another attempt. A backoff schedule handles transient errors. **No guarantee of continuous background execution when the browser or PWA is closed**.
- Differences between local and existing cloud records are flagged **for review**, never silently overwritten. Remote deletions are respected. The original PRISM tables and original-app workout keys remain unchanged.
- Account identity and current token are verified before transfer. Guest workouts remain separate and are not uploaded.
- The existing manual **Sync workouts**, **Check for workouts**, and **Download backup** controls remain.
- Settings now shows automatic sync status (queued, offline, up to date, needs review, retry) instead of incorrectly reporting cloud sync disabled.

## Automated tests
- GitHub Actions UI and synchronization unit suites passed on revision `5120d1481085dfcbd4da4425734e78921418f215` (run `43798393390`).
- Mobile Chromium browser smoke test uses mocked Supabase Auth and RPC; verifies completed workout automatically uploads, manual re-sync doesn't duplicate it, missing workout recovery is non-destructive, a second workout queues while offline, reconnect uploads it exactly once, journal empties only after acknowledgement, and reload produces no duplicate.
- Existing exercise, sidebar, nutrition, measurement, and draft persistence tests retained.

## Deployment policy
- Preview-only at `/preview/`, production root `index.html` unchanged and Draft PR #1 unmerged.
- Never upload original PRISM workouts or change production table rows.
- **Not yet proven on iPhone:** automatically upload a new completed workout; airplane-mode queuing and reconnect; reopen the installed Home Screen app; recover data if the device actually loses its local copy.
- Do not infer background sync works while app is terminated: retries resume on the next active browser session.

## Next device acceptance
1. Sign in to Preview Fix 11 on iPhone.
2. Complete one new small 2.0 workout, open Settings; status should reach `Up to date` without tapping Sync.
3. Tap manual Sync workouts to ensure it reports already saved, not a new upload.
4. Try a disposable offline session and restore connectivity if desired; never delete original workout data.

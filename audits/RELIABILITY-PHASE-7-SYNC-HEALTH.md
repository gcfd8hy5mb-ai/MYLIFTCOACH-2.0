# MYLIFTCOACH 2.0 — Phase 7: Sync resilience and health diagnostics

Date: November 15, 2026 (Central). Deployed only to the isolated `/preview/` GitHub Pages site after automated verification.

## Added
- **Per-account backup health:** Settings shows how many upload events remain in the owner-specific durable queue and when the cloud was last successfully verified. A corrupt journal produces a needs-attention message rather than a misleading zero.
- **Verified time, not implied activity:** The `mlc2-cloud-verified-v1:<owner>` timestamp is written only after a verified, conflict-free up-to-date sync result. Failure to save the timestamp never affects workout records.
- Existing offline queue, initial local storage, retry, manual upload and manual recovery are unchanged; original PRISM workout records are never read for uploading or modified.

## Automated regression
- Browser mock tests cover a temporary 503 response to an otherwise valid workout upload, retained durable journal entry, server recovery, and retry of the SAME operation UUID; then confirm the queue is empty only after acknowledgement.
- Prior tests retained: successful automatic upload, offline completion, reconnect replay, reload deduplication, owner isolation, recovery, sign-in and other app navigation.
- GitHub Actions run `43799575817`: **all passed**.
- No genuine production user workout records or real Supabase Auth logins used by the tests.

## Current acceptance and remaining tests
- User previously supplied iPhone screenshot confirming `AUTO ON` and `Up to date · 2 workouts`, indicating live automatic-sync success.
- Physical iPhone airplane-mode offline/online recovery and actual erased-local-data recovery are **still unverified**. Do not instruct user to erase real local data.
- Background sync cannot be guaranteed while Safari/PWA is fully closed; retries resume when app is active.
- Draft PR #1 remains unmerged and original production root stays unchanged.

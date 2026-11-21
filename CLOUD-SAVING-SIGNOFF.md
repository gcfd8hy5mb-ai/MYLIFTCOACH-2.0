# MYLIFTCOACH 2.0 — cloud saving integration sign-off (code candidate)
Date: 2026-11-21
Branch: integration/coach-cloud-beta-20261120
PR: https://github.com/gcfd8hy5mb-ai/MYLIFTCOACH-2.0/pull/3 (DRAFT, unmerged)

## Implemented in the integration branch
- Authenticated, owner-scoped automatic upload of completed workouts after a verified local save; offline journal replay on reconnect and app foreground. No duplicate session uploads.
- Read-only comparison and confirmation-based restoration of missing workouts on a second device, with account isolation, revision-conflict rejection, and no destructive overwrite.
- Automatic account-scoped backup with retry for: custom workout plans, selected workout, weekly schedule, body measurements, water/weight tracking, Coach readiness check-ins and weekly training goal, plus nutrition entries and calorie/protein targets **when the UI provides them**.
- Repeated backup of edited data through acknowledged, owner-specific server revisions and local confirmed baselines. Concurrent edits from another device result in a conflict; never overwrite remote changes implicitly.
- An explicitly cleared selected workout or empty custom-workout list is synced only if the device previously confirmed its remote version; missing/unreadable local storage cannot be used to erase cloud records.
- Manual fill-only recovery of additional account categories; no signed-in account automatically claims existing guest data.
- Safe token refresh across concurrent requests and owner changes. Original PRISM production workout tables/keys untouched.

## Verified this session
- Read-only live PRISM Supabase checks: the isolated `mlc2_v1_commit`, `mlc2_v1_read` and `mlc2_v1_list_sessions` RPCs exist; authenticated role can execute them, anon cannot; `mlc2_private.records` and `mlc2_private.receipts` have RLS and owner policies; necessary authenticated table privileges are present.
- Existing 13 cloud-related regression suites passed 97/97 direct execution cases using the connector-retrieved JavaScript sources in the V8 test harness.
- Added revision-backup and preference-backup suites: 13 new cases passed, including updated backups, stale second-device conflicts, selected-workout clearing, Coach preferences and empty custom plans. Latest edited auxiliary modules passed 29/29 targeted cases including previous auxiliary cases.
- Recent affected JavaScript files parsed successfully in the same test runtime.
- Tests are developer-side and mocked; **they are not a substitute for a full official Node/GitHub Actions run or an actual authenticated two-device acceptance pass.**

## Remaining release verification — NOT code development
1. Full GitHub Actions Node regression result for draft PR #3 is unconfirmed; the reporting connector returns no PR run for current commits. Do not mark CI PASS.
2. Genuine signed-in integrated iPhone + laptop check: complete a new workout, confirm upload, sign in with same account on second device, restore missing history, modify and recover a custom plan and Coach schedule, verify no cross-account access.
3. Confirm browser storage restrictions, account session renewal and retry after network loss in the actual deployed candidate before merging.
4. Review and approve promotion from draft PR #3 to `main`. No production merge has been performed.

## Intentionally outside core cloud saving
- Private progress photos stay on-device; no photo upload/storage bucket is integrated.
- Nutrition interface is still a placeholder. Existing supported local nutrition data may be backed up, but meal entry capability is a separate feature task.
- No unauthorized beta users were granted Free/Pro switching; beta access authorization is independent of cloud saving.

**Result: Core cloud-saving implementation is code-complete on the draft integration branch, NOT yet a confirmed live release.**

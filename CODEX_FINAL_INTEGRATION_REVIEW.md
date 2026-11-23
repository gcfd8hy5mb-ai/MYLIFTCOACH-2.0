# MYLIFTCOACH 2.0 — FINAL INTEGRATION CODEX REVIEW

**Status:** CODE REVIEW REQUESTED; **NOT APPROVED TO MERGE INTO ORIGINAL APP**.
**Repository:** `gcfd8hy5mb-ai/MYLIFTCOACH-2.0`
**Candidate branch:** `review/final-integration-codex-readiness-20261123`
**Deployment:** Existing separate GitHub Pages 2.0 only; `gcfd8hy5mb-ai.github.io/MYLIFTCOACH-2.0/myliftcoach2/`.
**Original protected app:** `gcfd8hy5mb-ai/workout-tracker`. Do not edit, deploy, reset, or migrate its data.

## What this code-review batch changed
1. **Coach weekly goal:** if no explicit user-selected weekly goal exists, default to the number of scheduled training weekdays (exclude `rest-day`). Never overwrite a user-selected weekly goal or change the schedule.
2. **Custom routine deletion:** deleting a day used by the weekly program replaces only that plan's day assignments with explicit rest days, preserves other assignments/routines/history, clears its stale manual selection, and rolls back local mutations on failure.
3. **Home exercise details:** display actual saved optional sets/reps in the upcoming session card and actual planned set count for Today; do not invent exercise targets or log sets automatically.
4. New regression coverage for all above, account isolation, rollback, and Coach respecting rest days and optional targets.

## Already-integrated systems to review as one end-to-end product
- Approved fixed marble iPhone PWA / deep charcoal-teal and gold UI.
- Custom single routine and complete 7-day weekly builder, including rest days, workout ordering, optional sets/reps/weight/rest, one-action save and automatic schedule activation.
- Schedule precedence: explicit manual selection > current weekday workout or rest day > permitted fallbacks; new Home Next Session can preview/start an upcoming scheduled workout intentionally on a rest day without changing the schedule.
- Live workout logging, in-progress draft/resume, completed local account-scoped history, personal records, Coach suggestions, automatic rest, post-workout recap.
- Free/Pro **preview mode only**: the preview mode is not a paid subscription entitlement. Coach may propose but may not silently replace custom exercises or modify saved target weights.
- Account-scoped auxiliary cloud backups and completed workout cloud bridge; fill-only recovery must require consent, protect against owner switching, revision conflicts, stale accounts and data loss.
- Exercise catalog: **344 total**, **263 approved full-size/thumb demonstration pairs**; **81 are expressly withheld**, not approved. Do not regenerate approved artwork or claim the remaining 81 are complete.

## Codex review instructions — execute, do not just summarize
1. Checkout exactly the candidate branch. Inspect its HEAD and file diffs relative to the last published source SHA `96fe0a74fb011d729bda508e6b56fde162c39c78`. Never base changes on the production `workout-tracker` repository.
2. Run `node tests/run-all.js`, `node --check app.js`, `node --check custom-workouts.js`, `node --check full-week-builder.js`, `node --check weekly-workout-schedule.js`, `node --check coach-readiness.js`, and confirm the branch's GitHub `offline-regressions` job passes.
3. Conduct a **real code review**, not merely static tests. Inspect XSS/DOM escaping, localStorage quota/rollback and account scope, stale async callbacks, Supabase RPC permissions, PWA cache invalidation, checked-in approved asset mappings, iPhone standalone safe areas, form accessibility and focus, interrupted workout drafts and resume, and Free/Pro preview boundaries.
4. Test 0–7 training days (at least one required to save a new full-week program); rest-day priority; deleting a scheduled custom day; editing single-day routines after a full-week save; manual overrides versus weekly selection; Next Session from a rest day; Coach suggestions versus explicit custom targets; optional blank inputs; a logged workout, resume, history and recap.
5. Test restoring verified account data *without crossing accounts* using mocks/offline simulations. The owner is testing iPhone-only and expressly declined manual cross-device testing. Do not require a laptop.
6. For each issue, report path, line(s), severity (blocker/high/medium/low), impact, reproduction, and smallest safe fix. Fix only on an independent review branch, run tests after each batch, and keep original app and account data untouched.
7. Produce a final release decision: **GO for continuing 2.0 testing**, **GO/NO-GO for replacing the original**, remaining blockers and exact confidence boundaries. Do not claim live cloud sync or actual iPhone UI behavior was personally tested unless it was. Do not merge or deploy to original without explicit user approval.

## Prior independent review and branch topology
- Existing `CODEX-FINAL-REVIEW-RESULTS.md` documents an earlier 26-finding review and fixes, but **does not review the new seven-day program and subsequent integration**. Recheck only new or affected code unless a previous finding's conditions change. The original review's remaining browser acceptance and Web Locks fallback/cross-context issues must not be erased from the release record.
- The current candidate and GitHub `main` **diverge heavily** (at the start of this final pass: 859 commits ahead / 61 behind, 300 files returned by compare). **Do not create a blind merge PR from the candidate into main.** The production source is assembled by pinned GitHub Pages checkout; review both source and packaging diff.
- Original app and original user data stay unchanged until the user explicitly authorizes cutover.
- A copy of this handoff alone cannot invoke Codex. The user or their connected Codex workflow must run the review; report the actual tool/job/commit before marking Codex PASS.

## Verification and acceptance boundaries
- The user already verified the separate 2.0 iPhone Home Screen: weekly program builder works; dynamic training day label and next session actions work. Avoid repeating approved tests unless relevant changes regress them.
- New source changes in this review batch have automated CI but still require a final same-iPhone smoke test if published.
- The 81 withheld exercise demonstrations are a visible content gap. A full 344-demonstration completion claim is invalid.
- Real paid subscriptions/entitlements are **not** shipped by the current Free/Pro beta switch. Confirm this is a release gate if monetization is required.
- Independent Codex review must still be run and reported. This document is the handoff, not Codex's review.
- Keep **2.0** separate from original app; no production migration, overwrite, signing out, cache clearing, localStorage deletion, or reset as part of review.

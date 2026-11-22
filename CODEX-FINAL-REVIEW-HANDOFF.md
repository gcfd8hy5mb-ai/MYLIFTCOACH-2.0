# MYLIFTCOACH 2.0 — Final Codex Review and Repair Handoff
Prepared: 2026-11-22
Review-only branch: `review/codex-final-integration-20261122`
Frozen baseline: `integration/replacement-visual-coach-20261122`
Original production: **do not modify, merge, publish or change GitHub Pages**.

## Assignment for Codex
Perform a full source-level review of the **combined** MYLIFTCOACH 2.0 redesign. Do not perform a superficial style-only review. For every confirmed bug, write a failing focused regression test, implement the smallest safe fix on the review branch, rerun the full test suite, and document the result. Stop and report any unresolved release-blocking issue rather than claiming the app is bug-free.

## Existing work: preserve it, do not rebuild it
- Approved mobile-first charcoal/dark teal marble and gold UI, fixed wallpaper with scrolling content and iPhone Safari/PWA behavior. Do not revert to purple, black or light green.
- 344 exercise catalog entries; 263 previously approved image/thumbnail pairs; remaining 81 use approved placeholders. Never regenerate, discard or replace accepted artwork.
- Custom, manually selected, and weekday-scheduled workouts override Coach-generated recommendations; Home and opened workout must agree.
- Saved draft "Resume Workout" for the correct account and matching exercise list; completing a workout writes durable local history first.
- Coach 6/8/12-week custom, generated and mixed programs; deduplicated, qualified workout evidence; goal/periodization, calorie estimator with feet and inches.
- Free/Pro private beta modes (no paid entitlement); switching must refresh Home, Today, Coach immediately and leave user data untouched.
- Owner-scoped Supabase completed workout and auxiliary data backup; previous cloud validation should be preserved. Public preview is intentionally cloud-blocked.
- User has already verified on iPhone: workout resume wording, completed-session persistence after refreshing/reopening, and visually correct guest Pro→Free switching with previous totals retained.

## Review priorities (highest first)
1. **Data durability** — failure during finish, page close, refresh, queued workout upload, concurrent workout + auxiliary sync, journal rescan, offline→online, crash/retry, idempotent cloud commits, explicit recovery and no overwrites of original data.
2. **Identity and privacy** — sign-in, expired/refresh token, account switching while an operation is in-flight, guest-account separation, entitlements and metadata changes, cross-user isolation of plans, logs, drafts, calorie goals and media.
3. **Workout fidelity** — custom routine priority over presets/Coach; Home/Today vs opened plan parity; stale cached Coach-day invalidation; resume exact sets; no duplication in workout history or Coach progression.
4. **Coach correctness** — recommendations based only on valid owner-scoped completed sets; Free mode no Pro suggestions; future-dated/invalid/duplicate sessions excluded; progress/adherence vs next-day rotation consistent; non-mutating read-only suggestions.
5. **iPhone UX** — Safari and installed PWA behavior, modal/keyboard and safe areas, fixed marble background, navigation and accessible controls, no stale cached JS, copy or incorrect status after switching.
6. **Exercise library/images** — all catalog IDs resolve; approved manifest maps full-size/thumbnail correctly; no broken references; placeholders for artwork not yet approved.
7. **Performance/reliability** — expensive repeated recomputation, large histories, serialization failure, protected storage quotas, corrupt records, unhandled rejections, battery/network overhead.

## Repository and release facts
- Source: `gcfd8hy5mb-ai/MYLIFTCOACH-2.0`.
- Final combined source: `integration/replacement-visual-coach-20261122`; review work only on `review/codex-final-integration-20261122`.
- Draft integration PR: https://github.com/gcfd8hy5mb-ai/MYLIFTCOACH-2.0/pull/7 — do not mark ready or merge.
- Independent cloud-blocked iPhone preview: https://gcfd8hy5mb-ai.github.io/MYLIFTCOACH-2.0-PREVIEW/replacement-candidate/
- Deployment pipeline and preview repository are separate from the current production Home Screen app.
- Branch comparison on 2026-11-22: combined integration branch is **705 commits ahead and 39 commits behind** `main` (diverged), with a large changed-file set. **Do not blindly merge or rebase main.** Inspect actual conflicting files and preserve approved design and user data. Main has not been established as a safe base.
- There were 0 submitted PR reviews when this handoff was written. No Codex audit has been executed merely by adding this document.

## Commands / validation
```bash
node tests/run-all.js
node --check app.js
node --check beta-access.js
node --check sync/automatic-workouts.js
node --check sync/auxiliary-cloud.js
node --check goal-program-adherence.js
```
Check `.github/workflows/myliftcoach-regression.yml` and `.github/workflows/replacement-candidate.yml` for exact CI constraints. Add targeted regression tests to `tests/run-all.js` when fixing a bug. Run integration tests and release/visual manifest verification; do not interpret a green Node test as a real iPhone or live cloud verification.

## Deliverables
1. `CODEX-FINAL-REVIEW-RESULTS.md`: each finding with priority, precise file/function, reproduction steps, root cause, change commit, regression test and status.
2. Source fixes on the **review** branch, each minimized and tested. Preserve original app and all approved artwork.
3. Full-test run result and unresolved gaps: distinction between static/automated verification, iPhone visual acceptance already confirmed, and cloud behavior previously verified.
4. Final branch-to-branch integration risk report including the diverged `main` changes.
5. Recommendation **ready / blocked** with reasons. Do not deploy or merge unless user explicitly approves.

## Stop conditions
Do not modify production Supabase data, use unapproved real workout data as test fixtures, disable CSP on the public preview, regenerate approved images, change entitlements to paid status, or alter production GitHub Pages. Ask for authorization before actions with those effects. If a test cannot run with available tools, mark it **NOT VERIFIED**; never infer success.

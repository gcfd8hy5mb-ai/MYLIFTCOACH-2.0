# MYLIFTCOACH 2.0 — original-app replacement gate
Date: 2026-11-22
Status: CANDIDATE ONLY — no production cutover authorization

## Product contract
- iPhone-first, approved fixed marble wallpaper, dark teal + gold, no unintended redesign.
- Selected custom workout > explicitly scheduled workout > preset. Autonomous Coach can propose sessions but cannot silently replace the chosen workout.
- Zero-history accounts begin with catalog-based exercise suggestions; weight progression only after sufficient completed working sets.
- No fabricated history, recommended load, paid entitlement, or media approval.
- Synthetic Coach testing data lives only in RAM on the independent preview path, never in account progress, drafts, uploads, or reports.
- Completed workouts are saved first, cloud queued afterward, and account boundaries are verified.

## Requirements before autonomous Coach can be declared complete
- [x] Catalog-driven automatic 4-day balanced program proposal without requiring history (initial version).
- [x] Coach weight recommendations from qualifying completed sessions, opt-in next-set fill, live feedback and post-workout recap.
- [x] Readiness tracking, selected-plan priority, simulated test isolation and automated regression checks.
- [x] User-configurable goals, 3–5 weekly training days, and available equipment in the active automatic proposal; saved locally in owner-scoped preferences. Cloud synchronization of these NEW preferences is still pending.
- [ ] Recovery-aware adaptation, bounded fatigue/volume deload logic and rest-day recommendations with safety limits.
- [ ] Auto-rotating Coach sessions that respect manual schedule, custom plans, missed days and account sync across devices.
- [ ] Exercise substitutions when equipment is unavailable, with equivalent movement safeguards and visible reasoning.
- [ ] Real iPhone acceptance: first session, progression after two qualifying sessions, edited targets, interrupted workout and no-history fallback.

## Requirements before the original application can be retired
- [ ] Integrate and audit approved demonstration assets and precise exercise-ID mappings. No auto-approval of missing images.
- [ ] Merge latest Coach, approved visual, and workout redesign changes in one isolated release candidate without overwriting protected features.
- [ ] Confirm owner-specific completed workout, custom plan, selected schedule, Coach preferences, and auxiliary data cloud recovery between normal Safari and a clean second session.
- [ ] Verify beta Free/Pro changes remain authorized and do not masquerade as paid subscriptions.
- [ ] Validate all essential original-app functions, or explicitly agree on out-of-scope features (nutrition, photos, etc.).
- [ ] Run full regression suite plus actual iPhone end-to-end workout and media checks.
- [ ] Produce reversible backup of current published app and account data; verify rollback route before any merge/deployment.
- [ ] Obtain explicit cutover approval, publish, verify Home Screen PWA version, and retain rollback.

## Deliberate exclusions
- No old workout-history migration (user confirmed none exists).
- No unapproved production database writes or automatic replacement of custom plans.
- The independent preview is separate from the stable GitHub Pages deployment.

## Current code evidence
- Autonomous proposal engine: coach-program-builder.js
- Owner-scoped training preferences: coach-preferences.js
- Autonomous preference tests: tests/coach-autonomous-preferences.test.cjs
- Today tab integration: app.js / index.html
- Automated suite includes tests/coach-autonomous-proposal.test.cjs and tests/coach-live-workout.test.cjs
- Draft branch: feature/coach-live-workout-integration-20261122
- Existing integration branch: integration/coach-cloud-beta-20261120
- Separate approved visuals development branch: feature/344-approved-exercise-visuals

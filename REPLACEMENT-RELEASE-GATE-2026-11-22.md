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
- [ ] Auto-rotating Coach sessions that respect manual schedule, custom plans and missed days on the primary iPhone; cross-device Coach synchronization is not a release requirement.
- [ ] Exercise substitutions when equipment is unavailable, with equivalent movement safeguards and visible reasoning.
- [ ] Real iPhone acceptance: first session, progression after two qualifying sessions, edited targets, interrupted workout and no-history fallback.

## Goal calorie estimator — scoped implementation
- [x] Adult profile inputs: age, weight, height, sex-based BMR equation, and activity; choose strength, bulk, maintain, or cut.
- [x] Estimate calories using Mifflin-St Jeor with a modest default surplus/deficit; no food entries or macros required.
- [x] Store validated, owner-scoped profile on the iPhone with no user data migration.
- [x] Tests for formulas, invalid inputs, and owner isolation passed in latest branch CI.
- [ ] Confirm the updated estimator screen in actual iPhone Safari/PWA and compare boundary cases.
- [ ] Determine whether optional weight-trend-based recalculation should be added without relying on food logs; no automatic adjustment without user review.
- [ ] Confirm on-device profile backup/recovery before original-app cutover.

## Requirements before the original application can be retired
- [ ] Integrate and audit approved demonstration assets and precise exercise-ID mappings. No auto-approval of missing images.
- [ ] Merge latest Coach, approved visual, and workout redesign changes in one isolated release candidate without overwriting protected features.
- [ ] Verify owner-specific completed workout, custom plan, selected schedule, Coach preferences and auxiliary data save and backup/recovery on the user's iPhone; second-device parity is not required.
- [ ] Verify beta Free/Pro changes remain authorized and do not masquerade as paid subscriptions.
- [ ] Validate all essential original-app functions, or explicitly agree on out-of-scope features (nutrition, photos, etc.).
- [ ] Run full regression suite plus actual iPhone end-to-end workout, Home Screen PWA, save/restore and media checks.
- [ ] Produce reversible backup of current published app and account data; verify rollback route before any merge/deployment.
- [ ] Obtain explicit cutover approval, publish, verify Home Screen PWA version, and retain rollback.

## Deliberate exclusions
- Cross-device synchronization and second-device acceptance are not required. Retain safe cloud backup/recovery for the primary iPhone.
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

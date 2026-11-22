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
- [x] Initial recovery-aware, phase-specific set-volume advice: optional +1 set only in Build phase after two qualifying sessions and Great readiness; recommend lighter volume on Tired or Consolidate; block load increases under recovery holds. Advice never edits saved routines or logged sets.
- [ ] Extend recovery adaptation with more individualized progression, missed-session scheduling and physical iPhone acceptance; the current guidance is conservative, not fully autonomous.
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

## Fixed-length fitness goal programs (2026-11-22)
- [x] Strength, bulk, maintain and cut each offer selectable 6-, 8- and 12-week cycles.
- [x] Per-account local calendar start, current week, foundation/build/consolidate phase labels and completion status.
- [x] Coach-generated workout suggestions use the selected goal when a cycle is active, while preserving selected custom workouts.
- [x] Saving profile changes without changing goal/duration preserves the cycle start date.
- [x] Replacing or restarting a goal cycle requires user confirmation; completed workouts are not removed.
- [x] CI coverage for valid durations, boundaries, elapsed time, profile isolation, and no food logging.
- [ ] Verify the cycle UI in the independent iPhone preview and Home Screen PWA.
- [ ] Add genuinely phase-specific training volume/recovery adaptations; current phase names are labels, not yet complete periodization.
- [ ] Verify safe backup/recovery of goal cycle and calorie profile before production replacement.

## Custom-workout goal programs
- [x] Choose Custom / Coach-generated / Mixed as the workout source for each 6-, 8-, or 12-week goal.
- [x] Optionally pin a named saved custom routine or rotate existing custom routines.
- [x] Reference current saved custom plans by stable ID; edits to exercises are reflected without copying or overwriting their original record.
- [x] Respect manually selected custom workouts and the weekly schedule; Coach suggestions remain an optional Start action.
- [x] Pinned custom workouts fail closed when missing or deleted, rather than silently using another routine.
- [x] Owner-scoped source settings are bound to the current goal/program start date, so new programs cannot claim old settings.
- [x] Full offline regression suite passed on commit 91ed8bf6a3f53c3cc41c96f5eae706633bf3ccd9.
- [ ] Test the new source selector, saved custom workout editing, mixed rotation, and restart in iPhone Safari.
- [ ] Verify program source preferences are included in iPhone backup/recovery before retiring the original app.
- [x] Add phase-specific custom-workout suggestions for sets, rep focus, load-increase gating and rest considerations without editing saved plans. CI passed on commit d8aab253d94da45b5c6c209c1e3bd9ff17aa7867.
- [ ] Verify the new guidance on iPhone; implement any further individualized progression and calendar scheduling only after acceptance.

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

# MYLIFTCOACH 2.0 — Functional parity register

Status: development, verified against the existing **gcfd8hy5mb-ai/workout-tracker** `main/index.html` and `persistence/storage-model.js`, November 15, 2026.

## Source of truth

The original workout-tracker has 27 primary section IDs:
`welcomeScreen`, `onboardingScreen`, `goalReviewScreen`, `setupScreen`, `home`,
`workoutsScreen`, `workoutDetailScreen`, `exerciseInfoScreen`, `profileScreen`,
`prismProScreen`, `helpScreen`, `manageWorkoutScreen`, `workoutScreen`,
`prismRestScreen`, `completionScreen`, `libraryScreen`, `builderScreen`,
`overallProgressScreen`, `calendarScreen`, `recordsScreen`,
`measurementsScreen`, `photosScreen`, `globalHistoryScreen`,
`globalTimerScreen`, `waterScreen`, `foodScreen`, `goalsScreen`, `weightScreen`.

The source array above contains **28** IDs when counted literally; the structural count must be re-verified after normalized section parsing. Do not infer 1:1 feature parity from the count: several original features are implemented in modules or subviews.

## Batch 1 — committed to MYLIFTCOACH-2.0 main

- Approved emerald marble, gold bordered design stays in place.
- Dedicated **Workout History** view shows completed 2.0 practice workouts with exercises and set details.
- Optional read-only inspection of original `workoutHistoryV52` device history, including per-exercise sets.
- Original custom plans (`customWorkoutsV5`) accessible as an inspection-only section within Workouts.
- Dedicated **Daily Tracking** view with usable new 2.0 local-only water and body-weight logging, display, and entry removal.
- Optional read-only original `dailyTrackingV1` water and weight history.
- New original-app view actions do **not** write, delete, or merge original records.
- Signed-in original local data is read only under `prismAccountLocalV1:<verified-current-user-id>:<legacy-key>`; guest records are inspected only when not authenticated. This follows `persistence/scoped-storage.js`.
- New tracking entries use only the separate `mlc2-local-daily-v1` key.
- History and Tracking have their own pages accessible from **More**, not repeat links to other pages.

## Not finished

- Full port of original 27+ sections and their behaviors; 2.0 is **not** functionally complete.
- Original Supabase training tables are **not** read from or written to in 2.0; device-local read-only inspection is not cloud synchronization.
- Original account onboarding, goal-derived plans, unrestricted custom workout builder, all exercises/illustrations, session recovery, saved PRs/measurements/photos, nutrition, calorie and macro tools, advanced coaching and entitlements have not been ported.
- Original records found via the device browser may be empty if the original used a different browser/device, the data only exists in Supabase, or the currently authenticated account differs.
- Requires real iPhone acceptance testing and cloud isolation review.

## Next batches

1. Full workout list and custom-workout editor/plan persistence, keeping original data read-only until safe mapping is tested.
2. Full training experience: exercise metadata, prior sets, timers, resume, finished-session reviews, PRs.
3. Food/nutrition, goals, photos, measurements, water, calendar and tracking parity.
4. Advanced coaching, analytics, Free/Pro, cross-device cloud reconciliation, and regression testing.

## Rules

- Leave original `gcfd8hy5mb-ai/workout-tracker` and its production Supabase tables untouched until user authorizes a tested migration.
- Preserve source-key ownership and existing student/user records, including deletions and conflict handling.
- Never label local device previews as completed cloud imports or verified cross-device sync.
- Keep approved MYLIFTCOACH 2.0 styling stable.

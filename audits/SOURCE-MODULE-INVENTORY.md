# Original `workout-tracker` source module and storage inventory

**Read-only GitHub tree:** `gcfd8hy5mb-ai/workout-tracker` `main` commit `d7ed94705d1b5fc9b1f8742f633ae05b36c59611`; tree `396a9e6ee91c813387bb9d4e7a4a496efd8fed56`. Tree listing returned `416` paths and `truncated=false`. This is a complete **path inventory**, not a guarantee every module is dynamically loaded at runtime or individually behavior-tested.

## File counts from original GitHub tree

| Category | Files |
|---|---:|
| Total tree entries (including directories) | 416 |
| Blob/file entries | 407 |
| Application JavaScript files (excluding tests and old `myliftcoach2/` folder) | 147 |
| Test files (all extensions) | 179 |
| Workflow files | 7 |
| SQL migrations | 3 |
| Image/font/media/archive assets by extension | 28 |

**Redesign repo:** current main tree returned `30` paths, with `false` truncated. Its `preview/` code is not a substitute for the original application modules.

## Canonical `persistence/storage-model.js` rules (34)

These rules are an exact source extract from the original app's model. Other local-only keys, IndexedDB stores and independent module keys also exist; see the master register.

| Original logical storage key | Account table category | Shape |
|---|---|---|
| `prismTimerAlertModeV1` | `ui_preferences` | `raw` |
| `prismLocalProfileV1` | `profile` | `fields` |
| `prismJourneyV1` | `onboarding` | `fields` |
| `workoutGoalsV1` | `goals` | `fields` |
| `prismGoalPhasesV1` | `goal_phases` | `list` |
| `prismAthleteProfileV1` | `athlete_preferences` | `fields` |
| `dailyTrackingV1` | `tracking` | `tracking` |
| `customWorkoutsV5` | `workouts` | `workouts` |
| `myliftcoachWeeklyDayOverridesV1` | `ui_preferences` | `fields` |
| `workoutHistoryV52` | `sessions` | `sessions` |
| `setHistoryV5` | `current_sets` | `fields` |
| `previousHistoryV51` | `previous_sets` | `fields` |
| `overloadTargetsV1` | `targets` | `fields` |
| `completedExercisesV5` | `completions` | `list` |
| `prismActiveWorkoutV1` | `active_workout` | `fields` |
| `prismCoachActionsV1` | `coach_actions` | `fields` |
| `prismCoachCheckinsV1` | `coach_checkins` | `list` |
| `prismAdaptiveProgrammingV1` | `adaptive` | `adaptive` |
| `prismSessionFatigueV1` | `fatigue` | `list` |
| `prismCoachFeedbackV1` | `coach_feedback` | `list` |
| `prismCoachInterventionsV1` | `interventions` | `interventions` |
| `prismPostWorkoutCoachV1` | `post_workout` | `list` |
| `prismCoachSessionReflectionsV1` | `reflections` | `list` |
| `prismSessionReadinessV1` | `readiness` | `fields` |
| `prismAskHistoryV1` | `coach_questions` | `list` |
| `prismMeasurementsV1` | `measurements` | `list` |
| `prismProBetaFeedbackV1` | `beta_feedback` | `fields` |
| `prismDrawerSectionsV1` | `ui_preferences` | `fields` |
| `prismBetaPreviewPreferenceV1` | `ui_preferences` | `fields` |
| `prismCoachLongTermGoalV1` | `coach_long_term_goals` | `fields` |
| `prismCoachTrainingPhaseV1` | `coach_training_phases` | `fields` |
| `prismCoachPhaseTransitionV1` | `coach_phase_transitions` | `fields` |
| `prismCoachProgramProposalsV1` | `coach_program_proposals` | `list` |
| `prismCoachRecoveryPlansV1` | `coach_recovery_plans` | `list` |

## Original JavaScript code modules (147 paths)

**Classification is a filename-based filing aid, not a behavioral validation.** A module may participate in multiple workstreams. Source paths and approximate source byte sizes are listed for audit planning.

### Account/auth, cloud, profiles, backup and ownership (15)

| Source file | GitHub-tree bytes |
|---|---:|
| [`cloud-backup.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/cloud-backup.js) | 6,430 |
| [`liftova-onboarding.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-onboarding.js) | 5,632 |
| [`myliftcoach-intelligence-account-boundary.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-intelligence-account-boundary.js) | 6,297 |
| [`myliftcoach-onboarding-polish.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-onboarding-polish.js) | 3,237 |
| [`onboarding.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/onboarding.js) | 38,899 |
| [`persistence/account-controller.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/persistence/account-controller.js) | 6,662 |
| [`persistence/account-sync.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/persistence/account-sync.js) | 4,649 |
| [`persistence/account-ui.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/persistence/account-ui.js) | 21,122 |
| [`persistence/photo-scope.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/persistence/photo-scope.js) | 4,092 |
| [`persistence/photo-sync.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/persistence/photo-sync.js) | 10,297 |
| [`persistence/reconcile.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/persistence/reconcile.js) | 2,419 |
| [`persistence/scoped-storage.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/persistence/scoped-storage.js) | 4,308 |
| [`persistence/storage-model.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/persistence/storage-model.js) | 9,283 |
| [`pro-experience.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/pro-experience.js) | 19,258 |
| [`supabase-config.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/supabase-config.js) | 4,571 |

### Workouts, exercise library and training UX (14)

| Source file | GitHub-tree bytes |
|---|---:|
| [`exercise-library-expansion-2.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/exercise-library-expansion-2.js) | 23,009 |
| [`exercise-library-expansion-3.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/exercise-library-expansion-3.js) | 21,842 |
| [`exercise-library-expansion-4.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/exercise-library-expansion-4.js) | 7,649 |
| [`exercise-library-expansion-5.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/exercise-library-expansion-5.js) | 15,273 |
| [`exercise-library-expansion-v1.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/exercise-library-expansion-v1.js) | 13,501 |
| [`exercise-library-expansion.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/exercise-library-expansion.js) | 754 |
| [`liftova-active-workout.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-active-workout.js) | 10,185 |
| [`liftova-library.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-library.js) | 11,137 |
| [`liftova-workout-tab-v3.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-workout-tab-v3.js) | 11,699 |
| [`liftova-workouts.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-workouts.js) | 1,762 |
| [`post-workout-summary.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/post-workout-summary.js) | 10,632 |
| [`preworkout-plan.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/preworkout-plan.js) | 7,385 |
| [`timer-alerts.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/timer-alerts.js) | 4,345 |
| [`workout-experience.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/workout-experience.js) | 13,523 |

### Progress, history, nutrition, measurements and photos (6)

| Source file | GitHub-tree bytes |
|---|---:|
| [`advanced-analytics.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/advanced-analytics.js) | 7,531 |
| [`liftova-progress.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-progress.js) | 6,964 |
| [`meal-planner.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/meal-planner.js) | 18,080 |
| [`measurements.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/measurements.js) | 7,542 |
| [`online-food-lookup.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/online-food-lookup.js) | 6,349 |
| [`progress-photos.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/progress-photos.js) | 12,898 |

### Coach and adaptive/athlete learning systems (93)

| Source file | GitHub-tree bytes |
|---|---:|
| [`adaptive-exercise-selector.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/adaptive-exercise-selector.js) | 4,471 |
| [`adaptive-feedback-loop.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/adaptive-feedback-loop.js) | 19,195 |
| [`adaptive-plan-activation.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/adaptive-plan-activation.js) | 3,395 |
| [`adaptive-program-builder.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/adaptive-program-builder.js) | 13,025 |
| [`adaptive-programming.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/adaptive-programming.js) | 16,500 |
| [`adaptive-set-coach.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/adaptive-set-coach.js) | 13,418 |
| [`athlete-context-learning-v8.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/athlete-context-learning-v8.js) | 9,100 |
| [`athlete-dose-response-v8_2.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/athlete-dose-response-v8_2.js) | 5,382 |
| [`athlete-fatigue-deload-v8_5.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/athlete-fatigue-deload-v8_5.js) | 6,552 |
| [`athlete-learning-engine.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/athlete-learning-engine.js) | 8,873 |
| [`athlete-profile.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/athlete-profile.js) | 6,724 |
| [`athlete-program-adaptation-outcomes-v8_7.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/athlete-program-adaptation-outcomes-v8_7.js) | 5,968 |
| [`athlete-progression-response-v8_4.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/athlete-progression-response-v8_4.js) | 5,964 |
| [`athlete-recovery-lag-v8_3.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/athlete-recovery-lag-v8_3.js) | 4,807 |
| [`coach-athlete-intelligence.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-athlete-intelligence.js) | 3,510 |
| [`coach-checkin.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-checkin.js) | 5,487 |
| [`coach-confidence.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-confidence.js) | 2,701 |
| [`coach-cycle.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-cycle.js) | 9,015 |
| [`coach-decision-engine-v2.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-decision-engine-v2.js) | 3,717 |
| [`coach-engine.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-engine.js) | 18,200 |
| [`coach-intervention-memory.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-intervention-memory.js) | 6,003 |
| [`coach-learning.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-learning.js) | 8,992 |
| [`coach-long-term-phases.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-long-term-phases.js) | 3,473 |
| [`coach-memory-v2.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-memory-v2.js) | 3,091 |
| [`coach-phase-programming.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-phase-programming.js) | 2,852 |
| [`coach-phase-transitions.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-phase-transitions.js) | 3,532 |
| [`coach-program-adaptation.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-program-adaptation.js) | 13,937 |
| [`coach-program-overlay-learning.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-program-overlay-learning.js) | 4,378 |
| [`coach-program-overlay-policy.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-program-overlay-policy.js) | 4,294 |
| [`coach-program-overlays.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-program-overlays.js) | 6,218 |
| [`coach-recovery-deload.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-recovery-deload.js) | 3,003 |
| [`coach-today.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-today.js) | 12,974 |
| [`coach-weekly-planning.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/coach-weekly-planning.js) | 7,550 |
| [`exercise-coach-memory.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/exercise-coach-memory.js) | 3,073 |
| [`in-workout-coach.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/in-workout-coach.js) | 7,821 |
| [`myliftcoach-adaptive-arbitration-v8.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-adaptive-arbitration-v8.js) | 6,110 |
| [`myliftcoach-adaptive-context-v8_1.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-adaptive-context-v8_1.js) | 5,496 |
| [`myliftcoach-adaptive-dose-v8_2.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-adaptive-dose-v8_2.js) | 3,253 |
| [`myliftcoach-adaptive-fatigue-v8_5.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-adaptive-fatigue-v8_5.js) | 2,889 |
| [`myliftcoach-adaptive-program-outcomes-v8_7.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-adaptive-program-outcomes-v8_7.js) | 2,608 |
| [`myliftcoach-adaptive-program-planner-v8_6.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-adaptive-program-planner-v8_6.js) | 2,899 |
| [`myliftcoach-adaptive-program-planning-v10.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-adaptive-program-planning-v10.js) | 6,235 |
| [`myliftcoach-adaptive-progression-v8_4.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-adaptive-progression-v8_4.js) | 2,588 |
| [`myliftcoach-adaptive-recovery-v8_3.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-adaptive-recovery-v8_3.js) | 3,008 |
| [`myliftcoach-admin-shadow-dashboard-v3.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-admin-shadow-dashboard-v3.js) | 7,518 |
| [`myliftcoach-admin-shadow-dashboard-v4.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-admin-shadow-dashboard-v4.js) | 9,262 |
| [`myliftcoach-anatomy-v2.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-anatomy-v2.js) | 92 |
| [`myliftcoach-athlete-evidence-core.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-athlete-evidence-core.js) | 2,280 |
| [`myliftcoach-autonomy-calibration-v10_3_6.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-autonomy-calibration-v10_3_6.js) | 8,037 |
| [`myliftcoach-brand-safety.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-brand-safety.js) | 3,234 |
| [`myliftcoach-brand.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-brand.js) | 832 |
| [`myliftcoach-coach-context-v8_1.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-coach-context-v8_1.js) | 8,693 |
| [`myliftcoach-coach-dose-v8_2.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-coach-dose-v8_2.js) | 3,436 |
| [`myliftcoach-coach-evidence-v8.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-coach-evidence-v8.js) | 4,332 |
| [`myliftcoach-coach-fatigue-v8_5.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-coach-fatigue-v8_5.js) | 3,708 |
| [`myliftcoach-coach-program-outcomes-v8_7.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-coach-program-outcomes-v8_7.js) | 2,906 |
| [`myliftcoach-coach-progression-v8_4.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-coach-progression-v8_4.js) | 3,764 |
| [`myliftcoach-coach-recovery-v8_3.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-coach-recovery-v8_3.js) | 3,866 |
| [`myliftcoach-custom-workout-fix.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-custom-workout-fix.js) | 5,153 |
| [`myliftcoach-daily-tracking-ux.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-daily-tracking-ux.js) | 3,290 |
| [`myliftcoach-decision-arbitration-v9-7.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-decision-arbitration-v9-7.js) | 5,638 |
| [`myliftcoach-home-sequence-fix.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-home-sequence-fix.js) | 16,530 |
| [`myliftcoach-home-workout-actions.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-home-workout-actions.js) | 6,385 |
| [`myliftcoach-intelligence-contract-v1.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-intelligence-contract-v1.js) | 9,288 |
| [`myliftcoach-intelligence-core.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-intelligence-core.js) | 6,273 |
| [`myliftcoach-library-ux.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-library-ux.js) | 4,383 |
| [`myliftcoach-menu-return-swipe.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-menu-return-swipe.js) | 3,523 |
| [`myliftcoach-multi-horizon-optimization-v10_2.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-multi-horizon-optimization-v10_2.js) | 3,480 |
| [`myliftcoach-phase-aware-optimization-v10_3.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-phase-aware-optimization-v10_3.js) | 3,831 |
| [`myliftcoach-pre-v10_4-readiness.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-pre-v10_4-readiness.js) | 8,491 |
| [`myliftcoach-prediction-self-evaluation-v9_1.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-prediction-self-evaluation-v9_1.js) | 9,615 |
| [`myliftcoach-predictive-athlete-model-v9.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-predictive-athlete-model-v9.js) | 7,840 |
| [`myliftcoach-predictive-readiness-v8_8.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-predictive-readiness-v8_8.js) | 6,044 |
| [`myliftcoach-profile-brand-lock.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-profile-brand-lock.js) | 2,905 |
| [`myliftcoach-program-adaptation-planner-v8_6.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-program-adaptation-planner-v8_6.js) | 5,975 |
| [`myliftcoach-program-adaptation-planner-v8_7.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-program-adaptation-planner-v8_7.js) | 2,448 |
| [`myliftcoach-program-outcome-validation.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-program-outcome-validation.js) | 8,452 |
| [`myliftcoach-program-plan-outcomes-v10_1.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-program-plan-outcomes-v10_1.js) | 4,324 |
| [`myliftcoach-settings-destination-fixes.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-settings-destination-fixes.js) | 1,146 |
| [`myliftcoach-shadow-cloud.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-shadow-cloud.js) | 1,544 |
| [`myliftcoach-startup-smooth.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-startup-smooth.js) | 4,738 |
| [`myliftcoach-swipe-ux.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-swipe-ux.js) | 5,064 |
| [`myliftcoach-visual-cleanup.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-visual-cleanup.js) | 3,350 |
| [`myliftcoach-week-coordination-v9-9.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-week-coordination-v9-9.js) | 7,648 |
| [`myliftcoach-workout-coordination-v9-8.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/myliftcoach-workout-coordination-v9-8.js) | 4,914 |
| [`next-session-coach.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/next-session-coach.js) | 9,384 |
| [`phase-insights.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/phase-insights.js) | 10,948 |
| [`plateau-detection.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/plateau-detection.js) | 5,990 |
| [`post-workout-coach.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/post-workout-coach.js) | 8,807 |
| [`session-readiness.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/session-readiness.js) | 4,489 |
| [`set-coach.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/set-coach.js) | 4,850 |
| [`workout-coach-targets.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/workout-coach-targets.js) | 5,952 |
| [`workout-completion-intelligence.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/workout-completion-intelligence.js) | 5,146 |

### Other app shell, presentation, supporting modules (19)

| Source file | GitHub-tree bytes |
|---|---:|
| [`app-feel.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/app-feel.js) | 3,927 |
| [`ask-prism.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/ask-prism.js) | 18,763 |
| [`liftova-anatomy.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-anatomy.js) | 16,124 |
| [`liftova-custom-home.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-custom-home.js) | 6,050 |
| [`liftova-functional-fixes.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-functional-fixes.js) | 2,645 |
| [`liftova-home.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-home.js) | 19,614 |
| [`liftova-native-device.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-native-device.js) | 3,058 |
| [`liftova-native-forms.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-native-forms.js) | 7,899 |
| [`liftova-native-interactions.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-native-interactions.js) | 2,517 |
| [`liftova-native-navigation.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-native-navigation.js) | 7,926 |
| [`liftova-native-states.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-native-states.js) | 4,252 |
| [`liftova-polish.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-polish.js) | 9,962 |
| [`liftova-pro.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-pro.js) | 6,692 |
| [`liftova-profile-branding.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-profile-branding.js) | 8,805 |
| [`liftova-profile.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-profile.js) | 8,576 |
| [`liftova-quick-log.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/liftova-quick-log.js) | 4,782 |
| [`prism-test-mode.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/prism-test-mode.js) | 4,484 |
| [`sw.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/sw.js) | 9,085 |
| [`weekly-summary.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/weekly-summary.js) | 13,231 |

## Source audits and verification already available

- `docs/account-persistence-audit.md` — earlier ownership and cloud migration design; verify against current source.
- `docs/liftova-functional-qa-2026-09-28.md` — tested original app flows (some pass, fail or blocked on a prior commit). Never treat old passes as a current V2 test.
- `persistence/storage-model.js`, `persistence/scoped-storage.js`, `persistence/account-controller.js`, `persistence/account-sync.js`, `persistence/photo-sync.js` — load/save/ownership lifecycle.
- `supabase/migrations/` — proposed DB schema and RLS; **presence in source is not verification of current live deployment**.
- `sw.js`, `manifest.json` — PWA offline and cache behavior, including update isolation.

## Explicitly not retrieved

- Private actual user workouts, measurements, photos, passwords/tokens, connected cloud rows, or local device backups.
- A verified live Supabase schema/RLS snapshot; code alone cannot confirm it.
- Every individual JavaScript function body or source media asset; this is a path-level exhaustive census with selected detailed reviews in the master register.

**Next pass:** review modules in the order of persistence/ownership → workout session/plan engines → daily tracking → photos → coaching/entitlements, and add individually verified acceptance tests. Do not merge source data models until test-account conflict resolution is proven.

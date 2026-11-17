# MYLIFTCOACH 2.0 — Master original-app migration audit

**Audit started:** 2026-11-15 (US Central). **Scope:** static GitHub source and previously recorded QA evidence only. **No production data read or migrated.**

## Authority and frozen source baselines

- **Original application source:** [`workout-tracker` main](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/index.html) at commit `d7ed94705d1b5fc9b1f8742f633ae05b36c59611`, `index.html` blob `ad762c87999c82b6550b9f727871f925255f3165`.
- **Original persistence model:** [`persistence/storage-model.js`](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/persistence/storage-model.js). Original scoped-storage/account-sync/photo-sync modules are separate contracts.
- **Redesign source under migration:** [`MYLIFTCOACH-2.0` feature branch](https://github.com/gcfd8hy5mb-ai/MYLIFTCOACH-2.0/blob/feature/restore-original-extras-sidebar/index.html), preview at [`main/preview/`](https://github.com/gcfd8hy5mb-ai/MYLIFTCOACH-2.0/tree/main/preview), current as of audit start commit `d05f955e06f0d4509ce343fa0e9783f1cdd69953`.
- **Earlier parity audit documents:** `FUNCTIONAL-PARITY.md`, `FUNCTIONAL-PARITY-REGISTER.md` are baseline history and now **outdated about recently added 2.0 preview functions**. This file supersedes their status table; do not interpret older “missing” labels as current.
- **Evidence distinction:** code present ≠ behavior tested ≠ user data migrated ≠ production parity. All three require different proof.

## Measured code inventory

| Measurement | Original | Redesign / preview | Audit interpretation |
|---|---:|---:|---|
| Main screen `<section>` IDs | **28** | **13** `section.page` views | Screens do not map 1-to-1; verify functions/subviews rather than just counts |
| `index.html` named function declarations | **222** | Not comparable (separate app.js modules) | The original has extensive inline logic |
| Original repository JS code files outside tests and old redesign folder | **147** | Preview uses `app.js` plus CSS and assets | Module-level inventory required |
| Original `persistence/storage-model.js` record rules | **34** | No 1-to-1 sync adapter | Cloud preservation blocker |
| Current 2.0 exercise definitions | N/A | **12 starter exercises** | Rebuild original full exercise catalog from verified source |
| Current 2.0 built-in plans | N/A | **4 demo plans** plus preview-local custom plans | Does not preserve original schedule or plan rules |

The original repo's main tree scan returned **416 paths** (not truncated). That includes assets, workflows, tests, JavaScript, documents and SQL. The root-level `index.html` explicitly loads account/persistence modules and some other features are installed by script/module loaders; counting just its static `<script src>` tags undercounts app behavior.

## Primary-screen migration register (all 28 original screens)

`Partial` means some UI or preview-local behavior exists, **not** equivalence to the original and **not** cloud data migration.

| # | Original section | Original role | V2 destination | Source-parity state | What remains |
|---|---|---|---|---|---|
| 01 | `welcomeScreen` | Welcome / account entry | welcome | **Partial** | Existing credential sign-in and demo entry; original account entry/onboarding paths need parity |
| 02 | `onboardingScreen` | Onboarding journey | — | **Missing** | Restore step sequence, persistence and resume without overwriting prior profile |
| 03 | `goalReviewScreen` | Goal review | — | **Missing** | Restore goals review, editing and returning-user flow |
| 04 | `setupScreen` | Workout-plan setup | — | **Missing** | Goal-derived suggested plans, focus, schedule, and basic-plan fallback |
| 05 | `home` | Home dashboard | home | **Partial** | Approved visual styling; verify live original-data summaries, next sessions, and shortcuts |
| 06 | `workoutsScreen` | Browse plans / custom workouts | workouts | **Partial** | 4 fixed demo plans plus new preview custom plans; original scheduling and plan rules absent |
| 07 | `workoutDetailScreen` | Plan detail and exercises | workouts / modal | **Partial** | Original plan detail, explanation/controls and ordered exercises not fully ported |
| 08 | `exerciseInfoScreen` | Exercise detail | library | **Partial** | 12 starter movements; original instructions, diagrams/history/substitutions not ported |
| 09 | `profileScreen` | Profile / settings / account tools | settings | **Partial** | Sign-in/settings skeleton only; profile fields/units/alerts/account actions incomplete |
| 10 | `prismProScreen` | Pro tier / feature access | — | **Missing** | Free/Pro entitlement policy and premium feature gating must be preserved |
| 11 | `helpScreen` | Help & Support | sidebar placeholder | **Missing** | Restore genuine help content, data explanations and routes |
| 12 | `manageWorkoutScreen` | Manage / reset / backup | manage | **Partial** | New preview create/edit/delete custom plans; original plan reset/backup protections absent |
| 13 | `workoutScreen` | In-progress workout | workouts / modal | **Partial** | Practice sets/rest work; original resume/sets/options/exercise substitutions and workout state absent |
| 14 | `prismRestScreen` | Workout rest countdown | rest overlay | **Partial** | 90-second timer present; original adjustable durations, alerts and workflow need parity |
| 15 | `completionScreen` | Workout completion | progress / modal | **Missing** | Full session review, feedback, next-target suggestions, and completion route not ported |
| 16 | `libraryScreen` | Exercise Library | library | **Partial** | Original large metadata/image catalog, advanced filters and builder integration missing |
| 17 | `builderScreen` | Custom workout builder | manage | **Partial** | New 2.0 local 1–12 exercise builder; original unlimited rules, ordering and cloud mapping unverified |
| 18 | `overallProgressScreen` | Progress / analytics | progress | **Partial** | Practice session totals/chart; original filters, muscle stats, coaching and history metrics absent |
| 19 | `calendarScreen` | Workout calendar | calendar | **Partial** | 2.0 calendar displays recorded days; no verified original account-cloud parity |
| 20 | `recordsScreen` | Personal records | calendar | **Partial** | Heaviest-set computation; full original PR history rules and units not validated |
| 21 | `measurementsScreen` | Body measurements | measurements | **Partial** | New local form/history; original measurement types/phase linkage/cloud history incomplete |
| 22 | `photosScreen` | Private progress photos | sidebar placeholder | **Missing** | Original IndexedDB + private Supabase Storage paths not ported; no image import |
| 23 | `globalHistoryScreen` | Workout History | history | **Partial** | Practice sessions plus opt-in local-original read-only snapshot; cloud history not migrated |
| 24 | `globalTimerScreen` | Standalone timer | sidebar timer | **Partial** | 90-second standalone timer; original settings, alerts/background controls incomplete |
| 25 | `waterScreen` | Water logging and goal | tracking | **Partial** | Local 2.0 water entry; unit, target, trends and original account storage not ported |
| 26 | `foodScreen` | Food / saved meals / favorites | nutrition | **Partial** | New manual macro log; original catalog/serving control/favorites/recipes not migrated |
| 27 | `goalsScreen` | Calorie / water / training goals | nutrition / tracking | **Partial** | Preview calories/protein inputs; original goal calculations, training plan and water targets missing |
| 28 | `weightScreen` | Weight and history | tracking | **Partial** | Local pounds tracking; original units, chart, body-goal phase and account sync absent |

**Current 2.0 sections inspected:** `welcome`, `home`, `workouts`, `manage`, `library`, `progress`, `history`, `calendar`, `measurements`, `tracking`, `coaching`, `nutrition`, `settings`. Separate workout/rest modal overlays do not add to that count.

## Implementation workstreams and acceptance criteria

| Workstream | Original source examples | Required proof before marking complete |
|---|---|---|
| A. Entry, identity, profile | `onboarding.js`, `persistence/account-ui.js`, `persistence/account-controller.js`, `index.html` | Returning user profile and new-user journey both work; validated account ownership and sign-out/reload behavior |
| B. Preset plans, custom workouts, exercise library | `index.html`, `myliftcoach-custom-workout-fix.js`, `liftova-library.js`, `exercise-library-expansion-*.js` | Plan selection, reorder/edit, exercise instructions and equipment metadata, substitutions, and selected goal/schedule all match |
| C. Active workout & rest | `index.html`, `liftova-active-workout.js`, `in-workout-coach.js` | Exercise order, set logging, rep/weight units, pause/rest, resume after tab refresh, finish/cancel history, alert settings |
| D. History, PRs, charts, calendar | `index.html`, `advanced-analytics.js`, `liftova-progress.js` | Session IDs and all sets preserved; trend metrics and dates reconcile; weeks/months/time zones and notes tested |
| E. Tracking, goals, meals | `index.html`, `meal-planner.js`, `online-food-lookup.js` | Original food catalog, favorites/saved meals, servings/macros, unit settings, water and calorie targets, meal plan restored |
| F. Measurements, private photos | `measurements.js`, `progress-photos.js`, `persistence/photo-sync.js`, `persistence/photo-scope.js` | Scoped records/photos preserved, all original image stores read, safe private upload, compare/view/delete, offline behavior |
| G. Coach & adaptive intelligence | `coach-*.js`, `athlete-*.js`, `adaptive-*.js`, `myliftcoach-*-v*.js`, `post-workout-coach.js` | Readiness, targets, deloads, recovery, overlays, recommendations, reflection/feedback and outcome learning validated |
| H. Free/Pro, help and backups | `pro-experience.js`, `cloud-backup.js`, `index.html` | Entitlements remain server-trustworthy, no preview-only grant copied; help, export, restore, account boundaries and reset gates operate correctly |
| I. Visual/UX acceptance | Approved MYLIFTCOACH 2.0 references and CSS | Dark-and-gold buttons, marble, fixed background, sidebar, modals, keyboard/iPhone PWA, desktop, installed-app cache updates |

## Data and ownership contract — DO NOT MERGE THESE NAMESPACES

**Original app:** The data model contains **34 named logical records** (enumerated in `SOURCE-MODULE-INVENTORY.md`). Guest and owner-scoped entries use `prismAccountLocalV1:<userId>:<legacy-key>`; the owner must be cryptographically authenticated before cloud import or edit.

Important original primary keys include `workoutHistoryV52`, `setHistoryV5`, `previousHistoryV51`, `customWorkoutsV5`, `dailyTrackingV1`, `workoutGoalsV1`, `prismMeasurementsV1`, `prismLocalProfileV1`, `prismJourneyV1`, `prismActiveWorkoutV1`, and many `prismCoach*` and `prismAthlete*` learning records. Preserve unknown fields and ID relationships, rather than flattening into isolated arrays.

Original photo storage is split between IndexedDB `workoutTrackerPhotosV1/photos` and `prismProgressPhotosDB/photos`. A proposed private Supabase bucket in source is `prism-account-photos`; verify live deployment, policy/ownership, and recovery separately before any writes.

**Preview-only data:** `mlc2-demo-workouts-v1`, `mlc2-local-daily-v1`, `mlc2-custom-plans-v1`, `mlc2-measurements-v1`, `mlc2-food-log-v1`, `mlc2-food-goals-v1`. Auth token is in separate `mlc2-auth-session-v1` sessionStorage. These are deliberately **not the same keys or schema as the original app**. A recent browser smoke test covers the new preview-local custom plans, meals and measurements, not original-history transfer.

**Supabase:** The original has `persistence/account-sync.js`, `storage-model.js`, `account-controller.js`, photo sync, scoped storage and SQL migrations. V2 currently uses a separate sign-in flow and opt-in local-original inspection; it does **not** claim verified full cloud sync. Audit RLS, schema migration state and per-account ownership with disposable test records only.

## Migration gates / acceptance matrix

1. **Inventory complete:** enumerate all source modules, 28 screens, 34 persistence rules, photo stores, cache/update strategy and entitlement paths. This document is an initial source-level register, not proof all modules have been individually reviewed.
2. **Read-only snapshot and checksum:** produce an owner-verified snapshot of original storage and account data for a test account. Include local-only data and both photo stores. Do not copy access tokens or paid entitlement grants.
3. **Dual-model mapper:** map each original key/entity to V2 schema losslessly; preserve IDs, set order, timestamps, units, substitutions, goals and unknown properties. Reject collisions/conflicts.
4. **Unit and integration tests:** compare representative source and V2 results, workouts/PR/calendar, food/macros, records, coach recommendations, and permissions.
5. **Cloud test data only:** verify A/B account isolation; optimistic revision conflict; restore and deletion tombstones; offline edits and multi-tab updates.
6. **Physical devices:** Safari + installed iPhone PWA, desktop, reload, background/foreground, timer and caching; no fake green “pass” based on simulator alone.
7. **Merge separately:** keep `workout-tracker` production and real student/workout data untouched. Merge redesign into production only after all acceptance gates and explicit user approval.

## Current audit conclusion

**Not yet 100% restored.** Source coverage: **28/28 original primary screens inventoried**, **34/34 canonical storage rules identified**, code module file list captured separately. Functionality migration has **13 V2 screens with mixed partial functionality**, but critical original features (photo workflows, real account sync, complete coach/intelligence, Pro gates, original full library, in-progress resume, full saved meals) are not ported. The backlog must be completed and regression tested before any production replacement.

## Source references

- [Original 28 screens and in-app functions](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/index.html)
- [Original persistence rules](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/persistence/storage-model.js)
- [Scoped ownership](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/persistence/scoped-storage.js)
- [Cloud account read/write transport](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/persistence/account-sync.js)
- [Photo stores and transport](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/persistence/photo-sync.js)
- [Original app persistence audit](https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/docs/account-persistence-audit.md)
- [2.0 current preview code](https://github.com/gcfd8hy5mb-ai/MYLIFTCOACH-2.0/blob/main/preview/app.js)

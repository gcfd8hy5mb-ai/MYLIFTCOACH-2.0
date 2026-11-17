# MYLIFTCOACH 2.0 — Original exercise library imported (Fix 18)

**Branch:** `feature/restore-original-extras-sidebar`, draft PR #1. Original production root site unchanged.

## Source-proven catalog
- Original `workout-tracker/main/index.html`: **60 base exercise entries**.
- Expansion scripts `exercise-library-expansion-v1.js` through `exercise-library-expansion-5.js`: **292 distinct expansion IDs** (duplicate definitions deduplicated).
- Original base + expansions: **341 unique original IDs**. The 2.0 starter list contains 12 IDs, 9 of which overlap the original catalog, yielding **344 unique available exercises** in the rebuilt site.
- `imports/source/` holds untouched snapshots of the five original expansion files; `imports/build-exercise-catalog.cjs` provides a side-effect-free extraction validator. `imports/original-exercises.generated.js` contains static exercise metadata only, no legacy DOM/persistence/auth or presentation code.
- One original `pendulum-squat-wide` entry in v5 omitted the equipment argument; its exported metadata is normalized to `Machine` while retaining the original ID, name, and instructions. No original source files modified.

## Integrated features
- Complete exercise library with 12 muscle groups, source instructions, tips, common mistakes, and an equipment filter.
- Searchable and capped 60-card library rendering to avoid excessive scrolling on iPhone.
- Searchable custom workout builder with stable selected exercise IDs through searches; imported exercises can be saved to 2.0 custom plans and logged as sets.
- The existing 2.0 starter IDs, completed workout records, drafts, cloud journal, and original PRISM data remain unchanged.
- Approved emerald marble / dark-charcoal / gold style is preserved; no legacy styles are imported.

## Verification
- GitHub Actions run **43807735196: PASSED** both isolated sync/catalog unit tests and iPhone-sized/desktop automated browser smoke tests.
- Browser checks original library search, expanded technique notes, equipment filter, imported exercise selection and custom-plan persistence, along with all earlier workout, offline/online, auth, backup, and recovery behavior.
- Physical-iPhone review of the enlarged library and installed Home Screen update remains pending. The app is not complete: training plans, anatomy, intelligent Coach, and other original modules are subsequent import waves.

## Production safeguards
Keep draft PR unmerged. Publish changes only under `/preview/`. Do not overwrite original PRISM tables, original workout history, Supabase accounts, or the existing root-site deployment without separate approval.

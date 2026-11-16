# MYLIFTCOACH 2.0 — Reliability exit and original-feature import register

## Evidence already demonstrated on the actual iPhone
- Existing PRISM account sign-in and automatic backup of three completed workouts, including one completed offline then synchronized after reconnecting
- Device displays zero pending completed-workout uploads and a verified cloud sync timestamp
- Manual 2.0 session upload, second upload recognized as already saved, cloud lookup returns the existing session
- One 2.0 custom-workout-plan snapshot successfully uploaded (one new category, four unchanged/empty)
- Preview version check displayed current Fix 16 without reinstalling the browser preview

These statements do **not** mean that all other fitness categories have been restored on a real second device, or that an installed iPhone Home Screen icon has passed update verification.

## Automated release gate
- [x] Original app account / production PRISM data never written by the preview's new sync code
- [x] Automated offline workout-save, retry, idempotency, local history, and account isolation tests
- [x] Simulated two-browser session recovery, preserving the original browser
- [x] Simulated five-category auxiliary data upload, repeat skip, recovery, and no-overwrite protection
- [x] Expanded tests for wrong-account/guest isolation, byte-identical populated categories, corrupted backup rejection, storage rollback
- [x] Safe-update checker identifies a newer version without automatic navigation
- [ ] Physical installed Home Screen app update acceptance (requires user's installed icon)
- [ ] Real second-browser restore with the user's own account (do not erase iPhone storage)
- [ ] Real-device upload of all other data categories after data exists; only custom-plan category has a confirmed live backup
- [ ] End-to-end comprehensive original feature restoration (NOT part of saving foundation)

**Policy:** Do not block independent, separately staged feature-import work on tests that require the user's physical devices. Do not merge/deploy production until applicable acceptance is obtained. Maintain a strict separation between safe new features and historical app's unreliable UI/persistence code.

## Source modules verified from original repository
Original repo: `gcfd8hy5mb-ai/workout-tracker`, original `main` at the read-only audit snapshot.

### 1. Exercise library — first import, highest priority
- Original `index.html` includes the base `exerciseLibrary` with legacy exercise IDs
- `exercise-library-expansion.js` sequentially loads versions 1 through 5
- `exercise-library-expansion-v1.js`: static exercise metadata (names, muscle groups, equipment, how-to, tips and mistakes)
- `exercise-library-expansion-2.js` and `exercise-library-expansion-3.js`: further exercise definitions
- `exercise-library-expansion-4.js` and `exercise-library-expansion-5.js`: additional exercises using shorthand constructor `x(id,name,muscle,equipment,how)`
- `liftova-library.js`: legacy presentation styles and DOM behavior; DO NOT import those styles into the approved charcoal/jade/gold 2.0 design
- `liftova-anatomy.js`, `myliftcoach-anatomy-v2.js`: anatomy features

**Import strategy:** extract and validate metadata into a *pure immutable data catalog*; keep original IDs and ordering, avoid duplicate IDs, normalize group/equipment fields, require unique IDs and safe text. Adapt 2.0's library and workouts to the catalog via read-only adapter, not via the original script's global DOM mutations or its styles. Run tests for search, filters, custom plan IDs, workout drafts, mobile UI, and cloud data before enabling.

### 2. Training programs and custom workouts
- Original `index.html` plus `myliftcoach-custom-workout-fix.js`, `myliftcoach-home-workout-actions.js`, and original `persistence/storage-model.js`
- Import workout definitions and validated compatibility, **not** the legacy storage implementation. Existing 2.0 local/cloud record IDs and user data take precedence.

### 3. Coaching and progressive overload — second import wave
- Original `coach-engine.js` version 1.4, `coach-decision-engine-v2.js`, `coach-today.js`
- `adaptive-programming.js` version 2.4, `adaptive-feedback-loop.js`, `adaptive-exercise-selector.js`, `adaptive-set-coach.js`, `coach-memory-v2.js`
- Numerous `myliftcoach-coach-*`, `myliftcoach-adaptive-*`, and predictive-v8/v9/v10 modules with overlapping generations
- Retain validated decision rules, confidence gates, bounded recommendations and test fixtures; reconstruct a single pure Coach pipeline that reads the new validated exercise, program, and history models. DO NOT inject all historical globals/scripts en masse.

### 4. Remaining fitness features — subsequent waves
- Measurements, nutrition, tracking, reports, photos, anatomy and profile (source modules include `myliftcoach-daily-tracking-ux.js`, `persistence/photo-scope.js`, `persistence/photo-sync.js`).
- Preserve approved luxury visual design and the 2.0 save/restore/cloud namespace. Photos need a separate private Storage audit and are not included in JSON sync.

## Import acceptance sequence
1. Check duplicate IDs, exercise coverage and catalog formatting against originals (pure data; no DOM side effects).
2. Add full exercise library to 2.0 in a dedicated branch commit with smoke and saved-workout compatibility tests.
3. Restore plans, visualization and anatomy.
4. Restore isolated Coach algorithms and their tests, checking progression confidence bounds.
5. Restore remaining 2.0 feature coverage, finish tests and iPhone sign-off before merging.

**Current distinction:** The reliable workout/backup foundation has passed extensive automated tests and multiple physical-iPhone milestones. The entire fitness app is not yet complete; this register prepares its next development stage.

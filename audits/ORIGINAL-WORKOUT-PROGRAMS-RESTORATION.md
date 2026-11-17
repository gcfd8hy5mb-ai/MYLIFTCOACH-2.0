# MYLIFTCOACH 2.0 — Original workout-program restoration (Preview Fix 19)

## Original source
The original `gcfd8hy5mb-ai/workout-tracker/main/index.html` contains `const presetWorkouts` with exactly four routine definitions. They were transcribed from source without changing the day names or exercise lists:
- Day 1 — Chest & Triceps: `machine-chest-press`, `pec-deck`, `triceps-pushdown`.
- Day 2 — Back & Biceps: `lat-pulldown`, `seated-row`, `preacher-curl`.
- Day 3 — Legs: `leg-press`, `leg-extension`, `seated-leg-curl`, `calf-raise`.
- Day 4 — Shoulders & Arms: `shoulder-press`, `lateral-raise`, `biceps-curl`, `triceps-extension`.

## Scope
- `imports/original-programs.js`: safe immutable static program metadata, with IDs `original-day1` to `original-day4`. No original DOM styling, localStorage routines, authentication, or cloud persistence scripts are executed.
- Existing original exercise IDs were checked against the already-imported catalog; all needed exercises exist.
- `app.js` now makes the original presets available alongside, not instead of, the four established 2.0 plans. The home-card rotation and existing 2.0 plan IDs remain unchanged.
- Workouts screen groups original, 2.0 and user-created workouts. Saved custom workouts, account-scoped local records and automatically synced completed sessions retain existing storage keys and semantics.
- This phase does **not** import adaptive Coach-generated plans or prior users' custom plans from the original app; those remain separate subsequent tasks. Original custom plans remain viewable read-only when available in same-origin browser storage.

## Verification
- Automated run `43880891237` PASSED catalog/program source unit tests and mobile/desktop browser smoke tests.
- Original day 1 launches an exercise logger using `machine-chest-press`; logged set retains the original ID in the durable draft.
- Discarding that draft leaves no falsely completed workout and does not touch original records.
- Existing mobile UI, imported exercise library, fitness record backup, account isolation, offline queue, retry, duplicate protection, and recovery smoke tests all passed.
- Physical iPhone acceptance remains outstanding for newly restored program cards. Production root remains untouched; Draft PR #1 unmerged.

## Next restoration wave
- Source-verified optional read-only preview and explicit opt-in copy of the user's original custom workout plans, with legacy exercise ID validation and duplicate safety.
- Adaptive 3–5 day training templates and original Coach algorithms, reimplemented on top of 2.0's stable workout and storage foundation.

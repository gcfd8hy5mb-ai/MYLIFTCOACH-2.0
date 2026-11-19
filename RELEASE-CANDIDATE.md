# MYLIFTCOACH 2.0 — Development release-candidate gate

This draft branch is **not approved for merge or deployment**. Keep production MYLIFTCOACH and all existing Supabase records unchanged until the checks below pass.

## Offline automated checks (no paid APIs)

Run from the repository root on a computer with Node.js installed:

```bash
node tests/run-all.js
```

The command invokes three independent test files: static integration contracts (344 catalog records, script ordering, UI hooks, no cloud-preview write calls), local migration/recovery invariants (unfinished session drafts, backup/restore conflicts, malformed data, data health) and Coach progression rules (session ordering, warm-up handling, insufficient history, exercise-specific load increments, selected-plan alignment).

These checks do **not** prove that Safari, desktop browsers, Supabase auth, or photo downloads work. Do not promote a branch based only on an offline PASS.

## Manual acceptance — run on an iPhone and desktop preview before merge

- [ ] Existing-account sign-in works without freezing. Failed login and token expiry are recoverable.
- [ ] A saved custom workout is prioritized over presets whenever it is selected.
- [ ] Home Today's Workout, the Workouts selection marker, the opened workout and Coach all show the same plan and exercise order.
- [ ] Create, edit and delete a custom routine; refresh; selected workout remains correct.
- [ ] Log multiple sets across two exercises. Refresh before finishing; resume the same exercise list and verify sets persist.
- [ ] Attempt to switch to another workout with an unfinished draft. Cancel retains the draft; confirmation makes the new plan explicit.
- [ ] Complete a workout. History, home totals, progress charts and Coach agree after refresh; no phantom entries if storage fails.
- [ ] Export a local recovery file, inspect the file type, and restore **only on a separate empty test browser**. Conflicting existing records must be rejected without changes.
- [ ] Save a copy of an IndexedDB progress photo. Confirm that it is **not included** in the JSON recovery backup.
- [ ] Read-only cloud account comparison returns data for the authenticated user only. Test wrong-account and expired-session handling without writing.
- [ ] Check full 344-exercise library for matching descriptions, muscle groups, technique notes, and nonblank placeholders.
- [ ] Verify approved demonstrations only after obtaining the matching private media manifest/files and license status.

## Release blockers

1. **Cloud sync incomplete:** Original backend account record shapes, owner-bound revision checkpoints, and explicit cross-app migration still need integration and real account testing. The present controls are read-only previews, not working cross-device sync.
2. **Demonstrations incomplete:** The latest 268 approved media files are not available in the 2.0 repository. The imported catalog contains 344 exercise entries, not 344 approved visuals.
3. **Coach incomplete:** Only migrated local workout progression, substitution, weekly readiness, selected-plan review and catalog technique notes have been verified in development.
4. **End-to-end acceptance incomplete:** No physical-device test has been performed through this tool session.

## Rollout protections

- Keep pull request #2 in draft until all release blockers are addressed.
- Do not replace original Supabase policies, tables, or user records.
- Do not silently claim or overwrite original users' local data.
- Never treat an empty client-side history as evidence of an empty original cloud account.
- Keep the original production app available until an explicit cutover/rollback decision.

## GitHub-hosted automated verification — November 18, 2026

A draft-branch GitHub Actions workflow now runs `node tests/run-all.js` on changes to `feature/exercise-placeholder-migration-prep` and pull requests targeting `main`. It uses Node 22, standard GitHub-hosted compute, and no external API credentials or deployment tokens.

**Verified completed run:** workflow run `44430476871`, job `135246265357`, conclusion `success`. Its logs confirmed PASS for:

1. Static integration contracts (catalog, script order, UI controls, read-only cloud-preview safeguards).
2. Recovery/migration regression (drafts, local export/import, conflict rejection, original mapping).
3. Coach regression (progression, history ordering, selected workout).

This clears the **offline automated test gate only**. Real iPhone/desktop acceptance, 268 approved image transfer, production account sync and full Coach parity remain blockers. The GitHub job emitted a Node runtime deprecation warning from its runner/actions; it did not affect test completion.

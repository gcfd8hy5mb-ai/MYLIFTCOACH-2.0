# MYLIFTCOACH 2.0 — Phase 9: Separate fitness-data backup and recovery

**Status:** Development code tested; preview-only publication pending. The original PRISM workout tables and user records remain unchanged.

## Scope
Completed workout sessions already have automatic offline-first synchronization. This phase adds an opt-in, separate backup path for other 2.0 fitness records:
- Custom workouts (plans)
- Body measurements
- Water/weight daily tracking
- Nutrition meal history
- Nutrition targets/goals

The new actions under Settings are **Back up data** and **Recover data**. The user must confirm both actions. This deliberately does not auto-upload records that could be changed simultaneously on two devices.

## Data segregation and conflict model
- Uses existing `mlc2_private.records` with distinct allowed record types and record ID `snapshot-v1`; no new server tables or policies needed.
- Every category stays isolated under the verified PRISM Auth user ID. Each backup is a versioned record with an idempotent operation UUID in the existing `mlc2-sync-journal-v1:<owner>` journal.
- An initial backup creates only records absent from the cloud. An equal existing backup is skipped. A different existing cloud backup is **never overwritten** and is reported as a conflict for later reconciliation.
- Recovery reads only that owner's snapshots and **fills only missing or empty local categories**, never replacing an existing populated category. Missing cloud records or tombstones do not remove local data.
- Local storage failures attempt rollback of earlier writes; original PRISM workout tables remain untouched. A private local JSON download remains available.

## Automated verification
- Dedicated `tests/aux-data.test.cjs` covers account-scoped keys, JSON validation, non-destructive restores, tombstones, storage-write rollback, and canonical JSON comparison.
- Browser smoke test covers backing up five non-session categories with mocked account RPCs, skipping identical uploads on retry, and restoring missing categories in a fresh independent browser without a new cloud write.
- All tests use mocked identities and cloud data, not any existing personal workouts.
- Actual restoration from your own account on another physical device remains unverified.

## Remaining work
- Confirm actual backup on the user's iPhone with small non-sensitive example records.
- Real cross-device restoration for auxiliary categories.
- Version-aware update reconciliation and deletions; no automatic overwrite should be enabled until resolved.
- Separate preview PWA manifest/cache versioning; avoid caching an older app bundle indefinitely.

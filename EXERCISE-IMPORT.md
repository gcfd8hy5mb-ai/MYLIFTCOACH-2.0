# Exercise library import status

**Completed on this development branch:** `exercise-catalog-344.js` has been committed and loaded before `app.js`. It includes 344 unique exercise IDs, names, categories, equipment, cues and supporting instruction fields. Search and filters now cover Chest, Arms, Back, Legs, Shoulders, Core and Cardio. A charcoal-and-gold generic illustration appears for any withheld or unavailable demonstration.

**Important release safeguard:** The recovered archive predates the latest Work-approved image manifest. Consequently **all 344 demonstration statuses are withheld in this branch**, including the 268 whose actual images were reportedly approved and integrated in the separate private Work workspace. This is a safe placeholder state, not a revocation of those private approvals. Import only the latest checksum-verified approved image files and matching manifest before showing thumbnails in the development app.

**Not yet migrated:** The workout creator and current session logic still use the earlier 12-item starter data set and demo local history. The complete 344-item catalog is available in the Exercise Library view, but must also be wired into custom workout editing, the home screen's workout selection, and workout logging without changing production Supabase data.

**Do not merge or deploy as finished:** Browser acceptance testing and the private media transfer remain outstanding; keep this pull request a draft. No production workout data is written.

## Cloud migration staging (not activated)

The public 2.0 development build now includes the **exact pure original storage model and three-way reconciliation planner**, plus a manually triggered **read-only cloud dry run** in Settings. The cloud check revalidates the signed-in user, fetches account-scoped rows without caching, and reports overlap and potential conflicts. It has **no write APIs or restore logic**.

This dry run may see **zero original local keys**, because the original app uses account-scoped storage and the 2.0 app has separate `mlc2-*` storage. A zero count does not prove the original app or account has no data. Its findings are advisory, not permission to merge. Safe synchronization needs an explicit 2.0-to-original mapping, verified owner-scoped local reads, a shared checkpoint, recovery archive, conflict-resolution UI and physical device tests.

No production schema changes, records, or images were modified.

## Local recovery export (new)

Settings now offers **Download recovery copy**. This downloads a versioned, allowlisted 2.0 JSON snapshot of local custom workouts, selected workout, practice session history, water/weight tracking, body measurements, and readiness check-ins. It expressly excludes original-app keys, Supabase tokens and photo binaries; the photo store remains separately in IndexedDB. No import/restore button exists yet, and exporting does not mean data is synced to the cloud. Keep this file securely and back up photos separately.

The dry-run original-format converter remains intentionally non-writing. The original app's numeric custom-workout IDs, scoped storage, and revision checkpoint semantics must be reconciled before any upload. Do not use this recovery export as an input to the original app's cloud backup endpoint.

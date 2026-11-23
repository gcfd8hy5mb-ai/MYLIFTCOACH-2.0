# MYLIFTCOACH 2.0 production cutover review

**Package ready for a controlled limited beta. Publication remains pending explicit approval, the GitHub Actions dry-run, and an explicit decision on the remaining hosted verification risk.** This report supersedes the status and deployment sequence in the earlier production runbooks.

## Pinned package and fallback

The [release manifest](release-manifest.json) pins replacement commit `acf85b4f30fd1f6edb0fdd579758c5f976800d8e` and original commit `24b3e3a40076f8d6aeb6fe6c603068652b268351`. The destination is the existing [MYLIFTCOACH URL](https://gcfd8hy5mb-ai.github.io/workout-tracker/). The verified local build contains 623 replacement files. Its asset tree matches the pinned release source byte for byte, including the approved exercise art. This preparation changes review files only.

To rebuild, check out the source revisions in separate read-only checkouts. From the pinned replacement checkout run `node review/production/package.cjs /path/to/original-checkout /path/to/new-output`. Use the [manual workflow template](github-pages-cutover.yml) and compare both generated tree hashes in the release manifest. The tree hashes are the SHA-256 of sorted lines from `find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum`, run from each tree root with GNU tools. The original ZIP can be reproduced with `git archive --format=zip 24b3e3a40076f8d6aeb6fe6c603068652b268351` from the original repository. Check the recorded archive SHA-256 or verify all file contents against that Git commit if a different Git or compression implementation changes ZIP bytes.

GitHub showed Pages deployment `7933407576` at the pinned original commit. The live `index.html`, `manifest.json` and `sw.js` matched that baseline. All 495 original tracked files matched the reconstructed source ZIP. The 495-file publishable rollback differs from the exact archive only by a scoped worker that avoids cache deletion and forced client navigation. The exact ZIP preserves the original worker for independent recovery. The Pages rollback does not touch Supabase or browser records.

The replacement preserves the original manifest ID, start URL `./?app=myliftcoach`, `/workout-tracker/` scope, and `./sw.js` worker registration. It stages the existing dark teal, marble and gold shell, Coach, workout logging, custom plans, history and Free/Pro beta code with approved visual assets. Worker tests verified offline routing for the installed launch query with both packages. Real installed handoff still requires the same iPhone.

## Account and data preservation

See the original and 2.0 storage mapping in [Production replacement](PRODUCTION_REPLACEMENT.md#what-happens-to-existing-data). Original account UUIDs remain in the shared Supabase project. Original and 2.0 browser keys and cloud records stay separate. The original account may have to sign in again with the same credentials. No token transfer, automatic migration, storage clear or deletion is part of the release.

The owner has chosen to start 2.0 without importing original workout history, progression or schedules. All original records and backups are to be retained, and existing 2.0 test records are to be kept. The synthetic rehearsal supports reviewed additions later if needed. Supported original history and device data have compatibility views, but original active workout drafts, advanced Coach state, guest data and photos stored only in the original device database or private photo bucket may require the original app or a saved export. Real paid or lifetime entitlement parity remains unverified if such accounts exist. Beta Free/Pro remains in the pinned app.

### iPhone checklist for the owner

- If an original workout is unfinished, finish it and confirm it appears in History, or preserve it before switching. Allow the original app to finish syncing.
- Keep a private fresh original-app backup. Save any device-only or guest progress photos separately if missing from the backup. Keep the existing Home Screen shortcut and both app data stores.
- After the authorized publish, close the old Home Screen app and any open copies normally, reopen the existing shortcut online, then confirm the intended 2.0 shell, the existing account and expected original data access. If rollback is needed, reopen that same shortcut again and confirm the original account and retained data. No second device is needed.

The completed owner checks remain accepted for logout/login persistence, reopening an in-progress workout, logged set details, completed History, and same-account Supabase recovery of custom workouts and weekly schedules across Private and regular Safari. They do not need a repeat for this review package.

## Supabase and verification results

The owner reports independent production verification of the corrected `mlc2_v1_commit` definition at `1418f676d179c4bff8894f5b8911cd5f65861e851b90456cb1badc02aae26cb8`, authenticated execution and anonymous denial. No new production SQL was issued. Live authenticated deletion, stale-write rejection, exact receipt replay and cross-account isolation remain untested by the release team. The runner setup is out of scope for this batch. The isolated checks passed. Before publication, obtain either live evidence or explicit owner acceptance of the outstanding risk for a limited beta. Keep the beta limited until the live checks are complete. A suspected leak or deleted record reappearing is grounds to stop the beta and investigate with access to the approved rollback.

| Verification | Result |
| --- | --- |
| Isolated PostgreSQL and secure-runner checks | 11 passed, 0 failed |
| Migration preview with synthetic historical records | 6 passed, 0 failed |
| Replacement and rollback integration | 4 passed, 0 failed |
| Pages workflow competition and pin checks | 3 passed, 0 failed |
| Manual workflow packaging dry-run | Passed locally, with both tree hashes and the live original file comparison |
| Original archive and staged approved assets | Matched pinned sources |
| Authorized live synthetic Supabase run and original installed shortcut handoff | Pending |

## Authorized deployment sequence

1. Preserve original device-only records. Obtain explicit approval for the original Pages replacement at the pinned SHA and for the scoped Pages rollback if needed. If authenticated hosted testing is still unavailable, obtain explicit acceptance of the remaining risk for limited beta. Keep paid accounts with unverified entitlement parity out of the active beta if that applies. The owner has already selected a fresh 2.0 start with retained legacy data.
2. Verify the original live root still matches the release manifest. The current production tree contains two direct Pages publishers, `.github/workflows/pages.yml` and `.github/workflows/myliftcoach2-pages-preview.yml`. Both were active during preparation. After approval, disable both and let any queued or running work terminate before installing the manual template on original `main`. Keep them disabled during the rollout and on rollback. The generated `dynamic/pages/pages-build-deployment` entry also exists. Ensure the production Pages source is **GitHub Actions**, rather than branch publishing. The manual deploy checks the current source mode before publication. The public API could not confirm that setting during preparation.
3. Set original repository variable `MLC2_APPROVED_RELEASE_SHA` to `acf85b4f30fd1f6edb0fdd579758c5f976800d8e`. If source access requires it, provide `MLC2_SOURCE_READ_TOKEN` with read-only permissions to the replacement repository. Install [the template](github-pages-cutover.yml) as `.github/workflows/myliftcoach-production-cutover.yml`. Dispatch `dry-run` with the pinned commit and `DRY RUN MYLIFTCOACH`. The dry-run builds both packages, tests them and compares the live baseline. It skips the Pages artifact upload and deploy job.
4. Dispatch `replacement` with the same commit and `RELEASE MYLIFTCOACH`. The workflow rechecks the pin, both tree hashes, the live baseline and competing publishers. It verifies the destination URL, then publishes `replacement/` to the existing Pages environment. Compare the live replacement index, manifest and worker to the release manifest. Complete the installed shortcut check above.
5. If authorized rollback is needed, dispatch `rollback` with the same commit and `RELEASE MYLIFTCOACH`. Verify live HTML and manifest match the original and `sw.js` matches the scoped rollback hash. Verify the original shortcut on the same iPhone. Keep the 2.0 history and new writes in their existing stores. Supabase remains on its corrected function throughout the Pages rollback.

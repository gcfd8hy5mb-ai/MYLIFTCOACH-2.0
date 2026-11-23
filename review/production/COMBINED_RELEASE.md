# MYLIFTCOACH 2.0 combined review

Candidate SHA: `b567184c72a765fea8de7dcd8c16ee99c871983c`. Its checked-out tree matches the locally tested sources. PRs #10, #11, and #12 were already stacked in order and are all ancestors of the candidate. Production remains at the existing [MYLIFTCOACH URL](https://gcfd8hy5mb-ai.github.io/workout-tracker/).

## Changes

- Home shows the active Coach training-day count or the number of assigned training days and the saved custom program name. A temporary workout selection leaves the active program intact. Coach mode pauses saved schedules. Explicit rest days and unassigned days in a named schedule use the next configured session.
- New weekly editor tabs start at **Add exercises**. An incomplete day blocks saving and opens that day. Rest days require an explicit toggle. Saving retains exercise order and targets. The storage API rejects missing day entries. Previously saved weeks remain intact.
- Named weekly programs retain their account-scoped backups, edit and save-as-new actions, and switching between Coach and saved schedules.
- Registration keeps the existing Supabase project and account IDs, requires matching passwords, and handles email confirmation. Sign-in offers password recovery through Supabase. Recovery tokens are removed from the address bar and kept in memory for the password update. Supabase's public Auth settings reported email signup enabled and email confirmation required. Real email delivery and opening confirmation and reset links on an iPhone remain to be tested.
- The shortcut icon uses the existing approved 2.0 mark and marble artwork. New 180×180 Apple, 192×192 and 512×512 manifest, and 32×32 favicon assets are precached. The app keeps the existing install ID, start URL, scope and worker path. Approved exercise artwork is unchanged. The library remains at 344 exercises, with 263 approved demonstrations and 81 withheld.

## Verification and rollback

The full registered regression runner passed 452 tests, with zero failures. The non-deploying workflow shell rehearsal builds both packages from pinned checkouts, runs the 13 package, migration and deployment-gate checks (all passed), compares both whole-tree hashes, and compares the existing live HTML, manifest and worker with the restored live package. Token delivery, the iPhone Home Screen icon change for existing installs, and production writes for the new features were not exercised.

Rollback reconstructs the currently live 2.0 package from `acf85b4f30fd1f6edb0fdd579758c5f976800d8e` and historical original source `24b3e3a40076f8d6aeb6fe6c603068652b268351`. No database rollback, history migration, browser reset or record deletion is part of this release.

| Package | SHA-256 tree fingerprint |
| --- | --- |
| Replacement | `95e67ba325c0f4685fd48ff7d2dc0819a1db9574f8dc7cb619120caeb7d976be` |
| Live 2.0 rollback | `621ec54f47726e8e7488ba07955ba5b8faf62e22a3cb6918f0bbbfc23c356819` |

## After explicit approval

1. Verify both competing Pages workflows remain disabled and idle. Install [the update template](github-pages-update.yml) at the existing original repo path `.github/workflows/myliftcoach-production-cutover.yml` and set `MLC2_APPROVED_RELEASE_SHA` to the candidate above. Keep GitHub Actions as the production Pages source.
2. Dispatch `dry-run` with that candidate and `DRY RUN MYLIFTCOACH`. A GitHub-hosted dispatch is still pending because the template has not been installed in the original repository. After it passes, dispatch `replacement` with the same candidate and `RELEASE MYLIFTCOACH`. If needed and authorized, dispatch `rollback` with the same candidate and phrase.
3. On the iPhone, finish or back up any open workout and confirm important records have synced. Close and reopen the current shortcut online. If the icon is still old, open the same URL in Safari and check the Add to Home Screen preview. If iOS allows a second shortcut, add and verify it before removing the old one. If iOS requires removing the old shortcut first, save and verify a recovery copy and separately save any device-only photos before deciding whether to proceed. Do not clear Safari website data. The icon update can be verified on the existing iPhone without another device.

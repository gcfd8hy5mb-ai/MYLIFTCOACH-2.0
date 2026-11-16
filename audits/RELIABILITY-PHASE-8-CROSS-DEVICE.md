# MYLIFTCOACH 2.0 — Phase 8: Safe second-device workout recovery

## Implemented
- When an authenticated browser sees cloud workouts missing from its local 2.0 history, Settings reports the count as **cloud workouts available** and points to **Check for workouts**.
- The cloud check is read-only. No automatic import, overwriting of existing local sessions, or deletion from the original browser.
- Manual restore remains confirmation-based and only adds missing, validated MYLIFTCOACH 2.0 workout sessions.
- Owner authentication and the isolated PRISM Supabase RPCs remain unchanged; no original PRISM workout data is touched.

## Tested
- GitHub Actions run `43801279652`: sync unit tests and mobile/desktop browser smoke tests **passed**.
- The browser test has two isolated browser storage contexts using mocked Auth and RPCs: a first browser with three uploaded sessions, and a fresh desktop browser with zero local sessions. After signing in with the same simulated account, the desktop browser correctly reported missing cloud workouts and did not automatically import them; it restored three sessions after confirmation. The original browser retained all three records. No new upload was made during recovery.
- Existing offline queue, server failure, replay protection and standard UI tests also passed.

## Not yet verified
- Genuine sign-in and recovery on another physical device or separate browser with the real account. The automated cross-browser test uses mocked authenticated responses, so it does not establish physical cross-device acceptance.
- App installation and automatic version updating on a saved Home Screen PWA; preview does not yet have its own proven installed-app update mechanism.
- Cloud persistence of custom plans, measurements, food, water, weight and other non-session fitness records.

## Safety and release state
- Develop on Draft PR #1; publish only the `/preview/` site.
- Existing iPhone workouts and original production app are unchanged.
- To verify on a different browser, sign in there and tap **Check for workouts**; never clear or delete the iPhone's saved records.

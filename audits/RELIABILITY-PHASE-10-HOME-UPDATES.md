# MYLIFTCOACH 2.0 — Phase 10: Home Screen update checks

**Status:** Preview-only update flow, not a claim of proven installed-app update behavior on physical iOS.

## Implementation
- Settings includes a **Check for updates** control and an explicit status.
- When preview is loaded, it fetches `/preview/index.html` over the network with a cache-busting query and `cache: no-store`, extracts the `PREVIEW FIX N` version, and compares it with the currently displayed preview marker.
- No update is applied automatically: a new version is reported in Settings and **Open latest version** is offered. If a workout session is active, the app refuses to navigate until the workout is closed or finished.
- Opening the latest version uses the **same Home Screen app scope**, with a new revision and refresh query rather than requiring the user to remove/re-add an icon.
- On return from background, it can check again while retaining all device-local records and the existing auth session.
- This intentionally does not install a service worker that might cache obsolete app bundles. Background network calls and automatic iOS installed-app asset updates are not guaranteed.

## Tests
- Browser mock checks that a newer HTML `PREVIEW FIX` marker is discovered without unexpected page navigation or mutation of fitness records.
- Existing workout, offline queue, auth, nutrition, measurement, two-browser backup and restore tests must continue to pass.
- A physical iPhone Home Screen test is still needed to confirm an installed icon sees a new revision without reinstallation.

## Safety
- Root production `index.html` is untouched; only the isolated `/preview/` deployment is updated.
- App data, original PRISM workout records, old auth and existing cloud sync records remain unchanged.

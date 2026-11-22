# MYLIFTCOACH 2.0 — iPhone replacement acceptance (2026-11-22)

**Candidate:** `integration/replacement-visual-coach-20261122` (app.js v36).  
**Separate public preview:** https://gcfd8hy5mb-ai.github.io/MYLIFTCOACH-2.0-PREVIEW/replacement-candidate/

## Rules
- Do not merge pull request #7, change the original published GitHub Pages app, delete the current installed Home Screen app, or delete browser data until every applicable release gate passes.
- The separate `replacement-candidate/` preview deliberately sets `connect-src 'none'` and `form-action 'none'`: no Supabase authentication or cloud backup is possible there. Never label its local-only tests as cloud-verified.
- Do not use simulation history to qualify real Coach progression or account cloud-saving.
- Same-iPhone Safari and saved Home Screen use distinct browser/PWA storage contexts in some circumstances. Never promise their local data will automatically be shared. Check the actual installed PWA separately after approved cutover.

## Stage A — iPhone Safari, isolated **cloud-blocked** preview
Perform only with disposable guest test data in the new preview, never with the existing original app.

| ID | iPhone action | Required result |
|---|---|---|
| A1 | Open the combined preview in Safari; visit Home, Workouts, Progress, Nutrition, More | Approved dark `#04252d` cards, teal marble and gold trim, fixed background, correct navigation; no blank page |
| A2 | Nutrition: select strength, bulk, maintain, or cut; 6, 8, or 12 weeks; enter height as **Feet + Inches** | Estimate appears without a food/macro diary; 6 ft 0 in equals 72 inches; changes persist after reload in same Safari context |
| A3 | Workouts: use a preset; enter a real test set; tap **Save draft & exit** | The draft survives page reload |
| A4 | Open the same routine from Today or Home | **Resume Workout** appears and restores the exact completed set values and exercise order |
| A5 | Finish the workout and check History/Progress; reload | One completed record, correct sets, no duplicate; Resume button returns to Start |
| A6 | Select an existing custom workout or create one; refresh and reopen | Custom routine wins over preset/Coach, with the same routine shown on Home and Today |
| A7 | Select a goal program source (custom / generated / mixed), enter days and finish eligible sessions | Only valid completed sessions advance the program; unrelated and incomplete sessions do not |
| A8 | Inspect library exercises and open a demonstrated exercise | Approved full-size art and thumbnails render; missing artwork uses the approved placeholder rather than a broken image |

Record **PASS / FAIL / NOT TESTED** plus any screenshot for each ID. These are *manual acceptance checks*, not claims of tests performed by the assistant.

## Stage B — approved signed-in, cloud-enabled candidate on the **same iPhone**
**BLOCKED UNTIL an isolated cloud-enabled staging plan is explicitly approved and safely provisioned.** Do not remove the preview CSP or silently point it at production account tables.

| ID | Check | Required result |
|---|---|---|
| B1 | Sign in on iPhone, close/reopen, verify the same account | No sign-in freeze, owner stays verified |
| B2 | Finish a workout, confirm device write, check cloud completion | Exact record uploaded once; offline status is not falsely labeled synced |
| B3 | Reopen and recover workout history for same account | Exact IDs, sets and dates restored, no overwrite or duplicates |
| B4 | Start an unfinished workout, close/reopen on that iPhone | Same draft resumed; no other account's data shown |
| B5 | Switch authorized Beta Free / Pro, reload | Correct entitlements; local program and custom workouts unaffected |
| B6 | Update goal, custom source and Coach settings, reload | Current account retains settings; conflicts require explicit review |

## Stage C — cutover (only with explicit approval)
1. Record source branch SHA and GitHub Pages deployed SHA; obtain and retain a reversible copy of the current *published original app*.
2. Validate previous user records and current custom routines; do not silently migrate or erase old keys.
3. Confirm whether the 81 exercises without approved demo artwork are acceptable as placeholders.
4. Require manual iPhone PASS for Stage A and authorized Stage B, then prepare the selected production merge/publish action.
5. Test the saved Home Screen app after cutover; if any data or navigation fails, execute the documented rollback.

**Release status:** Stage A not yet user-verified; Stage B blocked; cutover not authorized.

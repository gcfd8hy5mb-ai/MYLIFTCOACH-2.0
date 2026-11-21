# Private beta tester authorization — release setup

MYLIFTCOACH 2.0 beta-mode switching is an authenticated **testing** feature, not a paid subscription entitlement.

## Observed PRISM Supabase state — November 21, 2026
- Project: PRISM (existing original authentication backend), ref `kirlpjflaoriiusfamsk`.
- Read-only database verification found all three isolated RPCs available: `mlc2_v1_commit`, `mlc2_v1_read`, `mlc2_v1_list_sessions`.
- `mlc2_private.records` and `mlc2_private.receipts` have RLS enabled.
- **Zero accounts currently have the `mlc2_beta_tester` or `myliftcoach_beta_tester` server flag.** The Free/Pro selector is visible but disabled for unapproved signed-in accounts. This is intentional.

## Authorization requirement
An administrator must select the specific intended tester accounts (never all users automatically), then assign `app_metadata.mlc2_beta_tester = true` **server-side** through the Supabase Auth Admin API or a trusted administrative process. Do not place service-role/secret credentials in this GitHub repository, browser, or GitHub Pages.

The account's chosen Free/Pro mode is stored in authenticated `user_metadata.mlc2_private_beta_mode`, but that field alone **never authorizes** beta Pro; the server-controlled `app_metadata` flag must also be present in the verified Auth user.

## Verification acceptance
1. Approved account signs in: Settings displays Beta Access Mode.
2. Select Pro: advanced Coach progression and substitutions appear without signing out; account preference is saved.
3. Reload and sign in on laptop: same Pro beta preference is returned by Supabase Auth.
4. Switch to Free: Pro-only panels disappear immediately, but workouts/history stay untouched.
5. Unapproved account cannot activate beta Pro by editing its local browser state or its user metadata.
6. Production subscription entitlements remain untouched. These beta preferences must not be used in a production payment authorization policy.

**Status:** Code written and targeted tests passed in development environment. No admin tester flags were changed, no user records were modified, and real-device end-to-end acceptance remains outstanding.

# MYLIFTCOACH 2.0 — open Free/Pro beta mode

## Policy approved November 21, 2026
**Everyone can switch between Free and Pro during the 2.0 beta without paying.** There is no tester account enrollment or admin authorization requirement during this stage.

- Signed-in users: Free/Pro is a UI feature-preview preference saved as `user_metadata.mlc2_private_beta_mode` on their existing Supabase Auth account. The mode survives account sign-ins and device changes.
- Guests: Free/Pro can be previewed without signing in; their choice is stored temporarily for the current browser session only. Guest mode never grants cloud access or an authenticated account.
- Both modes are test features, **not actual paid subscriptions**, account billing changes or production membership entitlements. `paidSubscription` always remains `false` in beta-access logic.
- Switching should instantly show or hide Pro Coach progression and substitutions; it must not delete workouts or interfere with existing cloud sync.

## Security boundary
Production subscription authorization cannot depend on editable `user_metadata`. Once real payments launch, subscriber access must be established from trusted billing-derived data, not this beta preview setting.

## Acceptance checklist
1. Guest: Settings allows Free ↔ Pro; Pro panels respond; refresh within the same browser session retains preference.
2. Any ordinary signed-in account: switch Free ↔ Pro with no admin flag, no purchase, no restart; server confirms preference.
3. Sign out and back in with the same account: preference persists. Guest preview selection remains separately scoped.
4. Pro preview does not set any production subscription entitlement.
5. Regression runner, Coach gating, cloud sync, workout history and account switching remain functional.

## Release state
Implementation is on draft PR #3 and not yet merged to the original app. Do not modify Supabase Auth `app_metadata`, paid entitlements or production subscriber records to activate the preview.

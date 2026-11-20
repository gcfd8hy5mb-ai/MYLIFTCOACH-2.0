# MYLIFTCOACH 2.0 — ChatGPT + Claude collaboration

## Purpose
Use GitHub as a shared, auditable handoff between ChatGPT/Codex (implementation) and Claude Free (independent review). This is a **manual** collaboration workflow, not an automated Claude agent.

## Safeguards
- `main` is the stable baseline. Never push unreviewed AI changes directly to `main`.
- Use a separate feature branch per change, and open a pull request (PR).
- No automatic merging, deployment changes, credentials, paid APIs, or new subscriptions.
- Keep the existing live app and saved user data intact.
- Never paste Firebase private keys, login credentials, tokens, or real user data into either chat.
- Review the actual diff and tests, not just an AI claim of success.

## Workflow
1. ChatGPT/Codex prepares a clearly scoped change on a feature branch and opens a PR.
2. Open the PR on GitHub. On Claude Free, connect the official GitHub integration if available (Claude Settings/Customize > Connectors > GitHub) and authorize this repository, or paste the PR's changed-file diff into Claude.
3. Ask Claude to review the PR for correctness, regressions, security/privacy, and consistency with app behavior. Request findings with filenames, line numbers, severity, and reproduction steps. Ask Claude **not to make edits**.
4. Paste Claude's review into a GitHub PR comment (or share it with ChatGPT) using the template below.
5. ChatGPT/Codex independently checks each finding and fixes confirmed issues on the feature branch.
6. Run targeted tests and manually verify the user-facing workflow before merging. Merge only with user approval.

## First pilot review: workout management and cloud saving
Review risks in this priority order:
1. Custom workouts must override presets where the user selected them. The home-screen workout and workout detail must agree on the same day, plan, and exercises.
2. Workout edits, exercise substitutions, completion history, and scheduling must survive reloads without being overwritten.
3. Firebase login and cloud saving must restore saved workouts and progress across devices without clobbering more recent data.
4. Coach and library integration must not break navigation or erase user settings.
5. Avoid introducing paid services, Vercel deployment dependencies, or changing approved charcoal/gold styling.

These are **requirements to verify**, not claims that bugs currently exist.

## Claude prompt for a review
> Review the linked MYLIFTCOACH-2.0 pull request as an independent senior JavaScript, Firebase and PWA reviewer. Read the actual diff and relevant surrounding files. Focus on custom-versus-preset workout precedence; consistency between home card and detail; saving and restoring edits, history and cloud data; and regressions in Coach and the exercise library. Report only actionable findings with severity (critical/high/medium/low), filename and line range, why it matters, and a reproducible test. Distinguish confirmed findings from hypotheses. Do not modify the repository and do not invent test results.

## Findings comment template
```md
### Claude independent review
PR: #...
Commit reviewed: ...
- Severity: ...
- File/line: ...
- Finding / reproduction: ...
- Proposed change: ...
- Confidence: confirmed / suspected

### ChatGPT validation
- Accepted / rejected / needs reproduction:
- Evidence or test:
- Follow-up commit:
```

## Limits
The Claude GitHub connector is primarily for bringing repository code into a Claude conversation. Availability and behavior may vary by account. A free Claude account does **not** mean Claude Code GitHub Actions or automatic PR review is included; these may require a paid plan or API costs. No Claude connection or automated review is enabled by merely adding this document.

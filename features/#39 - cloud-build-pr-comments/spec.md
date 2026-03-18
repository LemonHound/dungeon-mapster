# Feature #39 — Cloud Build PR Comments on Failure

**Status:** Implementation

## Problem

When Cloud Build fails (integration tests or E2E tests), the only signal back to GitHub is a generic
deployment status ("failure"). There are no details about what failed or why. Developers must manually
open Cloud Logging in GCP to investigate.

## Goal

When any Cloud Build step fails, post a GitHub PR comment on the associated PR with a log excerpt so
the failure is visible without leaving GitHub.

## Design

### PR Lookup

Cloud Build has `$COMMIT_SHA` (the squash-merge commit on main). GitHub's API
`GET /repos/{owner}/{repo}/commits/{sha}/pulls` returns the PR(s) associated with that commit.
If no PR is found (e.g., direct push), the comment step is skipped silently.

PR number is looked up at the start of the `integration-tests` step (earliest step with
`GITHUB_TOKEN`) and written to `/workspace/pr-number` for use in later steps.

### Failure Comment Format

```
:x: **{Step} failed** on `{commit_sha}`

<details><summary>Log excerpt</summary>

```
...last 6000 chars of output...
```

</details>
```

Collapsible `<details>` keeps the comment compact. Log is truncated to last 6000 characters
to stay within GitHub comment size limits while capturing the relevant failure output.

### Steps Modified

| Step | Change |
|---|---|
| `integration-tests` | Add PR lookup; tee mvn output to `/workspace/integration-test-output.txt`; post comment on failure |
| `e2e-tests` | Tee playwright output to `/workspace/e2e-output.txt` |
| `post-e2e` | Post comment on E2E failure using `/workspace/e2e-output.txt` |

### No New Secrets Required

`GITHUB_TOKEN` is already available in `integration-tests` and `post-e2e` via `secretEnv`.

## CLAUDE.md Update

The "Whenever pushing code" section gains two steps for implementation changes:
- After submitting the PR: run `gh run watch` to monitor GitHub Actions inline (fast, ~2 min).
  Fix failures immediately.
- After merge: GCP Cloud Build runs post-merge (~10–15 min). Do not block — continue new work.
  When resuming the next conversation, check the merged PR for any Cloud Build failure comment
  and address it before starting new work.

## Test Cases

All testing is manual (CI/CD infrastructure change):

| # | Scenario | How to verify |
|---|---|---|
| 1 | Integration test failure | Introduce a failing test, push, confirm PR comment appears |
| 2 | E2E test failure | Break an E2E assertion, push, confirm PR comment appears |
| 3 | Direct push (no PR) | Push directly to main, confirm no error in Cloud Build |
| 4 | Success path unchanged | Normal push, confirm no spurious comments, deploy succeeds |

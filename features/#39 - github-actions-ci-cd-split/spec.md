# #39 — GitHub Actions CI / Cloud Build CD Split

**Status:** Draft

## Problem

The current pipeline runs all concerns — unit tests, integration tests, E2E tests, and deployment — in a single Cloud Build trigger. This has several consequences:

- Test failures surface as a single monolithic Cloud Build check run in GitHub with no breakdown by stage
- Logs are only accessible via `gcloud builds log`, requiring GCP credentials and an extra round-trip to diagnose failures
- GitHub Actions (which run on PRs) and Cloud Build (which runs post-merge) have no shared structure, so test failures on main are invisible until after a deploy is already in flight
- The feedback loop for an LLM-assisted workflow is long: failures require switching tools and contexts to retrieve logs

## Proposed Architecture

Split CI and CD into two separate systems with a clean handoff:

```
PR opened / push to branch
  └─ GitHub Actions (CI)
        ├─ job: backend-tests     (unit + integration via Testcontainers)
        ├─ job: frontend-tests    (Vitest unit tests + build check)
        └─ job: e2e               (Playwright against a per-PR ephemeral test deploy)
                                     [optional / phase 2]

Push to main (after PR merge)
  └─ Cloud Build (CD)
        ├─ step: build image
        ├─ step: push to Artifact Registry
        ├─ step: deploy to test Cloud Run
        ├─ step: smoke test (single health-check request, not full E2E)
        └─ step: deploy to prod Cloud Run
```

### Why this split

- GitHub Actions jobs produce native check runs — each job is a separate entry in the GitHub UI with its own "Details" page showing full logs, re-run buttons, and timing
- `gh run view --log-failed` gives direct CLI access to failure output with no GCP credentials required
- Cloud Build is retained for deployment only, where its GCP-native IAM and Artifact Registry auth are a genuine advantage
- The change is additive: existing Cloud Build config is simplified rather than replaced wholesale

## Scope

### Phase 1 — GitHub Actions CI (this feature)

1. Add `.github/workflows/ci.yml` with three jobs:
   - `backend`: checkout → Java 21 → Maven unit tests (`mvn test`) + integration tests (`mvn failsafe:integration-test failsafe:verify` with Docker-in-Docker or `services:` for Testcontainers)
   - `frontend`: checkout → Node 24 → `npm ci` → `ng test --watch=false` (Vitest) → `ng build`
   - These run in parallel; both must pass for the PR to be mergeable

2. Add branch protection rule requiring the `backend` and `frontend` jobs to pass (documented as a manual setup step, not automated)

3. Simplify Cloud Build to: compute-tag → build → push → deploy-test → smoke-test → deploy-prod
   - Remove integration tests from Cloud Build entirely
   - Remove E2E from Cloud Build (phase 2 will add per-PR E2E on Actions)

### Phase 2 — E2E on GitHub Actions (future)

- Playwright E2E runs as a GitHub Actions job against a per-PR test Cloud Run deploy
- Requires a Cloud Build trigger that deploys to a named test revision on PR open/update, and tears it down on PR close
- Out of scope for this feature; tracked separately

## Key Decisions

**Testcontainers on GitHub Actions**: `ubuntu-latest` runners include Docker, so Testcontainers works without modification. The `TESTCONTAINERS_RYUK_DISABLED=true` env var is no longer needed (Ryuk works fine on Actions).

**GCS in integration tests**: `GcsUploadIT` uses the real `dungeon-mapster-test` bucket. Running it on GitHub Actions requires a GCP service account key stored as a GitHub Actions secret. Options: (a) add the key as a secret and run the test as-is, (b) skip it in Actions via a Maven profile and keep it in Cloud Build only, (c) mock GCS in the test profile. **Open question — decide at implementation time.**

**E2E during Phase 1**: With no per-PR E2E, the Cloud Build smoke test provides minimal confidence that the deployed service starts. Full E2E remains on the post-merge Cloud Build run until Phase 2.

**Existing GitHub Actions workflows**: The repo already has a CI workflow running unit tests on PRs. This feature replaces/extends it rather than adding a parallel workflow.

## Test Cases

| Scenario | Tier | Test name |
|---|---|---|
| Backend job passes on clean main | Manual | Verify green check in GitHub after merge |
| Backend job fails on broken test | Manual | Introduce a failing test on a branch, verify red check blocks PR |
| Frontend job passes on clean main | Manual | Verify green check in GitHub after merge |
| Cloud Build smoke test passes after deploy | Manual | Verify deployment status on commit after merge |
| `gh run view --log-failed` returns failure output | Manual | Break a test, verify CLI output without GCP creds |

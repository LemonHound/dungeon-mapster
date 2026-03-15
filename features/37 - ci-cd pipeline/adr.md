# ADR: CI/CD Pipeline Architecture

## Status

Accepted

## Context

The existing CI/CD setup is partially automated:
- GitHub Actions runs lint and build checks on PRs and pushes to `main`
- Cloud Build is triggered manually via semantic version release tags to build, push, and deploy to Cloud Run
- No automated tests exist beyond the build step (backend tests are skipped; frontend tests are not run in CI)
- There is no test environment — builds deploy directly to production
- There is no automatic rollback on failure
- Deployment requires a developer to manually create and push a release tag

The goal is a fully automated pipeline where a merge to `main` is the only human action required to deliver a
verified, deployed release to production.

## Decisions

### 1. Remove manual release tags — trigger Cloud Build on every merge to `main`

**Decision:** Cloud Build is triggered automatically on every push to `main`. No release tags are required.

**Why:** Release tags require a manual step, which breaks the "no manual steps" requirement. Every merge to `main`
should represent a potentially shippable release; manual tagging introduces a gap between "merged" and "released"
that adds friction without adding value.

### 2. Kebab-case CalVer + short SHA for image versioning

**Decision:** Docker images and Cloud Run revisions are tagged as `YYYY-MM-DD-{short-sha}` (e.g. `2026-03-15-a3f2c91`).

**Why:** Semantic versioning (MAJOR.MINOR.PATCH) requires human judgement to assign version numbers, which is
incompatible with fully automated releases. CalVer + SHA provides:
- Human-readable date context at a glance
- Unique, collision-free identifiers from git
- Full traceability from image tag back to the exact commit
- No manual input required

### 3. Hybrid GitHub Actions + Cloud Build pipeline

**Decision:** Unit tests and linting run in GitHub Actions as a PR gate. Integration and E2E tests run in Cloud Build
after merge.

**Why:** Integration and E2E tests require access to GCP services (GCS, Cloud Run). Running them in GitHub Actions
introduces authentication complexity, network latency variance to GCP services, and potential flakiness for
WebSocket stability and large file upload tests. Cloud Build runs within GCP's network and authenticates natively via
service accounts. GitHub Actions is retained for unit tests because it provides the fastest possible PR gate feedback
with no GCP dependency.

### 4. Testcontainers for integration test database

**Decision:** Integration tests use Testcontainers to spin up an ephemeral PostgreSQL instance per test run. No
persistent test Cloud SQL instance.

**Why:**
- A persistent test database accumulates state across runs; a failed test mid-run can leave the DB in a broken state
  that causes subsequent tests in that run to fail for unrelated reasons
- Testcontainers gives each run a clean schema created by Hibernate from Java entity definitions, seeded only with
  what the tests explicitly insert
- Spring Boot 3.1+ `@ServiceConnection` integrates Testcontainers with zero boilerplate
- Eliminates ongoing Cloud SQL cost for a test instance

### 5. Hibernate `ddl-auto=create-drop` — no migration tooling

**Decision:** The `test` Spring profile uses `ddl-auto=create-drop`. No Flyway or Liquibase.

**Why:** Hibernate already manages the production schema via `ddl-auto=update`, inferring all table/column
definitions from Java entity classes. This was a deliberate architectural choice: schema changes are expressed in
Java, not SQL. Adding a migration tool for test would introduce a parallel schema representation that must be kept
in sync with the entity classes — unnecessary overhead.

For `create-drop` in tests: Hibernate creates the full schema on container startup and drops it on shutdown. The
Testcontainers container is destroyed after each run regardless, so the drop is redundant but harmless. If Hibernate's
drop ordering produces foreign key constraint errors on first run, the fix is adjusting entity relationship
annotations — not adding a migration tool.

**Flyway deferred:** If a future schema change requires a destructive migration (rename/drop a column with existing
production data), a Flyway script for that one-off operation is appropriate. That decision belongs in a separate
ticket scoped to that migration. It has no bearing on this pipeline.

### 6. Playwright for E2E and WebSocket multi-user testing

**Decision:** Playwright is used for all E2E tests, including multi-user WebSocket simulation via multiple browser
contexts in a single test process.

**Why:**
- Playwright has native WebSocket support and can intercept, assert on, and wait for WS frames
- Multiple browser contexts in one Playwright process share the same test runner, allowing synchronized multi-user
  scenarios (e.g., User A edits, assert User B sees the change) without external coordination
- Playwright runs headless in Cloud Build without additional configuration
- TypeScript-native, consistent with the frontend codebase
- Configurable user count (`WS_USER_COUNT`, default `3`) allows the same test suite to be run with more users
  ad-hoc without duplicating test logic

**On user count (3 vs upper limit):** 3 concurrent users covers all meaningful state transitions: concurrent
read/write to the same cell, watch-only observation, and three-way presence tracking. Running at the upper limit
(10) in CI would increase runtime and introduce flakiness without catching a meaningfully different class of bugs.
Load and stress testing beyond 3 users is done ad-hoc, outside the CI gate.

**Alternatives considered:**
- **Cypress** — does not support multiple origins or multiple simultaneous sessions in one test easily; WebSocket
  support is indirect. Rejected.
- **Custom Node.js scripts with `@stomp/stompjs`** — can simulate concurrent WebSocket connections but cannot test
  browser rendering or UI state. Suitable for standalone load testing; not a replacement for E2E.

### 7. Mock Google OAuth in integration tests

**Decision:** Google OAuth token exchange is mocked in integration tests. A manual OAuth check is performed after
each successful production deployment.

**Why:** Testing the full OAuth exchange in CI requires real Google credentials, token refresh logic, and a
browser-capable environment — disproportionate complexity for an integration that is straightforward and unlikely
to break independently of the rest of the application. The manual post-deploy check provides sufficient coverage
for this surface.

### 8. Auto-rollback in both test and prod environments

**Decision:** On E2E test failure, the test Cloud Run environment is rolled back to the previous revision. On prod
deploy failure, prod is rolled back. Both environments revert.

**Why:** Leaving the test environment in a failed state means the next pipeline run starts from a broken baseline,
which can mask regressions or produce misleading failure signals. Cloud Run revision rollback is a single gcloud
command with no downtime risk. The cost of reverting test is zero; the benefit is a reliable baseline for all
subsequent runs.

### 9. GitHub Deployments API for mobile push notifications

**Decision:** Cloud Build posts deployment status events to the GitHub Deployments API after each deploy step.
GitHub Mobile surfaces these as push notifications natively.

**Why:** The GitHub Deployments API is a first-party integration that triggers GitHub Mobile notifications without
any third-party service (Slack, PagerDuty, etc.). Cloud Build can POST to the API using a stored `GITHUB_TOKEN`
secret from Secret Manager. No additional tooling is required.

### 10. Dedicated GCS test bucket in the existing GCP project

**Decision:** A separate GCS bucket (`dungeon-mapster-test`) is used for integration and E2E tests. A separate GCP
project is not created.

**Why:** A separate bucket provides sufficient isolation to prevent test data from surfacing in production without
the overhead of managing a second GCP project, IAM structure, or billing account.

## Consequences

- The `ci.yml` GitHub Actions workflow must be updated to enforce the PR gate and not independently trigger
  deployment (Cloud Build owns the full post-merge pipeline)
- A `cloudbuild.yaml` must be written encoding: build → integration tests → deploy test → E2E → deploy prod →
  rollback logic → GitHub status reporting
- A `test` Spring profile must be added (`application-test.properties`) for Testcontainers configuration
- Backend `pom.xml` must add Testcontainers dependencies (test scope only)
- Frontend `package.json` must add `@testing-library/angular`, `@playwright/test`, Husky, and lint-staged
- `GITHUB_TOKEN` and `JWT_SECRET` must be added to Cloud Build via Secret Manager
- The GCS test bucket `dungeon-mapster-test` must be created and the Cloud Build service account granted
  `roles/storage.objectAdmin` on it
- The test Cloud Run service `dungeon-mapster-test` must be provisioned
- Cloud Build service account requires: `roles/run.admin`, `roles/artifactregistry.writer`,
  `roles/secretmanager.secretAccessor`, `roles/storage.objectAdmin`, `roles/iam.serviceAccountUser`
- Cloud Build trigger must be updated from release-tag to `main` branch push
- Semantic version release tags are no longer used; any documentation or tooling referencing them must be updated
- `tech-stack.md` must be updated to reflect the new CI/CD trigger model and added tools
- Google OAuth is not integration-tested in CI; a manual check after each successful prod deployment is required

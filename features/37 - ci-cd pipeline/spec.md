# CI/CD Pipeline

## Status

Planning

## Purpose

Establish a fully automated CI/CD pipeline that builds, tests, and deploys the application without any manual steps.
This includes a complete test suite (unit, integration, and E2E), automatic deployment to test and production
environments, automatic rollback on failure, and push notifications to GitHub Mobile on deployment failure.

The pipeline replaces the current partially-automated setup (GitHub Actions lint/build + manually-tagged Cloud Build
triggers) with a fully event-driven flow triggered solely by merges to `main`.

## Pipeline Overview

```
PR opened
└── GitHub Actions (PR gate — must pass before merge is allowed)
    ├── Backend: JUnit 5 unit tests
    ├── Frontend: Vitest unit + component tests
    └── Frontend: ESLint

Merge to main
└── Cloud Build
    ├── Build Docker image (tagged with kebab-case CalVer + short SHA, e.g. 2026-03-15-a3f2c91)
    ├── Push image to Artifact Registry
    ├── Integration tests (Testcontainers — ephemeral PostgreSQL + real GCS test bucket)
    ├── Deploy image to test Cloud Run
    ├── E2E tests (Playwright against live test Cloud Run URL)
    │   ├── Single-user map editor flows
    │   ├── Multi-user WebSocket (3 concurrent Playwright browser contexts)
    │   └── Image upload with production-representative file sizes
    │        ↓ pass → deploy same image to prod Cloud Run
    │        ↓ fail → rollback test Cloud Run + report failure, halt prod deploy

Deployment failure (test or prod)
└── GitHub Deployments API status update → GitHub Mobile push notification
```

## Versioning

Each Docker image tag uses kebab-case combining the build date and the short git SHA:

```
2026-03-15-a3f2c91
```

- Built automatically by Cloud Build from `$(date +%Y-%m-%d)` and `$SHORT_SHA`
- No manual release tags required — every merge to `main` produces a uniquely named, traceable image
- Cloud Run revisions are named to match the image tag for traceability

## Test Strategy

### Unit Tests (GitHub Actions — PR Gate)

Run on every PR. Fast, no I/O, no infrastructure.

**Backend (JUnit 5 + Mockito):**
- Service layer logic
- JWT utility methods
- Model validation
- WebSocket message routing logic (mocked session registry)

**Frontend (Vitest + @testing-library/angular):**
- Component rendering and interaction
- Angular services (mocked HTTP)
- WebSocket service state machine (connect / reconnect / disconnect)
- Presence indicator rendering

### Integration Tests (Cloud Build — post-build)

Run in Cloud Build after the image is built, before deploying to test. Uses Testcontainers to spin up an ephemeral
PostgreSQL instance per test run. Hibernate creates the full schema from entity definitions on startup using
`ddl-auto=create-drop`. The container is destroyed after the test run, so no cleanup is required.

**Schema compatibility note:** Hibernate's `create-drop` will surface any foreign key constraint ordering issues as
a SQL error on first run. This is a quick fix (usually adjusting entity relationship annotations) and requires no
migration tooling. There is no Flyway or Liquibase involvement in this pipeline — Hibernate manages all schema
changes automatically from Java entity definitions. If a future schema change requires a destructive migration
(rename/drop a column with existing data), that will be handled as a separate one-off ticket.

**Backend (Spring Boot Test + Testcontainers):**
- REST endpoint contracts (MockMvc / WebTestClient)
- Authentication and JWT validation flows
- Google OAuth token exchange (mocked — no real token exchange in CI)
- WebSocket handshake validation (JWT, mapId param)
- GCS image upload/download (real GCS test bucket in the same GCP project)
- Session registry lifecycle (connect, heartbeat, disconnect, cleanup)
- Map cache write-through consistency

**Why Testcontainers over a persistent test Cloud SQL instance:**
- Each test run starts from a clean schema — no test data accumulates or corrupts across runs
- A failed mid-run test cannot leave the DB in a state that breaks subsequent tests
- Spring Boot 3.1+ `@ServiceConnection` integrates Testcontainers with zero boilerplate
- Eliminates ongoing Cloud SQL cost for a test instance

### E2E Tests (Playwright — against live test Cloud Run)

Run in Cloud Build after deploying to test. Tests execute against the fully deployed application including the
production Docker image, Cloud SQL, and GCS.

**Single-user flows:**
- User authentication (Google OAuth flow)
- Map creation wizard
- Map editor: cell selection, variable editing, save/load
- Image upload to GCS and rendering in editor

**Multi-user WebSocket (3 concurrent browser contexts):**
- User count is a Playwright config variable (`WS_USER_COUNT`, default: `3`)
- User A and User B edit the same cell simultaneously — last-write-wins verified
- User A selects a cell — User B and User C see the presence indicator
- User A focuses a field — User B and User C see the field highlight
- User C disconnects — User A and User B see presence list updated
- User C reconnects — full state resync verified

**Image upload with realistic file sizes:**
- Upload a representative large map image (production-scale)
- Verify GCS storage and retrieval within acceptable latency

### Pre-commit Hooks (Developer Machine)

Husky + lint-staged, configured in `frontend/package.json`:
- ESLint on staged frontend files
- No test execution on commit — unit tests run in CI

## Deployment

### Environments

| Environment | Cloud Run Service      | Trigger                              |
|-------------|------------------------|--------------------------------------|
| test        | `dungeon-mapster-test` | Every merge to `main`                |
| prod        | `dungeon-mapster-prod` | E2E tests pass against test env      |

### Auto-Rollback

On E2E test failure after deploying to test:
- Revert test Cloud Run to the previous revision via `gcloud run services update-traffic`
- Halt the pipeline — prod deploy does not proceed

On prod deploy failure (container startup failure, health check failure):
- Revert prod Cloud Run to the previous revision
- Report failure via GitHub Deployments API

Auto-rollback applies to both test and prod. Keeping the test environment stable ensures subsequent pipeline runs
have a reliable baseline to deploy against.

The previous revision tag is retrieved before each deploy step and stored as a Cloud Build substitution variable
for use in rollback commands.

### GitHub Mobile Notifications (Stretch Goal)

Cloud Build reports deployment status to GitHub via the GitHub Deployments API. GitHub natively surfaces deployment
failures as push notifications in the GitHub Mobile app — no third-party service required.

Cloud Build posts a `failure` deployment status when:
- Integration tests fail
- E2E tests fail (after test rollback)
- Prod deploy or health check fails (after prod rollback)

A `success` status is posted after prod deploy completes successfully.

## Pre-Implementation Setup (One-Time Manual Steps)

All steps below are complete. Documented here for reference.

1. **Test Cloud Run service** — `dungeon-mapster-test` provisioned, port 8080, public access (allow unauthenticated)
   - URL: `https://dungeon-mapster-test-675207457500.us-central1.run.app`
   - Environment variables mirror `application-prod.properties` naming convention, with test-specific values
   - Cloud SQL connection points to `dungeonmapster-db` instance; `DB_NAME` set to `dungeonmapster_test`
   - `app.frontend-url` set to the test Cloud Run URL above
2. **Test database** — `dungeonmapster_test` created on existing `dungeonmapster-db` Cloud SQL instance (no new instance)
   - `dungeonmapster` user granted full privileges on `dungeonmapster_test` database and its `public` schema
3. **GCS test bucket** — `dungeon-mapster-test` created with public access prevention enabled
4. **Cloud Build triggers** — both test and prod triggers updated from release-tag to `main` branch push
   - GitHub connection is via GCP-native GitHub integration (no token required for triggering)
   - Prod trigger retains semantic version tag trigger until the pipeline is proven end-to-end ~~(removed after first successful run)~~
5. **Cloud Build service account permissions** — all five roles granted (see table below)
6. **Secrets added to Secret Manager:**
   - `GITHUB_TOKEN` — fine-grained personal access token, scoped to `LemonHound/dungeon-mapster`, `Deployments: read/write` only (used for GitHub Deployments API notifications — not for triggering Cloud Build)
   - `JWT_SECRET` — same value as prod, used in integration tests

### Cloud Build Service Account Permissions

The Cloud Build service account (`[PROJECT_NUMBER]@cloudbuild.gserviceaccount.com`) requires:

| Role | Purpose |
|------|---------|
| `roles/run.admin` | Deploy to Cloud Run; update traffic for rollback |
| `roles/artifactregistry.writer` | Push Docker images |
| `roles/secretmanager.secretAccessor` | Read secrets from Secret Manager |
| `roles/storage.objectAdmin` | Read/write to GCS test bucket |
| `roles/iam.serviceAccountUser` | Act as the Cloud Run service account during deploy |

The Cloud Run service account (the identity the running service uses) already has the necessary Cloud SQL and GCS
production bucket access. No changes needed there.

### Cloud Build Config Migration Note

The prod Cloud Build trigger currently uses an inline build config. Before writing `cloudbuild.yaml`, copy all
existing inline settings (deploy command, image name, region, service name, env var references, substitution
variables) and reuse those exact values in the new file. This avoids introducing subtle differences that would
require separate troubleshooting.

## New Dependencies

### Backend

| Dependency                   | Scope | Purpose                                              |
|------------------------------|-------|------------------------------------------------------|
| `spring-boot-starter-test`   | test  | JUnit 5, Mockito, MockMvc (likely on classpath already) |
| `testcontainers-bom`         | test  | BOM for Testcontainers version alignment             |
| `testcontainers-postgresql`  | test  | Ephemeral PostgreSQL for integration tests           |
| `spring-boot-testcontainers` | test  | `@ServiceConnection` auto-wiring                     |

### Frontend

| Dependency                  | Scope         | Purpose                                        |
|-----------------------------|---------------|------------------------------------------------|
| `@testing-library/angular`  | devDependency | Component testing utilities for Vitest         |
| `@playwright/test`          | devDependency | E2E and WebSocket multi-user tests             |
| `husky`                     | devDependency | Pre-commit hook runner                         |
| `lint-staged`               | devDependency | Run ESLint only on staged files                |

## Environment Configuration

### Spring Profile for Integration Tests

A new Spring profile `test` with:
- `ddl-auto=create-drop` (Testcontainers manages container lifecycle)
- GCS bucket pointing to `dungeon-mapster-test`
- Logging at `WARN` level to reduce CI output noise
- Google OAuth mocked — no real token exchange

### Cloud Build Substitution Variables

| Variable         | Value                              |
|------------------|------------------------------------|
| `_IMAGE_TAG`     | `$(date +%Y-%m-%d)-$SHORT_SHA`     |
| `_PREV_REVISION` | Retrieved before each deploy step  |
| `_REGION`        | Cloud Run region (e.g. `us-central1`) |

## Open Questions

None — all design decisions finalized.

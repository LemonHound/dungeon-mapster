# Tech Stack

## Frontend

- **Framework:** Angular 21 with TypeScript, SSR enabled
- **Build:** Angular CLI / `@angular/build`
- **Testing:** Vitest
- **Linting:** ESLint with `angular-eslint` and `typescript-eslint`
- **Key Libraries:** RxJS, Angular Router, Angular Forms

## Backend

- **Framework:** Spring Boot (Java 21, Oracle OpenJDK)
- **Build:** Maven
- **ORM:** Hibernate / JPA (`ddl-auto=update` for dev)
- **Security:** Spring Security with JWT authentication, Google OAuth
- **Storage Client:** Google Cloud Storage SDK (Application Default Credentials)

## Database

- **Engine:** PostgreSQL
- **Local:** Local PostgreSQL instance, credentials via `backend/.env` (`LOCAL_DB_USERNAME`, `LOCAL_DB_PASSWORD`)
- **Production:** Cloud SQL (PostgreSQL)

## Infrastructure (GCP)

- **Hosting:** Cloud Run (min 1, max 2-3 instances)
- **Database:** Cloud SQL (PostgreSQL)
- **Storage:** Google Cloud Storage bucket `dungeon-mapster-487912_cloudbuild`, images under `maps/` prefix
- **Registry:** Artifact Registry (Docker images)
- **CI/CD:** Cloud Build triggers on `main` branch after GitHub Actions CI passes

## CI/CD

- **GitHub Actions:** `.github/workflows/ci.yml` — PR gate only
    - Backend: JUnit 5 unit tests
    - Frontend: Vitest unit + component tests, ESLint
- **Cloud Build:** Triggered on every merge to `main` (no manual release tags)
    - Builds Docker image tagged `YYYY-MM-DD-{short-sha}` (e.g. `2026-03-15-a3f2c91`)
    - Runs integration tests (Testcontainers)
    - Deploys to test Cloud Run, runs Playwright E2E tests
    - Deploys to prod Cloud Run on E2E pass; auto-rollback on failure
- **Playwright:** E2E tests including multi-user WebSocket simulation (3 concurrent browser contexts)
- **Testcontainers:** Ephemeral PostgreSQL for integration tests
- **Husky + lint-staged:** Pre-commit ESLint on staged frontend files

## Local Development

- **Frontend:** `ng serve` on port 4200; proxied to backend via `proxy.conf.json`
- **Backend:** Spring Boot with `SPRING_PROFILES_ACTIVE=local`
- **Environment vars:** `backend/.env` for DB credentials
- **GCS:** Local dev connects to production GCS bucket using personal Google ADC

## Spring Profiles

| Profile | DB               | Notes                                                  |
|---------|------------------|--------------------------------------------------------|
| `local` | Local PostgreSQL | `application-local.properties`                         |
| `prod`  | Cloud SQL        | `application-prod.properties`, env vars from Cloud Run |

## Docker

Multi-stage `Dockerfile`:

1. Node 22 — builds Angular frontend
2. Maven 3.9 / JDK 21 — builds Spring Boot JAR, copies frontend into `static/`
3. Eclipse Temurin 21 JRE — runs `app.jar`
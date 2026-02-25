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

- **GitHub Actions:** `.github/workflows/ci.yml`
    - Backend: Maven build + tests
    - Frontend: npm install, lint, build
- **Cloud Build:** Builds Docker image, pushes to Artifact Registry, deploys to Cloud Run

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
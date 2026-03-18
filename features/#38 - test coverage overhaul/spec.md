# Test Coverage Overhaul

## Status

Planning

## Purpose

Expand the test suite from the current minimal smoke-test coverage to a comprehensive set of automated tests that
validates all primary application scenarios, plus a documented manual checklist for scenarios where automated testing
would introduce more flakiness than value.

Also update CLAUDE.md to mandate that every future feature spec includes a test cases section, ensuring new
functionality is always tested as part of its own implementation.

## CLAUDE.md Update

Add the following to the "Adding a New Feature" section after step 4:

> Each spec must include a **Test Cases** section listing every new scenario, which tier it belongs to
> (unit / API integration / E2E / manual), and the concrete test name. A feature is not considered complete
> until all automated test cases pass in CI and any manual cases are documented in the manual checklist.

---

## Testing Model

This project uses the **Testing Trophy** model, which favors API integration tests as the primary layer of
confidence. The traditional "testing pyramid" (many unit tests, few integration) is outdated for full-stack
web apps — most bugs live at the boundary between layers, not in isolated units.

```
        /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
       /   E2E (Playwright)   \       ← Critical user journeys only
      /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
     /  API Integration Tests   \     ← Primary confidence layer
    /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
   /    Unit (pure logic only)    \   ← Business rules, no I/O
  /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
 /   Static (TypeScript + ESLint)   \ ← Already in place
```

| Tier | Tooling | Runs in CI | When |
|------|---------|------------|------|
| Unit | JUnit 5 + Mockito, Vitest | GitHub Actions (PR gate) | Every PR |
| API Integration | Spring Boot Test + Testcontainers | Cloud Build (post-build) | Every merge to `main` |
| E2E | Playwright | Cloud Build (post-test-deploy) | Every merge to `main` |
| Manual | Developer checklist | N/A | Before releases with relevant changes |

**What belongs in each tier:**
- **Unit** — Pure business logic: role checks, JWT math, service rules that have no I/O. Mock all
  repositories. If a test needs a real DB or HTTP call, it belongs in integration.
- **API Integration** — HTTP request → Spring controller → service → real DB (Testcontainers). No browser.
  This is where most new tests should live. Tests prove the API contract and persistence in one shot.
- **E2E** — Only for behaviors that require a real browser: auth redirects, UI state after WebSocket sync,
  file upload through the browser. Kept deliberately small to minimize flake.
- **Manual** — Race conditions, visual rendering, scenarios that require real Google OAuth, or anything
  where asserting precise state would require timing assumptions.

---

## Execution & Infrastructure

### How each tier runs

#### Unit tests — GitHub Actions PR gate

Command: `mvn test -q` (backend) and `npm test -- --watch false` (frontend Vitest).

Both run on `ubuntu-latest` GitHub-hosted runners with Maven and npm dependency caches already in place.
No Docker, no database, no network calls. These must stay fast — under two minutes each.

The backend runner uses a dummy `JWT_SECRET` env var and placeholder values for GCS and OAuth credentials
(already configured in `ci.yml`). No new CI configuration is needed for any new unit tests.

#### API integration tests — Cloud Build, post-image-build

Command: `mvn failsafe:integration-test failsafe:verify -q`, run inside a `maven:3.9-eclipse-temurin-21`
Docker container with the Docker socket mounted (docker-in-docker). This is already how the pipeline works.

Testcontainers spins up an ephemeral PostgreSQL container per test run. The container is destroyed when
the tests complete. No persistent test database is used or needed for this tier.

The `JWT_SECRET` is injected from Secret Manager. GCS calls in integration tests hit the real
`dungeon-mapster-test` bucket (already provisioned).

**File naming is the key**: Maven Failsafe includes `**/*IT.java` and Surefire excludes it. All new
integration test classes must end in `IT.java` to run here and not in the PR gate. This convention is
already established in the codebase — no `pom.xml` changes needed.

#### E2E tests — Cloud Build, post-deploy-to-test

Playwright runs inside the `mcr.microsoft.com/playwright:v1.50.0-noble` image against the live test Cloud
Run URL. A fresh JWT is fetched from `/api/test/token` before the suite starts (the test-only endpoint,
enabled via `APP_E2E_ENABLED=true` on the test Cloud Run service).

No new infrastructure is needed. New E2E spec files are picked up automatically by Playwright's config.
The `multiplayer.spec.ts` pattern of using multiple browser contexts is the model for any new multi-user
tests.

---

### Local development workflow

The user's intuition is right: local test execution is largely limited to the fastest tiers. The CI
pipeline handles everything else with more consistency than a local environment can guarantee.

| What to run locally | When | Command |
|---------------------|------|---------|
| Backend unit tests | While writing or debugging service/utility logic | `cd backend && mvn test` |
| Frontend unit tests | While writing interceptor, guard, or service logic | `cd frontend && npm test -- --watch false` |
| A single integration test | While actively debugging a specific API contract | `cd backend && mvn -Dit.test=NoteControllerIT verify` |
| Manual checklist items | Before any PR that touches the relevant area | See Manual Checklist section |

What is **not** worth running locally:
- The full integration test suite (identical to what Cloud Build runs; wait for CI)
- E2E tests (requires the full stack deployed; the test Cloud Run is the right target)
- Docker build (slow, Cloud Build handles this)

Testcontainers does work locally if Docker Desktop is running, so the single-test case above is genuinely
useful while writing a new `*IT.java` class. Running `mvn verify` locally before pushing is optional but
shortens the feedback loop if an integration test is actively being developed.

---

### Cost profile

No new infrastructure is required for any test in this spec. All costs are incremental build time on
existing resources.

| Resource | Current cost driver | Impact of new tests |
|----------|-------------------|---------------------|
| GitHub Actions | PR gate ~3–4 min/PR | Unit tests add negligible time; GitHub Actions free tier (2,000 min/month) is sufficient |
| Cloud Build | Integration tests ~2–3 min, E2E ~4–5 min, total build ~12–15 min | New integration test classes add ~1–2 min. New E2E specs add ~1–2 min. Total build stays under 20 min. |
| Cloud Build free tier | 120 build-minutes/day free | At ~5 merges/week (~15 min each), weekly usage is ~75 min — under the daily free quota most days |
| Test Cloud Run (`dungeon-mapster-test`) | Min 1 instance, already running | No change — E2E tests already run against this |
| GCS test bucket (`dungeon-mapster-test`) | Negligible storage + minimal egress | No change |
| Testcontainers PostgreSQL | Runs in the Cloud Build VM | Free — no separate Cloud SQL instance |

The one cost to avoid: **do not add a persistent Cloud SQL test instance**. Testcontainers already provides
an ephemeral database for integration tests, and the existing `dungeonmapster_test` database on the shared
Cloud SQL instance is used only by the deployed test Cloud Run service (for E2E). This separation is correct
and should stay as-is.

---

### What needs to change vs what's already in place

| Area | Status | Action needed |
|------|--------|---------------|
| Maven Failsafe config (`*IT.java` → integration, `*Test.java` → unit) | Already configured | None |
| GitHub Actions `ci.yml` (unit tests + lint + build) | Already configured | None |
| Cloud Build integration test step (docker-in-docker, Testcontainers) | Already configured | None |
| Cloud Build E2E step (Playwright, test token, test URL) | Already configured | None |
| `application-test.properties` Spring profile | Already configured | None |
| GCS test bucket for integration tests | Already provisioned | None |
| New `*IT.java` integration test classes | Missing | Write during implementation |
| New `*Test.java` unit test classes (`NoteServiceTest`, `SessionRegistryTest` gaps) | Missing | Write during implementation |
| New frontend `*.spec.ts` unit tests | Missing | Write during implementation |
| New Playwright `*.spec.ts` E2E specs | Missing | Write during implementation |

---

## Concrete Test List

Tests are listed by the file they live in. Existing tests are marked `[existing]`. All others are new.

---

### Unit Tests

#### `DungeonMapServiceTest` (existing — no changes required)
All 45 existing tests cover role checks, map creation, join, promote/demote, and patch. Sufficient as-is.

#### `JwtTokenProviderTest` (existing — no changes required)
Token generation, validation, expiration, and userId round-trip are covered.

#### `WebSocketHandshakeInterceptorTest` (existing — no changes required)
All handshake rejection and acceptance scenarios are covered.

#### `SessionRegistryTest` (review and expand if gaps exist)
- `[existing]` — verify what is currently tested
- `addSession_tracksUserUnderCorrectMapId`
- `removeSession_removesUserFromMap`
- `isLastUserForMap_returnsTrueWhenOnlyOneSessionRemains`
- `getUsersForMap_returnsAllConnectedUserIds`

#### `NoteServiceTest` (new)
- `getCellNotes_sharedNote_returnedForAnyMember`
- `getCellNotes_privateNote_returnedForAuthorOnly`
- `getCellNotes_privateNote_notReturnedForOtherUser`
- `getMapNotes_privateNote_returnedForAuthorOnly`
- `getMapNotes_privateNote_notReturnedForOtherUser`

#### `AuthInterceptorSpec` (frontend, new)
- `addsAuthorizationHeader_whenTokenPresent`
- `doesNotAddAuthorizationHeader_whenNoToken`

#### `AuthGuardSpec` (frontend, new)
- `allowsNavigation_whenAuthenticated`
- `redirectsToHome_whenNotAuthenticated`

---

### API Integration Tests

All integration tests use `@SpringBootTest` + Testcontainers PostgreSQL and the existing
`application-test.properties` profile from #37.

#### `AuthControllerIT` (existing — complete)
- `[existing]` `getMe_withValidToken_returnsCurrentUser`
- `[existing]` `getMe_withNoToken_returns401`
- `[existing]` `getMe_withInvalidToken_returns401`

#### `DungeonMapControllerIT` (existing — expand)
- `[existing]` `createMap_returnsMapWithJoinCode`
- `[existing]` `listMaps_returnsOnlyUserOwnedMaps`
- `[existing]` `patchMap_updatesSpecifiedField`
- `getMapById_returnsCorrectMap`
- `getMapById_notFound_returns404`
- `updateMap_asOwner_persistsName`
- `deleteMap_asOwner_removesMapAndMemberships`
- `deleteMap_asNonOwner_returns403`

#### `MapMembershipIT` (new)
- `joinMap_withValidCode_addsMemberWithPlayerRole`
- `joinMap_withInvalidCode_returns404`
- `joinMap_alreadyMember_returns409`
- `promoteToD m_asOwner_updatesMemberRole`
- `demoteToPlayer_asOwner_updatesMemberRole`
- `promoteOrDemote_asNonOwner_returns403`
- `transferOwnership_asOwner_previousOwnerBecomesDm`
- `removeMember_asOwner_removesMembership`
- `removedMember_getMap_returns403`
- `getMembers_returnsAllMembersWithCorrectRoles`

#### `GridCellDataControllerIT` (new)
- `saveCell_andRetrieve_returnsCorrectData`
- `ensureCell_createsNewCellIfNotExists`
- `ensureCell_returnsExistingCell_withoutCreatingDuplicate`

#### `NoteControllerIT` (new)
- `saveSharedCellNote_retrievableByDifferentMember`
- `savePrivateCellNote_notReturnedForOtherUser`
- `savePrivateCellNote_returnedForAuthor`
- `saveSharedMapNote_retrievableByAnyMember`
- `savePrivateMapNote_notReturnedForOtherUser`

#### `MapVariableControllerIT` (new)
- `createVariable_asDm_returnsCreatedVariable`
- `createVariable_asPlayer_returns403`
- `updateVariable_asDm_persistsChanges`
- `deleteVariable_cascadesAssociatedCellValues`
- `addPicklistValue_asDm_appearsInPicklistValues`
- `updatePicklistValue_asDm_persistsLabel`
- `deletePicklistValue_asDm_removesOption`
- `getVariables_asDmOnly_notVisibleToPlayers` *(checks response payload visibility field)*

#### `CellVariableValueControllerIT` (new)
- `upsertValue_newValue_createsRecord`
- `upsertValue_existingValue_updatesRecord`
- `deleteValue_removesRecord`
- `getValuesForCell_returnsAllValuesForCell`
- `upsertDmOnlyVariable_asPlayer_returns403`

#### `FileUploadControllerIT` (existing — expand)
- `[existing]` `uploadImage_returnsFilenameInResponse`
- `downloadImage_byFilename_returnsFile`

---

### E2E Tests (Playwright)

E2E tests cover only what cannot be verified without a real browser. All tests run against the live test
Cloud Run environment after deploy.

#### `auth.spec.ts` (new)
- `homePage_loadsForUnauthenticatedUser`
- `mapsRoute_redirectsToHome_whenNotAuthenticated`

#### `maps.spec.ts` (expand existing)
- `[existing]` `mapsListPage_displaysUserMaps`
- `createMap_appearsInMapsList`
- `joinMapPage_withValidCode_navigatesToEditor`

#### `map-editor.spec.ts` (expand existing)
- `[existing]` `mapEditor_opensForMap`
- `[existing]` `mapEditor_displaysMapName`
- `[existing]` `selectCell_updatesDetailPanel`
- `createVariable_asDm_appearsInCellPanel`
- `writeSharedCellNote_persistsAcrossNavigation`

#### `multiplayer.spec.ts` (expand existing)
- `[existing]` `userJoins_presenceListUpdates`
- `[existing]` `userDisconnects_presenceListUpdates`
- `cellEdit_byUserA_seenByUserB`
- `sharedNoteEdit_byUserA_seenByUserB`
- `variableCreation_byUserA_seenByUserB`
- `cellVariableValueSet_byUserA_seenByUserB`

#### `image-upload.spec.ts` (existing — no changes required)
- `[existing]` `uploadLargeImage_storesInGcs`

---

### Manual Checklist

The following scenarios are documented for manual verification. Each has a number for easy reference when
reporting issues.

| # | Area | Scenario | Trigger |
|---|------|----------|---------|
| M-1 | Auth | Full Google OAuth2 login flow: click "Sign in with Google", complete Google's consent screen, return to app authenticated | Any auth change |
| M-2 | Multiplayer | Two users edit the same cell simultaneously — verify no data loss and no error state in either session | WebSocket / cell edit changes |
| M-3 | Multiplayer | User closes browser tab mid-session — verify other users' presence lists update within ~30 seconds | WebSocket / session changes |
| M-4 | Variables | DM_ONLY variable is not shown in the cell panel when logged in as a PLAYER | Variable visibility changes |
| M-5 | Variables | PLAYER_READ variable appears in PLAYER's panel but all edit controls are disabled | Variable visibility changes |
| M-6 | Notes | Private note written by User A is not visible to User B in the same map | Note type changes |
| M-7 | Images | Uploaded image renders correctly and fills the map background in the editor canvas | Image upload / grid changes |
| M-8 | Demo editor | Demo editor loads without login and all interactive controls are read-only (no writes sent to the API) | Demo editor changes |
| M-9 | Persistence | After making edits (cell name, variable value, note), reload the page — all changes are present | Any persistence change |
| M-10 | File size | Attempt to upload a file larger than 30 MB — verify a clear error message is shown | Upload / file handling changes |
| M-11 | Grid types | Create a map with a hex grid and a map with a square grid — verify each renders the correct cell shape | Grid rendering changes |

The "Trigger" column indicates which types of code changes should prompt re-running that item before merging.

---

## Tests Intentionally Excluded from Automation

The following were considered and deliberately left out:

| Scenario | Reason |
|----------|--------|
| Last-write-wins simultaneous cell edit | Requires precise timing coordination between two async browser contexts; more likely to produce false failures than catch real bugs. Covered by M-2. |
| "Persists after page reload" in E2E | Page reload timing adds significant latency and flake to the test run. Persistence is already verified at the API integration layer; E2E just confirms the UI round-trip. |
| Variable visibility enforcement in the UI | Whether the *correct fields are hidden* in the browser is visual and selector-fragile. The API already enforces the 403; M-4 and M-5 cover the UI layer manually. |
| User reconnect state resync (precise assertion) | Full state verification after reconnect requires stable timing. M-3 covers the user-visible behavior manually. |
| Demo editor read-only enforcement | The demo editor requires checking that no network write calls are made during interaction, which is fragile to implement in Playwright. Covered by M-8. |
| Grid rendering cell count | Tests the rendering implementation rather than user-visible behavior. Caught by visual inspection (M-11) if the grid is wrong. |

---

## Implementation Order

1. Backend unit tests: `SessionRegistryTest` gaps, `NoteServiceTest`
2. Backend API integration: `MapMembershipIT`, `NoteControllerIT`, `MapVariableControllerIT`,
   `CellVariableValueControllerIT`, `GridCellDataControllerIT`, expand `DungeonMapControllerIT`,
   expand `FileUploadControllerIT`
3. Frontend unit tests: `AuthInterceptorSpec`, `AuthGuardSpec`
4. E2E: `auth.spec.ts`, expand `maps.spec.ts`, expand `map-editor.spec.ts`, expand `multiplayer.spec.ts`
5. CLAUDE.md update

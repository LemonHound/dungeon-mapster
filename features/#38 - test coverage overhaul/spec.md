# Test Coverage Overhaul

## Status

Implementation

## Purpose

Expand the test suite from the current minimal smoke-test coverage to a comprehensive set of automated tests
that validates all primary application scenarios, plus a documented manual checklist for scenarios where
automated testing would introduce more flakiness than value.

Modernize the testing infrastructure with: structured PR feedback via GitHub Actions step summaries,
E2E artifact capture for debuggable failures, and a shared test data factory that keeps integration tests
isolated, parallelism-safe, and maintainable as the suite grows.

Also update CLAUDE.md to mandate that every future feature spec includes a test cases section and that
test implementations are initially proposed by the implementing LLM and refined through review.

---

## CLAUDE.md Updates

Add to the "Adding a New Feature" section after step 4:

> Each spec must include a **Test Cases** section listing every new scenario, which tier it belongs to
> (unit / API integration / E2E / manual), and the concrete test name. A feature is not considered complete
> until all automated test cases pass in CI and any manual cases are documented in the manual checklist.
> Test implementations are initially proposed by the implementing LLM based on the spec's test cases section
> and refined through review before the spec is finalized.

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

### Unit tests — GitHub Actions PR gate

Command: `mvn test -q` (backend) and `npm test -- --watch false` (frontend Vitest).

Both run on `ubuntu-latest` GitHub-hosted runners with Maven and npm dependency caches already in place.
No Docker, no database, no network calls. These must stay fast — under two minutes each.

The backend runner uses a dummy `JWT_SECRET` env var and placeholder values for GCS and OAuth credentials
(already configured in `ci.yml`). No new CI configuration is needed for any new unit tests.

#### PR test summaries

Both the backend and frontend jobs publish structured test results to the GitHub Actions step summary so
that failed test names and messages appear inline on the PR without digging into raw logs.

- Backend: Maven Surefire writes JUnit XML to `target/surefire-reports/`. The `mikepenz/action-junit-report`
  action reads that XML and annotates the PR with failed test names.
- Frontend: Vitest's built-in `junit` reporter writes XML to `test-results/`. Same action reads it.

Both are additive to `ci.yml` — no structural changes to the pipeline.

---

### API integration tests — Cloud Build, post-image-build

Command: `mvn failsafe:integration-test failsafe:verify -q`, run inside a `maven:3.9-eclipse-temurin-21`
Docker container with the Docker socket mounted (docker-in-docker). This is already how the pipeline works.

Testcontainers spins up an ephemeral PostgreSQL container for the entire Maven Failsafe run. The container
is destroyed when the run completes. No cleanup between test methods is needed or performed — see
**Test Isolation Contract** below.

**File naming is the key**: Maven Failsafe includes `**/*IT.java` and Surefire excludes it. All integration
test classes must end in `IT.java`. This convention is already established — no `pom.xml` changes needed.

---

### E2E tests — Cloud Build, post-deploy-to-test

Playwright runs inside the `mcr.microsoft.com/playwright:v1.50.0-noble` image against the live test Cloud
Run URL. A fresh JWT is fetched from `/api/test/token` before the suite starts.

#### Artifact capture on failure

When Playwright tests fail in Cloud Build, the HTML report and trace files are uploaded to GCS so failures
are fully debuggable without re-running.

- Playwright is configured with `trace: 'retain-on-failure'` and `screenshot: 'only-on-failure'`.
  Traces include a full DOM snapshot at every step, all network requests, and the console log.
- The Cloud Build E2E step uploads `playwright-report/` to
  `gs://dungeon-mapster-487912_cloudbuild/playwright-traces/$BUILD_ID/` when `$PLAY_EXIT` is non-zero,
  then echoes the GCS URL to the build log.
- A GCS Object Lifecycle rule on the `playwright-traces/` prefix deletes objects after 30 days.
  Storage cost is negligible (a few MB per failed run at $0.02/GB/month).

This is an additive change to the `e2e-tests` step in `cloudbuild.yaml`.

---

### Local development workflow

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

---

### Cost profile

No new infrastructure is required for any test in this spec. All costs are incremental build time on
existing resources.

| Resource | Impact of new tests |
|----------|---------------------|
| GitHub Actions | `action-junit-report` adds ~5s per job. Free tier (2,000 min/month) is unaffected. |
| Cloud Build | New integration test classes add ~1–2 min. New E2E specs add ~1–2 min. Stays under 20 min total. |
| GCS (playwright-traces/) | A few MB per failed run. 30-day lifecycle rule caps accumulation. Cost is negligible. |
| Cloud Run test instance | No change — E2E tests already run against this. |
| Testcontainers PostgreSQL | Runs in the Cloud Build VM — free. |

---

## Test Data Factory

### Motivation

The current integration tests use `deleteAll()` in `@BeforeEach` to wipe the entire database before every
test method. This pattern has three problems:

1. Slow — every test method incurs a full-table-delete round trip.
2. Parallel-unsafe — a second class wiping the DB mid-run corrupts other tests.
3. Duplicated setup code — each IT class reimplements the same user/map construction inline.

The factory replaces this entirely.

---

### Test isolation contract

These rules apply to all integration test classes, new and existing:

1. **No `deleteAll()` calls anywhere.** The Testcontainers PostgreSQL container is destroyed at the end of
   the Maven Failsafe run. Its data never persists between runs. Per-method wipes are unnecessary.
2. **Each test class uses `@BeforeAll` to create its own data via `TestFactory`.** This is the "section"
   of data for that class. No other class touches it because all entities are identified by UUIDs.
3. **Destructive tests (delete, remove member, transfer ownership) create their own `TestContext` inline
   via `TestFactory` rather than operating on the class-level context.** This keeps the shared context
   intact for other tests in the class and makes each destructive test fully self-contained.
4. **Tests within a class must not depend on each other's side effects.** Each test either reads from the
   shared class-level context or creates and destroys its own data.
5. **Entity names and emails are UUID-based** (generated by the factory) so two classes in the same run
   never collide.

---

### TestContext

A plain record that holds the entities a test class needs. Fields for roles not present in a given
scenario are `null`.

```java
record TestContext(
    Long ownerId,    String ownerToken,
    Long dmId,       String dmToken,
    Long playerId,   String playerToken,
    Long mapId,      String joinCode
) {}
```

---

### TestFactory

A Spring `@Component` in the test source tree, imported via `IntegrationTestBase`. Autowired into IT
classes the same way `MockMvc` is.

**Scenario methods** (cover the vast majority of tests):

| Method | Creates |
|--------|---------|
| `mapWithOwner()` | 1 user (OWNER), 1 map |
| `mapWithOwnerAndDm()` | 2 users (OWNER + DM), 1 map |
| `mapWithAllRoles()` | 3 users (OWNER + DM + PLAYER), 1 map |

**Primitive methods** (for tests that need custom composition):

| Method | Returns |
|--------|---------|
| `createUser()` | `UserContext(id, token)` — unique UUID email, auto-generated name |
| `createMap(ownerId)` | `MapContext(id, joinCode)` — square grid, size 40 |
| `joinMap(mapId, joinCode, userId)` | Calls `POST /api/maps/join` and returns |

All scenario methods call the API (not repositories directly) so membership data is fully realistic.

**Usage in a class with shared context:**

```java
@Autowired TestFactory factory;

static TestContext ctx;

@BeforeAll
void setUp() {
    ctx = factory.mapWithOwnerAndDm();
}

@Test
void someReadTest() {
    // use ctx.mapId, ctx.ownerToken, etc.
}

@Test
void deleteMap_asOwner_removesMapAndMemberships() {
    TestContext isolated = factory.mapWithOwner();
    // delete isolated.mapId — ctx is untouched
}
```

**What to migrate:** `DungeonMapControllerIT` and `MapMembershipIT` currently use `deleteAll()` in
`@BeforeEach`. These are refactored as part of this feature to use `@BeforeAll` + `TestFactory`.

---

## Concrete Test List

Tests are listed by the file they live in. Existing tests marked `[existing]`. All others are new.

---

### Unit Tests

#### `DungeonMapServiceTest` (existing — no changes required)
All 45 existing tests cover role checks, map creation, join, promote/demote, and patch.

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

All integration tests extend `IntegrationTestBase`, use `@BeforeAll` + `TestFactory`, and follow the
test isolation contract above.

#### `AuthControllerIT` (existing — complete)
- `[existing]` `getMe_withValidToken_returnsCurrentUser`
- `[existing]` `getMe_withNoToken_returns401`
- `[existing]` `getMe_withInvalidToken_returns401`

#### `DungeonMapControllerIT` (existing — refactor + expand)
Refactor: replace `@BeforeEach deleteAll` with `@BeforeAll factory.mapWithOwner()`.
- `[existing]` `createMap_returnsCreatedMap`
- `[existing]` `getMaps_returnsUserMaps`
- `[existing]` `patchMap_updatesField`
- `[existing]` `getMapById_returnsCorrectMap`
- `[existing]` `getMapById_notFound_returns404`
- `[existing]` `updateMap_asOwner_persistsName`
- `[existing]` `deleteMap_removesMap` — uses inline `factory.mapWithOwner()`
- `[existing]` `deleteMap_asOwner_removesMapAndMemberships` — uses inline `factory.mapWithOwner()`
- `[existing]` `deleteMap_asNonOwner_returns403`
- `[existing]` `getMap_withoutAuth_returns401`

#### `MapMembershipIT` (existing — refactor + expand)
Refactor: replace `@BeforeEach deleteAll` with `@BeforeAll factory.mapWithOwner()`.
- `[existing]` `joinMap_withValidCode_addsMemberWithPlayerRole`
- `[existing]` `joinMap_withInvalidCode_returns404`
- `[existing]` `joinMap_alreadyMember_returns409`
- `[existing]` `promoteToDm_asOwner_updatesMemberRole`
- `[existing]` `demoteToPlayer_asOwner_updatesMemberRole`
- `[existing]` `promoteOrDemote_asNonOwner_returns403`
- `[existing]` `transferOwnership_asOwner_previousOwnerBecomesDm` — uses inline `factory.mapWithOwnerAndDm()`
- `[existing]` `removeMember_asOwner_removesMembership` — uses inline `factory.mapWithAllRoles()`
- `[existing]` `removedMember_getMap_returns404` — uses inline `factory.mapWithAllRoles()`
- `[existing]` `getMembers_returnsAllMembersWithCorrectRoles`

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
- `getVariables_asDmOnly_notVisibleToPlayers`

#### `CellVariableValueControllerIT` (new)
- `upsertValue_newValue_createsRecord`
- `upsertValue_existingValue_updatesRecord`
- `deleteValue_removesRecord`
- `getValuesForCell_returnsAllValuesForCell`
- `upsertDmOnlyVariable_asPlayer_returns403`

#### `GcsUploadIT` (existing — expand)
- `[existing]` `uploadImage_returnsFilenameInResponse`
- `downloadImage_byFilename_returnsFile`

---

### E2E Tests (Playwright)

E2E tests cover only what cannot be verified without a real browser. All tests run against the live test
Cloud Run environment after deploy. Playwright is configured with `trace: 'retain-on-failure'` and
`screenshot: 'only-on-failure'` — traces are uploaded to GCS on build failure.

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

## Manual Checklist

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

---

## Tests Intentionally Excluded from Automation

| Scenario | Reason |
|----------|--------|
| Last-write-wins simultaneous cell edit | Requires precise timing coordination between two async browser contexts; more likely to produce false failures than catch real bugs. Covered by M-2. |
| "Persists after page reload" in E2E | Page reload timing adds flake. Persistence is verified at the API integration layer; E2E just confirms the UI round-trip. |
| Variable visibility enforcement in the UI | Whether the correct fields are hidden in the browser is selector-fragile. The API already enforces the 403; M-4 and M-5 cover the UI layer manually. |
| User reconnect state resync | Full state verification after reconnect requires stable timing. M-3 covers the user-visible behavior manually. |
| Demo editor read-only enforcement | Checking that no network write calls are made during interaction is fragile to implement in Playwright. Covered by M-8. |
| Grid rendering cell count | Tests the rendering implementation rather than user-visible behavior. Caught by visual inspection (M-11) if the grid is wrong. |

---

## Implementation Order

1. `TestFactory` and `TestContext` — implement first; all subsequent tests depend on it
2. Refactor `DungeonMapControllerIT` and `MapMembershipIT` to use `@BeforeAll` + `TestFactory`
3. Backend unit tests: `SessionRegistryTest` gaps, `NoteServiceTest`
4. Backend API integration: `GridCellDataControllerIT`, `NoteControllerIT`, `MapVariableControllerIT`,
   `CellVariableValueControllerIT`, expand `GcsUploadIT`
5. Frontend unit tests: `AuthInterceptorSpec`, `AuthGuardSpec`
6. E2E: `auth.spec.ts`, expand `maps.spec.ts`, expand `map-editor.spec.ts`, expand `multiplayer.spec.ts`
7. CI additions: JUnit XML reporters in `ci.yml`, Playwright artifact upload in `cloudbuild.yaml`
8. CLAUDE.md update

# ADR: Flatten Backend Java Package Structure

## Context

The backend Java source tree had a redundant intermediate package: `org.dungeonmaps.DungeonMapster`. This created an unnecessary two-tier structure where the inner package name (`DungeonMapster`) mirrored the project name without adding organizational value.

Before:
```
src/main/java/org/dungeonmaps/
├── DungeonMapsterApplication.java
├── config/          (GcsConfig, SecurityConfig)
├── controller/      (AuthController, UserController)
├── model/           (User)
├── repository/      (UserRepository)
├── security/        (JwtAuthenticationFilter, JwtTokenProvider, OAuth2AuthenticationSuccessHandler)
└── DungeonMapster/
    ├── config/      (ResourceConfig, WebConfig, WebSocketConfig)
    ├── controller/  (CellVariableValueController, DungeonMapController, FileUploadController,
    │                 GridCellDataController, MapVariableController, NoteController)
    ├── model/       (CellNote, CellVariableValue, CellVariableValueId, DungeonMap, GridCellData,
    │                 MapMembership, MapNote, MapVariable, PicklistValue)
    ├── repository/  (CellNoteRepository, CellVariableValueRepository, DungeonMapRepository,
    │                 GridCellDataRepository, MapMembershipRepository, MapNoteRepository,
    │                 MapVariableRepository, PicklistValueRepository)
    ├── service/     (CellVariableValueService, DungeonMapService, GridCellDataService,
    │                 MapVariableService, NoteService)
    └── websocket/   (MapCache, MapCacheService, MapWebSocketController, SessionRegistry,
    │                 UserSession, WebSocketHandshakeInterceptor)
```

## Decision

Remove the `DungeonMapster` sub-package by merging all 37 files up into `org.dungeonmaps` directly, combining with the existing sibling packages.

After:
```
src/main/java/org/dungeonmaps/
├── DungeonMapsterApplication.java
├── config/          (GcsConfig, SecurityConfig, ResourceConfig, WebConfig, WebSocketConfig)
├── controller/      (AuthController, UserController, CellVariableValueController,
│                     DungeonMapController, FileUploadController, GridCellDataController,
│                     MapVariableController, NoteController)
├── model/           (User, CellNote, CellVariableValue, CellVariableValueId, DungeonMap,
│                     GridCellData, MapMembership, MapNote, MapVariable, PicklistValue)
├── repository/      (UserRepository, CellNoteRepository, CellVariableValueRepository,
│                     DungeonMapRepository, GridCellDataRepository, MapMembershipRepository,
│                     MapNoteRepository, MapVariableRepository, PicklistValueRepository)
├── security/        (JwtAuthenticationFilter, JwtTokenProvider, OAuth2AuthenticationSuccessHandler)
├── service/         (CellVariableValueService, DungeonMapService, GridCellDataService,
│                     MapVariableService, NoteService)
└── websocket/       (MapCache, MapCacheService, MapWebSocketController, SessionRegistry,
                      UserSession, WebSocketHandshakeInterceptor)
```

## Rationale

- The `DungeonMapster` sub-package was purely cosmetic and added folder depth with no structural benefit.
- All files within matching folder names (e.g. both `config/` layers) contain the same type of class — Spring `@Configuration`, `@RestController`, `@Entity`, `JpaRepository` — just operating on different domains.
- No naming conflicts exist between the two layers.
- The `@SpringBootApplication` component scan base (`org.dungeonmaps`) is unchanged; no Spring wiring is affected.
- The Maven `artifactId` (`DungeonMapster`) is not a Java package path and is unchanged.

## Files Changed

All 37 files under `org.dungeonmaps.DungeonMapster` had their `package` declaration and all
`import org.dungeonmaps.DungeonMapster.*` references updated to `org.dungeonmaps.*`.

Files physically moved (old path → new path):

**config/**
- `DungeonMapster/config/ResourceConfig.java` → `config/ResourceConfig.java`
- `DungeonMapster/config/WebConfig.java` → `config/WebConfig.java`
- `DungeonMapster/config/WebSocketConfig.java` → `config/WebSocketConfig.java`

**controller/**
- `DungeonMapster/controller/CellVariableValueController.java` → `controller/CellVariableValueController.java`
- `DungeonMapster/controller/DungeonMapController.java` → `controller/DungeonMapController.java`
- `DungeonMapster/controller/FileUploadController.java` → `controller/FileUploadController.java`
- `DungeonMapster/controller/GridCellDataController.java` → `controller/GridCellDataController.java`
- `DungeonMapster/controller/MapVariableController.java` → `controller/MapVariableController.java`
- `DungeonMapster/controller/NoteController.java` → `controller/NoteController.java`

**model/**
- `DungeonMapster/model/CellNote.java` → `model/CellNote.java`
- `DungeonMapster/model/CellVariableValue.java` → `model/CellVariableValue.java`
- `DungeonMapster/model/CellVariableValueId.java` → `model/CellVariableValueId.java`
- `DungeonMapster/model/DungeonMap.java` → `model/DungeonMap.java`
- `DungeonMapster/model/GridCellData.java` → `model/GridCellData.java`
- `DungeonMapster/model/MapMembership.java` → `model/MapMembership.java`
- `DungeonMapster/model/MapNote.java` → `model/MapNote.java`
- `DungeonMapster/model/MapVariable.java` → `model/MapVariable.java`
- `DungeonMapster/model/PicklistValue.java` → `model/PicklistValue.java`

**repository/**
- `DungeonMapster/repository/CellNoteRepository.java` → `repository/CellNoteRepository.java`
- `DungeonMapster/repository/CellVariableValueRepository.java` → `repository/CellVariableValueRepository.java`
- `DungeonMapster/repository/DungeonMapRepository.java` → `repository/DungeonMapRepository.java`
- `DungeonMapster/repository/GridCellDataRepository.java` → `repository/GridCellDataRepository.java`
- `DungeonMapster/repository/MapMembershipRepository.java` → `repository/MapMembershipRepository.java`
- `DungeonMapster/repository/MapNoteRepository.java` → `repository/MapNoteRepository.java`
- `DungeonMapster/repository/MapVariableRepository.java` → `repository/MapVariableRepository.java`
- `DungeonMapster/repository/PicklistValueRepository.java` → `repository/PicklistValueRepository.java`

**service/**
- `DungeonMapster/service/CellVariableValueService.java` → `service/CellVariableValueService.java`
- `DungeonMapster/service/DungeonMapService.java` → `service/DungeonMapService.java`
- `DungeonMapster/service/GridCellDataService.java` → `service/GridCellDataService.java`
- `DungeonMapster/service/MapVariableService.java` → `service/MapVariableService.java`
- `DungeonMapster/service/NoteService.java` → `service/NoteService.java`

**websocket/**
- `DungeonMapster/websocket/MapCache.java` → `websocket/MapCache.java`
- `DungeonMapster/websocket/MapCacheService.java` → `websocket/MapCacheService.java`
- `DungeonMapster/websocket/MapWebSocketController.java` → `websocket/MapWebSocketController.java`
- `DungeonMapster/websocket/SessionRegistry.java` → `websocket/SessionRegistry.java`
- `DungeonMapster/websocket/UserSession.java` → `websocket/UserSession.java`
- `DungeonMapster/websocket/WebSocketHandshakeInterceptor.java` → `websocket/WebSocketHandshakeInterceptor.java`

## Markdown Files Audited

The following project documentation files were checked for references to the `DungeonMapster` package path. None contained any such references and required no changes:

- `architecture.md`
- `tech-stack.md`
- `CLAUDE.md`
- `features/` — all spec.md and adr.md files
- `frontend/README.md`
- `templates/spec_template.md`

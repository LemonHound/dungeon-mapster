# Demo Map Editor — Shared Read-Only Map

## Status

Draft

## Purpose

The demo editor currently duplicates all logic from `MapEditor` as a standalone component with stub methods. Every
new feature added to the real editor requires manual updates to the demo to keep it compiling. This spec replaces the
demo with a simpler approach: a real hosted map that unauthenticated users can view and interact with, but cannot
persist changes to.

## Approach

Create a single "demo" map in the database owned by a system account. The demo route loads this map via the normal
`MapEditor` component, but all write operations silently no-op because the user is unauthenticated. The demo
component ceases to exist — `DemoMapEditor` is deleted.

## Behavior

**Loading:**

- `/demo` resolves to the real `MapEditor` with a special demo map ID (configured via environment variable)
- The editor loads the map's data (image, grid settings, variables) normally via the existing REST API
- No auth is required for reading the demo map — the backend exposes one public endpoint:
  `GET /api/maps/demo` returns the demo map data without a JWT

**Interaction:**

- The user can pan, zoom, click cells, and open the Variables tab exactly as normal
- Grid lock/unlock, hex/square toggle, cell selection — all work client-side as usual
- Any action that would call a write endpoint (save cell name, save variable value, upload image, etc.)
  silently does nothing — the `MapEditor` already guards writes behind `canEdit()`, which returns false
  when `userRole` is null
- The "Login to Save" button remains for unauthenticated users and redirects to OAuth

**Auth wall:**

- `canEdit()` returns false when `userRole === null` — already blocks all mutations in the real editor
- No new conditional logic needed in the template; the existing guards cover it

## Backend Changes

1. Add `GET /api/maps/demo` — public endpoint (no JWT), returns the demo map by a configured ID
2. `MapEditor` checks if the route param is `'demo'` and calls `/api/maps/demo` instead of `/api/maps/:id`
3. Demo map membership: no membership record needed — the endpoint returns `userRole: null` so `canEdit()` is false

## Frontend Changes

1. Delete `demo-map-editor.ts` and `demo-map-editor.spec.ts`
2. Update `app.routes.ts`: route `/demo` to `MapEditor` (no auth guard)
3. Update `MapEditor.ngOnInit`: if route param is `'demo'`, load from `/api/maps/demo`, skip membership check,
   skip WebSocket connection
4. Remove `isDemo` flag from `MapEditor` — no longer needed once the demo has no special behavior

## Demo Map Setup

The demo map is seeded once in the database (or via a startup migration). Its ID is set in the backend config.
The map has a pre-uploaded image and pre-configured grid settings. Variables can be pre-populated to showcase
the feature.

## Edge Cases

- Demo map deleted: backend returns 404, frontend shows "Demo unavailable" message
- Demo map's image evicted from cache: loads normally via the public image endpoint
- Multiple concurrent unauthenticated visitors: no session, no WebSocket, no shared state — fully isolated reads
- Authenticated user visits `/demo`: `canEdit()` would normally be true, but since the demo map endpoint
  returns no membership, `userRole` stays null and writes are still blocked

## Open Questions

- Should authenticated users be redirected away from `/demo` to `/maps`? (Current behavior redirects them — keep or
  remove?)
- Should the demo map support read-only WebSocket presence so visitors see the pre-set variable values live?
  (Probably not needed for MVP of this feature)
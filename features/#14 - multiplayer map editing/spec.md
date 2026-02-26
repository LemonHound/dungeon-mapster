# Real-time Multiplayer Map Editing

## Status

Documentation

## Purpose

Enable real-time collaborative editing of dungeon maps, allowing multiple users (DMs and players) to see each other's
actions as they happen. This includes:

- Real-time synchronization of map-level settings changes
- Real-time synchronization of grid cell variable changes
- Visual indicators showing which cells/fields other users are currently editing
- Online/offline presence indicators for all connected users

This transforms Dungeon Mapster from a single-user tool into a collaborative platform suitable for live tabletop RPG
sessions with 2-10 concurrent users per map.

## UX

### Connection & Presence

- Users automatically connect to the map's WebSocket channel when opening the map editor
- A presence indicator shows all connected users with their assigned color and online/offline status
- Connection status ("Connected", "Reconnecting...") displays unobtrusively if connection drops

### Visual Collaboration Indicators

Each connected user receives a randomly assigned color from a distinct palette: Red, Blue, Green, Purple, Orange, Teal,
Pink, Amber.

**Cell Selection:**
- When a user selects a grid cell, a colored border (their assigned color) outlines the cell
- A small circular avatar/icon in the top-right corner of the cell shows who has it selected
- Multiple users can select different cells simultaneously, each with their own color

**Field Editing:**

- When a user focuses on an input field (e.g., cell name in the fly-out panel), the field border highlights in their
  color
- Their avatar/icon appears within or adjacent to the field
- This provides immediate feedback about concurrent editing without blocking access

**No Text Labels:**

- Visual indicators use only color and icon — no "User X is editing..." text overlays
- Clean, unobtrusive presence awareness similar to Google Sheets

### Real-time Updates

- Cell variable changes appear immediately for all users
- Map-level setting changes (grid type, size, offsets) update in real-time
- Updates follow existing save debounce timing (300ms after user stops typing/interacting)
- Last-write-wins conflict resolution — no optimistic locking or merge conflicts

### Reconnection

- Automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- "Reconnecting..." indicator shown during connection attempts
- Full state resync on reconnection (all cell data for the current map)
- Outbound messages queued during disconnection and sent on reconnect

## Behavior

### Connection Lifecycle

1. **User Opens Map Editor**
   - Client establishes WebSocket connection with JWT token in handshake
   - Server validates JWT, creates session, assigns random color
   - Server broadcasts to other users: "User X joined (color)"
   - Client subscribes to `/topic/map/{mapId}`
   - Server sends full map state to new client

2. **User Edits Cell Variable**
   - User types in cell name field (debounced 300ms)
   - Client saves to database via REST API
   - On successful save, client broadcasts via WebSocket: `{type: 'CELL_UPDATE', mapId, row, col, field: 'name', value}`
   - Server relays to all other connected users on same map
   - Other clients update cell data in memory, refresh UI if visible

3. **User Selects Cell**
   - Client broadcasts immediately: `{type: 'SELECTION', mapId, row, col, userId, color}`
   - Server relays to all other users
   - Other clients draw colored border + icon on specified cell

4. **User Focuses Field**
   - Client broadcasts immediately: `{type: 'FIELD_FOCUS', mapId, row, col, field: 'name', userId, color}`
   - Server relays to all other users
   - Other clients highlight field border in user's color, show icon

5. **User Disconnects**
   - WebSocket connection closes (tab close, network drop, etc.)
   - Server detects disconnect via connection lifecycle event
   - Server broadcasts to remaining users: "User X left"
   - Server cleans up session after 60s grace period for reconnection
   - Other clients remove user from presence list, clear their selection indicators

6. **User Reconnects**
   - Client detects connection loss, shows "Reconnecting..." indicator
   - Client attempts reconnect with exponential backoff
   - Client re-establishes connection with JWT token
   - Server validates, creates new session, assigns color (may differ from before)
   - Server sends full map state
   - Client resyncs all data, broadcasts current selection if any

### Message Protocol (STOMP over WebSocket)

**Topics:**

- `/topic/map/{mapId}` — Map-wide broadcasts (all users on this map)
- `/user/queue/sync` — Personal messages (initial state sync)

**Message Types:**

Presence:

```
{type: 'USER_JOINED', userId, userName, color, role}
{type: 'USER_LEFT', userId}
```

Selection:

```
{type: 'SELECTION', userId, row, col, color}
{type: 'FIELD_FOCUS', userId, row, col, field, color}
{type: 'FIELD_BLUR', userId}
```

Data changes:

```
{type: 'CELL_UPDATE', mapId, row, col, field, fieldFlags: {isDmOnly, isReadOnly, ...}, value, userId}
{type: 'MAP_UPDATE', mapId, field, fieldFlags: {isDmOnly, isReadOnly, ...}, value, userId}
```

Clients include `fieldFlags` on all data change broadcasts. The server uses these flags (validated against the sender's
role from the session registry) to filter broadcasts per recipient. In this MVP, no variables are DM-only so the server
passes all messages through without filtering. Filtering logic will be activated in #16.

State sync (personal):

```
{type: 'FULL_STATE', mapData, cellData: [{row, col, name, ...}, ...], users: [{userId, color, role}, ...]}
```

The `FULL_STATE` payload is built from the server-side map cache (not a direct DB query) and is pre-filtered based on
the recipient's role before sending.

### Server-Side Session Management

**In-Memory Session Registry:**

- `ConcurrentHashMap<String, UserSession>`
- Key: WebSocket session ID
- Value: `{userId, mapId, color, role, connectedAt, lastHeartbeat}`

**Session Lifecycle:**

- Session created on WebSocket connect
- Heartbeat updated every 10s (STOMP built-in)
- Session removed on disconnect or heartbeat timeout (30s)
- Automatic cleanup task runs every 60s to remove stale sessions

**Single Instance Assumption:**

- Current implementation assumes max 1 Cloud Run instance
- All sessions for a map are in the same instance's memory
- Simple broadcast to all sessions on same `mapId`
- No cross-instance message routing needed

### Server-Side Map Cache

**Purpose:** Avoid per-message DB queries for broadcast filtering and state sync. The cache is the authoritative source
for all server-side reads after initial load.

**Cache Lifecycle:**

- **Cold load:** First connection to a map loads all cell and variable data (including field flags) from DB, populates
  cache
- **Write-through:** Every successful DB write updates the cache before broadcasting — cache is always consistent with
  DB at broadcast time
- **Eviction:** Cache entry for a map is dropped when the last user disconnects — no idle data held in memory
- **State sync:** `FULL_STATE` payload is built from cache, pre-filtered by recipient role, never from a direct DB query

**Write flow:**

```
client → REST save → DB → (success) → server updates cache → filtered broadcast to connected users
```

**Broadcast filtering:**

- Server uses `fieldFlags` from the incoming message, validated against the sender's role in the session registry (
  in-memory, no DB hit)
- Filtered per recipient based on their role and the field's flags from cache
- In MVP all fields are non-DM-only, so all messages pass through — filter logic is a no-op until #16

**Reconciliation:**

- A background job runs periodically against all active map caches
- Diffs cache state against DB; auto-corrects cache on any discrepancy detected
- Logs all corrections for visibility
- Intended to catch bugs in write-through logic early; can be disabled later when confidence is established

### Client-Side State Management

**Connection State:**

- WebSocket connection reference
- Connection status (connected / reconnecting / disconnected)
- Assigned color for current user
- Presence list of other users: `{userId, userName, color, role}[]`

**Selection State:**

- Track own selection (don't render own border/icon)
- Track other users' selections: `Map<userId, {row, col, field}>`
- Clear selection when user disconnects
- Update on each `SELECTION` / `FIELD_FOCUS` message

**Data Synchronization:**

- Optimistic updates: apply own changes immediately
- Server updates: apply if different from current state
- Last-write-wins: no conflict detection
- Full resync on reconnection overwrites local state

### Integration with Existing Save Logic

Current behavior is preserved — debounce timing unchanged. After a successful DB save, broadcast the WebSocket message.
No separate broadcast throttling needed; broadcast signals "this change is now persisted."

```typescript
function saveCellName() {
   this.gridCellDataService.saveCell(mapId, row, col, name).subscribe({
      next: () => {
         this.websocketService.broadcast({
            type: 'CELL_UPDATE',
            mapId, row, col,
            field: 'name',
            fieldFlags: {isDmOnly: false, isReadOnly: false},
            value: this.selectedCellName
         });
      }
   });
}
```

All data change broadcasts must include `fieldFlags`. As new variable types and flags are introduced in #16, clients
populate these from the variable definition. The server uses the flags for filtering but validates the sender's role
from the session registry before trusting them.

## Edge Cases

**Connection Management:**

- Rapid connect/disconnect: Grace period (60s) before full cleanup prevents session churn
- Duplicate connections: Same user on multiple tabs/devices gets separate session with different color
- Stale connections: Heartbeat timeout (30s) automatically marks as offline and cleans up
- Network flakiness: Auto-reconnect with exponential backoff prevents connection spam

**Concurrent Editing:**

- Same cell, same field: Last-write-wins, no locking or conflict resolution
- Same cell, different fields: Independent — both changes apply
- Race condition on save: Database constraint violations handled by existing error handling
- Out-of-order messages: STOMP guarantees message ordering per connection

**Presence Indicators:**

- User stays idle: Connection stays "online" — heartbeat keeps session alive
- User backgrounds tab: Connection remains active, heartbeat continues
- User closes tab: Disconnect event fires immediately, presence removed
- User force-closes browser: Heartbeat timeout (30s) detects stale connection, marks offline

**Security & Authorization:**

- Unauthorized access: JWT validation on handshake rejects invalid tokens
- Broadcast filtering: Server validates sender's role from session registry (in-memory); uses `fieldFlags` from the
  message combined with cache state to filter per recipient — no DB hit per message
- Spoofing user actions: Server includes `userId` in all broadcasts, client cannot forge another user's updates

**Scaling & Performance:**

- 2-10 users per map: Well within single WebSocket connection capacity
- 20+ users (edge case): Still manageable on single instance (Cloud Run handles ~1000 concurrent WebSockets)
- Multiple maps: Each map has independent broadcast group, no cross-contamination
- Message volume: With 10 users and aggressive editing, ~50-100 messages/sec max — negligible bandwidth

**Data Consistency:**

- User edits while offline: Changes queue locally, send on reconnect (STOMP queues automatically)
- Server restarts: All WebSocket connections drop, clients auto-reconnect, full state resync
- Database out of sync: Full state resync on reconnect ensures client has latest data
- Partial updates: Each message is atomic (single field change), no partial state issues

## Open Questions

None — all design decisions finalized.

## Testing Considerations

- Local testing: Multiple browser tabs/windows simulate concurrent users
- Test reconnection: Kill backend, verify client reconnects and resyncs
- Test rapid changes: Verify last-write-wins, no data corruption
- Load testing: 20 concurrent users on single map to verify performance
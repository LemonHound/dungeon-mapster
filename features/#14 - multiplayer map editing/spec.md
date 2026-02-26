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

Each connected user receives a randomly assigned color from a distinct palette (Red, Blue, Green, Purple, Orange, Teal,
Pink, Amber).

### Cell Selection:

- When a user selects a grid cell, a colored border (their assigned color) outlines the cell
- A small circular avatar/icon in the top-right corner of the cell shows who has it selected
- Multiple users can select different cells simultaneously, each with their own color

### Field Editing:

- When a user focuses on an input field (e.g., cell name in the fly-out panel), the field border highlights in their
  color
- Their avatar/icon appears within or adjacent to the field
- This provides immediate feedback about concurrent editing without blocking access

### No Text Labels:

- Visual indicators use only color and icon - no "User X is editing..." text overlays
- Clean, unobtrusive presence awareness similar to Google Sheets

### Real-time Updates

- Cell variable changes (name, future custom variables) appear immediately for all users
- Map-level setting changes (grid type, size, offsets) update in real-time
- Updates follow existing save debounce timing (300ms after user stops typing/interacting)
- Last-write-wins conflict resolution - no optimistic locking or merge conflicts

### Reconnection

- Automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- "Reconnecting..." indicator shown during connection attempts
- Full state resync on reconnection (all cell data for the current map)
- Outbound messages queued during disconnection and sent on reconnect

## Future Enhancement (Post-MVP)

### DM/Owner Hide Presence Toggle:

- Optional toggle for DMs/Owners to hide their selection indicators from players
- Prevents spoilers from DM examining specific cells
- Data changes still broadcast in real-time
- Only the visual selection/editing indicators are hidden
- Low priority - can be deferred

## Behavior

### Connection Lifecycle

1. User Opens Map Editor:
   - Client → Establish WebSocket connection with JWT token in handshake Server → Validate JWT, create session, assign
     random color Server → Broadcast to other users: "User X joined (color)" Client → Subscribe to /topic/map/{mapId}
     Server → Send full map state to new client
2. User Edits Cell Variable:
   Client → User types in cell name field (debounced 300ms) Client → Save to database via REST API Client (on successful
   save) → Broadcast via WebSocket: {type: 'CELL_UPDATE', mapId, row, col, field: 'name', value} Server → Relay to all
   other connected users on same map Other Clients → Update cell data in memory, refresh UI if visible
3. User Selects Cell:
   Client → User clicks grid cell Client → Broadcast immediately: {type: 'SELECTION', mapId, row, col, userId, color}
   Server → Relay to all other users Other Clients → Draw colored border + icon on specified cell
4. User Focuses Field:
   Client → User focuses input field (e.g., cell name) Client → Broadcast immediately: {type: 'FIELD_FOCUS', mapId, row,
   col, field: 'name', userId, color} Server → Relay to all other users Other Clients → Highlight field border in user's
   color, show icon
5. User Disconnects:
   Client → WebSocket connection closes (tab close, network drop, etc.) Server → Detect disconnect via connection
   lifecycle event Server → Broadcast to remaining users: "User X left" Server → Clean up session after 60s (grace
   period for reconnection) Other Clients → Remove user from presence list, clear their selection indicators
6. User Reconnects:
   Client → Detect connection loss, show "Reconnecting..." indicator Client → Attempt reconnect with exponential backoff
   Client → Re-establish connection with JWT token Server → Validate, create new session, assign color (may differ from
   before) Server → Send full map state Client → Resync all data, broadcast current selection if any

## Message Protocol (STOMP over WebSocket)

### Topics:

/topic/map/{mapId} - Map-wide broadcasts (all users on this map)
/user/queue/sync - Personal messages (initial state sync)
Message Types:
Presence messages: {type: 'USER_JOINED', userId, userName, color, role} {type: 'USER_LEFT', userId}
Selection messages: {type: 'SELECTION', userId, row, col, color} {type: 'FIELD_FOCUS', userId, row, col, field, color}
{type: 'FIELD_BLUR', userId}
Data change messages: {type: 'CELL_UPDATE', mapId, row, col, field, value, userId} {type: 'MAP_UPDATE', mapId, field,
value, userId}
State sync message (personal): {type: 'FULL_STATE', mapData, cellData: [{row, col, name, ...}, ...],
users: [{userId, color, role}, ...]}
Server-Side Session Management
In-Memory Session Registry:
ConcurrentHashMap<String, UserSession> Key: WebSocket session ID Value: {userId, mapId, color, role, connectedAt,
lastHeartbeat}
Session Lifecycle:
Session created on WebSocket connect
Heartbeat updated every 10s (STOMP built-in)
Session removed on disconnect or heartbeat timeout (30s)
Automatic cleanup task runs every 60s to remove stale sessions
Single Instance Assumption:
Current implementation assumes max 1 Cloud Run instance
All sessions for a map are in the same instance's memory
Simple broadcast to all sessions on same mapId
No cross-instance message routing needed
Future Multi-Instance Scaling:
When Cloud Run scales beyond 1 instance, add Redis (Memorystore)
Use Redis Pub/Sub to relay messages between instances
Minimal code changes needed (swap broadcast implementation)
Clear upgrade path when needed
Client-Side State Management
Connection State:
Store WebSocket connection reference
Track connection status (connected/reconnecting/disconnected)
Store assigned color for current user
Store presence list of other users: {userId, userName, color, role}[]
Selection State:
Track own selection (don't render own border/icon)
Track other users' selections: Map<userId, {row, col, field}>
Clear selection when user disconnects
Update on each SELECTION/FIELD_FOCUS message
Data Synchronization:
Optimistic updates: apply own changes immediately
Server updates: apply if different from current state
Last-write-wins: no conflict detection
Full resync on reconnection overwrites local state
Integration with Existing Save Logic
Current behavior:
Cell name changes debounced 300ms
Map settings debounced on input change
Auto-save timer (3s after last change)
New behavior:
Keep existing debounce logic
After successful DB save, broadcast WebSocket message
No separate broadcast throttling needed
Broadcast = "this change is now persisted"
Example integration:
saveCellName() { this.gridCellDataService.saveCell(mapId, row, col, name).subscribe({ next: () => { console.log('Cell
name saved'); // NEW: Broadcast to other users this.websocketService.broadcast({ type: 'CELL_UPDATE', mapId, row, col,
field: 'name', value: this.selectedCellName }); } }); }
Edge Cases
Connection Management
Rapid connect/disconnect: Grace period (60s) before full cleanup prevents session churn
Duplicate connections: Same user connects from multiple tabs/devices - each gets separate session with different color
Stale connections: Heartbeat timeout (30s) automatically marks as offline and cleans up
Network flakiness: Auto-reconnect with exponential backoff prevents connection spam
Concurrent Editing
Same cell, same field: Last-write-wins, no locking or conflict resolution
Same cell, different fields: Independent - both changes apply (future feature when multiple fields exist)
Race condition on save: Database constraint violations handled by existing error handling
Out-of-order messages: STOMP guarantees message ordering per connection
Presence Indicators
User stays idle: Connection stays "online" (like Google Sheets) - heartbeat keeps session alive
User backgrounds tab: Connection remains active, heartbeat continues (browser manages WebSocket lifecycle)
User closes tab: Disconnect event fires immediately, presence removed
User force-closes browser: Heartbeat timeout (30s) detects stale connection, marks offline
Security & Authorization
Unauthorized access: JWT validation on handshake rejects invalid tokens
Role-based filtering: Not implemented in MVP - all updates broadcast to all connected users on map
DM-only variables: Future feature (#16) will need server-side filtering before broadcast
Spoofing user actions: Server includes userId in all broadcasts, client cannot forge another user's updates
Scaling & Performance
2-10 users per map: Well within single WebSocket connection capacity
20+ users (edge case): Still manageable on single instance (Cloud Run handles ~1000 concurrent WebSockets)
Multiple maps: Each map has independent broadcast group, no cross-contamination
Message volume: With 10 users and aggressive editing, ~50-100 messages/sec max - negligible bandwidth
Data Consistency
User edits while offline: Changes queue locally, send on reconnect (STOMP queues automatically)
Server restarts: All WebSocket connections drop, clients auto-reconnect, full state resync
Database out of sync: Full state resync on reconnect ensures client has latest data
Partial updates: Each message is atomic (single field change), no partial state issues
Open Questions
None - all design decisions finalized.
Implementation Notes
Phase 1 (MVP):
Spring WebSocket + STOMP configuration
In-memory session management
Basic presence broadcasts (join/leave)
Selection broadcasts (cell + field)
Data change broadcasts (tied to saves)
Client WebSocket service and UI indicators
Phase 2 (Post-MVP):
DM/Owner hide presence toggle
Enhanced presence UI (user list panel)
Connection quality indicators
Message compression for lower bandwidth
Phase 3 (Multi-Instance Scaling - when needed):
Add Redis (Memorystore) as message broker
Implement Redis Pub/Sub for cross-instance relay
Session affinity configuration (optional - route same map to same instance)
Testing Considerations:
Local testing: Multiple browser tabs/windows simulate concurrent users
Test reconnection: Kill backend, verify client reconnects and resyncs
Test rapid changes: Verify last-write-wins, no data corruption
Load testing: 20 concurrent users on single map to verify performance
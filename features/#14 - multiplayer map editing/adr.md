# ADR: Real-time Multiplayer via STOMP over WebSocket

## Status

Accepted

## Context

Dungeon Mapster needed to support real-time collaborative map editing for 2-10 concurrent users per map. The solution
required:

- Bidirectional communication between server and multiple clients
- Presence awareness (who is connected, what they're editing)
- Real-time propagation of cell and map-level data changes
- Compatibility with the existing Spring Boot backend and Angular frontend
- Minimal operational complexity given the current single-instance Cloud Run deployment

## Decision

Use **Spring WebSocket with STOMP** as the messaging protocol, with an **in-memory session registry** and *
*write-through map cache** on the server, and a dedicated **Angular WebSocket service** on the client.

**Key choices:**

- **STOMP over WebSocket** rather than raw WebSocket — gives us topic-based pub/sub, message framing, and heartbeat
  support without additional infrastructure.
- **In-memory session management** (`ConcurrentHashMap`) rather than a persistent store — sufficient for a single Cloud
  Run instance; avoids Redis dependency until scaling requires it.
- **Broadcast after successful DB save** rather than optimistic broadcast — keeps WebSocket messages as a signal that a
  change is persisted, not a speculative one.
- **Write-through map cache** — cell and variable data (including field flags) loaded from DB on first connection, kept
  in sync by every successful write. All server-side reads (state sync, broadcast filtering) served from cache, never
  from direct DB queries after cold load.
- **Cache eviction on last-disconnect** — no idle map data held in memory; reloaded from DB on next connection.
- **Background reconciliation with auto-correction** — periodic diff of cache vs DB for all active maps; discrepancies
  are auto-corrected and logged. Provides early detection of write-through bugs while scale is small. Can be disabled
  later when confidence is established.
- **Client-supplied `fieldFlags` on broadcasts** — clients include flags (e.g. `isDmOnly`, `isReadOnly`) on all data
  change messages. Server validates against sender's role from session registry (in-memory) and uses cache as the
  authoritative flag source for filtering. In MVP all fields pass through — filter logic is a no-op until #16 introduces
  DM-only variables.
- **Last-write-wins** conflict resolution — appropriate for the expected concurrency level (2-10 users); eliminates
  complexity of OT or CRDT approaches.
- **JWT validation on WebSocket handshake** — reuses existing auth infrastructure, no new security surface.
- **Color-only presence indicators** (no text labels) — unobtrusive UX aligned with tools like Google Sheets.

## Alternatives Considered

**Server-Sent Events (SSE)**

- Pros: simpler, HTTP-native, no protocol upgrade
- Cons: unidirectional (server → client only); client-to-server updates would still require REST calls, making presence
  broadcasts awkward. Rejected.

**Raw WebSocket (no STOMP)**

- Pros: lower overhead
- Cons: requires manual message framing, routing, and heartbeat. STOMP gives these for free and Spring has first-class
  support. Rejected.

**Redis Pub/Sub from day one**

- Pros: supports multi-instance scaling immediately
- Cons: adds operational dependency (Cloud Memorystore) for a problem that doesn't exist yet. Cloud Run is configured at
  max 2-3 instances; session affinity can be used as a bridge if needed. Deferred — the in-memory design is
  intentionally structured to make Redis a drop-in swap when required.

**Optimistic locking / conflict resolution**

- Pros: prevents data loss on concurrent edits to the same field
- Cons: significant complexity; last-write-wins is acceptable given the small user counts and the nature of the data (
  map cell labels, not financial records). Rejected for MVP.

## Consequences

- The server must not scale beyond 1 active instance without adding Redis (or enabling session affinity as a stopgap).
  Cloud Run's min-instance setting should be monitored.
- Each user on multiple tabs gets a separate color-assigned session — this is acceptable but may look confusing.
  Documented as a known edge case.
- Role-based presence filtering (e.g., hiding DM selections from players) is not implemented in this feature. It will
  require server-side filtering logic and is tracked as a separate feature.
- The `fieldFlags` message schema is established in this feature so that #16 can activate server-side filtering without
  any client changes. In MVP the filter is a pass-through.
- The background reconciliation job adds a small overhead for active maps. It is intentionally included early for
  correctness guarantees and should be reviewed for removal or disabling before any significant scale-up.
- A server crash between a successful DB write and the cache update self-heals — cache is rebuilt from DB on next cold
  load. The narrow window of drift is covered by the reconciliation job.
- Any field added to a map or cell in the future must have its definition — including all flags — included in the
  initial map state payload delivered to the client on connect. This is required for the broadcast pipeline to carry
  accurate metadata at save time. New fields that do not follow this pattern will not be correctly handled by the
  broadcast, filter, and subscribe model.
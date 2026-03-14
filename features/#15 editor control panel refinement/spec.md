# Editor Control Panel UX Refinement

GitHub Issue: https://github.com/LemonHound/dungeon-mapster/issues/15

## Status

Ready for Implementation

## Purpose

Redesign the map editor's right-side flyout control panel to be more intuitive, contextual, and modern. Replace the current clunky vertical tab-strip with a clean flyout system driven by user intent, and introduce map-level and cell-level notes as part of this feature.

## Visual Reference

Mockup: `features/#15 editor control panel refinement/mockup.html`
(Also served locally during planning at `http://localhost:4018`)

Design language: dark theme (`#161b22` panel, `#0d1117` inputs), amber accent (`#e8a838`) for hex/cell context, orange accent (`#f0883e`) for admin context, blue (`#388bfd`) for focus states.

---

## Top Bar Redesign

The existing topbar (brand left, nav center, profile right) gains two structured buttons on the right:

| Button | Visibility | Behavior |
|---|---|---|
| **DM Admin** (`🛡️`) | DM and Owner roles only | Opens DM Admin flyout |
| **Account** (avatar initial) | All users | Opens account/profile UI (out of scope for this feature) |

On mobile, button labels may collapse to icon-only. The DM Admin button highlights (amber border) when its flyout is open.

---

## Flyout System — Overview

Three completely independent flyouts. No cross-navigation between them. Each slides in from the right.

**Sizing:**
- Landscape (width > height): 55% of screen width
- Portrait (height < width): 100% of screen width

**Opening:**
- Cell flyout: auto-opens when user taps a hex
- Notes flyout: opens when user taps the Notes FAB
- DM Admin flyout: opens when user taps the DM Admin topbar button

**Closing — universal rule for all three flyouts:**
- Tap the `✕` button in the flyout header
- Tap anywhere on the map canvas
- In both cases: flyout closes, nothing else happens. The next tap is treated fresh (selecting a hex, re-opening the flyout, etc.)

No flyout can navigate to another. No shared tab bar.

---

## Notes FAB

A single persistent floating action button, always visible on the map canvas.

- **Position**: bottom-right corner (`right: 20px, bottom: 20px`)
- **Label**: `📖 Notes`
- **When any flyout opens**: FAB slides left to hover just outside the left edge of the flyout (`right: calc(55% + 16px)` landscape, near left edge portrait), remaining tappable
- **While Notes flyout is open**: FAB is highlighted (amber border/tint); tapping it closes the Notes flyout
- **While Cell or Admin flyout is open**: tapping the Notes FAB closes the current flyout (and deselects the hex if Cell was open), then immediately opens the Notes flyout

---

## Flyout 1 — Cell

Triggered by: tapping any hex on the map canvas.

No sub-navigation. Contains only:

- **Header**: hex identifier (e.g. "Cell B4"), subtitle "Row X · Col Y", `✕` close button
- **Variables section**: list of map-level variables with per-cell override values (editable inline)
- **Cell Notes section**: freeform textarea for notes about this specific hex

Closing the Cell flyout deselects `selectedCell` and removes the hex highlight. Tapping a hex while the Cell flyout is already open closes it (deselects) — the next tap selects the new hex. There is no "switch hex in place" behavior.

---

## Flyout 2 — Notes

Triggered by: tapping the Notes FAB.

No sub-navigation. Contains map-level campaign notes in an accordion layout:

| Section | Icon | Persisted | Description |
|---|---|---|---|
| Quests | ⚔️ | No (placeholder) | Active and completed quests — simple textarea for now; richer entry model planned |
| NPCs | 🧙 | No (placeholder) | NPC names, relationships, notes — simple textarea for now; entry model planned |
| Session Notes | 📅 | No (placeholder) | Per-session recap and reminders — simple textarea for now |
| Public Shared Note | 📝 | Yes | Freeform shared campaign notes visible and editable by all players |
| Personal Notes | 🔒 | Yes | Per-player private/attributed notes (two-tab: Your Note \| Private) |

Each accordion section is independently expandable/collapsible. Quests, NPCs, and Session Notes are UI-only placeholders with no backend persistence for this feature — their data models will be redesigned in a future feature. Public Shared Note and Personal Notes are fully persisted.

---

## Flyout 3 — DM Admin

Triggered by: tapping the DM Admin topbar button. Visible to DM and Owner roles only.

Has sub-navigation tabs across the top of the flyout (amber underline active indicator):

### Map tab
- Image upload drop zone (PNG/JPG/WEBP, up to 20 MB)
- Grid Type selector (Hex flat-top / Hex pointy-top / Square)
- Cell Size input
- Lock Grid to Map toggle
- Show Grid toggle

### Members tab
- List of connected users with avatar, name, role, online/away status indicator
- Promote/Demote role buttons per non-owner member

### Variables tab
- List of map-level variable definitions (key + type)
- "+ Add Variable" button

---

## Hex Selection and Deselection

- **Select**: tap a hex → `selectedCell` set, Cell flyout opens
- **Deselect**: tap `✕` on Cell flyout, or tap the map canvas — `selectedCell` cleared, highlight removed
- **No deselection on pan/zoom**
- **Switching hexes**: tap the map to close (deselects), then tap the new hex to select it
- **No Escape key**: excluded intentionally for uniform desktop/mobile/tablet UX

---

## Context-Aware Default State

When the map editor loads and no map image has been uploaded yet, the DM Admin flyout opens automatically to the Map tab. This surfaces the image upload UI without requiring the DM to find it manually.

---

## Notes Permission Model

All notes exist in three visibility/edit tiers. This applies to both map-level and cell-level notes:

| Type | Label | Who can write | Who can read |
|---|---|---|---|
| **Shared** | "Shared" | All players | All players |
| **Private** | "Private" | Only you | Only you (DM cannot see) |
| **Attributed public** | "Your Note" | Only you | All players (read-only for others) |

### Cell flyout — Cell Notes section
A three-tab strip (`Shared | Player Notes | Private`) switches between the three note types for the selected cell.

- **Shared**: single collaborative textarea, all players read/write
- **Player Notes**: your note (editable textarea, green border) at top; below it, a read-only attributed list of all other players' notes (avatar + name + text). Replaces the per-player "Your Note" tab to prevent notes being hidden from each other.
- **Private**: your private textarea (purple border), hidden from all others including DM

### Notes flyout — Map Notes
- Quests, NPCs, Session Notes, Public Shared Note are the collaborative accordions — all players can read and edit the shared content.
- **Player Notes** accordion contains a two-tab strip (`Player Notes | Private`) for per-player map-level notes.
  - **Player Notes** (default): your attributed note (editable textarea, green border) at top; other players' attributed notes listed below read-only with avatar and name attribution.
  - **Private**: hidden from all, including DM.

## Notes Backend Scope

New persistence required (not yet implemented):

### Cell notes
Keyed by: `map_id + row + col + user_id + type`

| type | user_id | Description |
|---|---|---|
| `shared` | null | One shared record per cell |
| `private` | user ID | One per user per cell; server enforces read restriction |
| `public` | user ID | One per user per cell; readable by all |

### Map notes
Keyed by: `map_id + user_id + type + section`

Only two sections are persisted in this feature. Quests, NPCs, and Session Notes are rendered as UI-only textareas with no backend — their data models will be designed in a future feature.

| type | section | user_id | Description |
|---|---|---|---|
| `shared` | general | null | Public Shared Note accordion — all players read/write |
| `private` | null | user ID | Per-user private map note (Personal Notes → Private tab) |
| `public` | null | user ID | Per-user attributed map note (Personal Notes → Your Note tab) |

### Access control rules
- `private` notes: server must validate that requesting user matches `user_id` before returning content. DM role does not override this.
- `public` notes: readable by all authenticated members of the map; writable only by owning `user_id`.
- `shared` notes: readable and writable by all authenticated members of the map.

---

## Edge Cases

- Tapping the map while no flyout is open: selects the tapped hex, opens Cell flyout
- Tapping the map while any flyout is open: closes flyout only; hex under the tap is NOT selected
- Notes FAB tapped while Notes flyout is open: closes Notes flyout
- Notes FAB tapped while Cell flyout is open: closes Cell flyout (deselects hex), opens Notes flyout
- DM Admin button tapped while Admin flyout is open: closes Admin flyout
- Remote WebSocket selection events: do not affect local `selectedCell` or flyout state
- Non-DM users: DM Admin button not rendered; DM Admin flyout inaccessible

---

## Out of Scope

- Account flyout/dropdown (separate feature)
- Variable creation UI for individual cells (Variables tab defines map-level schema; cell overrides are edited in the Cell flyout against that schema)
- Demo map editor: intentionally kept out of date per project convention

# Cell Variables

## Status

Implementation

## Purpose

DMs and Owners can define a set of typed variables scoped to a specific map. These variables appear in the Variables
tab of the cell flyout for every cell on that map, and can be assigned values per cell. Players can view or edit
variables depending on the visibility setting the DM configured.

## Variable Types

Each variable has a `data_type` and, where applicable, a `display_format` qualifier:

| data_type | display_format values               |
|-----------|-------------------------------------|
| TEXT      | (none)                              |
| TEXTAREA  | (none — plain text only)            |
| DATE      | (none)                              |
| NUMERIC   | INTEGER, FLOAT, PERCENTAGE          |
| PICKLIST  | (none — color behavior is separate) |

Additional numeric display formats (e.g. CURRENCY) will be added in future features using the same `display_format`
column without schema changes.

## Variable Visibility

Each variable has a `visibility` enum column:

- `DM_ONLY` — players cannot see or edit
- `PLAYER_READ` — players can see the value but the field is greyed out and non-interactive
- `PLAYER_EDIT` — players can see and edit the value

Server validates the player's role against this flag before writing any cell variable value to the DB.

## Picklist Behavior

Picklist variables have an additional `show_color_on_cells` boolean flag. When true, a color is auto-assigned to each
picklist value added by the DM. The cell tint rendering uses this color if the user has enabled display for that
variable.

Each user independently controls which (if any) picklist variable is shown as a cell tint. This is a client-local
setting — it is not persisted or broadcast. The toggle/radio is surfaced per-user in the map editor UI. Only one
picklist variable can be shown as the active tint at a time.

## Database Schema

### `map_variables` table

| column              | type      | notes                                         |
|---------------------|-----------|-----------------------------------------------|
| id                  | UUID      | auto-generated primary key                    |
| map_id              | BIGINT FK | references `dungeon_maps`                     |
| name                | VARCHAR   | display label                                 |
| data_type           | VARCHAR   | enum: TEXT, TEXTAREA, DATE, NUMERIC, PICKLIST |
| display_format      | VARCHAR   | nullable; used for NUMERIC subtype            |
| visibility          | VARCHAR   | enum: DM_ONLY, PLAYER_READ, PLAYER_EDIT       |
| show_color_on_cells | BOOLEAN   | picklist only; false for all other types      |
| sort_order          | INTEGER   | creation order; used for display ordering     |

### `picklist_values` table

| column      | type    | notes                           |
|-------------|---------|---------------------------------|
| id          | UUID    | auto-generated primary key      |
| variable_id | UUID FK | references `map_variables`      |
| label       | VARCHAR | display text                    |
| color       | VARCHAR | hex color string, auto-assigned |
| sort_order  | INTEGER | creation order                  |

### `cell_variable_values` table

| column      | type   | notes                                               |
|-------------|--------|-----------------------------------------------------|
| cell_id     | BIGINT | FK to `grid_cells` — composite PK with variable_id  |
| variable_id | UUID   | FK to `map_variables` — composite PK with cell_id   |
| value       | TEXT   | serialized value; picklist stores picklist_value id |

**Cell row upsert:** A `grid_cells` row is created (or confirmed to exist) when any user clicks a cell, regardless
of role. The client calls a upsert endpoint at selection time, before any name or variable is set. This guarantees
`cell_id` is always a valid FK by the time any variable value is saved, since the user must click a cell to edit it.
The map lockdown feature will later replace this one-by-one approach with a bulk insert of all cells at map creation
time.

Cells are not pre-populated when a variable is created. Rows are only inserted when a value is first assigned to a
cell. Clearing a value hard-deletes the row from `cell_variable_values`.

Deleting a variable hard-deletes the `map_variables` row and all related `picklist_values` and `cell_variable_values`
rows via cascade.

## UX

### DM — Managing Variables

A "Manage Variables" button is pinned to the top of the Variables tab, always visible to DM and Owner regardless of
whether a cell is selected. Clicking it expands a secondary panel that slides over or widens the existing flyout
(exact animation TBD, but should feel like a second layer opening over the tab). This panel shows:

- The list of existing variables for the map, each with Edit and Delete buttons
- A "Create New Variable" button at the bottom of the list

Creating a variable opens an inline form (within the same panel) for: name, type, visibility, display format (if
NUMERIC), and `show_color_on_cells` toggle (if PICKLIST). After saving, the new variable appears in the list
immediately.

Editing an existing variable opens the same form pre-populated. The variable type cannot be changed after creation
(changing type would invalidate existing values).

Deleting a variable shows a confirmation prompt. On confirm, all related data cascades.

For PICKLIST variables, the edit view also includes a section to add, reorder, and remove picklist values. Colors are
auto-assigned on creation; a color picker will be added in a future feature.

Closing the Manage Variables panel returns the tab to its normal state.

### DM and Players — Editing Cell Variables

When a cell is selected, the Variables tab shows all variables defined for the map below the "Manage Variables"
button. Each variable is rendered according to its type:

- TEXT: single-line text input
- TEXTAREA: multi-line plain text input
- DATE: date picker
- NUMERIC: number input styled according to display_format (% suffix, decimal rules per subtype)
- PICKLIST: dropdown of available values

Variables with `visibility = DM_ONLY` are hidden from players entirely. Variables with `visibility = PLAYER_READ` are
rendered as greyed-out, non-interactive fields for players. Variables with `visibility = PLAYER_EDIT` are fully
interactive for players.

If no value is assigned for a variable on a cell, the field is empty. Clearing a field removes the stored value row.

### Cell Tint Display

If one or more picklist variables on the map have `show_color_on_cells = true`, a per-user control appears in the map
editor (location TBD — deferred to the control panel redesign feature) allowing the user to select which picklist
variable to use as the active cell tint, or to show none. This setting is local only and not persisted.

When a cell has a value assigned for the active tint variable, the cell is rendered with a color overlay matching that
picklist value's color. Cells with no assigned value for that variable show no tint.

## Behavior

1. DM clicks "Manage Variables" → secondary panel opens over the Variables tab
2. DM creates a variable → it appears in the manage list and in all cell variable editors immediately
3. DM or player selects a cell → client upserts the `grid_cells` row; Variables tab shows all variables for that
   cell below the Manage Variables button
4. User sets a value for a variable on a cell → saves to `cell_variable_values` via REST (cell row is guaranteed
   to exist from step 3), broadcasts via WebSocket with `fieldFlags` populated from the variable's `visibility`
   setting
5. Server filters the broadcast per recipient based on `visibility` (activates the pass-through filter from #14)
6. DM deletes a variable → confirmation; on confirm, cascades all data and removes variable from all cell editors
   in real-time via WebSocket broadcast

## Phase 2 — Paint Mode

Paint mode is DM-only. The DM activates a toggle that changes cell click behavior from selection to paint. While in
paint mode, the DM selects a variable and a value, then clicks (or drags) across cells to assign that value in bulk.
Paint mode is always available to DMs regardless of the variable's `visibility` setting. Implementation deferred to
Phase 2 of this feature before shipping.

## Edge Cases

- Deleting a variable while a cell flyout is open: variable row removed from the open flyout in real-time via
  WebSocket broadcast
- Player attempts to write a DM_ONLY or PLAYER_READ variable: server rejects with 403
- Picklist value deleted while cells have that value assigned: those `cell_variable_values` rows cascade-delete;
  affected cells show empty for that variable
- Color auto-assignment collision: use a fixed palette with fallback to random hex if palette exhausted
- No variables defined on map: Variables tab shows empty state with a prompt for DM/Owner and an empty message for
  players
- Variable type cannot be changed after creation; the Edit form disables the type selector for existing variables

## Open Questions

None — all design decisions finalized.
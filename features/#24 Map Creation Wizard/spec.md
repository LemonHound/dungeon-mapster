# Map Creation Wizard

## Status

Draft

## Purpose

Currently, a map's image and grid overlay can be modified at any time. Once a map is being actively used in a campaign,
changing the image or grid configuration would invalidate all placed cell data and variable values. This feature
introduces a deliberate setup-then-lock workflow: the DM configures the map image and grid overlay to their
satisfaction, then locks it. After locking, the image and grid are immutable and the map is considered "in play."

Additionally, the current new-map flow drops users directly into the editor without guidance. A better creation flow
should walk the DM through the required setup steps before reaching the editor.

## UX

TBD — key questions to resolve during design:

- What does the new map creation flow look like? (wizard vs. immediate editor with prompts)
- What is the visual treatment of a locked map in the editor? (locked controls greyed out, lock icon, banner?)
- Can the DM unlock a map? If so, what warnings are shown about data loss risk?
- Where does the lock action live in the editor UI?

## Behavior

TBD — key behaviors to define:

- Steps in the new map creation flow (upload image, configure grid, confirm and lock)
- What "locked" prevents: image re-upload, grid type changes, grid size changes, grid offset changes
- What "locked" does not prevent: cell variable edits, member management, map name changes
- How cells outside the map image bounds are handled at lock time (drop vs. keep)
- Server enforcement of the locked state (reject mutations to locked fields)

## Edge Cases

TBD

## Open Questions

- Should locking be reversible? If yes, what data-loss warnings are shown and what gets cleared?
- Do we drop out-of-bounds cells at lock time, or lazily (i.e. stop rendering them but keep the rows)?
- Is there a distinction between "setup mode" (pre-lock) and "play mode" (post-lock) beyond the locked fields?
- Should players see any indication that a map is locked/finalized?
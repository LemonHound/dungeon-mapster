# Mobile & Tablet Touch Controls

## Status

Documentation

## Purpose

Add touch gesture support to the map canvas so mobile and tablet users can interact with the map using the same
interactions available to desktop users via mouse and scroll wheel.

## UX

Touch gestures map directly to existing mouse interactions. No UI layout changes are included in this feature.

| Gesture                 | Mouse equivalent                                                                                                              |
|-------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| Tap                     | Click — selects a grid cell (when grid is locked)                                                                             |
| Single-finger drag      | Click + drag — pans the map (or moves grid if unlocked)                                                                       |
| Two-finger pinch/spread | Scroll wheel — zooms centered on the midpoint of the two fingers, while simultaneously panning so the midpoint stays anchored |

## Behavior

**Single touch (one finger):**

- `touchstart`: record start position and time; mark as potential tap
- `touchmove`: pan the map using the delta from the previous touch position, using the same offset logic as
  `mousemove`. If cumulative movement exceeds a small threshold (~5px), the gesture is no longer a tap candidate.
- `touchend`: if no significant movement occurred and duration < 200ms, treat as a tap and call `handleCellClick()`
  with the touch position. `handleCellClick(x, y)` takes canvas-relative coordinates, so pass
  `touch.clientX - rect.left` and `touch.clientY - rect.top` (same as the `mouseup` handler). Otherwise, if grid
  is unlocked, trigger auto-save (same as `mouseup` path).

**Two-finger touch (pinch/spread):**

- `touchstart` (second finger joins): record both touch positions. Reset pan tracking to use midpoint.
- `touchmove`: on each frame, compute:
    1. Current midpoint of the two fingers
    2. Current distance between the two fingers
    3. Pan delta = current midpoint minus previous midpoint → apply to offsets (same logic as single-finger drag)
    4. Zoom ratio = current distance / previous distance → apply as a scale multiplier centered on the current midpoint,
       using the same offset math as the `wheel` handler (raw ratio, not a fixed intensity multiplier)
    5. Update previous midpoint and distance for next frame
- Scale is clamped to `[0.1, 5]` matching the wheel handler
- `touchend` (one finger lifts): if one finger remains, transition back to single-finger pan mode using the
  remaining touch as the new anchor; do not treat this as a tap

**More than two touches:** ignore entirely — do nothing, do not reset state.

**`touchcancel`:** treat the same as `touchend`; reset all gesture state.

## Implementation Notes

- Add `setupTouchEvents()` as a separate private method in both `map-editor.ts` and `demo-map-editor.ts`, called
  alongside `setupMouseEvents()` in `ngAfterViewInit`
- All touch events are registered on `this.gridCanvas`, same as mouse events
- Call `e.preventDefault()` on `touchstart` and `touchmove` to suppress browser scroll, zoom, and tap-highlight
  behaviors
- Add `touch-action: none` to `.grid-canvas` in `map-editor.css`. `demo-map-editor.ts` uses the same
  `map-editor.css` via its `styleUrl`, so no separate CSS change is needed there.
  to prevent browser default gesture handling before JS fires
- The zoom-centered-on-point math for pinch mirrors the `wheel` handler exactly. The `wheel` handler branches
  on `this.gridLocked` and updates different variables in each path — `setupTouchEvents()` must replicate this
  same branching:
  - Grid locked: update `scale`, `offsetX/Y`, and mirror to `gridOffsetX/Y` + `gridOffsetRatioX/Y`
  - Grid unlocked: update `gridScale` and `gridOffsetX/Y` only

  ```
  newScale = clamp(oldScale * distanceRatio, 0.1, 5)
  scaleChange = newScale / oldScale
  offsetX = midX - (midX - offsetX) * scaleChange
  offsetY = midY - (midY - offsetY) * scaleChange
  ```
  (`offsetX/Y` and `oldScale` above refer to whichever pair is active for the current lock state.)
  Pan delta is applied first, then zoom, within the same `touchmove` handler to keep both in sync.

## Edge Cases

- Second finger joins mid-drag: reset to pinch mode; use current midpoint as new anchor to avoid position snap
- One finger lifts during pinch: transition to single-finger pan using the remaining touch; do not fire a tap
- `touchcancel` (e.g., incoming call, notification): reset all state cleanly
- Zero-distance pinch (fingers on same point): guard against divide-by-zero when computing ratio; skip zoom update
  if distance is 0
- Auto-save trigger: only fires on single-finger drag end when grid is unlocked, matching the `mouseup` behavior

## Testing

**Browser DevTools emulation (Chrome/Firefox device toolbar)**

Suitable for: layout at mobile screen sizes, CSS media queries, single-finger tap and drag.

Not suitable for: pinch zoom (DevTools cannot simulate two simultaneous touch points), Safari-specific behavior,
system-level gesture conflicts on iOS.

**Android Studio emulator**

Free and local. Runs real Android Chrome in a software VM. Supports multi-touch pinch simulation by holding Alt
(Windows/Linux) or Option (Mac) while dragging — this generates two symmetrical touch points. Use this to verify
the full pinch zoom + pan behavior before deploying to real devices.

Setup: install Android Studio, create a virtual device (Pixel, API 34+), launch the emulator, open Chrome, navigate
to the local dev server.

**BrowserStack (or equivalent cloud device farm)**

Streams a real physical device to your browser. Required for accurate iOS Safari testing and any scenario where
Safari-specific quirks need to be validated. Has a free trial. Use this to verify:

- `preventDefault()` on touch events behaves correctly (Safari enforces passive listener rules differently)
- Pinch zoom doesn't trigger the browser's native page zoom (requires correct `<meta viewport>` tag)
- Rubber-band scroll / momentum scroll doesn't interfere with canvas panning
- Overall feel on a real iOS device

**Windows touch screen (if available)**

Any Windows laptop with a touch screen running Chrome or Edge will exercise real `PointerEvent`-based touch.
Useful as an additional smoke test if accessible.

**Recommended test sequence**

1. DevTools emulation — tap, drag, layout at 375px and 768px widths
2. Android Studio emulator — pinch zoom, single-finger drag, tap-to-select
3. BrowserStack (real iPhone/Safari) — all gestures, with attention to Safari quirks
4. Physical Android device if available — sanity check on real hardware

**Viewport meta tag — browser zoom disabled**

`index.html` must include `user-scalable=no` and `maximum-scale=1` in the viewport meta tag to prevent the browser's
native pinch-to-zoom from intercepting gestures before the canvas touch handler sees them. Without this, iOS Safari
in particular will handle pinch as a page zoom rather than dispatching touch events to the app.

```html

<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
```

Rationale: the only content users would want to zoom is the map itself, which is controlled by the in-app pinch and
scroll wheel gestures. UI elements (buttons, panels) will rely on other accessibility mechanisms such as `tabIndex`
and sufficient tap target sizing rather than browser zoom.

**Key scenarios to verify across all platforms**

- Tap selects a cell (when grid locked), does not trigger drag
- Single-finger drag pans the map; auto-save triggers after drag ends (grid unlocked)
- Pinch zooms centered on finger midpoint; simultaneous pan keeps midpoint anchored
- Second finger joining mid-drag transitions to pinch without position snap
- One finger lifting during pinch transitions back to single-finger pan without firing a tap
- Three or more simultaneous touches do nothing
- No browser-native zoom or scroll occurs during any gesture on canvas

## Open Questions

None.
# Responsive Design & UI Consistency

## Problem

The app is desktop-first with no mobile breakpoints. Confirmed issues on mobile (portrait, Pixel/Android):

1. The right flyout panel only covers ~60% of the screen instead of the full width.
2. Bottom-positioned UI elements (FAB, tint selector) are clipped by the Android system navigation bar.

A broader audit also surfaced layout and visual inconsistencies affecting all devices:

3. The maps-list page uses a light theme (`#f8f9fa`, white cards) while the header and map editor are dark — a jarring visual break on every navigation.
4. The maps-list page uses Bootstrap-esque button colors (blue, green, red, yellow) inconsistent with the app's orange palette.
5. Button styles are defined independently per page/section with no shared system.
6. The flyout panel has no backdrop — users have no affordance for dismissal by clicking outside, and no mechanism to do so.
7. Multiple banners (demo, cache-stale, reconnecting) can appear simultaneously with undefined stacking.
8. The maps-list page header row (title + create button + join input) has no mobile layout.

## Goals

- Flyout panel covers the full screen on mobile, with standard backdrop-dismiss behavior.
- No UI elements obscured by system chrome on any device.
- Header remains usable at all screen sizes.
- Consistent dark theme across all pages.
- Unified button classes used everywhere.
- Defined banner stacking behavior.

## Non-Goals

- CSS design token / variable system — separate feature.
- Theme toggle on user profile — separate feature (requires user profile page).
- Redesigning the map editor layout for tablet in landscape (canvas + 55% panel is acceptable there).
- Touch gesture support (pinch-to-zoom, swipe) — separate effort.
- Home page redesign — separate effort.

## Breakpoints

Used consistently across all components:

| Name    | Max Width | Target                             |
|---------|-----------|------------------------------------|
| mobile  | 480px     | Portrait phone                     |
| tablet  | 768px     | Landscape phone / portrait tablet  |
| desktop | (none)    | Everything wider                   |

---

## Changes

### 1. Viewport Meta (`index.html`)

Add `viewport-fit=cover` to allow content to render under system bars (required for safe-area insets):

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
```

### 2. Global Safe-Area Insets & Viewport Height (`styles.css`)

`100vh` on Android Chrome includes the browser toolbar, causing overflow. Use `100dvh` with `100vh` fallback. Expose safe-area values as CSS variables so components don't inline `env()` calls directly:

```css
:root {
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-top: env(safe-area-inset-top, 0px);
}

body {
  height: 100vh;
  height: 100dvh;
}
```

Apply the same `dvh` fix anywhere `height: 100vh` appears in component CSS (app.component.css, map-editor.css).

### 3. Unified Button Classes (`styles.css`)

Define a small shared button system as global utility classes. All existing per-page button styles are replaced with these.

Three variants, one size modifier:

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-primary {
  background: #f0883e;
  color: #0d1117;
}

.btn-primary:hover:not(:disabled) {
  background: #e07830;
}

.btn-secondary {
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.35);
}

.btn-danger {
  background: #e74c3c;
  color: #fff;
}

.btn-danger:hover:not(:disabled) {
  background: #c0392b;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 12px;
}
```

**Mapping of existing buttons to new classes:**

| Location | Old class | New classes |
|----------|-----------|-------------|
| Header: Login with Google | `.login-btn` | Keep as-is (branded Google button — special case) |
| Header: Logout | `.logout-btn` | `btn btn-secondary` |
| Header: DM Admin | `.header-btn-admin` | Keep custom (toggle with active state, emoji icon) |
| Maps-list: Create Map | `.create-button` | `btn btn-primary` |
| Maps-list: Join Map | join button | `btn btn-primary` |
| Maps-list: Delete | `.delete-button` | `btn btn-danger btn-sm` |
| Maps-list: Leave | `.leave-button` | `btn btn-danger btn-sm` |
| Map editor: Copy, Copy URL | `.copy-btn` | `btn btn-secondary btn-sm` |
| Map editor: Promote | `.action-btn.promote-btn` | `btn btn-primary btn-sm` |
| Map editor: Demote | `.action-btn.demote-btn` | `btn btn-secondary btn-sm` |
| Map editor: Make Owner | `.action-btn.transfer-btn` | `btn btn-secondary btn-sm` |
| Map editor: Remove | `.action-btn.remove-btn` | `btn btn-danger btn-sm` |
| Map editor: Save variable | `.save-btn` | `btn btn-primary btn-sm` |
| Map editor: Cancel | `.cancel-btn` | `btn btn-secondary btn-sm` |
| Map editor: Delete variable | `.delete-btn` | `btn btn-danger btn-sm` |
| Map editor: Add picklist value | add button | `btn btn-secondary btn-sm` |
| Map editor: Manage Variables | `.manage-variables-btn` | `btn btn-secondary` |
| Map editor: Grid type btns | `.grid-type-btn` | Keep custom (segmented control pattern) |
| Map editor: Grid lock btn | `.grid-lock-btn` | Keep custom (toggle with active state) |
| Demo banner: Log In | `.demo-banner-btn` | `btn btn-primary btn-sm` |
| Cache-stale: Dismiss | `.cache-stale-dismiss` | `btn btn-secondary btn-sm` |

Per-page button styles that are replaced can be removed from their respective CSS files.

### 4. Dark Theme for Maps-List (`maps-list.css` + `maps-list.html`)

Replace the light theme with the app's established dark palette. No structural changes — only colors and backgrounds.

Key replacements:

| Element | Before | After |
|---------|--------|-------|
| Page background | `#f8f9fa` (via app shell) | `#0d1117` |
| Card background | `#fff` | `#161b22` |
| Card border | `#ddd` | `rgba(255, 255, 255, 0.08)` |
| Card hover shadow | light shadow | `rgba(0, 0, 0, 0.4)` |
| Primary text | `#333` | `rgba(255, 255, 255, 0.85)` |
| Secondary text | `#666` | `rgba(255, 255, 255, 0.5)` |
| Section backgrounds | `#f8f9fa` | `rgba(255, 255, 255, 0.03)` |
| Join code input | light | dark (`#0d1117` bg, white border) |
| Section headings | `#2c3e50` | `rgba(255, 255, 255, 0.85)` |
| Thumbnail placeholder | light gray | `#2c2c2c` |

The app shell (`app.component.css` or `styles.css`) also needs `background: #0d1117` on the main content area so the page background extends correctly.

### 5. Flyout Panel Width & FAB Behavior (`map-editor.css`)

The panel is hardcoded to `55%`. Add breakpoints:

```css
/* existing — desktop default */
.flyout-panel { width: 55%; }
.notes-fab.panel-open { right: calc(55% + 16px); }

@media (max-width: 768px) {
  .flyout-panel { width: 80%; }
  .notes-fab.panel-open { right: calc(80% + 16px); }
}

@media (max-width: 480px) {
  .flyout-panel { width: 100%; }
  .notes-fab.panel-open { display: none; }
}
```

On mobile, the FAB is hidden while the panel is open. The `×` close button inside the flyout header is the correct dismiss mechanism for a full-screen sheet. The FAB reappears when the panel closes.

### 6. Flyout Panel Backdrop (`map-editor.css` + `map-editor.html`)

Add a clickable backdrop that closes the panel. It lives at z-index 24 — above the canvas (10) but below the flyout (25).

In the template, inside `.map-editor` before the flyout panels:

```html
@if (activePanel !== null) {
  <div class="flyout-backdrop" (click)="closePanel()"></div>
}
```

In CSS:

```css
.flyout-backdrop {
  position: absolute;
  inset: 0;
  z-index: 24;
  background: rgba(0, 0, 0, 0.4);
}
```

**Interaction note:** The backdrop sits above the grid-canvas in the stacking order. When the panel is open, the backdrop intercepts all canvas pointer events — cell selection, drag-to-pan, and zoom are unavailable until the panel is dismissed. This is the intended behavior (consistent with standard modal/sheet patterns).

**Dead code removal:** `handleCellClick` currently contains an early-exit guard added in a recent fix:

```typescript
if (this.activePanel !== null) {
  this.closePanel();
  return;
}
```

This guard is unreachable once the backdrop is in place — canvas events never propagate through the backdrop to reach the canvas handlers. Remove this guard. The behavioral result is the same (clicking the map closes the panel), but is now enforced by DOM stacking order rather than application logic. The backdrop additionally adds the dim effect and correctly blocks drag-pan and wheel-zoom while the panel is open.

### 7. Bottom-Positioned Elements (`map-editor.css`)

The FAB and tint selector sit at fixed bottom offsets that don't account for the Android nav bar or iOS home indicator:

```css
.notes-fab {
  bottom: calc(24px + var(--safe-area-bottom));
}

.tint-selector-float {
  bottom: calc(16px + var(--safe-area-bottom));
}
```

### 8. Header Mobile Layout (`header.css`)

On narrow screens the user-name text causes overflow. Hide it on mobile; retain the avatar. Tighten padding and nav font size:

```css
@media (max-width: 480px) {
  .header-content {
    padding: 0 12px;
  }

  nav a {
    font-size: 13px;
  }

  .user-name {
    display: none;
  }
}
```

### 9. Maps-List Mobile Layout (`maps-list.css`)

Stack the page header and join section vertically on mobile:

```css
@media (max-width: 480px) {
  .maps-list-container {
    padding: 1rem;
  }

  .maps-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .join-section {
    flex-direction: column;
  }

  .join-section input {
    width: 100%;
  }
}
```

### 10. Banner Stacking (`map-editor.css`)

The demo, cache-stale, and reconnecting banners all anchor near the top of the editor. When multiple appear, they overlap. Define explicit sequential top positions:

- Reconnecting banner: `top: 0` — full-width takeover, highest priority (z-index 1001)
- Demo banner: `top: 60px` (below header)
- Cache-stale banner: `top: 60px` normally; `top: 100px` when demo banner is also present

Use the existing `.has-banner` class already applied to `.map-editor` to shift the cache-stale banner:

```css
.cache-stale-banner {
  top: 60px;
}

.has-banner ~ .cache-stale-banner,
.map-editor.has-banner .cache-stale-banner {
  top: 100px;
}
```

---

## Affected Files

| File | Change |
|------|--------|
| `frontend/src/index.html` | `viewport-fit=cover` |
| `frontend/src/styles.css` | `dvh` fallback, `--safe-area-*` variables, unified `.btn` classes |
| `frontend/src/app/app.component.css` | `dvh` fallback, dark background on main content |
| `frontend/src/app/components/layout/header/header.css` | Mobile media query; remove per-class button styles replaced by `.btn` |
| `frontend/src/app/components/layout/header/header.html` | Apply `.btn` classes to logout button |
| `frontend/src/app/pages/map-editor/map-editor.css` | Flyout width breakpoints, FAB behavior, backdrop, safe-area offsets, banner stacking; remove per-class button styles replaced by `.btn` |
| `frontend/src/app/pages/map-editor/map-editor.html` | Backdrop element; apply `.btn` classes to buttons |
| `frontend/src/app/pages/map-editor/map-editor.ts` | Remove dead `if (this.activePanel !== null)` guard from `handleCellClick` |
| `frontend/src/app/pages/maps-list/maps-list.css` | Dark theme, mobile layout; remove per-class button styles replaced by `.btn` |
| `frontend/src/app/pages/maps-list/maps-list.html` | Apply `.btn` classes to buttons |

---

## Out of Scope — Future Features

- **CSS design token system**: CSS variables for colors, spacing, transitions — separate feature.
- **Theme toggle**: Light/dark switch on user profile — requires user profile page first.
- **Home page redesign**: Separate feature.

---

## Testing Checklist

- [ ] Android portrait (Pixel): FAB not clipped by nav bar
- [ ] Android portrait (Pixel): tint selector not clipped by nav bar
- [ ] Android portrait (Pixel): flyout panel covers full width
- [ ] Android portrait (Pixel): tapping backdrop closes the panel
- [ ] Android portrait (Pixel): FAB hidden while panel is open
- [ ] Android portrait (Pixel): FAB reappears after panel closes
- [ ] iOS Safari: home indicator not blocking FAB
- [ ] Tablet portrait (768px): flyout at 80%, FAB shifts to `calc(80% + 16px)`
- [ ] Tablet landscape: no regressions
- [ ] Desktop: no visual regressions
- [ ] Desktop: clicking backdrop closes panel; canvas is inactive while panel is open
- [ ] Header at 375px: no overflow, user-name hidden, avatar visible
- [ ] Maps-list at 375px: header and join section stack vertically
- [ ] Maps-list: dark theme consistent with header and map editor
- [ ] All `.btn` variants render correctly in all locations
- [ ] Disabled button state (opacity) works for all variants
- [ ] Multiple banners visible simultaneously: no overlap

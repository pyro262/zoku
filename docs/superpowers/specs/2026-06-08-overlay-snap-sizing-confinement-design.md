# Overlay: Snap, Window Sizing, Confinement

Date: 2026-06-08  
Status: Approved

## Summary

Three improvements to the Zoku overlay widget system:
1. Fix window sizing DPI bug so overlay fills the entire primary monitor
2. Widget-to-widget edge snapping during drag
3. Confinement toggle to keep widgets within screen bounds

---

## 1. Window Sizing Fix

**Problem:** `getDisplaySize()` uses `screen.getPrimaryDisplay().size` (logical pixels), which underreports the actual display area under Windows DPI scaling. Window is also hardcoded to `x:0, y:0`, which breaks if the primary monitor is not the leftmost display.

**Fix:** Replace `.size` with `.bounds`:

```js
const b = screen.getPrimaryDisplay().bounds;
return { W: b.width, H: b.height, X: b.x, Y: b.y };
```

Window creation uses `x: X, y: Y, width: W, height: H`.

`W` and `H` are sent to the renderer via a new `displaySize` IPC channel at startup and on display change events. Renderer stores them as module-level vars for use in snapping and confinement.

---

## 2. Snap-to-Widget Edges

**Threshold:** 10px

**Behavior:** During `mousemove`, after computing candidate position `(cx, cy)` for the dragged widget, check all other visible widgets' four edges. X and Y axes snap independently.

Snap axes:
- Left edge of dragged ↔ left or right edge of any target
- Right edge of dragged ↔ left or right edge of any target
- Top edge of dragged ↔ top or bottom edge of any target
- Bottom edge of dragged ↔ top or bottom edge of any target

If the closest matching edge on any other widget is within 10px, override `cx` or `cy` with the snapped value.

Widget dimensions: `getBoundingClientRect()` scaled by `--widget-scale` CSS var.

**Theme behavior:**
- **Default (consolidated):** whole panel moves as a unit; no other widgets to snap to, so snapping is skipped
- **Exterior / Interior:** full widget-to-widget snapping applies

Positions persist on `mouseup` via `saveWidgetPos` as before — snap state is purely visual during drag.

---

## 3. Confinement Toggle

**Config:** `cfg.confineWidgets` (default: `true`), persisted to `config.json`.

**Behavior:** On `mouseup`, after snap resolution, if confinement is on: clamp each widget's position:
- `x` → `[0, W - widgetWidth]`
- `y` → `[0, H - widgetHeight]`

Clamping runs after snapping, so snapped positions are also clamped.

**Consolidated mode:** clamp the panel anchor; all widgets follow.

**Toggle:** Tray menu item alongside the existing lock/unlock item — "Confine to screen". Shows current state (on/off). Calls `saveConfig()` on change.

No Options window changes needed.

---

## Files Changed

| File | Change |
|------|--------|
| `src/main.js` | `getDisplaySize()` uses `.bounds`; window `x`/`y` from bounds; send `displaySize` IPC; add confine tray item; `cfg.confineWidgets` init |
| `src/overlay/renderer.js` | `displaySize` IPC handler; snap logic in `mousemove`; confinement clamp in `mouseup` |
| `src/preload.js` | Expose `onDisplaySize` to renderer |

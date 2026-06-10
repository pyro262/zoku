# Design: FH6 Display Detection + Smart Preset Centering + Shift+Drag Group Move

**Date:** 2026-06-10  
**Status:** Approved

## Overview

Three related features for multi-monitor setups:

1. Detect which display FH6 is running on
2. Center theme presets on the correct display (FH6's display, or inherited from previous theme)
3. Shift+drag to move all visible widgets as a group in non-consolidated themes

## 1. FH6 Display Detection

### PowerShell focus watcher (`src/main.js` — `startFocusWatcher`)

Extend the existing `FocusWatch` C# class with `GetWindowRect` and a `RECT` struct:

```csharp
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
[StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
```

Change output line format from `"$name|$title"` to `"$name|$title|$left,$top,$right,$bottom"`. The rect is always emitted (for the current foreground window, whatever it is). Non-Forza lines are ignored for `forzaDisplay` update.

### main.js

- Parse the new third field (four comma-separated integers) from each PS line.
- When `isForzaLine` is true and rect is non-zero: call `screen.getDisplayMatching({ x: left, y: top, width: right - left, height: bottom - top })` and store as `forzaDisplay` (Electron `Display` object).
- `forzaDisplay` initialises as `null`. Persists the last known value after FH6 loses focus.

## 2. Preset Centering + Theme-Switch Display Inheritance

### Preset function signature

Change all preset functions from `(W, H)` to `(W, H, X = 0, Y = 0)` where `X, Y` are the virtual-desktop origin of the target display. All positions become `X + <relative>` and `Y + <relative>`. Default `X=0, Y=0` keeps existing values correct for primary display.

### `getTargetDisplay(forThemeName)`

New helper in `main.js`:

```
if forThemeName has saved layout (non-empty cfg.widgetLayouts[forThemeName]):
  return null  — saved positions used as-is, no preset centering needed

else if activeTheme has saved layout:
  compute centroid of activeTheme widget positions
  return screen.getDisplayNear(cx, cy)

else:
  return forzaDisplay ?? screen.getPrimaryDisplay()
```

### `buildThemePayload(name)`

- Call `getTargetDisplay(name)`.
- If `null`: skip preset, use saved positions only (current behaviour).
- If display returned: extract `{ bounds: { x, y, width, height } }`, pass `(width, height, x, y)` to preset function.

`getPrimarySize()` (used for Options window live-preview) is unchanged.

## 3. Shift+Drag Group Move

### `renderer.js` — mousedown handler

Extend the existing `isConsolidated` branch:

```js
const groupDrag = isConsolidated || event.shiftKey;
```

When `groupDrag` is active:
- At mousedown: snapshot `x/y` of all visible widgets.
- On mousemove: apply same `dx/dy` delta to all.
- On mouseup: call `saveWidgetPos` for every widget.
- No edge snapping in group mode (consistent with existing consolidated behaviour).

In consolidated theme, shift+drag is a no-op difference (already group mode). In Exterior/Interior, it activates group mode on demand. No cursor change or visual affordance needed.

## Unchanged

- `getPrimarySize()` — still used for Options window centering
- Saved widget positions — always restored as-is, unaffected by display detection
- `getDisplaySize()` — overlay still spans all displays
- Session recording, UDP parser, focus hide logic

## Files Changed

| File | Change |
|------|--------|
| `src/main.js` | PS script: add `GetWindowRect`; parse rect field; add `forzaDisplay`; add `getTargetDisplay()`; update `buildThemePayload()` and preset calls |
| `src/overlay/renderer.js` | Extend mousedown: `groupDrag = isConsolidated \|\| event.shiftKey` |
| `src/main.js` (THEMES object, lines ~32–85) | Add `X=0, Y=0` params to all three preset functions; offset all positions |

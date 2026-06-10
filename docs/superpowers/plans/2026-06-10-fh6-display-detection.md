# FH6 Display Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect which display FH6 is running on, center theme presets on that display, inherit display from the active theme when switching to an unsaved layout, and add Shift+drag to move all visible widgets as a group.

**Architecture:** Extend the existing PowerShell focus watcher to also emit the FH6 window rect via `GetWindowRect`; store the matched Electron `Display` object as `forzaDisplay`. A new `getTargetDisplay()` helper picks the centering target when a preset is needed. THEMES preset functions gain `X, Y` origin params so positions offset into the correct display. Renderer mousedown activates group-drag when `e.shiftKey` is true, mirroring the existing consolidated-mode path.

**Tech Stack:** Electron (main/renderer process), PowerShell (Win32 via C# DllImport), Node.js

> **Note:** No automated test framework exists. Test steps are manual — run on a Windows machine with FH6 available, or with any window open to simulate multi-monitor behavior.

---

## File Map

| File | What changes |
|------|-------------|
| `src/main.js:86–103` | Add `let forzaDisplay = null;` |
| `src/main.js:131–155` | PS script — add `GetWindowRect` + `RECT` struct; emit rect in output line |
| `src/main.js:172–196` | stdout parser — split on `\|` instead of `indexOf`; parse rect; update `forzaDisplay` on Forza lines |
| `src/main.js:218–244` | Replace `buildThemePayload` + add `getTargetDisplay()` helper above it |
| `src/main.js:32–84` | THEMES preset functions — add `X = 0, Y = 0` params; offset all positions |
| `src/overlay/renderer.js:348–382` | `mousedown` — add `groupDrag` flag using `e.shiftKey`; pass `isDefault` into `dragState` |
| `src/overlay/renderer.js:318–345` | `mouseup` — guard `stackAnchor` update behind `dragState.isDefault` |

---

## Task 1: Extend PS watcher — emit FH6 window rect

**Files:**
- Modify: `src/main.js:86–103` (add `forzaDisplay` variable)
- Modify: `src/main.js:131–155` (PS script body)
- Modify: `src/main.js:172–196` (stdout parser)

- [ ] **Step 1: Declare `forzaDisplay` alongside other state variables**

In `src/main.js`, after line 102 (`let inRace = false;`), add:

```js
let forzaDisplay   = null;
```

- [ ] **Step 2: Add `GetWindowRect` and `RECT` struct to the PS C# class**

In `src/main.js`, replace the `const script = [...]` block (lines 131–155) with:

```js
  const script = [
    'Add-Type @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'using System.Text;',
    'public class FocusWatch {',
    '    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
    '    [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int pid);',
    '    [DllImport("user32.dll", CharSet=CharSet.Unicode)]',
    '    public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int n);',
    '    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);',
    '    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }',
    '}',
    '"@',
    'while ($true) {',
    '    $hwnd = [FocusWatch]::GetForegroundWindow()',
    '    $pid  = 0',
    '    [FocusWatch]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null',
    '    $p    = Get-Process -Id $pid -ErrorAction SilentlyContinue',
    '    $sb   = New-Object System.Text.StringBuilder 256',
    '    [FocusWatch]::GetWindowText($hwnd, $sb, 256) | Out-Null',
    '    $name = if ($p) { $p.ProcessName } else { "" }',
    '    $rect = New-Object FocusWatch+RECT',
    '    [FocusWatch]::GetWindowRect($hwnd, [ref]$rect) | Out-Null',
    '    [Console]::Out.WriteLine("$name|$($sb.ToString())|$($rect.Left),$($rect.Top),$($rect.Right),$($rect.Bottom)")',
    '    [Console]::Out.Flush()',
    '    Start-Sleep -Milliseconds 500',
    '}',
  ].join('\n');
```

- [ ] **Step 3: Update the stdout line parser**

In `src/main.js`, replace lines 177–181 (the `trimmed`/`sep`/`procName`/`winTitle` block inside the `for (const line of lines)` loop):

```js
      const trimmed  = line.trim();
      const parts    = trimmed.split('|');
      const procName = (parts[0] ?? '').toLowerCase();
      const winTitle = (parts[1] ?? '').toLowerCase();
      const rectStr  = parts[2] ?? '';
```

- [ ] **Step 4: Update `forzaDisplay` when FH6 is in focus**

In `src/main.js`, inside the `if (isForzaLine)` branch (currently lines 185–187), add the rect parse after the existing lines:

```js
      if (isForzaLine) {
        if (focusHideTimer) { clearTimeout(focusHideTimer); focusHideTimer = null; }
        if (!forzaFocused) { forzaFocused = true; syncOverlayVisibility(); }
        const coords = rectStr.split(',').map(Number);
        if (coords.length === 4 && coords.every(n => !isNaN(n))) {
          const [l, t, r, b] = coords;
          if (r > l && b > t) {
            forzaDisplay = screen.getDisplayMatching({ x: l, y: t, width: r - l, height: b - t });
          }
        }
      }
```

- [ ] **Step 5: Manual smoke test**

On Windows: `npm start`, open any window (e.g. Notepad), switch to it, then switch back to Zoku/FH6. In main process DevTools console (or add a temporary `console.log(forzaDisplay?.id)` after the assignment), verify `forzaDisplay` is populated and matches the display FH6 is on. Remove the log after confirming.

- [ ] **Step 6: Commit**

```bash
git add src/main.js
git commit -m "feat: extend PS focus watcher with GetWindowRect to track forzaDisplay"
```

---

## Task 2: Add `getTargetDisplay()` + update `buildThemePayload()`

**Files:**
- Modify: `src/main.js:218–244`

- [ ] **Step 1: Replace `buildThemePayload` with updated version + add `getTargetDisplay` above it**

In `src/main.js`, replace the entire `getPrimarySize()` and `buildThemePayload()` functions (lines 230–244) with:

```js
function getPrimarySize() {
  const b = screen.getPrimaryDisplay().bounds;
  return { W: b.width, H: b.height };
}

function getTargetDisplay(forThemeName) {
  const hasSaved = Object.values(cfg.widgetLayouts?.[forThemeName] ?? {})
    .some(w => typeof w.x === 'number');
  if (hasSaved) return null;

  const prevPositions = Object.values(cfg.widgetLayouts?.[activeTheme] ?? {})
    .filter(w => typeof w.x === 'number');
  if (prevPositions.length > 0) {
    const cx = Math.round(prevPositions.reduce((s, p) => s + p.x, 0) / prevPositions.length);
    const cy = Math.round(prevPositions.reduce((s, p) => s + p.y, 0) / prevPositions.length);
    return screen.getDisplayNear(cx, cy);
  }

  return forzaDisplay ?? screen.getPrimaryDisplay();
}

function buildThemePayload(name) {
  const saved = cfg.widgetLayouts?.[name] ?? {};
  const targetDisplay = getTargetDisplay(name);
  let W = 0, H = 0, X = 0, Y = 0;
  if (targetDisplay) {
    ({ x: X, y: Y, width: W, height: H } = targetDisplay.bounds);
  }
  const preset = (THEMES[name] ?? THEMES.default)(W, H, X, Y);
  const widgets = {};
  for (const id of Object.keys(preset)) {
    widgets[id] = { ...preset[id], ...(saved[id] ?? {}) };
  }
  return { name, widgets };
}
```

- [ ] **Step 2: Manual test — preset centering on primary (baseline)**

On Windows with single monitor: `npm start`. Delete any saved layout for `exterior` from `%APPDATA%\Zoku\config.json` (`widgetLayouts.exterior` key). Switch to Exterior theme via `Ctrl+Shift+F7`. Widgets should appear centered on the primary display as before — no regression.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: add getTargetDisplay() and update buildThemePayload to center on FH6 display"
```

---

## Task 3: Update THEMES presets to accept `X, Y` origin offset

**Files:**
- Modify: `src/main.js:32–84`

- [ ] **Step 1: Update `default` preset**

Replace lines 33–48:

```js
  default: (W, H, X = 0, Y = 0) => ({
    'w-race':       { x: X + 20, y: Y + 20, visible: true  },
    'w-stats':      { x: X + 20, y: Y + 20, visible: true  },
    'w-rpm':        { x: X + 20, y: Y + 20, visible: true  },
    'w-inputs':     { x: X + 20, y: Y + 20, visible: true  },
    'w-tires':      { x: X + 20, y: Y + 20, visible: true  },
    'w-suspension': { x: X + 20, y: Y + 20, visible: false },
    'w-gmeter':     { x: X + 20, y: Y + 20, visible: false },
    'w-laptimes':   { x: X + 20, y: Y + 20, visible: false },
    'w-boost':      { x: X + 20, y: Y + 20, visible: false },
    'w-steering':   { x: X + 20, y: Y + 20, visible: false },
    'w-clutch':     { x: X + 20, y: Y + 20, visible: false },
    'w-tireslip':   { x: X + 20, y: Y + 20, visible: false },
    'w-wheelspeed': { x: X + 20, y: Y + 20, visible: false },
    'w-fuel':       { x: X + 20, y: Y + 20, visible: false },
  }),
```

- [ ] **Step 2: Update `exterior` preset**

Replace lines 50–65:

```js
  // Exterior — status bar top-center, big cluster at bottom-center (tires below inputs)
  exterior: (W, H, X = 0, Y = 0) => ({
    'w-race':       { x: X + Math.round(W / 2 - 150), y: Y + 20,                         visible: true  },
    'w-stats':      { x: X + Math.round(W / 2 - 150), y: Y + Math.round(H * 0.65),       visible: true  },
    'w-rpm':        { x: X + Math.round(W / 2 - 150), y: Y + Math.round(H * 0.65) + 110, visible: true  },
    'w-inputs':     { x: X + Math.round(W / 2 - 150), y: Y + Math.round(H * 0.65) + 150, visible: true  },
    'w-tires':      { x: X + Math.round(W / 2 - 150), y: Y + Math.round(H * 0.65) + 185, visible: true  },
    'w-suspension': { x: X + 20,                       y: Y + Math.round(H / 2 - 100),    visible: false },
    'w-gmeter':     { x: X + 20,                       y: Y + Math.round(H * 0.65),       visible: false },
    'w-laptimes':   { x: X + Math.round(W - 310),      y: Y + 20,                         visible: false },
    'w-boost':      { x: X + Math.round(W - 310),      y: Y + 120,                        visible: false },
    'w-steering':   { x: X + Math.round(W / 2 - 150), y: Y + Math.round(H * 0.65) + 330, visible: false },
    'w-clutch':     { x: X + 20,                       y: Y + Math.round(H * 0.65) + 50,  visible: false },
    'w-tireslip':   { x: X + Math.round(W - 310),      y: Y + Math.round(H * 0.65) + 150, visible: false },
    'w-wheelspeed': { x: X + Math.round(W - 310),      y: Y + Math.round(H * 0.65) + 250, visible: false },
    'w-fuel':       { x: X + Math.round(W / 2 + 160),  y: Y + H - 60,                     visible: false },
  }),
```

- [ ] **Step 3: Update `interior` preset**

Replace lines 67–83:

```js
  // Interior — compact strip at screen bottom, all at 300 px wide, centered
  // Heights (approximate, interior CSS overrides): race≈22, stats≈75, rpm≈34, inputs≈49
  interior: (W, H, X = 0, Y = 0) => ({
    'w-race':       { x: X + Math.round(W / 2 - 150), y: Y + H - 161, visible: true  },
    'w-stats':      { x: X + Math.round(W / 2 - 150), y: Y + H - 139, visible: true  },
    'w-rpm':        { x: X + Math.round(W / 2 - 150), y: Y + H - 64,  visible: true  },
    'w-inputs':     { x: X + Math.round(W / 2 + 160), y: Y + H - 139, visible: true  },
    'w-tires':      { x: X + 0,                        y: Y + 0,       visible: false },
    'w-suspension': { x: X + 0,                        y: Y + 0,       visible: false },
    'w-gmeter':     { x: X + 20,                       y: Y + H - 108, visible: false },
    'w-laptimes':   { x: X + Math.round(W / 2 - 150), y: Y + H - 230, visible: false },
    'w-boost':      { x: X + Math.round(W - 290),      y: Y + H - 130, visible: false },
    'w-steering':   { x: X + Math.round(W / 2 + 160), y: Y + H - 161, visible: false },
    'w-clutch':     { x: X + Math.round(W / 2 + 160), y: Y + H - 90,  visible: false },
    'w-tireslip':   { x: X + 20,                       y: Y + H - 210, visible: false },
    'w-wheelspeed': { x: X + 20,                       y: Y + H - 380, visible: false },
    'w-fuel':       { x: X + Math.round(W - 290),      y: Y + H - 60,  visible: false },
  }),
```

- [ ] **Step 4: Manual test — single monitor no regression**

On Windows single monitor: delete all saved layouts from config.json. `npm start`. Cycle through all three themes with `Ctrl+Shift+F7`. Verify each theme's widgets appear in expected positions (same as before this change).

- [ ] **Step 5: Manual test — multi-monitor preset centering**

On Windows with two monitors (or simulate by moving FH6 to the secondary display): delete saved layouts. Open FH6 on secondary display. Switch to Exterior or Interior theme via `Ctrl+Shift+F7`. Verify widgets appear centered on FH6's display rather than the primary display.

- [ ] **Step 6: Manual test — theme-switch display inheritance**

With two monitors: save Exterior layout positions on secondary display (drag any widget). Switch to Interior theme (no saved layout). Verify Interior preset centers on the secondary display (inheriting from Exterior's centroid), not primary.

- [ ] **Step 7: Commit**

```bash
git add src/main.js
git commit -m "feat: offset theme presets by display origin for multi-monitor centering"
```

---

## Task 4: Shift+drag group move in renderer.js

**Files:**
- Modify: `src/overlay/renderer.js:348–382` (mousedown)
- Modify: `src/overlay/renderer.js:318–345` (mouseup)

- [ ] **Step 1: Update mousedown to activate group drag on Shift+click**

In `src/overlay/renderer.js`, replace the `mousedown` handler (lines 348–383):

```js
document.querySelectorAll('.widget-drag').forEach((handle) => {
  handle.addEventListener('mousedown', (e) => {
    if (!document.body.classList.contains('unlocked')) return;
    const isConsolidated = document.body.dataset.theme === 'default';
    const groupDrag = isConsolidated || e.shiftKey;

    if (groupDrag) {
      const bg = $('panel-bg');
      dragState = {
        consolidated: true,
        isDefault: isConsolidated,
        widgets: Array.from(document.querySelectorAll('.widget:not(.hidden)')).map((w) => ({
          el: w,
          origX: parseInt(w.style.left) || 0,
          origY: parseInt(w.style.top)  || 0,
        })),
        bgOrigX: parseInt(bg?.style.left) || 0,
        bgOrigY: parseInt(bg?.style.top)  || 0,
        startX: e.clientX,
        startY: e.clientY,
      };
    } else {
      const widget = handle.closest('.widget');
      const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--widget-scale')) || 1;
      dragState = {
        consolidated: false,
        isDefault: false,
        widget,
        startX: e.clientX,
        startY: e.clientY,
        origX: parseInt(widget.style.left) || 0,
        origY: parseInt(widget.style.top)  || 0,
        scale,
        snapTargets: Array.from(document.querySelectorAll('.widget:not(.hidden)')).filter((el) => el !== widget),
      };
    }
    e.preventDefault();
  });
});
```

- [ ] **Step 2: Guard stackAnchor update in mouseup behind `isDefault`**

In `src/overlay/renderer.js`, replace the `mouseup` handler (lines 318–346):

```js
document.addEventListener('mouseup', () => {
  if (!dragState) return;
  const scale = dragState.scale ?? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--widget-scale')) || 1);
  if (dragState.consolidated) {
    clampConsolidated(dragState.widgets, scale);
    for (const w of dragState.widgets) {
      const x = parseInt(w.el.style.left) || 0;
      const y = parseInt(w.el.style.top)  || 0;
      window.fh6.saveWidgetPos(w.el.id, x, y);
    }
    if (dragState.isDefault) {
      const topWidget = dragState.widgets.reduce((a, b) =>
        (parseInt(a.el.style.top) || 0) < (parseInt(b.el.style.top) || 0) ? a : b
      );
      stackAnchor = {
        x: parseInt(topWidget.el.style.left) || stackAnchor.x,
        y: parseInt(topWidget.el.style.top)  || stackAnchor.y,
      };
      requestAnimationFrame(updatePanelBg);
    }
  } else {
    const rawX = parseInt(dragState.widget.style.left) || 0;
    const rawY = parseInt(dragState.widget.style.top)  || 0;
    const { x, y } = clampWidget(dragState.widget, rawX, rawY, scale);
    dragState.widget.style.left = x + 'px';
    dragState.widget.style.top  = y + 'px';
    window.fh6.saveWidgetPos(dragState.widget.id, x, y);
    requestAnimationFrame(updatePanelBg);
  }
  dragState = null;
});
```

- [ ] **Step 3: Manual test — Shift+drag in Exterior theme**

On Windows: `npm start`, unlock overlay (tray → Unlock). Switch to Exterior theme. Hold Shift and drag any widget handle. Verify ALL visible widgets move together as a group. Release — verify positions saved correctly (reload Zoku, widgets should be in new positions).

- [ ] **Step 4: Manual test — Shift+drag in Interior theme**

Same as Step 3 but in Interior theme. Verify group-drag behavior.

- [ ] **Step 5: Manual test — Default theme unaffected**

In Default theme: drag without Shift — should move the whole consolidated panel (no change from before). Drag with Shift — should also move the whole panel (no different behavior).

- [ ] **Step 6: Manual test — normal per-widget drag still works**

In Exterior or Interior theme, drag a widget WITHOUT holding Shift. Verify only that single widget moves, snapping and clamping work as before.

- [ ] **Step 7: Commit**

```bash
git add src/overlay/renderer.js
git commit -m "feat: shift+drag moves all visible widgets as a group in non-consolidated themes"
```

---

## Task 5: Version bump + release prep

**Files:**
- Modify: `package.json` (version)
- Modify: `src/main.js` (version string if hardcoded)
- Modify: `CLAUDE.md` (current state section)

- [ ] **Step 1: Bump version to v0.2.8**

In `package.json`, change `"version": "0.2.7"` to `"version": "0.2.8"`.

- [ ] **Step 2: Check for hardcoded version strings**

```bash
grep -rn "0\.2\.7" src/ --include="*.js"
```

Update any hits to `0.2.8`.

- [ ] **Step 3: Update CLAUDE.md current state section**

In `fh6-tools/CLAUDE.md`, update the `## Current state (v0.2.7)` heading to `v0.2.8` and prepend to the bullet list:

```
- FH6 display detection: PS focus watcher emits `GetWindowRect` each tick; main.js stores matched Electron display as `forzaDisplay`
- Theme preset centering: presets accept `(W, H, X, Y)` origin; `getTargetDisplay()` returns FH6's display (no saved layout) or previous theme's centroid display (theme switch); falls back to primary
- Shift+drag group move: holding Shift while dragging any widget handle moves all visible widgets together (Exterior/Interior themes); Default theme unaffected
```

- [ ] **Step 4: Commit**

```bash
git add package.json src/main.js CLAUDE.md
git commit -m "chore: bump version to v0.2.8"
```

- [ ] **Step 5: Follow release workflow**

Per project convention: build installer, copy to NAS, push, create GitHub release.

```bash
npm run build
cp dist/Zoku\ Setup\ 0.2.8.exe /media/projects/zoku/dist/
git push
gh release create v0.2.8 /media/projects/zoku/dist/Zoku\ Setup\ 0.2.8.exe \
  --title "v0.2.8" \
  --notes "- Detects which display FH6 is running on; theme presets center on FH6's display
- Switching to a theme with no saved layout inherits the display from the active theme
- Shift+drag on any widget handle moves all visible widgets as a group (Exterior/Interior themes)"
```

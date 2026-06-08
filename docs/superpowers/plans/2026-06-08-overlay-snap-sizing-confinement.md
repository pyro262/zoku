# Overlay: Snap, Window Sizing, Confinement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix DPI window sizing, add widget-to-widget edge snapping during drag, and add a confinement toggle to keep widgets within screen bounds.

**Architecture:** Three focused changes to two files (`main.js`, `renderer.js`) plus a small addition to `preload.js`. Window sizing fix goes in `getDisplaySize()` and `createOverlay()`. Snap and confinement logic lives entirely in the renderer's drag handlers. A new `displaySize` IPC channel carries `{W, H}` to the renderer; a `confine` channel carries the boolean toggle.

**Tech Stack:** Electron (main process + renderer process), IPC via contextBridge, CSS custom properties for scale

---

## File Map

| File | Changes |
|------|---------|
| `src/main.js` | `getDisplaySize()` uses `.bounds`; window `x/y` from bounds; send `displaySize` + `confine` on dom-ready; `display-metrics-changed` handler; `cfg.confineWidgets` init; tray confine toggle |
| `src/preload.js` | Expose `onDisplaySize` and `onConfine` |
| `src/overlay/renderer.js` | Module-level `displayW`/`displayH`/`confineWidgets`; IPC handlers; `snapPosition()`; `clampWidget()`; `clampConsolidated()`; updated `mousemove` + `mouseup` |

---

## Task 1: Fix `getDisplaySize()` and window bounds

**Files:**
- Modify: `src/main.js:212-214` (`getDisplaySize`)
- Modify: `src/main.js:302-308` (window creation x/y)

- [ ] **Step 1: Replace `getDisplaySize()` to use `.bounds`**

  Current (`main.js:212-215`):
  ```js
  function getDisplaySize() {
    const { width, height } = screen.getPrimaryDisplay().size;
    return { W: width, H: height };
  }
  ```

  Replace with:
  ```js
  function getDisplaySize() {
    const b = screen.getPrimaryDisplay().bounds;
    return { W: b.width, H: b.height, X: b.x, Y: b.y };
  }
  ```

- [ ] **Step 2: Use `X`/`Y` in `createOverlay()` window creation**

  Current (`main.js:302-308`):
  ```js
  const { W, H } = getDisplaySize();

  overlayWin = new BrowserWindow({
    x: 0,
    y: 0,
    width: W,
    height: H,
  ```

  Replace with:
  ```js
  const { W, H, X, Y } = getDisplaySize();

  overlayWin = new BrowserWindow({
    x: X,
    y: Y,
    width: W,
    height: H,
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/main.js
  git commit -m "fix: overlay window bounds from display.bounds (fixes DPI sizing)"
  ```

---

## Task 2: Send `displaySize` and `confine` IPC + handle display changes

**Files:**
- Modify: `src/main.js:287-334` (`createOverlay`)
- Modify: `src/main.js:624-641` (`app.whenReady`)

- [ ] **Step 1: Init `cfg.confineWidgets` in `createOverlay()`**

  After `cfg.startWithWindows ??= false;` (line 298), add:
  ```js
  cfg.confineWidgets ??= true;
  ```

- [ ] **Step 2: Send `displaySize` and `confine` on `dom-ready`**

  Current `dom-ready` block (`main.js:329-333`):
  ```js
  overlayWin.webContents.on('dom-ready', () => {
    sendTheme();
    overlayWin.webContents.send('opacity', cfg.widgetOpacity);
    overlayWin.webContents.send('scale',   cfg.overlayScale);
  });
  ```

  Replace with:
  ```js
  overlayWin.webContents.on('dom-ready', () => {
    const { W, H } = getDisplaySize();
    sendTheme();
    overlayWin.webContents.send('opacity',      cfg.widgetOpacity);
    overlayWin.webContents.send('scale',        cfg.overlayScale);
    overlayWin.webContents.send('displaySize',  { W, H });
    overlayWin.webContents.send('confine',      cfg.confineWidgets ?? true);
  });
  ```

- [ ] **Step 3: Add `display-metrics-changed` listener in `app.whenReady()`**

  After `startFocusWatcher();` (line 635), add:
  ```js
  screen.on('display-metrics-changed', () => {
    if (!overlayWin || overlayWin.isDestroyed()) return;
    const { W, H, X, Y } = getDisplaySize();
    overlayWin.setBounds({ x: X, y: Y, width: W, height: H });
    overlayWin.webContents.send('displaySize', { W, H });
  });
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/main.js
  git commit -m "feat: send displaySize and confine IPC to renderer"
  ```

---

## Task 3: Add confinement tray menu toggle

**Files:**
- Modify: `src/main.js:345-460` (`updateMenu`)

- [ ] **Step 1: Add confine toggle item after the lock/unlock separator**

  In `updateMenu()`, the current structure after the lock item is:
  ```js
      { type: 'separator' },
      {
        label: 'Theme',
  ```

  Replace that separator+theme block opening with:
  ```js
      { type: 'separator' },
      {
        label: `Confine widgets to screen: ${cfg.confineWidgets ? 'On' : 'Off'}`,
        click: () => {
          cfg.confineWidgets = !cfg.confineWidgets;
          saveConfig();
          if (overlayWin && !overlayWin.isDestroyed()) {
            overlayWin.webContents.send('confine', cfg.confineWidgets);
          }
          updateMenu();
        },
      },
      { type: 'separator' },
      {
        label: 'Theme',
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/main.js
  git commit -m "feat: add confine-to-screen tray toggle"
  ```

---

## Task 4: Expose `onDisplaySize` and `onConfine` in preload

**Files:**
- Modify: `src/preload.js`

- [ ] **Step 1: Add two new IPC listeners**

  Current `preload.js` (full file):
  ```js
  const { contextBridge, ipcRenderer } = require('electron');

  contextBridge.exposeInMainWorld('fh6', {
    onTelemetry:        (cb) => ipcRenderer.on('telemetry',          (_, d) => cb(d)),
    onRaceStart:        (cb) => ipcRenderer.on('raceStart',          (_, d) => cb(d)),
    onRaceEnd:          (cb) => ipcRenderer.on('raceEnd',            (_, d) => cb(d)),
    onSessionSaved:     (cb) => ipcRenderer.on('sessionSaved',       (_, p) => cb(p)),
    onLockState:        (cb) => ipcRenderer.on('lockState',          (_, v) => cb(v)),
    onTheme:            (cb) => ipcRenderer.on('theme',              (_, d) => cb(d)),
    onWidgetVisibility: (cb) => ipcRenderer.on('widgetVisibility',   (_, d) => cb(d)),
    onOpacity:          (cb) => ipcRenderer.on('opacity',            (_, v) => cb(v)),
    onScale:            (cb) => ipcRenderer.on('scale',              (_, v) => cb(v)),
    saveWidgetPos:      (id, x, y) => ipcRenderer.send('saveWidgetPos', { id, x, y }),
  });
  ```

  Replace with:
  ```js
  const { contextBridge, ipcRenderer } = require('electron');

  contextBridge.exposeInMainWorld('fh6', {
    onTelemetry:        (cb) => ipcRenderer.on('telemetry',          (_, d) => cb(d)),
    onRaceStart:        (cb) => ipcRenderer.on('raceStart',          (_, d) => cb(d)),
    onRaceEnd:          (cb) => ipcRenderer.on('raceEnd',            (_, d) => cb(d)),
    onSessionSaved:     (cb) => ipcRenderer.on('sessionSaved',       (_, p) => cb(p)),
    onLockState:        (cb) => ipcRenderer.on('lockState',          (_, v) => cb(v)),
    onTheme:            (cb) => ipcRenderer.on('theme',              (_, d) => cb(d)),
    onWidgetVisibility: (cb) => ipcRenderer.on('widgetVisibility',   (_, d) => cb(d)),
    onOpacity:          (cb) => ipcRenderer.on('opacity',            (_, v) => cb(v)),
    onScale:            (cb) => ipcRenderer.on('scale',              (_, v) => cb(v)),
    onDisplaySize:      (cb) => ipcRenderer.on('displaySize',        (_, d) => cb(d)),
    onConfine:          (cb) => ipcRenderer.on('confine',            (_, v) => cb(v)),
    saveWidgetPos:      (id, x, y) => ipcRenderer.send('saveWidgetPos', { id, x, y }),
  });
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/preload.js
  git commit -m "feat: expose onDisplaySize and onConfine in preload"
  ```

---

## Task 5: Add display size + confine state to renderer

**Files:**
- Modify: `src/overlay/renderer.js:45-52` (module-level vars)
- Modify: `src/overlay/renderer.js:309-315` (IPC handlers section)

- [ ] **Step 1: Add module-level vars after existing vars**

  Current block (`renderer.js:45-52`):
  ```js
  let maxRpm = 8000;
  let idleRpm = 800;
  let inRace = false;
  let hasData = false;
  let noDataTimer = null;

  // Consolidated panel anchor — top-left of the whole panel, preserved across drags
  let stackAnchor = { x: 20, y: 20 };
  ```

  Replace with:
  ```js
  let maxRpm = 8000;
  let idleRpm = 800;
  let inRace = false;
  let hasData = false;
  let noDataTimer = null;
  let displayW = window.innerWidth;
  let displayH = window.innerHeight;
  let confineWidgets = true;

  // Consolidated panel anchor — top-left of the whole panel, preserved across drags
  let stackAnchor = { x: 20, y: 20 };
  ```

- [ ] **Step 2: Add IPC handlers after existing ones**

  Current IPC handler block (`renderer.js:311-315`):
  ```js
  window.fh6.onTheme((data)           => applyLayout(data));
  window.fh6.onWidgetVisibility((d)   => applyWidgetVisibility(d.id, d.visible));
  window.fh6.onLockState((locked)     => document.body.classList.toggle('unlocked', !locked));
  window.fh6.onOpacity((v) => document.documentElement.style.setProperty('--widget-opacity', v));
  window.fh6.onScale((v)   => document.documentElement.style.setProperty('--widget-scale',   v));
  ```

  Replace with:
  ```js
  window.fh6.onTheme((data)           => applyLayout(data));
  window.fh6.onWidgetVisibility((d)   => applyWidgetVisibility(d.id, d.visible));
  window.fh6.onLockState((locked)     => document.body.classList.toggle('unlocked', !locked));
  window.fh6.onOpacity((v) => document.documentElement.style.setProperty('--widget-opacity', v));
  window.fh6.onScale((v)   => document.documentElement.style.setProperty('--widget-scale',   v));
  window.fh6.onDisplaySize((d) => { displayW = d.W; displayH = d.H; });
  window.fh6.onConfine((v)     => { confineWidgets = v; });
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/overlay/renderer.js
  git commit -m "feat: receive displaySize and confine state in renderer"
  ```

---

## Task 6: Add `snapPosition()` and wire into `mousemove`

**Files:**
- Modify: `src/overlay/renderer.js:223-247` (drag section)

- [ ] **Step 1: Add `SNAP_DIST` constant and `snapPosition()` before the drag section**

  Before `// ── Drag ──` comment (`renderer.js:223`), add:
  ```js
  const SNAP_DIST = 10;

  function snapPosition(cx, cy, draggedEl, scale) {
    const dw = draggedEl.offsetWidth * scale;
    const dh = draggedEl.offsetHeight * scale;
    let bestX = null, bestXDist = SNAP_DIST + 1;
    let bestY = null, bestYDist = SNAP_DIST + 1;

    document.querySelectorAll('.widget:not(.hidden)').forEach((el) => {
      if (el === draggedEl) return;
      const tx = parseInt(el.style.left) || 0;
      const ty = parseInt(el.style.top)  || 0;
      const tw = el.offsetWidth  * scale;
      const th = el.offsetHeight * scale;

      for (const te of [tx, tx + tw]) {
        for (const [de, offset] of [[cx, 0], [cx + dw, dw]]) {
          const dist = Math.abs(de - te);
          if (dist < bestXDist) { bestXDist = dist; bestX = te - offset; }
        }
      }
      for (const te of [ty, ty + th]) {
        for (const [de, offset] of [[cy, 0], [cy + dh, dh]]) {
          const dist = Math.abs(de - te);
          if (dist < bestYDist) { bestYDist = dist; bestY = te - offset; }
        }
      }
    });

    return { x: bestX !== null ? bestX : cx, y: bestY !== null ? bestY : cy };
  }
  ```

- [ ] **Step 2: Wire `snapPosition()` into the non-consolidated `mousemove` branch**

  Current non-consolidated branch (`renderer.js:243-246`):
  ```js
  } else {
    dragState.widget.style.left = (dragState.origX + dx) + 'px';
    dragState.widget.style.top  = (dragState.origY + dy) + 'px';
  }
  ```

  Replace with:
  ```js
  } else {
    const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--widget-scale')) || 1;
    const snapped = snapPosition(dragState.origX + dx, dragState.origY + dy, dragState.widget, scale);
    dragState.widget.style.left = snapped.x + 'px';
    dragState.widget.style.top  = snapped.y + 'px';
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/overlay/renderer.js
  git commit -m "feat: widget-to-widget edge snapping during drag"
  ```

---

## Task 7: Add confinement clamp functions and wire into `mouseup`

**Files:**
- Modify: `src/overlay/renderer.js` (drag section, `mouseup` handler)

- [ ] **Step 1: Add `clampWidget()` and `clampConsolidated()` after `snapPosition()`**

  After the closing `}` of `snapPosition()`, add:
  ```js
  function clampWidget(el, x, y, scale) {
    if (!confineWidgets) return { x, y };
    const w = el.offsetWidth  * scale;
    const h = el.offsetHeight * scale;
    return {
      x: Math.max(0, Math.min(displayW - w, x)),
      y: Math.max(0, Math.min(displayH - h, y)),
    };
  }

  function clampConsolidated(widgets, scale) {
    if (!confineWidgets) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const w of widgets) {
      const x = parseInt(w.el.style.left) || 0;
      const y = parseInt(w.el.style.top)  || 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w.el.offsetWidth  * scale);
      maxY = Math.max(maxY, y + w.el.offsetHeight * scale);
    }
    let dx = 0, dy = 0;
    if (minX < 0) dx = -minX;
    else if (maxX > displayW) dx = displayW - maxX;
    if (minY < 0) dy = -minY;
    else if (maxY > displayH) dy = displayH - maxY;
    if (dx === 0 && dy === 0) return;
    for (const w of widgets) {
      w.el.style.left = (parseInt(w.el.style.left) + dx) + 'px';
      w.el.style.top  = (parseInt(w.el.style.top)  + dy) + 'px';
    }
    stackAnchor.x += dx;
    stackAnchor.y += dy;
  }
  ```

- [ ] **Step 2: Replace the `mouseup` handler to clamp before saving**

  Current full `mouseup` handler (`renderer.js:249-273`):
  ```js
  document.addEventListener('mouseup', () => {
    if (!dragState) return;
    if (dragState.consolidated) {
      for (const w of dragState.widgets) {
        const x = parseInt(w.el.style.left) || 0;
        const y = parseInt(w.el.style.top)  || 0;
        window.fh6.saveWidgetPos(w.el.id, x, y);
      }
      // Update anchor from topmost visible widget after drag
      const topWidget = dragState.widgets.reduce((a, b) =>
        (parseInt(a.el.style.top) || 0) < (parseInt(b.el.style.top) || 0) ? a : b
      );
      stackAnchor = {
        x: parseInt(topWidget.el.style.left) || stackAnchor.x,
        y: parseInt(topWidget.el.style.top)  || stackAnchor.y,
      };
      requestAnimationFrame(updatePanelBg);
    } else {
      const x = parseInt(dragState.widget.style.left) || 0;
      const y = parseInt(dragState.widget.style.top)  || 0;
      window.fh6.saveWidgetPos(dragState.widget.id, x, y);
      requestAnimationFrame(updatePanelBg);
    }
    dragState = null;
  });
  ```

  Replace with:
  ```js
  document.addEventListener('mouseup', () => {
    if (!dragState) return;
    const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--widget-scale')) || 1;
    if (dragState.consolidated) {
      clampConsolidated(dragState.widgets, scale);
      for (const w of dragState.widgets) {
        const x = parseInt(w.el.style.left) || 0;
        const y = parseInt(w.el.style.top)  || 0;
        window.fh6.saveWidgetPos(w.el.id, x, y);
      }
      const topWidget = dragState.widgets.reduce((a, b) =>
        (parseInt(a.el.style.top) || 0) < (parseInt(b.el.style.top) || 0) ? a : b
      );
      stackAnchor = {
        x: parseInt(topWidget.el.style.left) || stackAnchor.x,
        y: parseInt(topWidget.el.style.top)  || stackAnchor.y,
      };
      requestAnimationFrame(updatePanelBg);
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

- [ ] **Step 3: Commit**

  ```bash
  git add src/overlay/renderer.js
  git commit -m "feat: confine widgets to screen bounds on drag release"
  ```

---

## Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update current state section**

  In `CLAUDE.md`, under `## Current state (v0.2.3)`, add these entries:
  - `getDisplaySize()` uses `screen.getPrimaryDisplay().bounds` (fixes DPI sizing); window positioned at `bounds.x/y` not hardcoded `0,0`; `screen.on('display-metrics-changed')` resizes overlay on resolution change
  - Widget-to-widget edge snapping during drag (10px threshold); X and Y axes independent; consolidated (default) theme skips snapping (panel moves as unit)
  - Confinement toggle (`cfg.confineWidgets`, default `true`) via tray menu; clamps widget positions on `mouseup`; consolidated mode clamps as a group; IPC channel `confine` + `displaySize`

- [ ] **Step 2: Commit**

  ```bash
  git add CLAUDE.md
  git commit -m "docs: update CLAUDE.md for snap/sizing/confinement features"
  ```

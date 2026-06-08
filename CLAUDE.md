# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Zoku is an Electron-based Windows overlay that reads Forza Horizon 6 UDP telemetry (Data Out) in real time. It displays speed, gear, RPM, throttle/brake, tire temps, and suspension travel. It auto-records sessions during races and saves them as JSON for future crew/session comparison. The overlay also works in free roam (no recording).

## Commands

```bash
npm install          # install deps (includes sharp — prebuilt binaries, no compilation needed)
npm start            # run the overlay (Electron dev mode, Windows only — needs a display)
npm run gen-icon     # regenerate build/icon.ico + build/icon.png from scripts/gen-icon.js
npm run build        # gen-icon runs automatically via prebuild, then packages NSIS installer → dist/
```

**Cross-compiling from Linux:** works — wine is available on the host. Run `npm run build` from a temp dir (not the NAS mount) to avoid writing node_modules to the NAS.

**Icon note:** `sharp` must render SVG with `{ density: 300 }` + `.resize(size, size)` — omitting resize causes oversized PNGs (~800px instead of 256px) which bloats the ICO and causes NSIS to reject it. `icon.png` renders at 512px (for README/GitHub); ICO uses 256/64/32/16 only (NSIS limit).

## GitHub

- **Repo:** https://github.com/pyro262/zoku (public)
- **Git identity:** `user.name = pyro262`, `user.email = 50073134+pyro262@users.noreply.github.com` — always use this to avoid random contributor attribution
- **Releases:** v0.1.3–v0.2.4 all published with installer binaries; use `gh release create` + `gh release edit --draft=false` for new releases; always update `README.md` version badge (`shields.io` static badge, not auto-updated)
- **Wiki:** not yet initialized — user must click "Create the first page" at github.com/pyro262/zoku/wiki once, then wiki pages can be pushed via git to https://github.com/pyro262/zoku.wiki.git

## FH6 setup required to receive data

Settings → HUD & Gameplay → Data Out:
- Data Out: On
- IP: `127.0.0.1`
- Port: `20777`
- Format: Car Dash

Game must be in **borderless windowed** mode — overlays cannot penetrate exclusive fullscreen.

## Architecture

**Main process** (`src/main.js`): creates a full-screen transparent always-on-top overlay window (sized to primary display), system tray, global shortcut (`Ctrl+Shift+F6` toggles `userHidden`), and wires telemetry events to the renderer via IPC. Widget positions persisted to `%APPDATA%/Zoku/config.json` under `widgetLayouts[theme][widgetId]`; positions persist across theme switches (no auto-reset on switch — delete the key from config.json to reset a theme). Overlay visibility: `syncOverlayVisibility()` checks `!userHidden && udpActive && forzaFocused`. **UDP show**: first telemetry packet sets `udpActive=true` and calls `syncOverlayVisibility()`; 5 s of no packets sets `udpActive=false` and hides. **Focus hide**: focus watcher (`startFocusWatcher`) spawns a persistent PowerShell that polls `GetForegroundWindow` every 500ms; non-Forza/non-Zoku focus triggers 2 s debounce hide; Forza focus sets `forzaFocused=true` and syncs. `forzaFocused` initialises `true` (corrected within 500ms by watcher). Rolling liveness watchdog kills+restarts PS if no stdout for 5 s (detects hangs, not just crashes — `Get-Process` can block on process transitions during rapid alt+tab). Unlock forces `overlayWin.show()` directly; re-lock does NOT call `syncOverlayVisibility` (focus watcher handles re-hide).

**UDP + packet parser** (`src/udp.js`): singleton `FH6Telemetry extends EventEmitter`. Binds UDP on port 20777, parses every 324-byte FH6 packet (little-endian), emits `telemetry`, `raceStart`, `raceEnd`. Race detection: `lapNumber > 0 && currentRaceTime > 0`. 3-second debounce on `raceEnd` prevents false triggers between laps.

**Session recorder** (`src/session.js`): singleton, started/stopped by `raceStart`/`raceEnd`. Downsamples to one frame per 50ms. Writes to `Documents/Zoku/sessions/session_<timestamp>.json`. Frame fields abbreviated (`t`, `x/y/z`, `spd`, `rpm`, `gear`, `thr`, `brk`, `ttFL/FR/RL/RR`, `suFL/FR/RL/RR`, `lap`).

**IPC bridge** (`src/preload.js`): `contextBridge` exposes `window.fh6.onTelemetry`, `onRaceStart`, `onRaceEnd`, `onSessionSaved`, `onLockState`, `onTheme`, `onWidgetVisibility`, `onOpacity`, `onScale`, `onDisplaySize`, `onConfine`, `saveWidgetPos` to renderer. No `nodeIntegration`.

**Viewer preload** (`src/viewer-preload.js`): exposes `window.viewer.openFiles`, `setOpacity(v)`, `getOpacity()`.

**Options preload** (`src/options-preload.js`): exposes `window.options.getConfig()`, `applyLive(patch)`, `save(cfg)`, `cancel(original)`.

**Options window** (`src/options/`): small BrowserWindow (420×530, non-resizable). Shows opacity slider (0–100%), scale slider (50–150%), default theme radio, auto-switch checkbox + theme dropdowns, Start with Windows checkbox. Live preview — changes send `options:applyLive` IPC and apply to overlay immediately. OK saves; Cancel sends original config back and reverts overlay.

**Overlay renderer** (`src/overlay/renderer.js`): pure DOM updates on every telemetry frame. `body.no-data` class hides all widgets until first telemetry arrives (auto-removed); re-added after 3 s of no data. Tracks `inRace`. `applyLayout(data)` positions widgets; calls `updatePanelBg()` after layout. `updatePanelBg()` measures widget bounding box and sizes `#panel-bg` to cover all visible widgets in consolidated mode. Drag: in consolidated mode, dragging any handle moves all visible widgets together; saves all positions on mouseup. `onOpacity` sets `--widget-opacity` CSS var; `onScale` sets `--widget-scale` CSS var on `:root`. Race bar behaviour:
- No game data: all widgets hidden (`body.no-data`)
- Free roam: `FREE ROAM · <class><PI>`
- In race: `<class><PI> · REC` in red
- Race ends: `FREE ROAM`

Tire temp colour scale: blue (<140°F) → green (140–200°F) → yellow (200–240°F) → red (>240°F). RPM range derived live from `engineMaxRpm`/`engineIdleRpm` packet fields.

**Icon generator** (`scripts/gen-icon.js`): SVG tachometer drawn programmatically (warm palette — gold/orange/red/purple), sharp renders at 256/64/32/16px with explicit `.resize()`, converts to ICO via `png-to-ico`.

## Packet format

FH6 sends 324-byte little-endian UDP packets. Key offsets:
- `0` `IsRaceOn` (i32), `16` `CurrentEngineRpm` (f32), `68–80` normalized suspension FL/FR/RL/RR (f32×4)
- `196–208` suspension travel meters FL/FR/RL/RR (f32×4)
- `244–252` world position X/Y/Z (f32×3), `256` speed m/s (f32)
- `268–280` tire temps FL/FR/RL/RR °F (f32×4)
- `308` `CurrentRaceTime` (f32), `312` `LapNumber` (u16), `314` `RacePosition` (u8)
- `315` Accel, `316` Brake (u8 0–255), `319` Gear (u8, 0=reverse, 11=neutral)
- FH6-specific at `232–243`: CarGroup (u32), SmashableVelDiff/SmashableMass (f32×2)

## Design system

Plasma dark theme — `#0a0812` background, `#9b59b6` purple, `#00d4ff` cyan, `#2ecc71` green, `#f39c12` yellow, `#e74c3c` red. All panels `transparent: true`. CSS custom properties in `src/overlay/style.css`. Icon uses warm sub-palette (gold→orange→red→purple arc segments).

## Current state (v0.2.4)

- Installer: `dist/Zoku Setup 0.2.5.exe` at `/media/projects/zoku/dist/`
- Overlay auto-hides when no UDP data (3 s debounce); starts hidden (`show: false`), shown only when Forza window is focused
- Focus watcher: persistent PowerShell child process polls `GetForegroundWindow` + `GetWindowText` every 500 ms with `Console.Out.Flush()` — checks both process name (`forzahorizon`) and window title (`forza horizon`) to handle both Steam and Xbox/UWP installs; Zoku's own windows exempt from hide debounce; 2 s debounce on hide; rolling liveness watchdog kills+restarts PS after 5 s silence (handles mid-loop hangs from rapid alt+tab)
- Widget positions persist across theme switches; no auto-reset on `applyTheme` or `options:save` — to reset, delete theme key from config.json
- Session viewer has `setMenu(null)` — File→Exit no longer closes Zoku
- All widgets 300 px wide in Race and Interior themes (uniform width for manual alignment)
- Race theme preset: all default widgets at `W/2-150`; y offsets updated for taller race-mode font sizes (stats→rpm +110, rpm→inputs +40, inputs→tires +35)
- `inRace` tracked in `main.js`; auto-switch theme applies immediately when free-roam/race theme or auto-switch toggle changes
- Default theme: visually merged single panel; auto-stack derives y positions from `offsetHeight * scale` after each layout/visibility change; uniform 300 px width; section dividers. `stackConsolidated()` is also called when first telemetry removes `body.no-data` (fixes fresh-install overlap — widgets are `display:none` until first data so heights are 0 at initial `applyLayout` call)
- Interior theme: all center-column widgets at `W/2-150` (300 px); y positions calculated from bottom up; inputs to the right at `W/2+160`
- Themes: Default (formerly Consolidated), Exterior (formerly Race/Natural), Interior (formerly HUD)
- 14 widgets total — 6 on by default, 8 optional hidden-by-default: G-Force, Lap Times, Boost/Power/Torque, Steering, Clutch/Handbrake, Tire Slip Ratio, Wheel Speeds, Fuel Level
- Overlay opacity (0–100%) and scale (50–150%) via CSS vars; Options window: 420×530, live preview, OK saves, Cancel reverts
- Session Viewer: play/pause + seek + variable speed; GPS map with left-click drag to pan, scroll wheel to zoom, double-click to reset fit; no menu bar (`setMenu(null)`)
- Sessions save to `Documents\Zoku\sessions\`; toggle: `Ctrl+Shift+F6`; Start with Windows via `app.setLoginItemSettings({ openAtLogin, path: app.getPath('exe') })` — `path` required for NSIS installs
- Version number shown in: Options window footer, Session Viewer toolbar, tray right-click menu (disabled label)
- Suspension widget: bars blend purple/cyan → solid red at 98–100% compression; rolling 30 s max shown below current % per corner (`suspHist` sliding window in renderer.js, keyed by fill element ID)
- Session recorder (`session.js`): trims trailing zero frames (t=0,x=0,z=0) before saving — raceEnd debounce window captures dead packets that corrupt duration and GPS track
- `panel-bg` opacity: uses `opacity: var(--widget-opacity)` on the element (background is solid `rgb(10,8,18)`) so border and backdrop-filter both fade to zero at 0% opacity
- `updatePanelBg` applies `--widget-scale` when computing bounding box so panel-bg grows with scale changes
- `getDisplaySize()` uses `screen.getPrimaryDisplay().bounds` (fixes DPI sizing); window positioned at `bounds.x/y` not hardcoded `0,0`; `screen.on('display-metrics-changed')` resizes overlay and re-sends `displaySize` IPC on resolution change
- Widget-to-widget edge snapping during drag (10px threshold); X and Y axes snap independently; consolidated (default) theme skips snapping (panel moves as unit); snap targets and scale read once at mousedown for performance
- Confinement toggle (`cfg.confineWidgets`, default `true`) via tray menu "Confine widgets to screen: On/Off"; clamps widget positions on `mouseup`; non-consolidated mode clamps each widget independently; consolidated mode clamps as a group; IPC channels: `displaySize` `{W,H}` + `confine` `boolean`; `preload.js` exposes `onDisplaySize` and `onConfine`

## Planned / not yet built

- **Auto-update** — `electron-updater` + GitHub Releases, deferred until after local testing complete
- **HUD/Race y positions** — still approximate hardcoded offsets; could implement the same auto-stack used by consolidated

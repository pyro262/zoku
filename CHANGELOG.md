# Changelog

All notable changes to Zoku are documented here.

---

## [0.3.1] — Current Release

### Fixed
- **Overlay window clamped to one monitor** — Windows clamps a `BrowserWindow`'s creation-time size to the bounds of the monitor it spawns on ([electron#20351](https://github.com/electron/electron/issues/20351)). On multi-monitor setups the overlay window was anchored at the virtual-desktop origin (top-left monitor) but sized to roughly one monitor, so it only partially covered the other displays — widgets could not be dragged onto them and presets landed off-window. The union bounds are now re-applied with `setBounds()` after creation, verified via `getBounds()` and retried up to 3× (mixed-DPI conversion can need a second pass, [electron#29605](https://github.com/electron/electron/issues/29605)), with `resizable` temporarily toggled on so the window can also shrink when a display is removed ([electron#15560](https://github.com/electron/electron/issues/15560)).

---

## [0.3.0]

### Fixed
- **Widgets appear on wrong monitor** — preset positions were computed in virtual-desktop-absolute coordinates but the renderer expects window-relative coordinates. The overlay window origin (virtual desktop minimum x/y across all displays) was not subtracted before passing display bounds to THEMES functions, causing an incorrect offset whenever any monitor has a non-zero virtual-desktop origin. All two-monitor setups where the primary is not the leftmost display were affected.
- **Centroid display detection used wrong coordinate space** — when switching to a theme with no saved layout, the previous theme's widget centroid was passed to `screen.getDisplayNear` in window-relative coordinates instead of virtual-desktop-absolute coordinates, causing the wrong target display to be selected.

> **If you're upgrading from v0.2.8 or v0.2.9:** your saved widget positions for any theme that was set by a buggy preset may point to the wrong monitor. Reset affected themes by deleting their key from `%APPDATA%\Zoku\config.json` (while Zoku is not running), then restart — presets will recalculate correctly.

---

## [0.2.9]

### Fixed
- **Wrong monitor on theme switch** — `activeTheme` was updated before `buildThemePayload` was called, so `getTargetDisplay` always compared the new theme against itself (finding no previous positions) and fell through to `forzaDisplay` — placing widgets on FH6's display instead of the previous theme's display. Fixed by capturing the previous theme name before the update and passing it explicitly.

---

## [0.2.8]

### Added
- **Multi-monitor display detection** — PS focus watcher now emits `GetWindowRect` each tick; main process tracks which display FH6 is running on as `forzaDisplay` (persists last known value; not cleared on focus loss)
- **Smart theme preset centering** — theme presets center on FH6's display automatically. Switching to a theme with no saved layout inherits the display from the active theme's widget centroid. Falls back to primary display if FH6 has never been seen
- **Shift+drag group move** — hold Shift while dragging any widget handle in Exterior or Interior themes to move all visible widgets together as a group. Default theme behavior unchanged

---

## [0.2.6]

### Added
- **`Ctrl+Shift+F7` theme cycle hotkey** — cycles `default → exterior → interior → default`. When auto-switch is on, the switch is temporary and auto-switch resumes on the next race state change. When auto-switch is off, the switch is persistent.

---

## [0.2.5]

### Fixed
- **Rolling liveness watchdog** — replaced the one-shot startup watchdog with a rolling watchdog that resets on every PowerShell stdout chunk and kills+restarts after 5 s of silence. Fixes a hang where `Get-Process` could block mid-loop during rapid alt+tab, leaving `forzaFocused` stuck `false` permanently so the overlay would never auto-show again.

---

## [0.2.4]

### Added
- **Widget edge snapping** — drag widgets in Exterior/Interior themes; edges snap together at a 10 px threshold; X and Y axes snap independently. Snap targets and scale are read once at mousedown for performance.
- **Confinement toggle** — tray menu "Confine widgets to screen: On/Off" (default On). Prevents widgets from being dragged off-screen; clamps on mouseup.

### Fixed
- **DPI / multi-monitor sizing** — overlay now correctly fills the primary monitor under Windows DPI scaling; window origin uses `display.bounds` (fixes setups where the primary monitor is not the leftmost)
- Overlay auto-resizes if display resolution changes while the app is running

---

## [0.2.3]

### Added
- **Version number** displayed in the Options window footer, Session Viewer toolbar, and tray right-click menu

### Changed
- **Overlay show/hide rework** — overlay now appears as soon as FH6 starts sending UDP data (no waiting on the focus watcher); hides after 5 s of no packets. Focus watcher still drives the hide-on-alt-tab path.

### Fixed
- **Start with Windows** — `setLoginItemSettings` now passes the explicit exe path required for NSIS installs; the registry entry was silently failing without it

---

## [0.2.2]

### Fixed
- Focus watcher stall on Windows auto-launch at startup

---

## [0.2.1]

### Added
- **Suspension history** — rolling 30-second max compression shown below current % per corner
- Suspension bars now transition purple/cyan → solid red at 98–100% compression to signal bottoming out

### Changed
- Themes renamed for clarity: Consolidated → **Default**, Race → **Exterior**, HUD → **Interior**

### Fixed
- Session recorder now trims trailing zero-frames captured during the raceEnd debounce window — previously these dead packets inflated session duration and corrupted the GPS track tail
- `panel-bg` at 0% opacity now correctly fades the border and backdrop-filter to zero (previously only the background color faded)
- `panel-bg` bounding box calculation now accounts for widget scale — the background panel grows correctly when scale is increased
- `stackConsolidated` is now called when first telemetry removes `body.no-data`, fixing a fresh-install layout issue where widgets were invisible during initial layout computation and stacked at 0,0

---

## [0.2.0]

### Added
- **8 new optional widgets** (hidden by default, enable via right-click tray → Widgets):
  - G-Force (lateral and longitudinal G bars)
  - Lap Times (best in green, last, current in M:SS.mmm)
  - Boost / Power / Torque (live psi, hp, lb-ft)
  - Steering (centred bar with direction and %)
  - Clutch / Handbrake (input bars)
  - Tire Slip Ratio (2×2 grip/slip grid, green → red)
  - Wheel Speeds (2×2 in rad/s, red = spinning, blue = locking)
  - Fuel Level (% bar, colour-coded by level)
- **Auto-switch themes** — automatically swap layouts on race start/end; free-roam and race themes configurable independently
- **Consolidated panel background** — single merged panel sized to cover all visible widgets in Default theme
- **Consolidated drag** — dragging any widget handle in Default theme moves all visible widgets together; positions saved on release
- RPM bar range now derived live from `engineMaxRpm` / `engineIdleRpm` packet fields (adapts to each car)
- Session Viewer: removed menu bar — File → Exit no longer closes Zoku unexpectedly

### Changed
- Widget drag in non-consolidated themes remains per-widget (unchanged)
- Options window dimensions locked at 420×530 (non-resizable)

---

## [0.1.9]

### Added
- **Focus watcher** — overlay auto-hides when FH6 loses focus, reappears when you switch back
- Persistent PowerShell child process polls `GetForegroundWindow` + `GetWindowText` every 500ms
- Checks both process name (`forzahorizon`) and window title (`forza horizon`) — supports Steam and Xbox/UWP installs
- Zoku's own windows (Options, Session Viewer) are exempt from the hide trigger
- 2-second hide debounce prevents flicker on brief focus changes
- Unlock forces overlay visible immediately; re-lock defers to focus watcher (re-hides within 500ms if FH6 not focused)

---

## [0.1.8]

### Added
- **Options window** (420×530) — opacity slider 0–100%, scale slider 50–150%
- Live preview — changes apply to the overlay immediately without saving
- OK saves settings; Cancel reverts overlay to original config and closes
- **Start with Windows** — Zoku launches at login, sits in tray silently until Forza sends data
- Overlay opacity exposed as `--widget-opacity` CSS variable; scale as `--widget-scale` on `:root`

---

## [0.1.7]

### Added
- **Per-widget drag layout** — all 6 default widgets independently positionable
- Widget positions persist to `%APPDATA%\Zoku\config.json` under `widgetLayouts[theme][widgetId]`
- Positions survive theme switches — each theme maintains its own saved layout independently
- Lock/Unlock toggle: amber drag handles appear on each widget when unlocked
- Preset default positions applied on first launch or when theme key is absent from config

---

## [0.1.6]

### Added
- **Three themes**: Consolidated (all widgets top-left), Race (tire-focused, spread layout), HUD (minimal bottom strip)
- Theme selection via right-click tray → Theme
- Race theme: tires and stats spread across the screen; suited for exterior camera
- HUD theme: minimal horizontal strip at the bottom; suited for cockpit/interior camera

---

## [0.1.5]

### Added
- **Session Viewer** window — play/pause, seek scrubber, variable playback speed (0.25×–4×)
- GPS track map with left-click drag to pan, scroll wheel to zoom, double-click to reset fit
- Viewer accessible from right-click tray

---

## [0.1.4]

### Added
- **Automatic race detection** — recording begins when `lapNumber > 0 && currentRaceTime > 0`
- **Session recording** — downsamples to one frame per 50ms, saves JSON to `Documents\Zoku\sessions\`
- 3-second `raceEnd` debounce prevents false stops between laps
- Toast notification (`SESSION SAVED`) fades in after each session is written
- Frame fields abbreviated for compact file size: `t`, `spd`, `rpm`, `gear`, `thr`, `brk`, `ttFL/FR/RL/RR`, `suFL/FR/RL/RR`, `lap`, `x/y/z`

---

## [0.1.3] — Initial Release

### Added
- Full-screen transparent always-on-top overlay window (primary display)
- Live UDP listener on port 20777 — parses 324-byte FH6 Car Dash packets
- Six default widgets: Race Status, Gear & Speed, RPM Bar, Throttle/Brake, Tire Temps, Suspension
- Tire temp colour scale: blue (cold) → green (optimal) → yellow → red (hot)
- `body.no-data` class hides all widgets until first telemetry packet arrives; re-applied after 3s of silence
- System tray: Lock/Unlock, Quit
- `Ctrl+Shift+F6` global shortcut to toggle overlay visibility
- Race status bar: `WAITING FOR RACE` (no data) → `FREE ROAM · <class><PI>` → `<class><PI> · REC` (recording) → `FREE ROAM` (race ended)

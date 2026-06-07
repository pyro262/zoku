# Frequently Asked Questions

---

## Installation & Setup

**Q: What do I need to run Zoku?**

Windows 10 or 11, Forza Horizon 6 (PC), and the game set to **Borderless Windowed** display mode. No second monitor, capture card, or admin rights required.

---

**Q: The overlay isn't showing up.**

Check in order:

1. Press `Ctrl+Shift+F6` — the overlay may be toggled off
2. Make sure the game is in **Borderless Windowed**, not Exclusive Fullscreen
3. Right-click the Zoku tray icon and confirm the overlay is not hidden
4. Make sure Forza Horizon 6 is the active window — Zoku hides when FH6 is not focused

---

**Q: No data — the Race Status bar says "WAITING FOR RACE" even in free roam.**

Zoku is running but not receiving UDP packets. Verify in FH6:

- **Settings → HUD & Gameplay → Data Out → On**
- IP Address: `127.0.0.1`
- Port: `20777`
- Packet Format: **Car Dash** (not Sled)

After changing these settings, return to the game. Zoku picks up the stream automatically — no restart needed.

---

**Q: I changed the Data Out settings but still no data.**

Try restarting Zoku after changing FH6 settings. In some cases the game only sends to the configured IP/port after a full settings save and return to gameplay.

---

**Q: Does Zoku work with Xbox Game Pass / UWP version of FH6?**

Yes. The focus watcher checks both the process name (`forzahorizon`) and the window title (`forza horizon`) so it works with both Steam and Xbox/UWP installs.

---

## Widgets & Layout

**Q: Some of my widgets are missing after an update.**

Re-enable them via **right-click tray → Widgets**. New widgets added in updates are hidden by default and must be enabled manually.

---

**Q: How do I move widgets?**

Right-click tray → **Unlock**. Each widget shows an amber drag handle at the top. Drag to reposition. Right-click tray → **Lock** when done. Positions are saved automatically.

**In Default theme:** dragging any widget handle moves all visible widgets together as a group.

**In Exterior/Interior themes:** each widget moves independently.

---

**Q: How do I reset a widget layout back to defaults?**

Open `%APPDATA%\Zoku\config.json` in a text editor while Zoku is not running. Delete the key for the theme you want to reset under `"widgetLayouts"`. Save the file and restart Zoku — preset positions will be used.

---

**Q: Widget positions I set in one theme don't carry over to other themes.**

Correct — positions are saved per theme. Each theme maintains its own independent layout. This is intentional so you can configure each theme for a different camera or play style.

---

**Q: Can I enable a widget that isn't in the tray menu?**

All 14 widgets are listed under **right-click tray → Widgets**. If you want to set a specific position before enabling, you can edit `config.json` directly — add an entry under `widgetLayouts → <theme> → <widgetId>` with `"visible": true` and your desired `x`/`y` coordinates.

Widget IDs: `w-race` `w-stats` `w-rpm` `w-inputs` `w-tires` `w-suspension` `w-gmeter` `w-laptimes` `w-boost` `w-steering` `w-clutch` `w-tireslip` `w-wheelspeed` `w-fuel`

---

## Themes

**Q: What's the difference between the three themes?**

| Theme | Best camera | Layout |
|-------|-------------|--------|
| **Default** | Any | All widgets in a single merged panel, top-left |
| **Exterior** | Chase / drone | Stats spread across the screen, tires centered |
| **Interior** | Cockpit / hood | Minimal strip at the bottom, inputs right |

---

**Q: What is Auto-switch?**

When enabled, Zoku automatically swaps themes when a race starts and when it ends. Configure which theme to use for free roam and which for races independently under **Settings** in the tray menu.

---

## Session Recording

**Q: What gets recorded and when?**

Zoku records automatically when you enter any race event — circuits, sprints, point-to-point, drag. Recording stops when the race ends. Nothing is recorded during free roam.

---

**Q: Where are my session files saved?**

```
Documents\Zoku\sessions\session_<timestamp>.json
```

Each file contains one frame per 50ms with speed, RPM, gear, throttle, brake, tire temps, suspension travel, GPS position, and lap number.

---

**Q: Sprint / point-to-point races aren't recording.**

Confirm your **Data Out Packet Format is Car Dash, not Sled**. The Sled format omits the `lapNumber` field that Zoku uses to detect race entry.

---

**Q: The GPS track in the Session Viewer looks wrong or cuts off early.**

This can happen if Zoku was closed mid-race. Sessions saved normally (via `raceEnd`) are trimmed of any trailing dead frames before saving, so the track should end cleanly at the finish line.

---

**Q: How do I open a session in the viewer?**

Right-click tray → **Open sessions folder**, then double-click a session file. The Session Viewer window will open.

- **Left-click drag** — pan the GPS map
- **Scroll wheel** — zoom in/out
- **Double-click** — reset to fit

---

## Performance & Compatibility

**Q: Does Zoku affect game performance?**

Zoku is a lightweight Electron overlay. The UDP listener parses incoming packets and updates the DOM at the telemetry rate. On a modern PC, CPU impact is negligible. GPU impact is minimal — the overlay is a transparent window composited by the OS, not rendered by the game's GPU pipeline.

---

**Q: Can I run Zoku on a second PC?**

Zoku is designed to run on the same machine as FH6 (it listens on `127.0.0.1`). If you want to run it on a second PC, you would need to change the FH6 Data Out IP to the second PC's IP and configure Zoku to bind to `0.0.0.0` — this is not officially supported in the current release.

---

**Q: Does Zoku work with other Forza titles?**

Zoku is built specifically for the FH6 324-byte Car Dash packet format. It may partially work with FH5 or FM8 (similar packet structure) but some fields differ — this is untested and not supported.

---

## Configuration

**Q: Where is the config file?**

```
%APPDATA%\Zoku\config.json
```

Which resolves to `C:\Users\<YourName>\AppData\Roaming\Zoku\config.json`. You can edit it in any text editor. Do not edit while Zoku is running — it will overwrite your changes on exit.

---

**Q: How do I uninstall?**

Use **Windows Settings → Apps → Zoku → Uninstall**, or run the uninstaller from the Start Menu. Your session files in `Documents\Zoku\sessions\` and config in `%APPDATA%\Zoku\` are not removed automatically — delete them manually if you want a clean removal.

---

**Q: Does Zoku send any data anywhere?**

No. Zoku reads UDP packets from localhost only and writes session files to your local Documents folder. There is no telemetry, no analytics, no network calls.

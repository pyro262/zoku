Zoku v0.2.1 - FH6 Telemetry Overlay
=====================================

REQUIRED GAME SETUP
--------------------
In Forza Horizon 6, open Settings -> HUD & Gameplay -> Data Out

    Data Out:               ON
    IP Address:             127.0.0.1
    Port:                   20777
    Data Out Packet Format: Car Dash

Save and return to the game. Zoku starts receiving data immediately.

DISPLAY MODE
------------
The game MUST run in Borderless Windowed mode.
Overlays cannot appear over Exclusive Fullscreen.

    Settings -> Video -> Display Mode -> Borderless Windowed

OVERLAY CONTROLS
----------------
    Ctrl+Shift+F6   Toggle overlay on / off

    Right-click the Zoku tray icon (bottom-right taskbar):

    Lock / Unlock overlay
        Unlock to drag individual widgets. Each widget shows an
        amber drag handle at the top. Lock when done.

    Theme
        Consolidated  All widgets stacked in the top-left corner
        Race       Tires centered on screen, stats at bottom
        HUD           Minimal strip at the bottom for in-car cam

    Widgets
        Toggle any widget on or off independently.
        Visible/hidden state is saved per theme.

    Auto-switch theme on race
        When enabled, Zoku automatically switches themes as you
        enter and leave races. Configure which theme to use for
        each mode:

        Free-roam theme  Shown during free roam (default: Race)
        Race theme       Shown during races     (default: HUD)

    Settings
        Start with Windows
            Zoku starts at login and sits in the tray. The overlay
            appears automatically when Forza Horizon 6 begins
            sending data. Invisible otherwise.

        Overlay Opacity
            Ghost / Low / Medium / High / Solid presets control
            how opaque the widget backgrounds are.

    Open sessions folder
        Browse your recorded race and sprint data.

    Quit
        Close Zoku.

WIDGET LAYOUT
-------------
Zoku has 14 widgets. Six are shown by default; the rest are hidden
and can be enabled via right-click tray -> Widgets.

    Default (on by default)
    -----------------------
    Race Status       Position, class/PI, lap timer, session badge
    Gear / Speed      Large gear number and speed in MPH
    RPM Bar           Live RPM bar with redline zone
    Throttle / Brake  Input bars (green = throttle, red = brake)
    Tire Temps        2x2 temp grid — colour coded cold->optimal->hot
    Suspension        Per-corner compression bars

    Optional (hidden by default, enable via Widgets menu)
    ------------------------------------------------------
    G-Force           Lateral and longitudinal G bars, colour by intensity
    Lap Times         Best (green), last, and current lap in M:SS.mmm
    Boost/Power/Torque  Live boost psi, horsepower, and lb-ft torque
    Steering          Centred bar showing steering direction and %
    Clutch/Handbrake  Input bars for clutch and handbrake
    Tire Slip Ratio   2x2 grid — green (grip) to red (slip/lock)
    Wheel Speeds      2x2 grid in rad/s — red = spinning, blue = locking
    Fuel Level        Fuel % bar — green > 25%, yellow > 10%, red below

Widget positions are saved per theme and persist across theme
switches. Switching themes restores wherever you last left each
widget for that theme.

WHAT GETS RECORDED
------------------
Zoku records automatically when you enter any race event
(circuits, sprints, point-to-point, drag) and stops when it ends.
Nothing is recorded during free roam.

Session files are saved to:
    Documents\Zoku\sessions\session_<timestamp>.json

Each session contains speed, RPM, gear, throttle, brake, tire temps,
suspension travel, and GPS position every 50ms.

CONFIGURATION FILE
------------------
All settings and widget layouts are stored in a plain JSON file:

    %APPDATA%\Zoku\config.json

Which resolves to:

    C:\Users\<YourName>\AppData\Roaming\Zoku\config.json

You can open this file in any text editor (Notepad, VS Code, etc.)
to inspect or manually edit your settings. Useful edits:

    Enable a hidden widget manually
        Find the widget ID under "widgetLayouts" -> your theme,
        and set "visible": true. Then set "x" and "y" to the
        pixel position where you want it to appear.

        Widget IDs:
            w-race        w-stats       w-rpm         w-inputs
            w-tires       w-suspension  w-gmeter      w-laptimes
            w-boost       w-steering    w-clutch      w-tireslip
            w-wheelspeed  w-fuel

    Reset a theme layout to defaults
        Delete the theme's key from "widgetLayouts" and restart
        Zoku. The preset positions will be used on next load.

    widgetOpacity   0.0 (invisible) to 1.0 (solid)
    overlayScale    0.5 (50%) to 1.5 (150%)
    theme           "consolidated" | "race" | "hud"

Changes take effect on next Zoku launch. Do not edit the file
while Zoku is running — it will overwrite your changes on exit.

TROUBLESHOOTING
---------------
Overlay not showing?
    - Press Ctrl+Shift+F6 to toggle visibility
    - Make sure the game is in Borderless Windowed, not Fullscreen

No data / shows "WAITING FOR RACE"?
    - Verify Data Out is ON in FH6 settings
    - Confirm IP is 127.0.0.1 and Port is 20777
    - Format must be Car Dash (not Sled)
    - Try restarting Zoku after changing settings

Sprint / point-to-point races not recording?
    - This is supported. If it's not triggering, confirm
      Data Out is set to Car Dash, not Sled format.

Widgets missing after update?
    - Right-click tray -> Widgets and re-enable them, or
      right-click tray -> Theme to reset to a preset layout.

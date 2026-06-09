# Theme Cycle Hotkey — Design Spec

**Date:** 2026-06-09
**Hotkey:** `Ctrl+Shift+F7`
**Scope:** `src/main.js` only — no renderer changes

## Summary

Add a global hotkey that cycles through all three themes (`default → exterior → interior → default`) in-game. When auto-switch is enabled, the cycle is temporary and resets on the next race state change. When auto-switch is disabled, the cycle persists as the new default theme.

## State

Add one new variable in `main.js` alongside existing overlay state:

```js
let autoSwitchOverride = false;
```

## Hotkey Handler

Registered alongside the existing `Ctrl+Shift+F6` shortcut in `app.on('ready')`:

```js
globalShortcut.register('CommandOrControl+Shift+F7', () => {
  const idx = THEME_NAMES.indexOf(activeTheme ?? cfg.theme);
  const next = THEME_NAMES[(idx + 1) % THEME_NAMES.length];
  if (cfg.autoSwitch) {
    sendTheme(next);
    autoSwitchOverride = true;
  } else {
    applyTheme(next);
  }
});
```

## Override Clearing

In the existing `raceStart` and `raceEnd` event handlers, add at the top of each:

```js
if (autoSwitchOverride) autoSwitchOverride = false;
```

This clears the flag and lets the existing `inRace`-based auto-switch logic run normally for the new state.

## Behavior Matrix

| auto-switch | hotkey pressed | result |
|-------------|---------------|--------|
| OFF | any | `applyTheme(next)` — persists to config, survives restart |
| ON | in free roam | `sendTheme(next)`, override=true — reverts on race start |
| ON | in race | `sendTheme(next)`, override=true — reverts on race end |

## What Does NOT Change

- Tray theme submenu reflects `cfg.theme` (persisted default), not the live override — correct
- `cfg.freeRoamTheme` and `cfg.raceTheme` are unaffected
- No renderer or preload changes needed — `sendTheme` already pushes via existing IPC
- `Ctrl+Shift+F6` (visibility toggle) unchanged

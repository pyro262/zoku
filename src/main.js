const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const telemetry = require('./udp');
const session = require('./session');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const UDP_PORT = 20777;

const WIDGET_META = [
  { id: 'w-race',       label: 'Race Status' },
  { id: 'w-stats',      label: 'Gear / Speed / RPM' },
  { id: 'w-rpm',        label: 'RPM Bar' },
  { id: 'w-inputs',     label: 'Throttle / Brake' },
  { id: 'w-tires',      label: 'Tire Temps' },
  { id: 'w-suspension', label: 'Suspension' },
  // Optional — hidden by default
  { id: 'w-gmeter',     label: 'G-Force' },
  { id: 'w-laptimes',   label: 'Lap Times' },
  { id: 'w-boost',      label: 'Boost / Power / Torque' },
  { id: 'w-steering',   label: 'Steering' },
  { id: 'w-clutch',     label: 'Clutch / Handbrake' },
  { id: 'w-tireslip',   label: 'Tire Slip Ratio' },
  { id: 'w-wheelspeed', label: 'Wheel Speeds' },
  { id: 'w-fuel',       label: 'Fuel Level' },
];

const THEME_NAMES = ['default', 'exterior', 'interior'];

// Theme preset positions — functions so they scale with screen size
const THEMES = {
  default: (W, H) => ({
    'w-race':       { x: 20, y: 20, visible: true  },
    'w-stats':      { x: 20, y: 20, visible: true  },
    'w-rpm':        { x: 20, y: 20, visible: true  },
    'w-inputs':     { x: 20, y: 20, visible: true  },
    'w-tires':      { x: 20, y: 20, visible: true  },
    'w-suspension': { x: 20, y: 20, visible: true  },
    'w-gmeter':     { x: 20, y: 20, visible: false },
    'w-laptimes':   { x: 20, y: 20, visible: false },
    'w-boost':      { x: 20, y: 20, visible: false },
    'w-steering':   { x: 20, y: 20, visible: false },
    'w-clutch':     { x: 20, y: 20, visible: false },
    'w-tireslip':   { x: 20, y: 20, visible: false },
    'w-wheelspeed': { x: 20, y: 20, visible: false },
    'w-fuel':       { x: 20, y: 20, visible: false },
  }),
  // Exterior — status bar top-center, big cluster at bottom-center (tires below inputs)
  exterior: (W, H) => ({
    'w-race':       { x: Math.round(W / 2 - 150), y: 20,                         visible: true  },
    'w-stats':      { x: Math.round(W / 2 - 150), y: Math.round(H * 0.65),       visible: true  },
    'w-rpm':        { x: Math.round(W / 2 - 150), y: Math.round(H * 0.65) + 110, visible: true  },
    'w-inputs':     { x: Math.round(W / 2 - 150), y: Math.round(H * 0.65) + 150, visible: true  },
    'w-tires':      { x: Math.round(W / 2 - 150), y: Math.round(H * 0.65) + 185, visible: true  },
    'w-suspension': { x: 20,                       y: Math.round(H / 2 - 100),    visible: false },
    'w-gmeter':     { x: 20,                       y: Math.round(H * 0.65),       visible: false },
    'w-laptimes':   { x: Math.round(W - 310),      y: 20,                         visible: false },
    'w-boost':      { x: Math.round(W - 310),      y: 120,                        visible: false },
    'w-steering':   { x: Math.round(W / 2 - 150), y: Math.round(H * 0.65) + 330, visible: false },
    'w-clutch':     { x: 20,                       y: Math.round(H * 0.65) + 50,  visible: false },
    'w-tireslip':   { x: Math.round(W - 310),      y: Math.round(H * 0.65) + 150, visible: false },
    'w-wheelspeed': { x: Math.round(W - 310),      y: Math.round(H * 0.65) + 250, visible: false },
    'w-fuel':       { x: Math.round(W / 2 + 160),  y: H - 60,                     visible: false },
  }),
  // Interior — compact strip at screen bottom, all at 300 px wide, centered
  // Heights (approximate, interior CSS overrides): race≈22, stats≈75, rpm≈34, inputs≈49
  interior: (W, H) => ({
    'w-race':       { x: Math.round(W / 2 - 150), y: H - 161, visible: true  },
    'w-stats':      { x: Math.round(W / 2 - 150), y: H - 139, visible: true  },
    'w-rpm':        { x: Math.round(W / 2 - 150), y: H - 64,  visible: true  },
    'w-inputs':     { x: Math.round(W / 2 + 160), y: H - 139, visible: true  },
    'w-tires':      { x: 0,                        y: 0,       visible: false },
    'w-suspension': { x: 0,                        y: 0,       visible: false },
    'w-gmeter':     { x: 20,                       y: H - 108, visible: false },
    'w-laptimes':   { x: Math.round(W / 2 - 150), y: H - 230, visible: false },
    'w-boost':      { x: Math.round(W - 290),      y: H - 130, visible: false },
    'w-steering':   { x: Math.round(W / 2 + 160), y: H - 161, visible: false },
    'w-clutch':     { x: Math.round(W / 2 + 160), y: H - 90,  visible: false },
    'w-tireslip':   { x: 20,                       y: H - 210, visible: false },
    'w-wheelspeed': { x: 20,                       y: H - 380, visible: false },
    'w-fuel':       { x: Math.round(W - 290),      y: H - 60,  visible: false },
  }),
};

let overlayWin  = null;
let viewerWin   = null;
let optionsWin  = null;
let tray = null;
let overlayLocked = true;
let cfg = {};
// Tracks what theme is currently displayed (may differ from cfg.theme during auto-switch)
let activeTheme = null;

let forzaFocused   = true;   // optimistic; focus watcher corrects within 500 ms
let userHidden     = false;
let udpActive      = false;
let udpTimeout     = null;
let focusWatcher   = null;
let focusHideTimer = null;
let appQuitting    = false;
let inRace         = false;
let autoSwitchOverride = false;

const UDP_VISIBILITY_TIMEOUT = 5000;

function syncOverlayVisibility() {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  const shouldShow = !userHidden && udpActive && forzaFocused;
  if (shouldShow) overlayWin.show();
  else overlayWin.hide();
}

function onUdpData() {
  if (udpTimeout) { clearTimeout(udpTimeout); }
  udpTimeout = setTimeout(() => {
    udpActive  = false;
    udpTimeout = null;
    syncOverlayVisibility();
  }, UDP_VISIBILITY_TIMEOUT);
  if (!udpActive) {
    udpActive = true;
    syncOverlayVisibility();
  }
}

function startFocusWatcher() {
  if (focusWatcher) return;
  // Output format: "ProcessName|Window Title" once per 500 ms, explicitly flushed.
  // Title check handles UWP/Xbox Game Pass installs where the foreground process is
  // ApplicationFrameHost.exe rather than ForzaHorizon6.exe.
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
    '    [Console]::Out.WriteLine("$name|$($sb.ToString())")',
    '    [Console]::Out.Flush()',
    '    Start-Sleep -Milliseconds 500',
    '}',
  ].join('\n');

  focusWatcher = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]);

  // Rolling liveness watchdog: resets on every stdout chunk.
  // Covers both Add-Type startup stall AND mid-loop hangs (e.g. Get-Process
  // blocking on a process in transition during rapid alt+tab). 5 s = 10×
  // the normal 500 ms poll interval — generous enough to survive transient
  // slowness, tight enough to recover before the user notices.
  let liveWatchdog = null;
  const resetWatchdog = () => {
    if (liveWatchdog) clearTimeout(liveWatchdog);
    liveWatchdog = setTimeout(() => { if (focusWatcher) focusWatcher.kill(); }, 5000);
  };
  resetWatchdog();

  let buf = '';
  focusWatcher.stdout.on('data', (data) => {
    resetWatchdog();
    buf += data.toString();
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      const sep     = trimmed.indexOf('|');
      const procName = (sep >= 0 ? trimmed.slice(0, sep) : trimmed).toLowerCase();
      const winTitle  = (sep >= 0 ? trimmed.slice(sep + 1) : '').toLowerCase();
      const isForzaLine = procName.includes('forza') || winTitle.includes('forza horizon');
      // Zoku's own windows (Options, Viewer) — don't disturb overlay visibility
      const isZokuLine  = procName === 'zoku' || procName.includes('electron');
      if (isForzaLine) {
        if (focusHideTimer) { clearTimeout(focusHideTimer); focusHideTimer = null; }
        if (!forzaFocused) { forzaFocused = true; syncOverlayVisibility(); }
      } else if (!isZokuLine && forzaFocused && !focusHideTimer) {
        // 2 s debounce — absorbs tray navigation, brief focus loss to system dialogs
        focusHideTimer = setTimeout(() => {
          focusHideTimer = null;
          forzaFocused = false;
          syncOverlayVisibility();
        }, 2000);
      }
    }
  });

  focusWatcher.on('exit', () => {
    if (liveWatchdog) { clearTimeout(liveWatchdog); liveWatchdog = null; }
    focusWatcher = null;
    if (!appQuitting) setTimeout(startFocusWatcher, 2000);
  });
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg));
}

function getDisplaySize() {
  const b = screen.getPrimaryDisplay().bounds;
  return { W: b.width, H: b.height, X: b.x, Y: b.y };
}

function buildThemePayload(name) {
  const { W, H } = getDisplaySize();
  const preset = (THEMES[name] ?? THEMES.default)(W, H);
  const saved = cfg.widgetLayouts?.[name] ?? {};
  const widgets = {};
  for (const id of Object.keys(preset)) {
    widgets[id] = { ...preset[id], ...(saved[id] ?? {}) };
  }
  return { name, widgets };
}

function sendTheme(name) {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  const themeName = name ?? cfg.theme;
  activeTheme = themeName;
  overlayWin.webContents.send('theme', buildThemePayload(themeName));
}

function applyTheme(name) {
  cfg.theme = name;
  saveConfig();
  sendTheme(name);
  updateMenu();
}

function getActiveLayout() {
  return buildThemePayload(activeTheme ?? cfg.theme ?? 'default').widgets;
}

function toggleWidgetVisibility(id) {
  const layout = getActiveLayout();
  const current = layout[id] ?? {};
  const visible = !(current.visible ?? true);
  const t = activeTheme ?? cfg.theme;
  if (!cfg.widgetLayouts) cfg.widgetLayouts = {};
  if (!cfg.widgetLayouts[t]) cfg.widgetLayouts[t] = {};
  cfg.widgetLayouts[t][id] = { ...(cfg.widgetLayouts[t][id] ?? {}), visible };
  saveConfig();
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.webContents.send('widgetVisibility', { id, visible });
  }
  updateMenu();
}

function setOpacity(v) {
  cfg.widgetOpacity = v;
  saveConfig();
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.webContents.send('opacity', v);
  }
  updateMenu();
}

// Migrate old theme names to new ones in-place so saved layouts are preserved
const THEME_RENAMES = { consolidated: 'default', race: 'exterior', hud: 'interior' };

function migrateConfig(c) {
  if (c.theme        && THEME_RENAMES[c.theme])        c.theme        = THEME_RENAMES[c.theme];
  if (c.freeRoamTheme && THEME_RENAMES[c.freeRoamTheme]) c.freeRoamTheme = THEME_RENAMES[c.freeRoamTheme];
  if (c.raceTheme    && THEME_RENAMES[c.raceTheme])    c.raceTheme    = THEME_RENAMES[c.raceTheme];
  if (c.widgetLayouts) {
    for (const [old, next] of Object.entries(THEME_RENAMES)) {
      if (c.widgetLayouts[old] && !c.widgetLayouts[next]) {
        c.widgetLayouts[next] = c.widgetLayouts[old];
      }
      delete c.widgetLayouts[old];
    }
  }
}

function createOverlay() {
  cfg = loadConfig();
  migrateConfig(cfg);
  saveConfig();
  cfg.theme         ??= 'default';
  cfg.widgetLayouts ??= {};
  cfg.autoTheme     ??= false;
  cfg.freeRoamTheme ??= 'exterior';
  cfg.raceTheme     ??= 'interior';
  cfg.widgetOpacity    ??= 0.82;
  cfg.overlayScale     ??= 1;
  cfg.startWithWindows ??= false;
  cfg.confineWidgets   ??= true;

  activeTheme = cfg.theme;

  const { W, H, X, Y } = getDisplaySize();

  overlayWin = new BrowserWindow({
    x: X,
    y: Y,
    width: W,
    height: H,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,   // hidden until focus watcher confirms Forza is active
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWin.loadFile(path.join(__dirname, 'overlay', 'index.html'));
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');

  overlayWin.on('closed', () => { overlayWin = null; });

  overlayWin.webContents.on('dom-ready', () => {
    const { W, H } = getDisplaySize();
    sendTheme();
    overlayWin.webContents.send('opacity',      cfg.widgetOpacity);
    overlayWin.webContents.send('scale',        cfg.overlayScale);
    overlayWin.webContents.send('displaySize',  { W, H });
    overlayWin.webContents.send('confine',      cfg.confineWidgets ?? true);
  });
}

function themeSubmenu(currentValue, onSelect) {
  return THEME_NAMES.map((name) => ({
    label: name.charAt(0).toUpperCase() + name.slice(1),
    type: 'radio',
    checked: currentValue === name,
    click: () => onSelect(name),
  }));
}

function updateMenu() {
  const theme = cfg.theme ?? 'default';
  const layout = getActiveLayout();

  const opacityPct = Math.round((cfg.widgetOpacity ?? 0.82) * 100);
  const opacityPresets = [20, 40, 65, 82, 95];

  const menu = Menu.buildFromTemplate([
    {
      label: 'Options...',
      click: () => createOptions(),
    },
    { type: 'separator' },
    {
      label: overlayLocked ? 'Unlock overlay (allow dragging)' : 'Lock overlay',
      click: () => {
        overlayLocked = !overlayLocked;
        overlayWin.setIgnoreMouseEvents(overlayLocked, { forward: true });
        overlayWin.setFocusable(!overlayLocked);
        if (!overlayLocked) {
          overlayWin.moveTop();
          overlayWin.focus();
          overlayWin.show(); // Force visible so user can drag widgets
        }
        // Don't call syncOverlayVisibility on re-lock — focus watcher handles it
        overlayWin.webContents.send('lockState', overlayLocked);
        updateMenu();
      },
    },
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
      submenu: themeSubmenu(theme, (name) => applyTheme(name)),
    },
    {
      label: 'Widgets',
      submenu: WIDGET_META.map(({ id, label }) => ({
        label,
        type: 'checkbox',
        checked: layout[id]?.visible ?? true,
        click: () => toggleWidgetVisibility(id),
      })),
    },
    { type: 'separator' },
    {
      label: 'Auto-switch theme on race',
      type: 'checkbox',
      checked: cfg.autoTheme ?? false,
      click: () => {
        cfg.autoTheme = !cfg.autoTheme;
        saveConfig();
        // Apply the right theme immediately when toggling on
        if (cfg.autoTheme) sendTheme(inRace ? cfg.raceTheme : cfg.freeRoamTheme);
        updateMenu();
      },
    },
    {
      label: 'Free-roam theme',
      submenu: themeSubmenu(cfg.freeRoamTheme, (name) => {
        cfg.freeRoamTheme = name;
        saveConfig();
        if (cfg.autoTheme && !inRace) sendTheme(name);
        updateMenu();
      }),
    },
    {
      label: 'Race theme',
      submenu: themeSubmenu(cfg.raceTheme, (name) => {
        cfg.raceTheme = name;
        saveConfig();
        if (cfg.autoTheme && inRace) sendTheme(name);
        updateMenu();
      }),
    },
    { type: 'separator' },
    {
      label: `Opacity: ${opacityPct}%`,
      submenu: opacityPresets.map((p) => ({
        label: `${p}%`,
        type: 'radio',
        checked: opacityPct === p,
        click: () => setOpacity(p / 100),
      })),
    },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: cfg.startWithWindows ?? false,
      click: () => {
        cfg.startWithWindows = !cfg.startWithWindows;
        app.setLoginItemSettings({ openAtLogin: cfg.startWithWindows, path: app.getPath('exe') });
        saveConfig();
        updateMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Session Viewer',
      click: () => createViewer(),
    },
    {
      label: 'Open sessions folder',
      click: () => {
        const { shell } = require('electron');
        const dir = path.join(app.getPath('documents'), 'Zoku', 'sessions');
        fs.mkdirSync(dir, { recursive: true });
        shell.openPath(dir);
      },
    },
    { type: 'separator' },
    { label: `Zoku v${app.getVersion()}`, enabled: false },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(menu);
}

function createOptions() {
  if (optionsWin && !optionsWin.isDestroyed()) { optionsWin.focus(); return; }
  optionsWin = new BrowserWindow({
    width: 420,
    height: 530,
    resizable: false,
    title: 'Zoku Options',
    backgroundColor: '#0a0812',
    webPreferences: {
      preload: path.join(__dirname, 'options-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  optionsWin.setMenu(null);
  optionsWin.loadFile(path.join(__dirname, 'options', 'index.html'));
  optionsWin.on('closed', () => { optionsWin = null; });
}

ipcMain.handle('app:getVersion', () => app.getVersion());

ipcMain.handle('options:getConfig', () => ({
  widgetOpacity:    cfg.widgetOpacity    ?? 0.82,
  overlayScale:     cfg.overlayScale     ?? 1,
  theme:            cfg.theme            ?? 'default',
  autoTheme:        cfg.autoTheme        ?? false,
  freeRoamTheme:    cfg.freeRoamTheme    ?? 'exterior',
  raceTheme:        cfg.raceTheme        ?? 'interior',
  startWithWindows: cfg.startWithWindows ?? false,
}));

ipcMain.on('options:applyLive', (_, patch) => {
  if (patch.widgetOpacity !== undefined) {
    cfg.widgetOpacity = patch.widgetOpacity;
    if (overlayWin && !overlayWin.isDestroyed()) overlayWin.webContents.send('opacity', patch.widgetOpacity);
  }
  if (patch.overlayScale !== undefined) {
    cfg.overlayScale = patch.overlayScale;
    if (overlayWin && !overlayWin.isDestroyed()) overlayWin.webContents.send('scale', patch.overlayScale);
  }
});

ipcMain.on('options:save', (_, patch) => {
  const themeChanged = patch.theme && patch.theme !== cfg.theme;
  Object.assign(cfg, patch);
  if (themeChanged) {
    activeTheme = cfg.theme;
    sendTheme(cfg.theme);
  } else if (cfg.autoTheme) {
    // Apply the correct auto-switch theme immediately (covers freeRoamTheme/raceTheme
    // changes and autoTheme being toggled on)
    const target = inRace ? cfg.raceTheme : cfg.freeRoamTheme;
    if (target) sendTheme(target);
  }
  app.setLoginItemSettings({ openAtLogin: cfg.startWithWindows ?? false, path: app.getPath('exe') });
  saveConfig();
  updateMenu();
  if (optionsWin && !optionsWin.isDestroyed()) optionsWin.close();
});

ipcMain.on('options:cancel', (_, original) => {
  Object.assign(cfg, original);
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.webContents.send('opacity', cfg.widgetOpacity);
    overlayWin.webContents.send('scale',   cfg.overlayScale);
  }
  if (optionsWin && !optionsWin.isDestroyed()) optionsWin.close();
});

function createViewer() {
  if (viewerWin && !viewerWin.isDestroyed()) { viewerWin.focus(); return; }
  viewerWin = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Zoku — Session Viewer',
    backgroundColor: '#0a0812',
    webPreferences: {
      preload: path.join(__dirname, 'viewer-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  viewerWin.setMenu(null);
  viewerWin.loadFile(path.join(__dirname, 'viewer', 'index.html'));
  viewerWin.on('closed', () => { viewerWin = null; });
}

ipcMain.on('viewer:setOpacity', (_, v) => {
  setOpacity(Math.max(0, Math.min(1, v)));
});

ipcMain.handle('viewer:getOpacity', () => cfg.widgetOpacity ?? 0.82);

ipcMain.handle('viewer:openFiles', async () => {
  const result = await dialog.showOpenDialog(viewerWin ?? null, {
    title: 'Open Session Files',
    defaultPath: path.join(app.getPath('documents'), 'Zoku', 'sessions'),
    filters: [{ name: 'Zoku Sessions', extensions: ['json'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled) return [];
  return result.filePaths.map((fp) => ({
    name: path.basename(fp),
    data: JSON.parse(fs.readFileSync(fp, 'utf8')),
  }));
});

function createTray() {
  let icon;
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('Zoku');
  updateMenu();
}

function wireTelemetry() {
  telemetry.on('telemetry', (data) => {
    onUdpData();
    if (overlayWin && !overlayWin.isDestroyed()) {
      overlayWin.webContents.send('telemetry', data);
    }
    session.addFrame(data);
  });

  telemetry.on('raceStart', (data) => {
    inRace = true;
    autoSwitchOverride = false;
    session.start(data);
    if (overlayWin && !overlayWin.isDestroyed()) {
      overlayWin.webContents.send('raceStart', data);
      if (cfg.autoTheme && cfg.raceTheme) sendTheme(cfg.raceTheme);
    }
  });

  telemetry.on('raceEnd', (data) => {
    inRace = false;
    autoSwitchOverride = false;
    const savedPath = session.stop();
    if (overlayWin && !overlayWin.isDestroyed()) {
      overlayWin.webContents.send('raceEnd', data);
      if (savedPath) overlayWin.webContents.send('sessionSaved', savedPath);
      if (cfg.autoTheme && cfg.freeRoamTheme) sendTheme(cfg.freeRoamTheme);
    }
  });
}

// Drag positions saved against whichever theme is currently displayed
ipcMain.on('saveWidgetPos', (_, { id, x, y }) => {
  const t = activeTheme ?? cfg.theme;
  if (!cfg.widgetLayouts) cfg.widgetLayouts = {};
  if (!cfg.widgetLayouts[t]) cfg.widgetLayouts[t] = {};
  const existing = cfg.widgetLayouts[t][id] ?? {};
  cfg.widgetLayouts[t][id] = { ...existing, x, y };
  saveConfig();
});

app.whenReady().then(() => {
  app.setAppUserModelId('com.zoku.app');

  createOverlay();
  createTray();
  wireTelemetry();
  telemetry.start(UDP_PORT);

  // Apply stored startup preference
  app.setLoginItemSettings({ openAtLogin: cfg.startWithWindows ?? false, path: app.getPath('exe') });

  startFocusWatcher();

  screen.on('display-metrics-changed', () => {
    if (!overlayWin || overlayWin.isDestroyed()) return;
    const { W, H, X, Y } = getDisplaySize();
    overlayWin.setBounds({ x: X, y: Y, width: W, height: H });
    overlayWin.webContents.send('displaySize', { W, H });
  });

  globalShortcut.register('CommandOrControl+Shift+F6', () => {
    userHidden = !userHidden;
    syncOverlayVisibility();
  });

  globalShortcut.register('CommandOrControl+Shift+F7', () => {
    const idx  = THEME_NAMES.indexOf(activeTheme ?? cfg.theme);
    const next = THEME_NAMES[(idx + 1) % THEME_NAMES.length];
    if (cfg.autoTheme) {
      sendTheme(next);
      autoSwitchOverride = true;
    } else {
      applyTheme(next);
    }
  });
});

app.on('window-all-closed', () => {
  // Keep running — quit only via tray menu
});

app.on('will-quit', () => {
  appQuitting = true;
  if (focusHideTimer) { clearTimeout(focusHideTimer); focusHideTimer = null; }
  if (focusWatcher) { focusWatcher.kill(); focusWatcher = null; }
  globalShortcut.unregisterAll();
  telemetry.stop();
});

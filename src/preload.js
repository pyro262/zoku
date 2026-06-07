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

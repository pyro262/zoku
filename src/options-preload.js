const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('options', {
  getConfig:  ()       => ipcRenderer.invoke('options:getConfig'),
  applyLive:  (patch)  => ipcRenderer.send('options:applyLive', patch),
  save:       (cfg)    => ipcRenderer.send('options:save', cfg),
  cancel:     (orig)   => ipcRenderer.send('options:cancel', orig),
});

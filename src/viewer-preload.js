const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('viewer', {
  openFiles:      () => ipcRenderer.invoke('viewer:openFiles'),
  setOpacity:     (v) => ipcRenderer.send('viewer:setOpacity', v),
  getOpacity:     () => ipcRenderer.invoke('viewer:getOpacity'),
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flashAlarm', {
  getState: () => ipcRenderer.invoke('app:state'),
  setAlarm: (request) => ipcRenderer.invoke('alarm:set', request),
  cancelAlarm: () => ipcRenderer.invoke('alarm:cancel'),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('app:set-launch-at-login', enabled),
  dismissAlarm: () => ipcRenderer.send('alarm:dismiss'),
  onAlarmChanged: (callback) => {
    const handler = (_event, alarm) => callback(alarm);
    ipcRenderer.on('alarm:changed', handler);
    return () => ipcRenderer.removeListener('alarm:changed', handler);
  },
  onRing: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('alarm:ring', handler);
    return () => ipcRenderer.removeListener('alarm:ring', handler);
  }
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('telegramSync', {
  getSettings: () => ipcRenderer.invoke('telegram:get-settings'),
  saveSettings: settings => ipcRenderer.invoke('telegram:save-settings', {
    endpoint: String(settings?.endpoint || ''),
    token: String(settings?.token || '')
  }),
  syncCatalog: recipes => ipcRenderer.invoke('telegram:sync-catalog', {
    recipes: Array.isArray(recipes) ? recipes : []
  }),
  pullEvents: () => ipcRenderer.invoke('telegram:pull-events'),
  ackEvents: ids => ipcRenderer.invoke('telegram:ack-events', Array.isArray(ids) ? ids : [])
});

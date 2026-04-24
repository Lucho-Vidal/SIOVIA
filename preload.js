// Preload scripts run in a renderer process and can access Node.js APIs.
// However, we expose only a minimal API to the renderer for security.
// We use contextBridge to expose safe APIs.

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer to send and receive IPC messages
contextBridge.exposeInMainWorld('electronAPI', {
  // Database query methods
  executeQuery: (sql, params) => {
    return ipcRenderer.invoke('db-executeQuery', { sql, params });
  },
  executeNonQuery: (sql, params) => {
    return ipcRenderer.invoke('db-executeNonQuery', { sql, params });
  }
});
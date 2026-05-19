// Preload scripts run in a renderer process and can access Node.js APIs.
// However, we expose only a minimal API to the renderer for security.
// We use contextBridge to expose safe APIs.

import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer to send and receive IPC messages
contextBridge.exposeInMainWorld('electronAPI', {
  // Database query methods
  executeQuery: (sql, params) => {
    return ipcRenderer.invoke('db-executeQuery', { sql, params });
  },
  executeNonQuery: (sql, params) => {
    return ipcRenderer.invoke('db-executeNonQuery', { sql, params });
  },
  authGetState: () => {
    return ipcRenderer.invoke('auth-get-state');
  },
  authLogin: (payload) => {
    return ipcRenderer.invoke('auth-login', payload);
  },
  authListRoles: () => {
    return ipcRenderer.invoke('auth-list-roles');
  },
  authListUsers: () => {
    return ipcRenderer.invoke('auth-list-users');
  },
  authCreateUser: (payload) => {
    return ipcRenderer.invoke('auth-create-user', payload);
  },
  authUpdateUserRoles: (payload) => {
    return ipcRenderer.invoke('auth-update-user-roles', payload);
  }
});

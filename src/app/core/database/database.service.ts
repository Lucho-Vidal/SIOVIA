import { Injectable } from '@angular/core';

export interface QueryResult {
  success: boolean;
  data?: any[];
  error?: string;
}

export interface NonQueryResult {
  success: boolean;
  changes?: number;
  lastInsertRowid?: number;
  error?: string;
}

declare const window: Window & typeof globalThis & {
  electronAPI: {
    sendMessage: (channel: string, args: any) => Promise<any>;
  };
};

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  // Check if we are running in Electron
  private isElectron = !!(window && (window as any).process && (window as any).process.type);

  constructor() {
    // If not in Electron, we could use a mock service for testing in browser
    // For now, we assume Electron environment
  }

  async executeQuery(sql: string, params: any[] = []): Promise<QueryResult> {
    if (!this.isElectron) {
      return { success: false, error: 'Database service only available in Electron' };
    }

    try {
      // Send IPC message to main process
      const result = await window.electronAPI.sendMessage('db-executeQuery', { sql, params });
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async executeNonQuery(sql: string, params: any[] = []): Promise<NonQueryResult> {
    if (!this.isElectron) {
      return { success: false, error: 'Database service only available in Electron' };
    }

    try {
      // Send IPC message to main process
      const result = await window.electronAPI.sendMessage('db-executeNonQuery', { sql, params });
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
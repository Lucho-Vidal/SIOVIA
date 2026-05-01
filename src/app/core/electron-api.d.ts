export interface ElectronAPI {
  executeQuery: (sql: string, params?: any) => Promise<any>;
  executeNonQuery: (sql: string, params?: any) => Promise<any>;
  authGetState: () => Promise<any>;
  authLogin: (payload: { username: string; password: string }) => Promise<any>;
  authListRoles: () => Promise<any>;
  authListUsers: () => Promise<any>;
  authCreateUser: (payload: { personalId: number; username: string; password: string; roleIds: number[] }) => Promise<any>;
  authUpdateUserRoles: (payload: { userId: number; roleIds: number[] }) => Promise<any>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};

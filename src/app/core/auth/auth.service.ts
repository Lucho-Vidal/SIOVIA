import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatabaseService } from '../database/database.service';

export interface AuthSession {
  userId: number;
  personalId: number;
  username: string;
  fullName: string;
  roles: string[];
}

export interface AuthBootstrapState {
  hasUsers: boolean;
  adminCount: number;
}

export interface AuthLoginResult {
  success: boolean;
  data?: AuthSession;
  error?: string;
}

export interface AuthListItem {
  id: number;
  name: string;
}

export interface AuthUserRow {
  userId: number;
  personalId: number;
  username: string;
  active: boolean;
  fullName: string;
  roles: string[];
  roleIds: number[];
}

const SESSION_KEY = 'sioavia.session';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly sessionState = signal<AuthSession | null>(this.restoreSession());
  private readonly bootstrapState = signal<AuthBootstrapState | null>(null);

  readonly session = computed(() => this.sessionState());
  readonly isAuthenticated = computed(() => this.sessionState() !== null);
  readonly isAdmin = computed(() => this.hasRole('administrador'));

  constructor(
    private readonly database: DatabaseService,
    private readonly router: Router,
  ) {
    void this.refreshBootstrapState();
  }

  async refreshBootstrapState(): Promise<AuthBootstrapState> {
    if (!this.hasElectronApi()) {
      const fallback = { hasUsers: false, adminCount: 0 };
      this.bootstrapState.set(fallback);
      return fallback;
    }

    const result = await window.electronAPI.authGetState();

    if (!result.success) {
      const fallback = { hasUsers: false, adminCount: 0 };
      this.bootstrapState.set(fallback);
      return fallback;
    }

    const data = {
      hasUsers: Boolean(result.data?.hasUsers),
      adminCount: Number(result.data?.adminCount ?? 0),
    };

    this.bootstrapState.set(data);
    return data;
  }

  getBootstrapState(): AuthBootstrapState {
    return this.bootstrapState() ?? { hasUsers: true, adminCount: 0 };
  }

  async login(username: string, password: string): Promise<AuthLoginResult> {
    if (!this.hasElectronApi()) {
      return { success: false, error: 'Autenticacion no disponible fuera de Electron' };
    }

    const result = await window.electronAPI.authLogin({ username, password });

    if (!result.success) {
      return { success: false, error: result.error ?? 'No se pudo iniciar sesión' };
    }

    const session: AuthSession = {
      userId: Number(result.data.userId),
      personalId: Number(result.data.personalId),
      username: String(result.data.username ?? ''),
      fullName: String(result.data.fullName ?? ''),
      roles: Array.isArray(result.data.roles) ? result.data.roles.map((role: string) => String(role).toLowerCase()) : [],
    };

    this.sessionState.set(session);
    this.persistSession(session);

    return { success: true, data: session };
  }

  logout(): void {
    this.sessionState.set(null);
    this.clearSession();
    void this.router.navigate(['/login']);
  }

  hasRole(role: string): boolean {
    const session = this.sessionState();
    return !!session && session.roles.includes(role.toLowerCase());
  }

  hasAnyRole(roles: string[]): boolean {
    const session = this.sessionState();
    return !!session && roles.some((role) => session.roles.includes(role.toLowerCase()));
  }

  defaultRoute(): string {
    if (this.hasRole('administrador')) {
      return '/admin/usuarios';
    }

    if (this.hasRole('autorizador')) {
      return '/autorizador/solicitudes';
    }

    if (this.hasRole('operador')) {
      return '/operador/solicitudes-autorizadas';
    }

    return '/solicitante/solicitudes';
  }

  async listRoles(): Promise<AuthListItem[]> {
    if (!this.hasElectronApi()) {
      return [];
    }

    const result = await window.electronAPI.authListRoles();
    return result.success && Array.isArray(result.data) ? result.data.map((role: any) => ({ id: Number(role.id), name: String(role.name ?? '') })) : [];
  }

  async listUsers(): Promise<AuthUserRow[]> {
    if (!this.hasElectronApi()) {
      return [];
    }

    const result = await window.electronAPI.authListUsers();
    return result.success && Array.isArray(result.data)
      ? result.data.map((user: any) => ({
          userId: Number(user.userId),
          personalId: Number(user.personalId),
          username: String(user.username ?? ''),
          active: Boolean(user.active),
          fullName: String(user.fullName ?? ''),
          roles: Array.isArray(user.roles) ? user.roles.map((role: string) => String(role)) : [],
          roleIds: Array.isArray(user.roleIds) ? user.roleIds.map((roleId: number) => Number(roleId)) : [],
        }))
      : [];
  }

  async createUser(payload: { personalId: number; username: string; password: string; roleIds: number[] }): Promise<{ success: boolean; error?: string }> {
    if (!this.hasElectronApi()) {
      return { success: false, error: 'Autenticacion no disponible fuera de Electron' };
    }

    const result = await window.electronAPI.authCreateUser(payload);
    return { success: Boolean(result.success), error: result.error };
  }

  async updateUserRoles(payload: { userId: number; roleIds: number[] }): Promise<{ success: boolean; error?: string }> {
    if (!this.hasElectronApi()) {
      return { success: false, error: 'Autenticacion no disponible fuera de Electron' };
    }

    const result = await window.electronAPI.authUpdateUserRoles(payload);
    return { success: Boolean(result.success), error: result.error };
  }

  async listPersonal(): Promise<Array<{ id: number; nombre: string }>> {
    const result = await this.database.executeQuery(`SELECT PersonalID AS id, Nombre || ' ' || Apellido AS nombre FROM Personal WHERE Activo = 1 ORDER BY Nombre, Apellido`);
    return result.success && Array.isArray(result.data)
      ? result.data.map((row: any) => ({ id: Number(row.id), nombre: String(row.nombre ?? '') }))
      : [];
  }

  private restoreSession(): AuthSession | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = window.localStorage.getItem(SESSION_KEY);

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as AuthSession;
      return parsed && typeof parsed.userId === 'number' ? parsed : null;
    } catch {
      return null;
    }
  }

  private persistSession(session: AuthSession): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  private clearSession(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(SESSION_KEY);
  }

  private hasElectronApi(): boolean {
    return typeof window !== 'undefined' && !!window.electronAPI?.authLogin;
  }
}

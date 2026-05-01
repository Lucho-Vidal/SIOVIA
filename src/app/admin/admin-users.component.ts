import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthListItem, AuthService, AuthUserRow } from '../core/auth/auth.service';

@Component({
  selector: 'app-admin-users',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss'
})
export class AdminUsersComponent implements OnInit {
  readonly loading = signal(false);
  readonly message = signal('');
  readonly users = signal<AuthUserRow[]>([]);
  readonly roles = signal<AuthListItem[]>([]);
  readonly personal = signal<Array<{ id: number; nombre: string }>>([]);
  readonly selectedUserId = signal<number | null>(null);
  readonly selectedUserRoleIds = signal<number[]>([]);
  readonly createRoleIds = signal<number[]>([]);

  readonly selectedUser = computed(() => this.users().find((user) => user.userId === this.selectedUserId()) ?? null);
  readonly createForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    readonly auth: AuthService,
  ) {
    this.createForm = this.fb.group({
      personalId: [null as number | null, Validators.required],
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/)]],
    });
  }

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    const [users, roles, personal] = await Promise.all([
      this.auth.listUsers(),
      this.auth.listRoles(),
      this.auth.listPersonal(),
    ]);

    this.users.set(users);
    this.roles.set(roles);
    this.personal.set(personal);

    if (!this.selectedUserId() && users.length > 0) {
      this.selectUser(users[0].userId);
    }

    this.loading.set(false);
  }

  selectUser(userId: number): void {
    this.selectedUserId.set(userId);
    const user = this.users().find((item) => item.userId === userId);
    this.selectedUserRoleIds.set(user?.roleIds ?? []);
  }

  toggleCreateRole(roleId: number, checked: boolean): void {
    const next = new Set(this.createRoleIds());
    if (checked) {
      next.add(roleId);
    } else {
      next.delete(roleId);
    }
    this.createRoleIds.set(Array.from(next));
  }

  toggleSelectedRole(roleId: number, checked: boolean): void {
    const next = new Set(this.selectedUserRoleIds());
    if (checked) {
      next.add(roleId);
    } else {
      next.delete(roleId);
    }
    this.selectedUserRoleIds.set(Array.from(next));
  }

  async createUser(): Promise<void> {
    if (this.createForm.invalid || this.createRoleIds().length === 0) {
      this.createForm.markAllAsTouched();
      this.message.set('Completa todos los datos y asigna al menos un rol.');
      return;
    }

    const value = this.createForm.getRawValue();
    const result = await this.auth.createUser({
      personalId: Number(value.personalId),
      username: String(value.username ?? '').trim(),
      password: String(value.password ?? ''),
      roleIds: this.createRoleIds(),
    });

    if (!result.success) {
      this.message.set(result.error ?? 'No se pudo crear el usuario');
      return;
    }

    this.createForm.reset();
    this.createRoleIds.set([]);
    this.message.set('Usuario creado');
    await this.reload();
  }

  async saveRoles(): Promise<void> {
    const userId = this.selectedUserId();

    if (!userId) {
      this.message.set('Selecciona un usuario');
      return;
    }

    const result = await this.auth.updateUserRoles({ userId, roleIds: this.selectedUserRoleIds() });

    if (!result.success) {
      this.message.set(result.error ?? 'No se pudieron guardar los roles');
      return;
    }

    this.message.set('Roles actualizados');
    await this.reload();
  }
}

import { Routes } from '@angular/router';
import { App } from './app';
import { AdminUsersComponent } from './admin/admin-users.component';
import { LoginComponent } from './auth/login.component';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'admin', pathMatch: 'full', redirectTo: 'admin/usuarios' },
  {
    path: 'admin/usuarios',
    component: AdminUsersComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['administrador'] },
  },
  {
    path: 'solicitante/solicitudes',
    component: App,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['solicitante'] },
  },
  {
    path: 'autorizador/solicitudes',
    component: App,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['autorizador'] },
  },
  {
    path: 'operador/solicitudes-autorizadas',
    component: App,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['operador'] },
  },
  {
    path: 'admin/solicitudes',
    component: App,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['administrador'] },
  },
  { path: '**', redirectTo: 'login' },
];

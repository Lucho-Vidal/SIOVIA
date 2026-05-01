import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  readonly loading = signal(false);
  readonly message = signal('');
  readonly form: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {
    this.form = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
    });
  }

  async ngOnInit(): Promise<void> {
    const state = await this.auth.refreshBootstrapState();

    if (!state.hasUsers) {
      this.message.set('No se detectaron usuarios. Debes crear el primer administrador.');
    }

    if (this.auth.isAuthenticated()) {
      await this.router.navigateByUrl(this.auth.defaultRoute());
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.message.set('Completa usuario y contraseña.');
      return;
    }

    this.loading.set(true);
    const { username, password } = this.form.getRawValue();
    const result = await this.auth.login(username ?? '', password ?? '');
    this.loading.set(false);

    if (!result.success) {
      this.message.set(result.error ?? 'No se pudo iniciar sesión');
      return;
    }

    await this.router.navigateByUrl(this.auth.defaultRoute());
  }
}

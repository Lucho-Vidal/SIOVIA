import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth.service';

function canAccessRole(auth: AuthService, roles: string[] | undefined): boolean {
  if (!roles || roles.length === 0) {
    return true;
  }

  if (auth.hasRole('administrador')) {
    return true;
  }

  return auth.hasAnyRole(roles);
}

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = route.data['roles'] as string[] | undefined;

  if (auth.isAuthenticated() && canAccessRole(auth, roles)) {
    return true;
  }

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  return router.parseUrl(auth.defaultRoute());
};

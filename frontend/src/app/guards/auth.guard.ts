import { inject } from '@angular/core';
import {CanActivateFn} from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);

  if (authService.isAuthenticated()) {
    return true;
  }

  sessionStorage.setItem('post_login_redirect', state.url);
  authService.login();
  return false;
};

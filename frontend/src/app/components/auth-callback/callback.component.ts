import {Component, OnInit, inject} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: '<p>Authenticating...</p>'
})
export class AuthCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (token) {
        this.authService.handleAuthCallback(token);
        const redirect = sessionStorage.getItem('post_login_redirect');
        sessionStorage.removeItem('post_login_redirect');
        this.router.navigate([redirect || '/maps']);
      } else {
        sessionStorage.removeItem('post_login_redirect');
        this.router.navigate(['/']);
      }
    });
  }
}

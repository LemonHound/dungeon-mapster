import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: '<p>Authenticating...</p>'
})
export class AuthCallbackComponent implements OnInit {

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      console.log('Callback received token:', token);
      if (token) {
        this.authService.handleAuthCallback(token);
        console.log('Token stored, checking localStorage:', localStorage.getItem('auth_token'));
        this.router.navigate(['/maps']);
      } else {
        console.log('No token found in params');
        this.router.navigate(['/']);
      }
    });
  }
}

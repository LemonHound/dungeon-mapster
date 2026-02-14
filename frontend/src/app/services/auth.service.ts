import {Injectable, inject} from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {BehaviorSubject} from 'rxjs';

export interface User {
  id: number;
  email: string;
  name: string;
  profilePictureUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);

  private readonly TOKEN_KEY = 'auth_token';
  private readonly API_URL = 'http://localhost:8080/api';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.loadCurrentUser();
  }

  login(): void {
    window.location.href = 'http://localhost:8080/oauth2/authorization/google';
  }

  handleAuthCallback(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.loadCurrentUser();
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.currentUserSubject.next(null);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private loadCurrentUser(): void {
    if (!this.isAuthenticated()) {
      this.currentUserSubject.next(null);
      return;
    }

    this.http.get<User>(`${this.API_URL}/auth/me`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (user) => this.currentUserSubject.next(user),
      error: () => {
        this.logout();
      }
    });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }
}

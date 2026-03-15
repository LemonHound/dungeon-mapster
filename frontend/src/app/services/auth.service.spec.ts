import {TestBed} from '@angular/core/testing';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideHttpClient} from '@angular/common/http';
import {AuthService, User} from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AuthService);
    httpMock.expectNone('/api/auth/me');
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('isAuthenticated returns false when no token', () => {
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('isAuthenticated returns true after handleAuthCallback', () => {
    service.handleAuthCallback('some-token');
    const req = httpMock.expectOne('/api/auth/me');
    req.flush({id: 1, email: 'a@b.com', name: 'Test', profilePictureUrl: ''});
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('getToken returns stored token', () => {
    service.handleAuthCallback('my-jwt');
    httpMock.expectOne('/api/auth/me').flush({id: 1, email: 'a@b.com', name: 'Test', profilePictureUrl: ''});
    expect(service.getToken()).toBe('my-jwt');
  });

  it('logout clears token and user', () => {
    service.handleAuthCallback('some-token');
    httpMock.expectOne('/api/auth/me').flush({id: 1, email: 'a@b.com', name: 'Test', profilePictureUrl: ''});

    service.logout();
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.getToken()).toBeNull();

    let user: User | null = null;
    service.currentUser$.subscribe(u => (user = u));
    expect(user).toBeNull();
  });

  it('currentUser$ emits user on successful loadCurrentUser', () => {
    service.handleAuthCallback('token');
    const req = httpMock.expectOne('/api/auth/me');
    req.flush({id: 42, email: 'user@test.com', name: 'User', profilePictureUrl: 'pic.jpg'});

    let user: User | null = null;
    service.currentUser$.subscribe(u => (user = u));
    expect(user?.email).toBe('user@test.com');
  });

  it('currentUser$ null and logout called on auth/me error', () => {
    service.handleAuthCallback('bad-token');
    const req = httpMock.expectOne('/api/auth/me');
    req.flush('Unauthorized', {status: 401, statusText: 'Unauthorized'});

    expect(service.isAuthenticated()).toBeFalse();
  });
});

import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {WebSocketService} from './websocket.service';
import {AuthService} from './auth.service';
import {Client} from '@stomp/stompjs';

describe('WebSocketService', () => {
  let service: WebSocketService;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', ['getToken']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {provide: AuthService, useValue: authService},
        WebSocketService,
      ],
    });
    service = TestBed.inject(WebSocketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('connectionStatus$ initializes as disconnected', () => {
    expect(service.connectionStatus$.getValue()).toBe('disconnected');
  });

  it('connect does not activate client when token is absent', async () => {
    authService.getToken.and.returnValue(null);
    await service.connect(1);
    expect(service.connectionStatus$.getValue()).toBe('disconnected');
  });

  it('disconnect clears client and sets status to disconnected', () => {
    service.disconnect();
    expect(service.connectionStatus$.getValue()).toBe('disconnected');
  });

  it('sendSelection does not throw when not connected', () => {
    expect(() => service.sendSelection(1, 2)).not.toThrow();
  });

  it('sendFieldFocus does not throw when not connected', () => {
    expect(() => service.sendFieldFocus(1, 2, 'name')).not.toThrow();
  });

  it('sendFieldBlur does not throw when not connected', () => {
    expect(() => service.sendFieldBlur()).not.toThrow();
  });

  it('scheduleReconnect doubles delay on each reconnect attempt', fakeAsync(() => {
    authService.getToken.and.returnValue('fake-token');
    const connectSpy = spyOn(service, 'connect').and.returnValue(Promise.resolve());

    (service as any).mapId = 1;
    (service as any).reconnectDelay = 1000;
    (service as any).scheduleReconnect();

    tick(1000);
    expect(connectSpy).toHaveBeenCalledWith(1);
    expect((service as any).reconnectDelay).toBe(2000);
  }));

  it('scheduleReconnect caps delay at 30 seconds', fakeAsync(() => {
    authService.getToken.and.returnValue('fake-token');
    spyOn(service, 'connect').and.returnValue(Promise.resolve());

    (service as any).mapId = 1;
    (service as any).reconnectDelay = 16000;
    (service as any).scheduleReconnect();

    tick(16000);
    expect((service as any).reconnectDelay).toBe(30000);
  }));
});

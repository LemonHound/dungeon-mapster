import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {vi} from 'vitest';
import {WebSocketService} from './websocket.service';
import {AuthService} from './auth.service';

interface ServiceInternals {
  mapId: number | null;
  reconnectDelay: number;
  scheduleReconnect: () => void;
}

describe('WebSocketService', () => {
  let service: WebSocketService;
  let authService: {getToken: ReturnType<typeof vi.fn>};

  beforeEach(() => {
    authService = {getToken: vi.fn()};

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
    authService.getToken.mockReturnValue(null);
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
    authService.getToken.mockReturnValue('fake-token');
    const connectSpy = vi.spyOn(service, 'connect').mockResolvedValue(undefined);
    const internals = service as unknown as ServiceInternals;

    internals.mapId = 1;
    internals.reconnectDelay = 1000;
    internals.scheduleReconnect();

    tick(1000);
    expect(connectSpy).toHaveBeenCalledWith(1);
    expect(internals.reconnectDelay).toBe(2000);
  }));

  it('scheduleReconnect caps delay at 30 seconds', fakeAsync(() => {
    authService.getToken.mockReturnValue('fake-token');
    vi.spyOn(service, 'connect').mockResolvedValue(undefined);
    const internals = service as unknown as ServiceInternals;

    internals.mapId = 1;
    internals.reconnectDelay = 16000;
    internals.scheduleReconnect();

    tick(16000);
    expect(internals.reconnectDelay).toBe(30000);
  }));
});

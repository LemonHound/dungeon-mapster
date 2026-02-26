import {Injectable, inject} from '@angular/core';
import {Subject, BehaviorSubject} from 'rxjs';
import {AuthService} from './auth.service';
import {WsMessage} from '../models/presence.model';
import type {Client, IMessage} from '@stomp/stompjs';

@Injectable({providedIn: 'root'})
export class WebSocketService {
  private authService = inject(AuthService);

  private client: Client | null = null;
  private mapId: number | null = null;
  private reconnectDelay = 1000;
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  readonly messages$ = new Subject<WsMessage>();
  readonly connectionStatus$ = new BehaviorSubject<'connected' | 'reconnecting' | 'disconnected'>('disconnected');

  async connect(mapId: number): Promise<void> {
    this.mapId = mapId;
    const token = this.authService.getToken();
    if (!token) return;

    const {Client} = await import('@stomp/stompjs');

    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/websocket?token=${token}&mapId=${mapId}`;

    this.client = new Client({
      brokerURL: url,
      reconnectDelay: 0,
      onConnect: () => {
        this.reconnectDelay = 1000;
        this.connectionStatus$.next('connected');

        this.client!.subscribe(`/topic/map/${mapId}`, (frame: IMessage) => {
          try {
            const msg = JSON.parse(frame.body) as WsMessage;
            this.messages$.next(msg);
          } catch {
            // ignore malformed frames
          }
        });

        this.client!.subscribe('/user/queue/sync', (frame: IMessage) => {
          try {
            const msg = JSON.parse(frame.body) as WsMessage;
            this.messages$.next(msg);
          } catch {
            // ignore malformed frames
          }
        });
      },
      onDisconnect: () => {
        this.connectionStatus$.next('reconnecting');
        this.scheduleReconnect();
      },
      onStompError: () => {
        this.connectionStatus$.next('reconnecting');
        this.scheduleReconnect();
      },
    });

    this.client.activate();
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.client?.deactivate();
    this.client = null;
    this.connectionStatus$.next('disconnected');
  }

  sendSelection(row: number, col: number): void {
    this.publish('/app/map/selection', {row, col});
  }

  sendFieldFocus(row: number, col: number, field: string): void {
    this.publish('/app/map/field-focus', {row, col, field});
  }

  sendFieldBlur(): void {
    this.publish('/app/map/field-blur', {});
  }

  private publish(destination: string, body: object): void {
    if (!this.client) return;
    this.client.publish({destination, body: JSON.stringify(body)});
  }

  private scheduleReconnect(): void {
    if (!this.mapId) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      this.connect(this.mapId!);
    }, this.reconnectDelay);
  }
}

import { Injectable, NgZone } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';
import { newChatGuid } from '../models/chat.model';
import { AlertSoundService } from './alert-sound.service';

export interface ChatPrivateMessage {
  message: string;
  fromAdmin: boolean;
  userId?: string;
}

export type ChatConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

@Injectable({
  providedIn: 'root',
})
export class ChatHubService {
  private static readonly CHAT_USER_KEY = 'shop_chat_user_id';

  public hubConnection?: signalR.HubConnection;

  private readonly connectionStateSubject = new BehaviorSubject<ChatConnectionState>('disconnected');
  private readonly privateMessage = new Subject<ChatPrivateMessage>();
  private readonly supportOnlineSubject = new BehaviorSubject<boolean>(false);
  private startInProgress = false;
  private registerInProgress: Promise<void> | null = null;
  private statusPoll: ReturnType<typeof setInterval> | null = null;

  readonly connectionState$ = this.connectionStateSubject.asObservable();
  readonly privateMessage$ = this.privateMessage.asObservable();
  readonly supportOnline$ = this.supportOnlineSubject.asObservable();

  constructor(
    private auth: AuthService,
    private ngZone: NgZone,
    private alertSound: AlertSoundService,
  ) {}

  get connected(): boolean {
    return this.connectionStateSubject.value === 'connected';
  }

  get chatUserId(): string {
    if (typeof localStorage === 'undefined') {
      return newChatGuid();
    }
    let id = localStorage.getItem(ChatHubService.CHAT_USER_KEY);
    if (!id) {
      id = newChatGuid();
      localStorage.setItem(ChatHubService.CHAT_USER_KEY, id);
    }
    return id;
  }

  startConnection(): void {
    const tenantId = this.auth.tenantId;
    if (!tenantId) {
      return;
    }

    const existing = this.hubConnection;
    if (existing) {
      const state = existing.state;
      if (
        state === signalR.HubConnectionState.Connecting
        || state === signalR.HubConnectionState.Connected
        || state === signalR.HubConnectionState.Reconnecting
      ) {
        void this.registerCustomer();
        return;
      }
      void existing.stop().catch(() => undefined);
      this.hubConnection = undefined;
    }

    if (this.startInProgress) {
      return;
    }

    this.startInProgress = true;
    this.connectionStateSubject.next('connecting');

    const token = this.auth.getEncryptedToken();
    const connectionOptions: signalR.IHttpConnectionOptions = {};
    if (token) {
      connectionOptions.accessTokenFactory = () => this.auth.getEncryptedToken() || token;
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.buildHubUrl(), connectionOptions)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.hubConnection.on(
      'ReceivePrivateMessage',
      (message: string, fromAdmin: boolean, userId?: string) => {
        this.ngZone.run(() => {
          this.privateMessage.next({
            message,
            fromAdmin: !!fromAdmin,
            userId,
          });
          if (fromAdmin) {
            this.alertSound.play();
          }
        });
      },
    );

    this.hubConnection.on('SupportStatusUpdated', (isOnline: boolean) => {
      this.ngZone.run(() => this.supportOnlineSubject.next(!!isOnline));
    });

    this.hubConnection.onreconnected(() => {
      this.ngZone.run(() => {
        this.connectionStateSubject.next('connected');
        void this.registerCustomer();
        this.startStatusPoll();
      });
    });

    this.hubConnection.onclose(() => {
      this.ngZone.run(() => this.connectionStateSubject.next('disconnected'));
      this.stopStatusPoll();
    });

    void this.hubConnection
      .start()
      .then(async () => {
        this.connectionStateSubject.next('connected');
        await this.registerCustomer();
        this.startStatusPoll();
      })
      .catch((err) => {
        this.connectionStateSubject.next('error');
        console.warn('[Chat] hub start failed', err);
      })
      .finally(() => {
        this.startInProgress = false;
      });
  }

  async ensureReady(): Promise<void> {
    if (!this.auth.tenantId) {
      throw new Error('Store is still loading. Please try again in a moment.');
    }

    if (!this.hubConnection || this.hubConnection.state === signalR.HubConnectionState.Disconnected) {
      this.startConnection();
    }

    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const conn = this.hubConnection;
      if (conn?.state === signalR.HubConnectionState.Connected) {
        await this.registerCustomer();
        return;
      }
      if (this.connectionStateSubject.value === 'error') {
        break;
      }
      await this.delay(200);
    }

    throw new Error('Unable to connect to chat. Please refresh and try again.');
  }

  async registerCustomer(): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      return;
    }

    if (this.registerInProgress) {
      await this.registerInProgress;
      return;
    }

    const profile = this.auth.getCustomerProfile();
    const name = profile?.customerName?.trim() || (this.auth.isLoggedIn() ? 'Customer' : 'Guest');
    const email = this.auth.getCustomerEmail();

    this.registerInProgress = this.hubConnection
      .invoke('RegisterUser', this.chatUserId, name, false, email || null)
      .then(async () => {
        await this.requestSupportStatus();
      })
      .catch((err) => {
        console.warn('[Chat] register failed', err);
        throw err;
      })
      .finally(() => {
        this.registerInProgress = null;
      });

    await this.registerInProgress;
  }

  async requestSupportStatus(): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      return;
    }

    try {
      await this.hubConnection.invoke('RequestSupportStatus');
    } catch (err) {
      console.warn('[Chat] support status failed', err);
    }
  }

  async sendMessage(message: string): Promise<void> {
    await this.ensureReady();

    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Chat is not connected.');
    }

    await this.hubConnection.invoke('SendPrivateMessageToUser', message, false, this.chatUserId);
  }

  private buildHubUrl(): string {
    const base = (environment.baseUrl || '').endsWith('/') ? environment.baseUrl : `${environment.baseUrl || ''}/`;
    const params = new URLSearchParams();
    params.set('platform', 'online-shop');
    const tenantId = this.auth.tenantId;
    if (tenantId) {
      params.set('Abp.TenantId', String(tenantId));
      params.set('tenantId', String(tenantId));
    }
    return `${base}signalr/chatHub?${params.toString()}`;
  }

  private startStatusPoll(): void {
    this.stopStatusPoll();
    this.statusPoll = setInterval(() => {
      void this.requestSupportStatus();
    }, 8000);
  }

  private stopStatusPoll(): void {
    if (this.statusPoll) {
      clearInterval(this.statusPoll);
      this.statusPoll = null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

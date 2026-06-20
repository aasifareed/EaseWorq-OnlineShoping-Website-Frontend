import { Injectable, NgZone } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { NotificationApiDto, ShopNotificationItem } from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  public signalrNotifications: ShopNotificationItem[] = [];
  public hubConnection?: signalR.HubConnection;
  public signalRConnectionEnabled = false;

  private startInProgress = false;

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private ngZone: NgZone,
    private toastr: ToastrService
  ) {}

  get unreadCount(): number {
    return this.signalrNotifications.filter((n) => !n.isRead).length;
  }

  /** Match admin: connect only when logged in with encrypted token; load unread first. */
  startConnection(): void {
    const token = this.authService.getEncryptedToken();
    const loggedIn = this.authService.isLoggedIn();

    console.log('[SignalR] startConnection', {
      loggedIn,
      hasToken: !!token,
      userId: this.authService.getUserId(),
      tenantId: this.authService.tenantId,
      storeId: this.authService.storeId
    });

    if (!loggedIn || !token) {
      console.warn('[SignalR] skipped — customer not logged in or encrypted token missing');
      return;
    }

    const existing = this.hubConnection;
    if (existing) {
      const state = existing.state;
      console.log('[SignalR] existing connection state:', signalR.HubConnectionState[state]);
      if (
        state === signalR.HubConnectionState.Connecting
        || state === signalR.HubConnectionState.Connected
        || state === signalR.HubConnectionState.Reconnecting
      ) {
        void this.refreshNotifications();
        return;
      }
      void existing.stop().catch(() => undefined);
      this.hubConnection = undefined;
    }

    if (this.startInProgress) {
      return;
    }

    this.startInProgress = true;
    void this.refreshNotifications()
      .then(() => this.openHubConnection())
      .finally(() => {
        this.startInProgress = false;
      });
  }

  refreshNotifications(): Promise<void> {
    if (!this.authService.isLoggedIn()) {
      this.signalrNotifications = [];
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.notificationService.loadUnreadCustomerNotifications().subscribe({
        next: (items) => {
          this.ngZone.run(() => {
            this.signalrNotifications = items;
            console.log('[SignalR] unread notifications loaded:', items.length);
            resolve();
          });
        },
        error: (err) => {
          console.warn('[SignalR] failed to load unread notifications:', err);
          this.ngZone.run(() => resolve());
        }
      });
    });
  }

  removeNotification(notificationId: number): void {
    this.signalrNotifications = this.signalrNotifications.filter((n) => n.id !== notificationId);
  }

  closeConnection(): void {
    this.signalRConnectionEnabled = false;
    this.signalrNotifications = [];
    this.startInProgress = false;

    const conn = this.hubConnection;
    this.hubConnection = undefined;
    if (conn) {
      void conn.stop().catch(() => undefined);
    }
    console.log('[SignalR] connection closed');
  }

  private openHubConnection(): void {
    const token = this.authService.getEncryptedToken();
    if (!this.authService.isLoggedIn() || !token) {
      return;
    }

    const hubUrl = this.buildHubUrl();
    console.log('[SignalR] hub URL:', hubUrl);

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => this.authService.getEncryptedToken()
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          if (retryContext.previousRetryCount < 5) {
            return [0, 2000, 5000, 10000, 20000][retryContext.previousRetryCount];
          }
          return 30000;
        }
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.registerOrderStatusListener();

    this.hubConnection.onreconnected((connectionId) => {
      console.log('[SignalR] reconnected:', connectionId);
      this.ngZone.run(() => this.refreshNotifications());
    });

    this.hubConnection.onclose((error) => {
      this.signalRConnectionEnabled = false;
      console.warn('[SignalR] disconnected', error?.message || error || 'no error detail');
    });

    void this.hubConnection
      .start()
      .then(() => {
        this.signalRConnectionEnabled = true;
        console.log('[SignalR] connected, connectionId:', this.hubConnection?.connectionId);
      })
      .catch((err) => {
        this.signalRConnectionEnabled = false;
        console.warn('[SignalR] start failed:', err);
      });
  }

  private registerOrderStatusListener(): void {
    if (!this.hubConnection) {
      return;
    }

    this.hubConnection.off('OnlineSalesOrderUpdated');
    this.hubConnection.on(
      'OnlineSalesOrderUpdated',
      (payload: NotificationApiDto | Record<string, unknown>, message?: string) => {
        console.log('[SignalR] OnlineSalesOrderUpdated received:', payload, message);
        this.ngZone.run(() => this.handleOrderStatusNotification(payload, message));
      }
    );
  }

  private handleOrderStatusNotification(
    payload: NotificationApiDto | Record<string, unknown>,
    message?: string
  ): void {
    const mapped = this.notificationService.mapFromApi(payload);
    if (mapped.id && !this.signalrNotifications.some((n) => n.id === mapped.id)) {
      this.signalrNotifications = [mapped, ...this.signalrNotifications];
    }

    const description = mapped.text || message || 'Your order status was updated.';
    this.toastr.info(description, mapped.title || 'Order Status Updated', { progressBar: true });
  }

  /** Admin-style base URL + online-shop query params. */
  private buildHubUrl(): string {
    const base = this.hubBaseUrl();
    const params = new URLSearchParams();
    params.set('platform', 'online-shop');
    const shopId = this.authService.storeId;
    if (shopId) {
      params.set('shopId', shopId);
    }
    return `${base}signalr/mart-task-hub?${params.toString()}`;
  }

  private hubBaseUrl(): string {
    const base = environment.baseUrl || '';
    return base.endsWith('/') ? base : `${base}/`;
  }
}

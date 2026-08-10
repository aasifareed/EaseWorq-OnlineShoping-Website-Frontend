import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map, of, tap, catchError, switchMap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';
import { asBackgroundRequest } from '../interceptors/background-request';
import { NotificationApiDto, ShopNotificationItem } from '../models/notification.model';

export interface CustomerNotificationContext {
  /** Stored as string to avoid JS precision loss on large ABP user ids. */
  userId: string | null;
  tenantId: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  private apiRoot(): string {
    const b = environment.baseUrl || '';
    return b.endsWith('/') ? b : `${b}/`;
  }

  getCustomerContext(): CustomerNotificationContext {
    this.auth.syncUserIdFromToken();
    const userId = this.auth.getUserId() ?? this.readStoredUserId();
    const tenantId = this.auth.tenantId;
    return { userId, tenantId };
  }

  private readStoredUserId(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem('shop_auth_user_id')?.trim();
    return raw || null;
  }

  private tenantHeaders(): HttpHeaders {
    const tenantId = this.auth.tenantId;
    return new HttpHeaders({
      'Abp.TenantId': String(tenantId)
    });
  }

  /**
   * The bell dropdown polls in the background and reports on itself, so nothing it does should take
   * the screen away from whatever the customer is reading.
   */
  private quietRequestOptions() {
    return asBackgroundRequest({ headers: this.tenantHeaders() });
  }

  loadNotifications(): Observable<ShopNotificationItem[]> {
    const path = environment.urls?.Notification_GetAll || 'Notification/GetNotifications';
    const url = `${this.apiRoot()}api/services/app/${path}`;
    return this.http.get<any>(url, this.quietRequestOptions()).pipe(
      map((resp) => this.mapResponseItems(resp))
    );
  }

  loadUnreadNotifications(): Observable<ShopNotificationItem[]> {
    return this.loadUnreadCustomerNotifications();
  }

  loadUnreadCustomerNotifications(): Observable<ShopNotificationItem[]> {
    const ctx = this.getCustomerContext();
    console.log('[Notifications] load unread — userId:', ctx.userId, 'tenantId:', ctx.tenantId);

    if (!ctx.userId) {
      console.warn('[Notifications] skipped — shop_auth_user_id missing');
      return of([]);
    }

    const path =
      environment.urls?.Notification_GetUnread || 'Notification/GetUnreadCustomerNotifications';
    const params = new HttpParams()
      .set('userId', String(ctx.userId))
      .set('tenantId', String(ctx.tenantId));
    const url = `${this.apiRoot()}api/services/app/${path}`;

    return this.http.get<any>(url, asBackgroundRequest({ headers: this.tenantHeaders(), params })).pipe(
      tap((resp) => {
        const items = resp?.result?.items ?? resp?.result ?? resp?.items ?? [];
        const count = Array.isArray(items) ? items.length : 0;
        console.log('[Notifications] unread API response count:', count);
      }),
      map((resp) => this.mapResponseItems(resp))
    );
  }

  markAsRead(notificationId: number): Observable<boolean> {
    return this.markCustomerNotificationAsRead(notificationId);
  }

  markCustomerNotificationAsRead(notificationId: number): Observable<boolean> {
    const ctx = this.getCustomerContext();
    if (!ctx.userId) {
      return of(false);
    }

    const markPath =
      environment.urls?.Notification_MarkAsRead || 'Notification/MarkCustomerNotificationAsRead';
    const url = `${this.apiRoot()}api/services/app/${markPath}`;
    const body = {
      notificationId,
      userId: ctx.userId,
      tenantId: ctx.tenantId
    };

    return this.http.post<any>(url, body, this.quietRequestOptions()).pipe(
      map((resp) => !!(resp?.result ?? resp))
    );
  }

  /** Marks every unread notification as read for the logged-in customer (single bulk API call). */
  markAllCustomerNotificationsAsRead(fallbackIds: number[] = []): Observable<boolean> {
    const ctx = this.getCustomerContext();
    if (!ctx.userId) {
      return of(false);
    }

    const markAllPath =
      environment.urls?.Notification_MarkAllAsRead || 'Notification/MarkAllCustomerNotificationsAsRead';
    const url = `${this.apiRoot()}api/services/app/${markAllPath}`;
    const body = {
      userId: ctx.userId,
      tenantId: ctx.tenantId,
    };

    return this.http.post<any>(url, body, this.quietRequestOptions()).pipe(
      map((resp) => !!(resp?.result ?? resp)),
      switchMap((ok) => (ok ? of(true) : this.markAllViaLegacyEndpoint(fallbackIds))),
      catchError(() => this.markAllViaLegacyEndpoint(fallbackIds)),
    );
  }

  /** Fallback when bulk endpoint is not deployed yet. */
  private markAllViaLegacyEndpoint(fallbackIds: number[]): Observable<boolean> {
    const ctx = this.getCustomerContext();
    if (!ctx.userId) {
      return of(false);
    }

    const markPath =
      environment.urls?.Notification_MarkAsRead || 'Notification/MarkCustomerNotificationAsRead';
    const url = `${this.apiRoot()}api/services/app/${markPath}`;
    const body = {
      notificationId: 0,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
    };

    return this.http.post<any>(url, body, this.quietRequestOptions()).pipe(
      map((resp) => !!(resp?.result ?? resp)),
      switchMap((ok) => (ok ? of(true) : this.markEachNotificationAsRead(fallbackIds))),
      catchError(() => this.markEachNotificationAsRead(fallbackIds)),
    );
  }

  private markEachNotificationAsRead(notificationIds: number[]): Observable<boolean> {
    const ids = [...new Set(notificationIds.filter((id) => id > 0))];
    if (!ids.length) {
      return of(false);
    }

    return forkJoin(ids.map((id) => this.markCustomerNotificationAsRead(id))).pipe(
      map((results) => results.every(Boolean))
    );
  }

  mapFromApi(element: NotificationApiDto | Record<string, unknown>): ShopNotificationItem {
    return this.mapNotification(this.normalizeApiDto(element));
  }

  private mapResponseItems(resp: any): ShopNotificationItem[] {
    const result = resp?.result ?? resp;
    const items: Array<NotificationApiDto | Record<string, unknown>> = Array.isArray(result)
      ? result
      : (result?.items ?? result?.Items ?? []);
    return items.map((element) => this.mapNotification(this.normalizeApiDto(element)));
  }

  private normalizeApiDto(raw: NotificationApiDto | Record<string, unknown>): NotificationApiDto {
    const dto = raw as Record<string, unknown>;
    return {
      id: Number(dto['id'] ?? dto['Id'] ?? 0),
      title: String(dto['title'] ?? dto['Title'] ?? ''),
      description: String(dto['description'] ?? dto['Description'] ?? ''),
      isRead: !!(dto['isRead'] ?? dto['IsRead']),
      creationTime: String(dto['creationTime'] ?? dto['CreationTime'] ?? ''),
      link: (dto['link'] ?? dto['Link']) as string | undefined,
      status: (dto['status'] ?? dto['Status']) as string | undefined,
      statusText: (dto['statusText'] ?? dto['StatusText']) as string | undefined,
      sourceId: (dto['sourceId'] ?? dto['SourceId']) as string | undefined,
      sourceType: (dto['sourceType'] ?? dto['SourceType']) as string | undefined,
      taskGroupId: (dto['taskGroupId'] ?? dto['TaskGroupId']) as number | undefined
    };
  }

  private mapNotification(element: NotificationApiDto): ShopNotificationItem {
    const statusText = element.statusText
      || element.status
      || 'Update';

    return {
      id: element.id,
      icon: 'fa fa-shopping-bag',
      title: element.title || 'Notification',
      badge: statusText,
      text: element.description || '',
      time: element.creationTime ? new Date(element.creationTime) : new Date(),
      status: this.mapStatusClass(statusText),
      link: element.link || '',
      isRead: !!element.isRead,
      sourceType: element.sourceType,
      sourceId: element.sourceId,
      taskGroupId: element.taskGroupId
    };
  }

  private mapStatusClass(statusText: string): string {
    const s = (statusText || '').toLowerCase();
    if (s.includes('cancel') || s.includes('fail')) {
      return 'danger';
    }
    if (s.includes('deliver') || s.includes('complete') || s.includes('paid')) {
      return 'success';
    }
    if (s.includes('ship') || s.includes('confirm')) {
      return 'info';
    }
    return 'warning';
  }
}

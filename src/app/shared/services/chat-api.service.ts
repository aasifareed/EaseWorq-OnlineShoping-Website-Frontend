import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';
import { asBackgroundRequest } from '../interceptors/background-request';
import { ChatHistoryItem } from '../models/chat.model';

@Injectable({
  providedIn: 'root',
})
export class ChatApiService {
  constructor(
    private http: HttpClient,
    private auth: AuthService,
  ) {}

  getChatHistory(userId: string): Observable<ChatHistoryItem[]> {
    const path = environment.urls?.Chat_GetChatHistory || 'Chat/GetChatHistory';
    const url = `${this.apiRoot()}api/services/app/${path}?userId=${encodeURIComponent(userId)}`;
    return this.http.get<any>(url, this.requestOptions()).pipe(
      map((resp) => (resp?.result || []).map((item: any) => ({
        message: item.message || item.Message,
        timestamp: item.timestamp || item.Timestamp,
        fromAdmin: !!(item.fromAdmin ?? item.FromAdmin),
      }))),
      catchError(() => of([])),
    );
  }

  uploadImage(file: File): Observable<string> {
    const path = environment.urls?.ChatImage_Upload || 'ChatImageUpload/Upload';
    const url = `${this.apiRoot()}api/services/app/${path}`;
    const form = new FormData();
    form.append('File', file);
    return this.http.post<any>(url, form, this.requestOptions()).pipe(
      map((resp) => String(resp?.result || '')),
    );
  }

  getSupportStatus(): Observable<{ isOnline: boolean; adminCount: number }> {
    const path = environment.urls?.Chat_GetSupportStatus || 'Chat/GetSupportStatus';
    const url = `${this.apiRoot()}api/services/app/${path}`;
    return this.http.get<any>(url, this.requestOptions()).pipe(
      map((resp) => ({
        isOnline: !!(resp?.result?.isOnline ?? resp?.result?.IsOnline),
        adminCount: resp?.result?.adminCount ?? resp?.result?.AdminCount ?? 0,
      })),
      catchError(() => of({ isOnline: false, adminCount: 0 })),
    );
  }

  private apiRoot(): string {
    const base = environment.baseUrl || '';
    return base.endsWith('/') ? base : `${base}/`;
  }

  private requestOptions() {
    const tenantId = this.auth.tenantId;
    const headers = new HttpHeaders({
      'Abp.TenantId': String(tenantId || ''),
    });
    return asBackgroundRequest({ headers });
  }
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { asBackgroundRequest } from '../interceptors/background-request';
import { ChatHistoryItem, ChatHistoryChannel, CHAT_HISTORY_CHANNELS } from '../models/chat.model';
import { StorefrontTenantService } from './storefront-tenant.service';

@Injectable({
  providedIn: 'root',
})
export class ChatApiService {
  constructor(
    private http: HttpClient,
    private storefrontTenant: StorefrontTenantService,
  ) {}

  getChatHistory(userId: string, chatChannel: ChatHistoryChannel = CHAT_HISTORY_CHANNELS.support): Observable<ChatHistoryItem[]> {
    const path = environment.urls?.Chat_GetChatHistory || 'Chat/GetChatHistory';
    const url = this.storefrontTenant.buildAppServiceUrl(this.apiRoot(), path, {
      userId,
      chatChannel,
    });
    return this.http.get<any>(url, this.requestOptions()).pipe(
      map((resp) => (resp?.result || []).map((item: any) => ({
        message: item.message || item.Message,
        timestamp: item.timestamp || item.Timestamp,
        fromAdmin: !!(item.fromAdmin ?? item.FromAdmin),
        messageType: item.messageType || item.MessageType || 'Text',
        metadataJson: item.metadataJson || item.MetadataJson,
        priceChallengeId: item.priceChallengeId || item.PriceChallengeId,
      } as ChatHistoryItem))),
      catchError(() => of([])),
    );
  }

  uploadImage(file: File): Observable<string> {
    const path = environment.urls?.ChatImage_Upload || 'ChatImageUpload/Upload';
    const url = this.storefrontTenant.buildAppServiceUrl(this.apiRoot(), path);
    const form = new FormData();
    form.append('File', file);
    return this.http.post<any>(url, form, this.requestOptions()).pipe(
      map((resp) => String(resp?.result || '')),
    );
  }

  getSupportStatus(): Observable<{ isOnline: boolean; adminCount: number }> {
    const path = environment.urls?.Chat_GetSupportStatus || 'Chat/GetSupportStatus';
    const url = this.storefrontTenant.buildAppServiceUrl(this.apiRoot(), path);
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
    return asBackgroundRequest({ headers: this.storefrontTenant.requestHeaders() });
  }
}

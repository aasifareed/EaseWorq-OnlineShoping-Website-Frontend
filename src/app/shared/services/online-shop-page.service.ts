import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  AbpResponse,
  OnlineShopPageMenuItem,
  OnlineShopPagePublic,
} from '../models/online-shop-page.model';

@Injectable({
  providedIn: 'root',
})
export class OnlineShopPageService {
  constructor(private http: HttpClient) {}

  private apiUrl(path: string): string {
    const base = environment.baseUrl || '';
    const root = base.endsWith('/') ? base : `${base}/`;
    return `${root}api/services/app/${path}`;
  }

  private tenantQuery(): string {
    const tenantId = environment.tenantId;
    return tenantId != null ? `tenantId=${tenantId}` : '';
  }

  getBySlug(slug: string): Observable<OnlineShopPagePublic> {
    const tenantPart = this.tenantQuery();
    const url = `${this.apiUrl(environment.urls.Page_GetBySlug)}?slug=${encodeURIComponent(slug)}${
      tenantPart ? `&${tenantPart}` : ''
    }`;
    return this.http
      .get<AbpResponse<OnlineShopPagePublic>>(url)
      .pipe(map((response) => response.result));
  }

  getActivePages(): Observable<OnlineShopPageMenuItem[]> {
    const tenantPart = this.tenantQuery();
    const url = `${this.apiUrl(environment.urls.Page_GetActivePages)}${
      tenantPart ? `?${tenantPart}` : ''
    }`;
    return this.http
      .get<AbpResponse<OnlineShopPageMenuItem[]>>(url)
      .pipe(map((response) => response.result || []));
  }

  pageLink(slug: string): string[] {
    return ['/page', slug];
  }
}

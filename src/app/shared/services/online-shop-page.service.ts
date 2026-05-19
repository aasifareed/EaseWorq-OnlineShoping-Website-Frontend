import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  AbpResponse,
  OnlineShopPageMenuItem,
  OnlineShopPagePublic,
} from '../models/online-shop-page.model';
import { AuthService } from './auth.service';
import { OnlineShopSettingsService } from './online-shop-settings.service';

@Injectable({
  providedIn: 'root',
})
export class OnlineShopPageService {
  private activePagesRequest$: Observable<OnlineShopPageMenuItem[]> | null = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private storefrontSettings: OnlineShopSettingsService,
  ) {}

  resolveTenantId(): number {
    const fromStorefront = this.storefrontSettings.snapshot?.tenantId;
    if (fromStorefront && fromStorefront > 0) {
      return fromStorefront;
    }
    return this.auth.tenantId || environment.tenantId || 1;
  }

  getBySlug(slug: string): Observable<OnlineShopPagePublic> {
    const tenantId = this.resolveTenantId();
    const url = `${this.apiUrl(environment.urls.Page_GetBySlug)}?slug=${encodeURIComponent(slug)}&tenantId=${tenantId}`;
    return this.http.get<AbpResponse<OnlineShopPagePublic>>(url, this.tenantRequestOptions(tenantId)).pipe(
      map((response) => {
        const page = this.unwrapAbp(response);
        if (!page?.slug) {
          throw new Error('Page not found.');
        }
        return this.normalizePublicPage(page as unknown as Record<string, unknown>);
      }),
    );
  }

  getActivePages(force = false): Observable<OnlineShopPageMenuItem[]> {
    if (!force && this.activePagesRequest$) {
      return this.activePagesRequest$;
    }

    const tenantId = this.resolveTenantId();
    const url = `${this.apiUrl(environment.urls.Page_GetActivePages)}?tenantId=${tenantId}`;
    this.activePagesRequest$ = this.http
      .get<AbpResponse<OnlineShopPageMenuItem[]>>(url, this.tenantRequestOptions(tenantId))
      .pipe(
      map((response) =>
        this.normalizeMenuItems((this.unwrapAbp(response) || []) as unknown[]),
      ),
      catchError(() => of([])),
      shareReplay(1),
    );

    return this.activePagesRequest$;
  }

  clearActivePagesCache(): void {
    this.activePagesRequest$ = null;
  }

  pageLink(slug: string): string[] {
    return ['/page', slug];
  }

  private tenantRequestOptions(tenantId: number): { headers: HttpHeaders } {
    return {
      headers: new HttpHeaders({
        'Abp.TenantId': String(tenantId),
      }),
    };
  }

  private apiUrl(path: string): string {
    const base = environment.baseUrl || '';
    const root = base.endsWith('/') ? base : `${base}/`;
    return `${root}api/services/app/${path}`;
  }

  private unwrapAbp<T>(response: AbpResponse<T> | null | undefined): T | null {
    if (!response || response.success === false) {
      return null;
    }
    return (response.result ?? null) as T | null;
  }

  private normalizePublicPage(raw: Record<string, unknown>): OnlineShopPagePublic {
    return {
      title: String(raw.title ?? raw.Title ?? ''),
      slug: String(raw.slug ?? raw.Slug ?? ''),
      content: String(raw.content ?? raw.Content ?? ''),
      metaTitle: (raw.metaTitle ?? raw.MetaTitle) as string | undefined,
      metaDescription: (raw.metaDescription ?? raw.MetaDescription) as string | undefined,
      metaImageUrl: (raw.metaImageUrl ?? raw.MetaImageUrl) as string | undefined,
    };
  }

  private normalizeMenuItems(items: unknown[]): OnlineShopPageMenuItem[] {
    return items
      .map((item) => {
        const row = item as Record<string, unknown>;
        return {
          title: String(row.title ?? row.Title ?? ''),
          slug: String(row.slug ?? row.Slug ?? ''),
        };
      })
      .filter((item) => item.title && item.slug);
  }
}

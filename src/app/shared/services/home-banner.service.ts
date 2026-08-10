import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { TenantService } from './tenant.service';
import { asBackgroundRequest } from '../interceptors/background-request';

export interface HomeBannerSlide {
  image: string;
  title?: string;
  subTitle?: string;
  linkUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class HomeBannerService {
  private bannersRequest$: Observable<HomeBannerSlide[]> | null = null;

  constructor(
    private http: HttpClient,
    private tenantService: TenantService
  ) {}

  getHomeBanners(force = false): Observable<HomeBannerSlide[]> {
    if (force) {
      this.bannersRequest$ = null;
    }
    if (this.bannersRequest$) {
      return this.bannersRequest$;
    }

    this.bannersRequest$ = this.tenantService.whenReady().pipe(
      switchMap((ctx) => {
        const path = environment.urls.OnlineShopHomeBanner_GetForStorefront
          ?? 'OnlineShopHomeBanner/GetHomeBannersForStorefront';
        const q = `TenantId=${ctx.tenantId}&StoreId=${encodeURIComponent(ctx.storeId)}`;
        const url = `${this.apiRoot()}api/services/app/${path}?${q}`;
        return this.http.get(url, asBackgroundRequest()).pipe(
          map((resp: { result?: unknown[] }) => {
            const rows = resp?.result ?? (Array.isArray(resp) ? resp : []);
            return (rows as Record<string, unknown>[]).map((row) => ({
              image: String(row.url ?? row.Url ?? ''),
              linkUrl: (row.linkUrl ?? row.LinkUrl) as string | undefined
            })).filter((slide) => !!slide.image);
          }),
          catchError(() => of([] as HomeBannerSlide[]))
        );
      }),
      shareReplay(1)
    );

    return this.bannersRequest$;
  }

  private apiRoot(): string {
    const base = (environment.baseUrl || '').replace(/\/$/, '');
    return base ? `${base}/` : '/';
  }
}

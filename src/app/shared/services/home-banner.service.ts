import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { TenantService } from './tenant.service';

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
  constructor(
    private http: HttpClient,
    private tenantService: TenantService
  ) {}

  getHomeBanners(): Observable<HomeBannerSlide[]> {
    return this.tenantService.whenReady().pipe(
      switchMap((ctx) => {
        const path = environment.urls.OnlineShopHomeBanner_GetForStorefront
          ?? 'OnlineShopHomeBanner/GetHomeBannersForStorefront';
        const q = `TenantId=${ctx.tenantId}&StoreId=${encodeURIComponent(ctx.storeId)}`;
        const url = `${this.apiRoot()}api/services/app/${path}?${q}`;
        return this.http.get(url).pipe(
          map((resp: { result?: unknown[] }) => {
            const rows = resp?.result ?? (Array.isArray(resp) ? resp : []);
            return (rows as Record<string, unknown>[]).map((row) => ({
              image: String(row.url ?? row.Url ?? ''),
              linkUrl: (row.linkUrl ?? row.LinkUrl) as string | undefined
            })).filter((slide) => !!slide.image);
          }),
          catchError(() => of([] as HomeBannerSlide[]))
        );
      })
    );
  }

  private apiRoot(): string {
    const base = (environment.baseUrl || '').replace(/\/$/, '');
    return base ? `${base}/` : '/';
  }
}

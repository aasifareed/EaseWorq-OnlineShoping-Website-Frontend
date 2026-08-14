import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { TenantService } from './tenant.service';
import { asBackgroundRequest } from '../interceptors/background-request';
import { rewriteMediaUrl } from './media-url';

export interface HomeBannerSlide {
  image: string;
  title?: string;
  subTitle?: string;
  linkUrl?: string;
}

const CACHE_PREFIX = 'sk_home_banners_v1_';
const CACHE_TTL_MS = 30 * 60 * 1000;

interface BannerCachePayload {
  savedAt: number;
  slides: HomeBannerSlide[];
}

@Injectable({
  providedIn: 'root'
})
export class HomeBannerService {
  private bannersRequest$: Observable<HomeBannerSlide[]> | null = null;
  private warmupStarted = false;
  private preloadLink: HTMLLinkElement | null = null;
  private readonly isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private tenantService: TenantService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /**
   * Starts the banners API as soon as the shop context is ready (during/after boot),
   * so the hero does not wait for the lazy HomeModule chunk.
   */
  warmup(): void {
    if (this.warmupStarted) {
      return;
    }
    this.warmupStarted = true;
    this.getHomeBanners().subscribe({ error: () => undefined });
  }

  getHomeBanners(force = false): Observable<HomeBannerSlide[]> {
    if (force) {
      this.bannersRequest$ = null;
    }
    if (this.bannersRequest$) {
      return this.bannersRequest$;
    }

    this.bannersRequest$ = this.tenantService.whenReady().pipe(
      switchMap((ctx) => {
        const cached = force ? null : this.readCache(ctx.tenantId, ctx.storeId);
        if (cached?.length) {
          this.preloadHeroImage(cached[0].image);
        }

        const network$ = this.fetchBanners(ctx.tenantId, ctx.storeId).pipe(
          tap((slides) => {
            this.writeCache(ctx.tenantId, ctx.storeId, slides);
            this.preloadHeroImage(slides[0]?.image);
          }),
          catchError(() => of(cached || ([] as HomeBannerSlide[])))
        );

        if (!cached?.length) {
          return network$;
        }

        return new Observable<HomeBannerSlide[]>((subscriber) => {
          subscriber.next(cached);
          const sub = network$.subscribe({
            next: (slides) => subscriber.next(slides?.length ? slides : cached),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
          return () => sub.unsubscribe();
        });
      }),
      shareReplay(1)
    );

    return this.bannersRequest$;
  }

  private fetchBanners(tenantId: number, storeId: string): Observable<HomeBannerSlide[]> {
    const path = environment.urls.OnlineShopHomeBanner_GetForStorefront
      ?? 'OnlineShopHomeBanner/GetHomeBannersForStorefront';
    const q = `TenantId=${tenantId}&StoreId=${encodeURIComponent(storeId)}`;
    const url = `${this.apiRoot()}api/services/app/${path}?${q}`;
    return this.http.get(url, asBackgroundRequest()).pipe(
      map((resp: { result?: unknown[] }) => {
        const rows = resp?.result ?? (Array.isArray(resp) ? resp : []);
        return (rows as Record<string, unknown>[]).map((row) => ({
          image: rewriteMediaUrl(String(row.url ?? row.Url ?? '')),
          linkUrl: (row.linkUrl ?? row.LinkUrl) as string | undefined,
          title: (row.title ?? row.Title) as string | undefined,
          subTitle: (row.subTitle ?? row.SubTitle) as string | undefined,
        })).filter((slide) => !!slide.image);
      })
    );
  }

  private cacheKey(tenantId: number, storeId: string): string {
    return `${CACHE_PREFIX}${tenantId}_${storeId}`;
  }

  private readCache(tenantId: number, storeId: string): HomeBannerSlide[] | null {
    if (!this.isBrowser) {
      return null;
    }
    try {
      const raw = sessionStorage.getItem(this.cacheKey(tenantId, storeId));
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as BannerCachePayload;
      if (!parsed?.slides?.length || !parsed.savedAt) {
        return null;
      }
      if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
        sessionStorage.removeItem(this.cacheKey(tenantId, storeId));
        return null;
      }
      return parsed.slides
        .map((slide) => ({ ...slide, image: rewriteMediaUrl(slide.image) }))
        .filter((slide) => !!slide.image);
    } catch {
      return null;
    }
  }

  private writeCache(tenantId: number, storeId: string, slides: HomeBannerSlide[]): void {
    if (!this.isBrowser || !slides?.length) {
      return;
    }
    try {
      const payload: BannerCachePayload = { savedAt: Date.now(), slides };
      sessionStorage.setItem(this.cacheKey(tenantId, storeId), JSON.stringify(payload));
    } catch {
      // ignore quota / private mode
    }
  }

  private preloadHeroImage(url?: string): void {
    if (!this.isBrowser || !url) {
      return;
    }

    const href = rewriteMediaUrl(url);
    if (!href || href.startsWith('data:') || href.startsWith('blob:')) {
      return;
    }

    if (this.preloadLink?.href === href) {
      return;
    }

    if (this.preloadLink?.parentNode) {
      this.preloadLink.parentNode.removeChild(this.preloadLink);
    }

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    link.setAttribute('fetchpriority', 'high');
    document.head.appendChild(link);
    this.preloadLink = link;

    const img = new Image();
    img.decoding = 'async';
    (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'high';
    img.src = href;
  }

  private apiRoot(): string {
    const base = (environment.baseUrl || '').replace(/\/$/, '');
    return base ? `${base}/` : '/';
  }
}

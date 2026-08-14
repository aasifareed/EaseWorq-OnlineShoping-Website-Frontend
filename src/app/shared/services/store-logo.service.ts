import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ShopContextService } from './shop-context.service';
import { asBackgroundRequest } from '../interceptors/background-request';
import { rewriteMediaUrl } from './media-url';

/** Icon-only SK mark (no “Sasta Khareedo” wordmark). Used in the APK header/footer and as the launcher. */
export const STORE_MARK_LOGO = 'assets/images/logo-sk-mark.svg';

interface StoreLogoCacheEntry {
  tenantId: number;
  storeId: string;
  logoUrl: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class StoreLogoService {
  private readonly logoSubject = new BehaviorSubject<string | null>(null);
  private initializeRequest$: Observable<string | null> | null = null;
  private readonly isBrowser: boolean;

  readonly logoUrl$ = this.logoSubject.asObservable();
  readonly useBrandMark = !!environment.isMobileApp;

  constructor(
    private http: HttpClient,
    private shopContext: ShopContextService,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  get snapshot(): string | null {
    return this.logoSubject.value;
  }

  /** Call once on app start / refresh to fetch logo from API and cache locally. */
  initialize(tenantId?: number, storeId?: string): Observable<string | null> {
    if (this.initializeRequest$) {
      return this.initializeRequest$;
    }

    const resolvedTenantId = tenantId ?? this.shopContext.resolveTenantId();
    const resolvedStoreId = storeId ?? this.shopContext.resolveStoreId();
    if (!resolvedTenantId || !resolvedStoreId) {
      return of(this.emitDisplayLogo(null));
    }

    const cached = this.readCache(resolvedTenantId, resolvedStoreId);
    if (cached !== undefined) {
      this.emitDisplayLogo(cached);
      this.applyFavicon();
    }

    const path = environment.urls.OnlineShopStoreLogo_GetForStorefront
      ?? 'OnlineShopStoreLogo/GetLogoForStorefront';
    const q = `TenantId=${resolvedTenantId}&StoreId=${encodeURIComponent(resolvedStoreId)}`;
    const url = `${this.apiRoot()}api/services/app/${path}?${q}`;

    this.initializeRequest$ = this.http.get(url, asBackgroundRequest()).pipe(
      map((resp: { result?: Record<string, unknown> }) => {
        const row = resp?.result ?? {};
        const logoUrl = rewriteMediaUrl(String(row.url ?? row.Url ?? '').trim()) || null;
        this.writeCache(resolvedTenantId, resolvedStoreId, logoUrl);
        return logoUrl;
      }),
      tap((logoUrl) => {
        this.emitDisplayLogo(logoUrl);
        this.applyFavicon();
      }),
      catchError(() => {
        if (cached === undefined) {
          this.emitDisplayLogo(null);
          this.writeCache(resolvedTenantId, resolvedStoreId, null);
        }
        return of(this.snapshot);
      }),
      shareReplay(1),
    );

    return this.initializeRequest$;
  }

  /** Read cached logo for current tenant/store without calling the API. */
  getCachedLogo(): string | null {
    if (this.useBrandMark) {
      return this.emitDisplayLogo(null);
    }

    const tenantId = this.shopContext.resolveTenantId();
    const storeId = this.shopContext.resolveStoreId();
    if (!tenantId || !storeId) {
      return this.snapshot;
    }

    const cached = this.readCache(tenantId, storeId);
    if (cached !== undefined) {
      const logoUrl = cached ? rewriteMediaUrl(cached) : null;
      return this.emitDisplayLogo(logoUrl);
    }

    return this.snapshot;
  }

  /** APK shows the icon-only mark; website keeps the uploaded store wordmark. */
  private emitDisplayLogo(logoUrl: string | null): string | null {
    const display = this.useBrandMark ? STORE_MARK_LOGO : logoUrl;
    this.logoSubject.next(display);
    return display;
  }

  private readCache(tenantId: number, storeId: string): string | null | undefined {
    if (!this.isBrowser) {
      return undefined;
    }

    try {
      const raw = localStorage.getItem(this.cacheKey(tenantId, storeId));
      if (raw == null) {
        return undefined;
      }

      const parsed = JSON.parse(raw) as StoreLogoCacheEntry;
      if (parsed.tenantId !== tenantId || parsed.storeId !== storeId) {
        return undefined;
      }

      const logoUrl = parsed.logoUrl ?? null;
      return logoUrl ? rewriteMediaUrl(logoUrl) : null;
    } catch {
      return undefined;
    }
  }

  private writeCache(tenantId: number, storeId: string, logoUrl: string | null): void {
    if (!this.isBrowser) {
      return;
    }

    const entry: StoreLogoCacheEntry = { tenantId, storeId, logoUrl };
    try {
      localStorage.setItem(this.cacheKey(tenantId, storeId), JSON.stringify(entry));
    } catch {
      // ignore quota / privacy mode errors
    }
  }

  private cacheKey(tenantId: number, storeId: string): string {
    return `ew_online_shop_logo_${tenantId}_${storeId}`;
  }

  private apiRoot(): string {
    const base = (environment.baseUrl || '').replace(/\/$/, '');
    return base ? `${base}/` : '/';
  }

  /**
   * Tab icon is always the Sasta Khareedo mark — never the header store logo.
   */
  applyFavicon(_logoUrl?: string | null): void {
    if (!this.isBrowser || typeof document === 'undefined') {
      return;
    }

    const href = 'assets/images/favicon-store.svg?v=sasta-khareedo-2';
    const type = 'image/svg+xml';

    const rels = ['icon', 'shortcut icon'];
    for (const rel of rels) {
      let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.type = type;
      link.href = href;
    }

    let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!apple) {
      apple = document.createElement('link');
      apple.rel = 'apple-touch-icon';
      document.head.appendChild(apple);
    }
    apple.href = href;
  }
}

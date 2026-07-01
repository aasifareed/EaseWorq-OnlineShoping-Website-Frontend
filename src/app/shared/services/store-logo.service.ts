import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ShopContextService } from './shop-context.service';

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
  private initialized = false;
  private readonly isBrowser: boolean;

  readonly logoUrl$ = this.logoSubject.asObservable();

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
    if (this.initialized) {
      return of(this.snapshot);
    }

    const resolvedTenantId = tenantId ?? this.shopContext.resolveTenantId();
    const resolvedStoreId = storeId ?? this.shopContext.resolveStoreId();
    if (!resolvedTenantId || !resolvedStoreId) {
      return of(null);
    }

    const cached = this.readCache(resolvedTenantId, resolvedStoreId);
    if (cached !== undefined) {
      this.logoSubject.next(cached);
    }

    const path = environment.urls.OnlineShopStoreLogo_GetForStorefront
      ?? 'OnlineShopStoreLogo/GetLogoForStorefront';
    const q = `TenantId=${resolvedTenantId}&StoreId=${encodeURIComponent(resolvedStoreId)}`;
    const url = `${this.apiRoot()}api/services/app/${path}?${q}`;

    return this.http.get(url).pipe(
      map((resp: { result?: Record<string, unknown> }) => {
        const row = resp?.result ?? {};
        const logoUrl = String(row.url ?? row.Url ?? '').trim() || null;
        this.writeCache(resolvedTenantId, resolvedStoreId, logoUrl);
        return logoUrl;
      }),
      tap((logoUrl) => {
        this.logoSubject.next(logoUrl);
        this.initialized = true;
      }),
      catchError(() => {
        if (cached === undefined) {
          this.logoSubject.next(null);
          this.writeCache(resolvedTenantId, resolvedStoreId, null);
        }
        this.initialized = true;
        return of(this.snapshot);
      }),
    );
  }

  /** Read cached logo for current tenant/store without calling the API. */
  getCachedLogo(): string | null {
    const tenantId = this.shopContext.resolveTenantId();
    const storeId = this.shopContext.resolveStoreId();
    if (!tenantId || !storeId) {
      return this.snapshot;
    }

    const cached = this.readCache(tenantId, storeId);
    if (cached !== undefined) {
      this.logoSubject.next(cached);
      return cached;
    }

    return this.snapshot;
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

      return parsed.logoUrl ?? null;
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
}

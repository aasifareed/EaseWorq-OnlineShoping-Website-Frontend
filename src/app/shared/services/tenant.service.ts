import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom, of } from 'rxjs';
import { catchError, filter, map, take } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ShopContext } from '../models/shop-context.model';
import { OnlineShopSettingsService } from './online-shop-settings.service';
import { StoreLogoService } from './store-logo.service';
import { ShopContextService } from './shop-context.service';
import { isValidStoreGuid, normalizeStoreGuid } from '../utils/shop-context.util';

interface TenantDetailsForWebsiteResult {
  tenantId?: number;
  TenantId?: number;
  storeId?: string;
  StoreId?: string;
}

interface AbpResultResponse<T> {
  success?: boolean;
  result?: T;
}

interface ResolveTenantByDomainApiResult {
  state?: number;
  State?: number;
  tenantId?: number;
  TenantId?: number;
  tenancyName?: string;
  TenancyName?: string;
  resolvedDomain?: string;
  ResolvedDomain?: string;
  isCustomDomain?: boolean;
  IsCustomDomain?: boolean;
  storeId?: string;
  StoreId?: string;
}

export interface TenantResolution {
  tenantId: number;
  tenancyName: string;
  resolvedDomain?: string;
  isCustomDomain: boolean;
  storeId?: string | null;
}

export interface TenantStoreDetails {
  tenantId: number;
  storeId: string;
}

const TENANT_RESOLUTION_AVAILABLE = 1;

@Injectable({
  providedIn: 'root',
})
export class TenantService {
  private readonly contextSubject = new BehaviorSubject<ShopContext | null>(null);
  private readonly loadingSubject = new BehaviorSubject<boolean>(true);
  private initializePromise: Promise<boolean> | null = null;

  readonly shopContext$ = this.contextSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();

  constructor(
    private http: HttpClient,
    private shopContext: ShopContextService,
    private storefrontSettings: OnlineShopSettingsService,
    private storeLogoService: StoreLogoService,
  ) {}

  get snapshot(): ShopContext | null {
    return this.contextSubject.value;
  }

  get loading(): boolean {
    return this.loadingSubject.value;
  }

  whenReady(): Observable<ShopContext> {
    const current = this.snapshot;
    if (current?.resolved && isValidStoreGuid(current.storeId)) {
      return of(current);
    }

    return this.shopContext$.pipe(
      filter((ctx): ctx is ShopContext => !!ctx?.resolved && isValidStoreGuid(ctx.storeId)),
      take(1),
    );
  }

  initialize(router: Router): Promise<boolean> {
    if (!this.initializePromise) {
      this.initializePromise = this.runInitialize(router);
    }
    return this.initializePromise;
  }

  resolveHostName(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (!environment.production && this.isLocalDevHost()) {
      return environment.devHostName?.trim() || window.location.hostname?.trim() || null;
    }

    return window.location.hostname?.trim() || null;
  }

  resolveTenantByDomain(hostName: string): Observable<TenantResolution | null> {
    const path = environment.urls.WebsiteTenantResolver_ResolveTenantByDomain
      ?? 'WebsiteTenantResolver/ResolveTenantByDomain';
    const url = `${this.apiRoot()}api/services/app/${path}`;

    return this.http.post<AbpResultResponse<ResolveTenantByDomainApiResult>>(url, { hostName }).pipe(
      map((response) => {
        const result = response?.result;
        if (!result) {
          return null;
        }

        const state = Number(result.state ?? result.State ?? 0);
        if (state !== TENANT_RESOLUTION_AVAILABLE) {
          return null;
        }

        const tenantId = Number(result.tenantId ?? result.TenantId ?? 0);
        const tenancyName = String(result.tenancyName ?? result.TenancyName ?? '').trim();
        if (!tenantId || !tenancyName) {
          return null;
        }

        if (this.shopContext.getTenancyName() && this.shopContext.getTenancyName() !== tenancyName) {
          this.shopContext.clearStoreId();
        }

        this.shopContext.setTenancyName(tenancyName);
        this.shopContext.setTenantId(tenantId);

        return {
          tenantId,
          tenancyName,
          resolvedDomain: (result.resolvedDomain ?? result.ResolvedDomain) as string | undefined,
          isCustomDomain: !!(result.isCustomDomain ?? result.IsCustomDomain),
          storeId: normalizeStoreGuid(result.storeId ?? result.StoreId),
        };
      }),
      catchError(() => of(null)),
    );
  }

  fetchTenantStoreDetails(tenantId: number): Observable<TenantStoreDetails | null> {
    const path = environment.urls.OnlineShopTenant_GetTenantDetailsForWebsite;
    const url = `${this.apiRoot()}api/services/app/${path}?TenantId=${tenantId}`;

    return this.http.get<AbpResultResponse<TenantDetailsForWebsiteResult>>(url).pipe(
      map((response) => {
        if (response?.success === false || !response?.result) {
          return null;
        }

        const result = response.result;
        const storeId = normalizeStoreGuid(result.storeId ?? result.StoreId);
        const resolvedTenantId = Number(result.tenantId ?? result.TenantId ?? tenantId);

        if (!storeId || !resolvedTenantId) {
          return null;
        }

        return {
          tenantId: resolvedTenantId,
          storeId,
        };
      }),
      catchError(() => of(null)),
    );
  }

  private async runInitialize(router: Router): Promise<boolean> {
    if (typeof window === 'undefined') {
      this.loadingSubject.next(false);
      return true;
    }

    this.loadingSubject.next(true);

    try {
      const hostName = this.resolveHostName();
      if (!hostName) {
        void router.navigateByUrl('/site-not-available');
        return false;
      }

      // Always resolve via the domain so the TenantDomains table stays the single source of
      // truth (host -> TenantDomains -> AbpTenants -> store). Caching is layered on after this.
      const resolution = await firstValueFrom(this.resolveTenantByDomain(hostName));
      if (!resolution) {
        void router.navigateByUrl('/site-not-available');
        return false;
      }

      const tenancyName = resolution.tenancyName;
      let tenantId = resolution.tenantId;

      // The resolver already returns the store id for the tenant. Only fall back to the
      // legacy per-tenant lookup if the resolver could not include it.
      let resolvedStoreId = normalizeStoreGuid(resolution.storeId);
      if (!resolvedStoreId) {
        const tenantDetails = await firstValueFrom(this.fetchTenantStoreDetails(tenantId));
        if (tenantDetails) {
          tenantId = tenantDetails.tenantId;
          resolvedStoreId = tenantDetails.storeId;
        }
      }

      if (!resolvedStoreId) {
        void router.navigateByUrl('/site-not-available');
        return false;
      }

      this.shopContext.setTenancyName(tenancyName);
      this.shopContext.setTenantId(tenantId);
      this.shopContext.setStoreId(resolvedStoreId);

      const storefront = await firstValueFrom(this.storefrontSettings.loadStorefront(true));
      if (!storefront?.isOnlineShopEnabled) {
        void router.navigateByUrl('/site-not-available');
        return false;
      }

      const storeId =
        normalizeStoreGuid(storefront.storeId) ??
        resolvedStoreId;

      const resolvedStorefront = { ...storefront, storeId, tenantId };
      this.shopContext.applyStorefront(resolvedStorefront, tenancyName);

      const context: ShopContext = {
        tenancyName,
        tenantId,
        storeId,
        storefront: resolvedStorefront,
        resolved: true,
      };

      this.contextSubject.next(context);
      await firstValueFrom(this.storeLogoService.initialize(tenantId, storeId));
      return true;
    } catch {
      void router.navigateByUrl('/site-not-available');
      return false;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  private isLocalDevHost(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const hostname = window.location.hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1';
  }

  private apiRoot(): string {
    const base = environment.baseUrl || '';
    return base.endsWith('/') ? base : `${base}/`;
  }
}

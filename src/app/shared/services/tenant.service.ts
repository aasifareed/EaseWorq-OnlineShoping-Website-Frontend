import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom, of } from 'rxjs';
import { catchError, filter, map, take } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ShopContext } from '../models/shop-context.model';
import { OnlineShopSettingsService } from './online-shop-settings.service';
import { ShopContextService } from './shop-context.service';
import { isValidStoreGuid, normalizeStoreGuid } from '../utils/shop-context.util';

interface IsTenantAvailableResult {
  tenantId?: number;
  TenantId?: number;
}

interface AbpTenantResponse {
  success?: boolean;
  result?: IsTenantAvailableResult;
}

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

export interface TenantStoreDetails {
  tenantId: number;
  storeId: string;
}

@Injectable({
  providedIn: 'root',
})
export class TenantService {
  private readonly contextSubject = new BehaviorSubject<ShopContext | null>(null);
  private readonly loadingSubject = new BehaviorSubject<boolean>(true);
  private initializePromise: Promise<boolean> | null = null;

  /** Single observable stream for resolved tenant/store context. */
  readonly shopContext$ = this.contextSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();

  constructor(
    private http: HttpClient,
    private shopContext: ShopContextService,
    private storefrontSettings: OnlineShopSettingsService,
  ) {}

  get snapshot(): ShopContext | null {
    return this.contextSubject.value;
  }

  get loading(): boolean {
    return this.loadingSubject.value;
  }

  /** Emits once when tenant/store context is fully resolved (or immediately if already ready). */
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

  /** APP_INITIALIZER entry point — resolves tenant, loads storefront settings, persists context. */
  initialize(router: Router): Promise<boolean> {
    if (!this.initializePromise) {
      this.initializePromise = this.runInitialize(router);
    }
    return this.initializePromise;
  }

  resolveTenancyNameFromHost(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (!environment.production && this.isLocalDevHost()) {
      return environment.devTenancyName?.trim() || null;
    }

    const hostname = window.location.hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return environment.devTenancyName?.trim() || null;
    }

    const parts = hostname.split('.').filter(Boolean);
    if (parts.length < 2) {
      return null;
    }

    let subdomain = parts[0];
    if (subdomain === 'www') {
      subdomain = parts.length >= 3 ? parts[1] : '';
    }

    return subdomain?.trim() || null;
  }

  checkTenantAvailability(tenancyName: string): Observable<boolean> {
    const url = `${this.apiRoot()}api/services/app/${environment.urls.Account_IsTenantAvailable}`;
    return this.http.post<AbpTenantResponse>(url, { tenancyName }).pipe(
      map((response) => {
        const tenantId = response?.result?.tenantId ?? response?.result?.TenantId;
        if (response?.success && tenantId != null) {
          if (this.shopContext.getTenancyName() !== tenancyName) {
            this.shopContext.clearStoreId();
          }
          this.shopContext.setTenancyName(tenancyName);
          this.shopContext.setTenantId(Number(tenantId));
          return true;
        }
        return false;
      }),
      catchError(() => of(false)),
    );
  }

  /** Resolves store id from CustomStore via OnlineShopTenant/GetTenantDetailsForWebsite. */
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
      const tenancyName = this.resolveTenancyNameFromHost();
      if (!tenancyName) {
        void router.navigateByUrl('/site-not-available');
        return false;
      }

      if (this.shopContext.getTenancyName() && this.shopContext.getTenancyName() !== tenancyName) {
        this.shopContext.clearStoreId();
      }

      let tenantId: number | null = null;

      if (!environment.production) {
        // Local dev — mirror admin panel: fixed tenancy + tenant id, skip IsTenantAvailable.
        this.shopContext.setTenancyName(tenancyName);
        tenantId = Number(environment.devTenantId ?? 1);
        if (!tenantId) {
          void router.navigateByUrl('/site-not-available');
          return false;
        }
        this.shopContext.setTenantId(tenantId);
      } else {
        const hasCachedTenant =
          this.shopContext.getTenancyName() === tenancyName && !!this.shopContext.getTenantId();

        const tenantCheck$ = hasCachedTenant
          ? of(true)
          : this.checkTenantAvailability(tenancyName);

        const available = await firstValueFrom(tenantCheck$);
        if (!available) {
          void router.navigateByUrl('/site-not-available');
          return false;
        }

        tenantId = this.shopContext.getTenantId();
        if (!tenantId) {
          void router.navigateByUrl('/site-not-available');
          return false;
        }
      }

      const tenantDetails = await firstValueFrom(this.fetchTenantStoreDetails(tenantId));
      if (!tenantDetails?.storeId) {
        void router.navigateByUrl('/site-not-available');
        return false;
      }

      tenantId = tenantDetails.tenantId;
      this.shopContext.setTenancyName(tenancyName);
      this.shopContext.setTenantId(tenantId);
      this.shopContext.setStoreId(tenantDetails.storeId);

      const storefront = await firstValueFrom(this.storefrontSettings.loadStorefront(true));
      if (!storefront?.isOnlineShopEnabled) {
        void router.navigateByUrl('/site-not-available');
        return false;
      }

      const storeId =
        normalizeStoreGuid(storefront.storeId) ??
        tenantDetails.storeId;

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

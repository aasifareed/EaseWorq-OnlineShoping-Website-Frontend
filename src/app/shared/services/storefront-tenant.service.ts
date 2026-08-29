import { Injectable } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';
import { ShopContextService } from './shop-context.service';
import { OnlineShopSettingsService } from './online-shop-settings.service';

@Injectable({
  providedIn: 'root',
})
export class StorefrontTenantService {
  constructor(
    private auth: AuthService,
    private tenantService: TenantService,
    private shopContext: ShopContextService,
    private onlineShopSettings: OnlineShopSettingsService,
  ) {}

  resolveTenantId(): number {
    const fromSnapshot = Number(this.tenantService.snapshot?.tenantId ?? 0);
    if (fromSnapshot > 0) {
      return fromSnapshot;
    }

    const fromStorage = this.shopContext.resolveTenantId();
    if (fromStorage > 0) {
      return fromStorage;
    }

    const fromAuth = Number(this.auth.tenantId ?? 0);
    if (fromAuth > 0) {
      return fromAuth;
    }

    const fromStorefront = Number(this.onlineShopSettings.snapshot?.tenantId ?? 0);
    if (fromStorefront > 0) {
      return fromStorefront;
    }

    const fromEnv = Number(environment.devTenantId ?? environment.shop?.tenantId ?? 0);
    return fromEnv > 0 ? fromEnv : 0;
  }

  buildAppServiceUrl(apiRoot: string, path: string, extraQuery?: Record<string, string>): string {
    const root = apiRoot.endsWith('/') ? apiRoot : `${apiRoot}/`;
    const params = new URLSearchParams();
    const tenantId = this.resolveTenantId();
    if (tenantId > 0) {
      params.set('TenantId', String(tenantId));
    }
    if (extraQuery) {
      Object.entries(extraQuery).forEach(([key, value]) => {
        if (value != null && value !== '') {
          params.set(key, value);
        }
      });
    }
    const query = params.toString();
    return `${root}api/services/app/${path}${query ? `?${query}` : ''}`;
  }

  requestHeaders(): HttpHeaders {
    const tenantId = this.resolveTenantId();
    return new HttpHeaders({
      'Abp.TenantId': tenantId > 0 ? String(tenantId) : '',
    });
  }
}

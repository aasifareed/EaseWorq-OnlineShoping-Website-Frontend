import { Injectable } from '@angular/core';
import { OnlineShopStorefront } from '../models/online-shop-storefront.model';

@Injectable({
  providedIn: 'root',
})
export class ShopContextService {
  private static readonly TENANT_KEY = 'shop_tenant_id';
  private static readonly STORE_KEY = 'shop_store_id';
  private static readonly TENANCY_NAME_KEY = 'shop_tenancy_name';

  getTenancyName(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(ShopContextService.TENANCY_NAME_KEY)?.trim() || null;
  }

  getTenantId(): number | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const raw = localStorage.getItem(ShopContextService.TENANT_KEY)?.trim();
    if (!raw) {
      return null;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  getStoreId(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(ShopContextService.STORE_KEY)?.trim() || null;
  }

  setTenancyName(name: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(ShopContextService.TENANCY_NAME_KEY, name.trim());
  }

  setTenantId(id: number): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(ShopContextService.TENANT_KEY, String(id));
  }

  setStoreId(id: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(ShopContextService.STORE_KEY, id.trim());
  }

  clearStoreId(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.removeItem(ShopContextService.STORE_KEY);
  }

  applyStorefront(storefront: OnlineShopStorefront, tenancyName: string): void {
    if (storefront.tenantId > 0) {
      this.setTenantId(storefront.tenantId);
    }
    if (storefront.storeId) {
      this.setStoreId(storefront.storeId);
    }
    if (tenancyName) {
      this.setTenancyName(tenancyName);
    }
  }

  resolveTenantId(): number {
    return this.getTenantId() ?? 0;
  }

  resolveStoreId(): string {
    return this.getStoreId() ?? '';
  }
}

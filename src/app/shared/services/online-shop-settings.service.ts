import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError, shareReplay } from 'rxjs/operators';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from 'src/environments/environment';
import {
  AbpResponse,
  OnlineShopStorefront,
  OnlineShopStorefrontTax,
} from '../models/online-shop-storefront.model';

@Injectable({
  providedIn: 'root',
})
export class OnlineShopSettingsService {
  private readonly storefrontSubject = new BehaviorSubject<OnlineShopStorefront | null>(null);
  private loadRequest$: Observable<OnlineShopStorefront | null> | null = null;

  readonly storefront$ = this.storefrontSubject.asObservable();

  constructor(
    private http: HttpClient,
    private title: Title,
    private meta: Meta,
  ) {}

  get snapshot(): OnlineShopStorefront | null {
    return this.storefrontSubject.value;
  }

  loadStorefront(force = false): Observable<OnlineShopStorefront | null> {
    if (!force && this.storefrontSubject.value) {
      return of(this.storefrontSubject.value);
    }

    if (!force && this.loadRequest$) {
      return this.loadRequest$;
    }

    const url = this.buildUrl();
    this.loadRequest$ = this.http.get<AbpResponse<Record<string, unknown>>>(url).pipe(
      map((response) => this.normalize(response?.result)),
      tap((storefront) => {
        this.storefrontSubject.next(storefront);
        if (storefront) {
          this.applyDefaultMeta(storefront);
        }
      }),
      catchError(() => {
        this.storefrontSubject.next(null);
        return of(null);
      }),
      shareReplay(1),
    );

    return this.loadRequest$;
  }

  applyDefaultMeta(storefront?: OnlineShopStorefront | null): void {
    const s = storefront || this.snapshot;
    if (!s) {
      return;
    }

    const title = s.metaTitle || s.storeName;
    if (title) {
      this.title.setTitle(title);
    }

    if (s.metaDescription) {
      this.meta.updateTag({ name: 'description', content: s.metaDescription });
    }

    if (s.metaImageUrl) {
      this.meta.updateTag({ property: 'og:image', content: s.metaImageUrl });
    }

    if (title) {
      this.meta.updateTag({ property: 'og:title', content: title });
    }
  }

  private resolveGoPayFastEnabled(raw: Record<string, unknown>): boolean {
    if (raw.isGoPayFastEnabled === true || raw.IsGoPayFastEnabled === true) {
      return true;
    }
    return !!(
      raw.isBankTransferEnabled ??
      raw.IsBankTransferEnabled ??
      raw.isJazzCashEnabled ??
      raw.IsJazzCashEnabled ??
      raw.isEasyPaisaEnabled ??
      raw.IsEasyPaisaEnabled ??
      raw.isCardOnlinePaymentEnabled ??
      raw.IsCardOnlinePaymentEnabled
    );
  }

  private buildUrl(): string {
    const base = environment.baseUrl || '';
    const root = base.endsWith('/') ? base : `${base}/`;
    const path = environment.urls.Settings_GetForStorefront;
    const params: string[] = [];

    if (environment.tenantId != null) {
      params.push(`tenantId=${environment.tenantId}`);
    }

    if (environment.storeId) {
      params.push(`customStoreId=${environment.storeId}`);
    }

    const query = params.length ? `?${params.join('&')}` : '';
    return `${root}api/services/app/${path}${query}`;
  }

  private normalize(raw: Record<string, unknown> | undefined | null): OnlineShopStorefront | null {
    if (!raw) {
      return null;
    }

    const taxesRaw = (raw.taxes || raw.Taxes) as Record<string, unknown>[] | undefined;
    const taxes: OnlineShopStorefrontTax[] | undefined = taxesRaw?.map((t) => ({
      taxId: String(t.taxId ?? t.TaxId ?? ''),
      taxName: String(t.taxName ?? t.TaxName ?? ''),
      taxInPercentage: Number(t.taxInPercentage ?? t.TaxInPercentage ?? 0),
      taxType: (t.taxType ?? t.TaxType) as string | undefined,
    }));

    return {
      tenantId: Number(raw.tenantId ?? raw.TenantId ?? environment.tenantId ?? 0),
      storeId: (raw.storeId ?? raw.StoreId) as string | undefined,
      isOnlineShopEnabled: (raw.isOnlineShopEnabled ?? raw.IsOnlineShopEnabled) !== false,
      storeName: (raw.storeName ?? raw.StoreName) as string | undefined,
      logoUrl: (raw.logoUrl ?? raw.LogoUrl) as string | undefined,
      bannerImageUrl: (raw.bannerImageUrl ?? raw.BannerImageUrl) as string | undefined,
      storeAddress: (raw.storeAddress ?? raw.StoreAddress) as string | undefined,
      phoneNumber: (raw.phoneNumber ?? raw.PhoneNumber) as string | undefined,
      whatsAppNumber: (raw.whatsAppNumber ?? raw.WhatsAppNumber) as string | undefined,
      email: (raw.email ?? raw.Email) as string | undefined,
      currencyName: (raw.currencyName ?? raw.CurrencyName) as string | undefined,
      currencySymbol: (raw.currencySymbol ?? raw.CurrencySymbol) as string | undefined,
      defaultLanguage: (raw.defaultLanguage ?? raw.DefaultLanguage) as string | undefined,
      timezone: (raw.timezone ?? raw.Timezone) as string | undefined,
      taxEnabled: !!(raw.taxEnabled ?? raw.TaxEnabled),
      taxes,
      storeSlug: (raw.storeSlug ?? raw.StoreSlug) as string | undefined,
      themeName: (raw.themeName ?? raw.ThemeName) as string | undefined,
      showOutOfStockProducts: !!(raw.showOutOfStockProducts ?? raw.ShowOutOfStockProducts),
      allowGuestCheckout: (raw.allowGuestCheckout ?? raw.AllowGuestCheckout) !== false,
      isDeliveryEnabled: (raw.isDeliveryEnabled ?? raw.IsDeliveryEnabled) !== false,
      defaultDeliveryCharges: (raw.defaultDeliveryCharges ?? raw.DefaultDeliveryCharges) as number | undefined,
      freeDeliveryMinimumOrderAmount: (raw.freeDeliveryMinimumOrderAmount ??
        raw.FreeDeliveryMinimumOrderAmount) as number | undefined,
      estimatedDeliveryDays: (raw.estimatedDeliveryDays ?? raw.EstimatedDeliveryDays) as number | undefined,
      isSameDayDeliveryEnabled: !!(raw.isSameDayDeliveryEnabled ?? raw.IsSameDayDeliveryEnabled),
      isCashOnDeliveryEnabled: (raw.isCashOnDeliveryEnabled ?? raw.IsCashOnDeliveryEnabled) !== false,
      isGoPayFastEnabled: this.resolveGoPayFastEnabled(raw),
      receiptFooterText: (raw.receiptFooterText ?? raw.ReceiptFooterText) as string | undefined,
      metaTitle: (raw.metaTitle ?? raw.MetaTitle) as string | undefined,
      metaDescription: (raw.metaDescription ?? raw.MetaDescription) as string | undefined,
      metaImageUrl: (raw.metaImageUrl ?? raw.MetaImageUrl) as string | undefined,
    };
  }
}

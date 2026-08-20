import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ShopContextService } from './shop-context.service';
import { AuthService } from './auth.service';
import { OnlineShopSettingsService } from './online-shop-settings.service';
import { asBackgroundRequest } from '../interceptors/background-request';

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

export interface MetaTrackContentLine {
  id: string;
  quantity: number;
  itemPrice?: number;
  name?: string;
}

@Injectable({ providedIn: 'root' })
export class MetaTrackingService {
  private enabled = false;
  private pixelId: string | null = null;
  private initialized = false;
  private lastPageViewPath: string | null = null;
  private lastViewContentKey: string | null = null;
  private lastInitiateCheckoutKey: string | null = null;
  private purchaseTrackedOrderIds = new Set<string>();
  private spaNavHooked = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient,
    private router: Router,
    private shopContext: ShopContextService,
    private auth: AuthService,
    private storefrontSettings: OnlineShopSettingsService,
  ) {}

  /** Call after storefront settings are available. */
  initFromStorefront(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.ensureFbclidCookie();

    const storefront = this.storefrontSettings.snapshot;
    const pixelId = String(storefront?.metaPixelId ?? '').trim();
    const enabled = !!storefront?.metaTrackingEnabled && !!pixelId;

    this.enabled = enabled;
    this.pixelId = enabled ? pixelId : null;

    if (!this.enabled || !this.pixelId) {
      return;
    }

    this.loadPixelScript(this.pixelId);
    this.hookSpaPageViews();
    this.trackPageView();
  }

  trackPageView(): void {
    if (!this.canTrack()) {
      return;
    }

    const path = this.currentPath();
    if (this.lastPageViewPath === path) {
      return;
    }
    this.lastPageViewPath = path;
    this.fbq('track', 'PageView');
  }

  trackViewContent(input: {
    productId: string;
    contentName: string;
    value: number;
    category?: string;
  }): void {
    if (!this.canTrack()) {
      return;
    }

    const contentId = this.normalizeContentId(input.productId);
    if (!contentId) {
      return;
    }

    const key = `${contentId}|${this.currentPath()}`;
    if (this.lastViewContentKey === key) {
      return;
    }
    this.lastViewContentKey = key;

    const eventId = this.newEventId();
    const value = this.roundMoney(input.value);
    const params: Record<string, unknown> = {
      content_ids: [contentId],
      content_type: 'product',
      content_name: input.contentName || undefined,
      value,
      currency: 'PKR',
      contents: [{ id: contentId, quantity: 1, item_price: value }],
    };
    if (input.category) {
      params.content_category = input.category;
    }

    this.fbq('track', 'ViewContent', params, { eventID: eventId });
    this.sendCapi({
      eventName: 'ViewContent',
      eventId,
      productId: contentId,
      quantity: 1,
    });
  }

  trackAddToCart(input: {
    productId: string;
    contentName: string;
    quantity: number;
    itemPrice: number;
  }): void {
    if (!this.canTrack()) {
      return;
    }

    const contentId = this.normalizeContentId(input.productId);
    const qty = Math.max(1, Math.round(Number(input.quantity) || 1));
    if (!contentId) {
      return;
    }

    const itemPrice = this.roundMoney(input.itemPrice);
    const value = this.roundMoney(itemPrice * qty);
    const eventId = this.newEventId();
    const params = {
      content_ids: [contentId],
      content_type: 'product',
      content_name: input.contentName || undefined,
      value,
      currency: 'PKR',
      contents: [{ id: contentId, quantity: qty, item_price: itemPrice }],
      num_items: qty,
    };

    this.fbq('track', 'AddToCart', params, { eventID: eventId });
    this.sendCapi({
      eventName: 'AddToCart',
      eventId,
      productId: contentId,
      quantity: qty,
    });
  }

  trackInitiateCheckout(input: {
    lines: MetaTrackContentLine[];
    value: number;
    numItems: number;
  }): void {
    if (!this.canTrack()) {
      return;
    }

    const lines = (input.lines || [])
      .map((l) => ({
        id: this.normalizeContentId(l.id),
        quantity: Math.max(1, Math.round(Number(l.quantity) || 1)),
        itemPrice: l.itemPrice != null ? this.roundMoney(l.itemPrice) : undefined,
      }))
      .filter((l) => !!l.id);

    if (lines.length === 0) {
      return;
    }

    const key = lines.map((l) => `${l.id}:${l.quantity}`).join('|') + `|${this.roundMoney(input.value)}`;
    if (this.lastInitiateCheckoutKey === key) {
      return;
    }
    this.lastInitiateCheckoutKey = key;

    const eventId = this.newEventId();
    const contentIds = lines.map((l) => l.id);
    const params = {
      content_ids: contentIds,
      content_type: 'product',
      contents: lines.map((l) => ({
        id: l.id,
        quantity: l.quantity,
        item_price: l.itemPrice,
      })),
      num_items: Math.max(1, Math.round(Number(input.numItems) || lines.reduce((s, l) => s + l.quantity, 0))),
      value: this.roundMoney(input.value),
      currency: 'PKR',
    };

    this.fbq('track', 'InitiateCheckout', params, { eventID: eventId });
    this.sendCapi({
      eventName: 'InitiateCheckout',
      eventId,
      contents: lines.map((l) => ({ id: l.id, quantity: l.quantity })),
    });
  }

  /**
   * Browser Pixel Purchase only (CAPI is sent by the backend after order/payment success).
   * Uses deterministic event_id purchase-{orderId} for Pixel/CAPI deduplication.
   */
  trackPurchasePixel(input: {
    orderId: string;
    orderNumber?: string;
    value: number;
    lines: MetaTrackContentLine[];
  }): void {
    if (!this.canTrack()) {
      return;
    }

    const orderId = String(input.orderId || '').trim();
    if (!orderId || this.purchaseTrackedOrderIds.has(orderId.toLowerCase())) {
      return;
    }
    this.purchaseTrackedOrderIds.add(orderId.toLowerCase());

    const lines = (input.lines || [])
      .map((l) => ({
        id: this.normalizeContentId(l.id),
        quantity: Math.max(1, Math.round(Number(l.quantity) || 1)),
        itemPrice: l.itemPrice != null ? this.roundMoney(l.itemPrice) : undefined,
      }))
      .filter((l) => !!l.id);

    const eventId = `purchase-${orderId}`;
    const params: Record<string, unknown> = {
      content_ids: lines.map((l) => l.id),
      content_type: 'product',
      contents: lines.map((l) => ({
        id: l.id,
        quantity: l.quantity,
        item_price: l.itemPrice,
      })),
      num_items: lines.reduce((s, l) => s + l.quantity, 0),
      value: this.roundMoney(input.value),
      currency: 'PKR',
    };
    if (input.orderNumber) {
      params.order_id = input.orderNumber;
    }

    this.fbq('track', 'Purchase', params, { eventID: eventId });
  }

  getMetaBrowserCookies(): { fbp?: string; fbc?: string } {
    if (!isPlatformBrowser(this.platformId)) {
      return {};
    }
    this.ensureFbclidCookie();
    return {
      fbp: this.readCookie('_fbp') || undefined,
      fbc: this.readCookie('_fbc') || undefined,
    };
  }

  private canTrack(): boolean {
    return isPlatformBrowser(this.platformId) && this.enabled && !!this.pixelId;
  }

  private hookSpaPageViews(): void {
    if (this.spaNavHooked) {
      return;
    }
    this.spaNavHooked = true;
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.trackPageView());
  }

  private loadPixelScript(pixelId: string): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    if (typeof window.fbq === 'function') {
      window.fbq('init', pixelId);
      return;
    }

    const n: any = (window.fbq = function (...args: any[]) {
      (n.callMethod ? n.callMethod(...args) : n.queue.push(args));
    });
    if (!window._fbq) {
      window._fbq = n;
    }
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(script, first);

    window.fbq('init', pixelId);
  }

  private fbq(...args: any[]): void {
    try {
      if (typeof window.fbq === 'function') {
        window.fbq(...args);
      }
    } catch {
      // Pixel must never break shopping.
    }
  }

  private sendCapi(payload: {
    eventName: string;
    eventId: string;
    productId?: string;
    quantity?: number;
    contents?: { id: string; quantity: number }[];
  }): void {
    try {
      const cookies = this.getMetaBrowserCookies();
      const tenantId = this.shopContext.resolveTenantId();
      const storeId = this.shopContext.resolveStoreId();
      const body = {
        eventName: payload.eventName,
        eventId: payload.eventId,
        eventSourceUrl: this.currentUrl(),
        tenantId: tenantId > 0 ? tenantId : null,
        storeId: storeId || null,
        productId: payload.productId || null,
        quantity: payload.quantity ?? null,
        contents: payload.contents || null,
        userData: {
          email: this.auth.getCustomerEmail() || null,
          fbp: cookies.fbp || null,
          fbc: cookies.fbc || null,
        },
      };

      const path = environment.urls?.MetaTracking_TrackBrowserEvent || 'MetaTracking/TrackBrowserEvent';
      const url = `${this.apiRoot()}api/services/app/${path}`;
      this.http
        .post(url, body, { context: asBackgroundRequest() })
        .subscribe({ error: () => undefined });
    } catch {
      // ignore
    }
  }

  private ensureFbclidCookie(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      const existing = this.readCookie('_fbc');
      if (existing) {
        return;
      }
      const params = new URLSearchParams(window.location.search || '');
      const fbclid = params.get('fbclid');
      if (!fbclid) {
        return;
      }
      const fbc = `fb.1.${Date.now()}.${fbclid}`;
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `_fbc=${encodeURIComponent(fbc)}; Path=/; Max-Age=${90 * 24 * 60 * 60}; SameSite=Lax${secure}`;
    } catch {
      // ignore
    }
  }

  private readCookie(name: string): string | null {
    try {
      const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
      return match ? decodeURIComponent(match[1]) : null;
    } catch {
      return null;
    }
  }

  private normalizeContentId(value: string | null | undefined): string | null {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return null;
    }
    // Prefer lowercase GUID canonical form matching server MetaCatalogContentId.
    const guid = raw.match(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    );
    return guid ? raw.toLowerCase() : raw;
  }

  private newEventId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private roundMoney(value: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return 0;
    }
    return Math.round(n * 100) / 100;
  }

  private currentPath(): string {
    return isPlatformBrowser(this.platformId) ? window.location.pathname + window.location.search : '';
  }

  private currentUrl(): string {
    return isPlatformBrowser(this.platformId) ? window.location.href : '';
  }

  private apiRoot(): string {
    const base = environment.baseUrl || '';
    return base.endsWith('/') ? base : `${base}/`;
  }
}

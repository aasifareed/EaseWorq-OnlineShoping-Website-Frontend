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
  /** True after initFromStorefront has run (enabled or explicitly disabled). */
  private bootstrapped = false;
  private initialized = false;
  private lastPageViewPath: string | null = null;
  private lastViewContentKey: string | null = null;
  private lastInitiateCheckoutKey: string | null = null;
  private purchaseTrackedOrderIds = new Set<string>();
  private spaNavHooked = false;
  /** Funnel actions that ran before storefront Meta config was ready. */
  private pendingActions: Array<() => void> = [];

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
    this.bootstrapped = true;

    if (this.enabled && this.pixelId) {
      this.loadPixelScript(this.pixelId);
      this.hookSpaPageViews();
      // Initial route only — SPA navigations go through NavigationEnd (deduped by path).
      this.trackPageViewForPath(this.router.url || this.currentPath());
    }

    const pending = this.pendingActions.splice(0);
    for (const action of pending) {
      try {
        action();
      } catch {
        // ignore
      }
    }
  }

  trackPageView(): void {
    this.trackPageViewForPath(this.router.url || this.currentPath());
  }

  trackViewContent(input: {
    productId: string;
    contentName: string;
    value: number;
    category?: string;
  }): void {
    this.runWhenReady(() => this.trackViewContentNow(input));
  }

  trackAddToCart(input: {
    productId: string;
    contentName: string;
    quantity: number;
    itemPrice: number;
  }): void {
    this.runWhenReady(() => this.trackAddToCartNow(input));
  }

  trackInitiateCheckout(input: {
    lines: MetaTrackContentLine[];
    value: number;
    numItems: number;
  }): void {
    this.runWhenReady(() => this.trackInitiateCheckoutNow(input));
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

  private runWhenReady(action: () => void): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (!this.bootstrapped) {
      this.pendingActions.push(action);
      return;
    }
    if (!this.canTrack()) {
      return;
    }
    action();
  }

  private trackViewContentNow(input: {
    productId: string;
    contentName: string;
    value: number;
    category?: string;
  }): void {
    const contentId = this.normalizeContentId(input.productId);
    if (!contentId) {
      return;
    }

    const key = `${contentId}|${this.normalizePath(this.router.url || this.currentPath())}`;
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

  private trackAddToCartNow(input: {
    productId: string;
    contentName: string;
    quantity: number;
    itemPrice: number;
  }): void {
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

  private trackInitiateCheckoutNow(input: {
    lines: MetaTrackContentLine[];
    value: number;
    numItems: number;
  }): void {
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

    // Ignore monetary fluctuations (shipping/coupons reprice) — only cart composition.
    const key = lines
      .map((l) => `${l.id}:${l.quantity}`)
      .sort()
      .join('|');
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
      num_items: Math.max(
        1,
        Math.round(Number(input.numItems) || lines.reduce((s, l) => s + l.quantity, 0)),
      ),
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
      .subscribe((e) => {
        const path = this.normalizePath(e.urlAfterRedirects || e.url);
        // Allow a fresh InitiateCheckout when the customer re-enters checkout later.
        if (!path.includes('/checkout')) {
          this.lastInitiateCheckoutKey = null;
        }
        this.trackPageViewForPath(path);
      });
  }

  private trackPageViewForPath(rawUrl: string): void {
    if (!this.canTrack()) {
      return;
    }

    const path = this.normalizePath(rawUrl);
    if (!path || this.lastPageViewPath === path) {
      return;
    }
    this.lastPageViewPath = path;
    this.fbq('track', 'PageView');
  }

  private loadPixelScript(pixelId: string): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    if (typeof window.fbq !== 'function') {
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
    }

    // Disable automatic button/microdata events (e.g. SubscribedButtonClick).
    this.fbq('set', 'autoConfig', false, pixelId);
    this.fbq('init', pixelId);
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
      const tenantId = this.resolveTenantId();
      const storeId = this.resolveStoreId();
      if (!storeId || tenantId <= 0) {
        // Without store/tenant the backend cannot resolve catalogue prices.
        return;
      }

      const body = {
        eventName: payload.eventName,
        eventId: payload.eventId,
        eventSourceUrl: this.currentUrl(),
        tenantId,
        storeId,
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
        .post(url, body, asBackgroundRequest())
        .subscribe({ error: () => undefined });
    } catch {
      // ignore
    }
  }

  private resolveTenantId(): number {
    const fromContext = this.shopContext.resolveTenantId();
    if (fromContext > 0) {
      return fromContext;
    }
    const fromStorefront = Number(this.storefrontSettings.snapshot?.tenantId ?? 0);
    return fromStorefront > 0 ? fromStorefront : 0;
  }

  private resolveStoreId(): string | null {
    const fromContext = String(this.shopContext.resolveStoreId() || '').trim();
    if (fromContext) {
      return fromContext;
    }
    const fromAuth = String(this.auth.storeId || '').trim();
    if (fromAuth) {
      return fromAuth;
    }
    const fromStorefront = String(this.storefrontSettings.snapshot?.storeId || '').trim();
    return fromStorefront || null;
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
      const match = document.cookie.match(
        new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'),
      );
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
    const guid = raw.match(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    );
    return guid ? raw.toLowerCase() : raw;
  }

  /** Pathname only — query/hash changes must not create extra PageViews. */
  private normalizePath(rawUrl: string): string {
    const raw = String(rawUrl || '').trim();
    if (!raw) {
      return '/';
    }
    try {
      const path = raw.startsWith('http')
        ? new URL(raw).pathname
        : raw.split('?')[0].split('#')[0];
      const normalized = (path || '/').replace(/\/+$/, '') || '/';
      return normalized.toLowerCase();
    } catch {
      return raw.toLowerCase();
    }
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
    return isPlatformBrowser(this.platformId) ? window.location.pathname : '';
  }

  private currentUrl(): string {
    return isPlatformBrowser(this.platformId) ? window.location.href : '';
  }

  private apiRoot(): string {
    const base = environment.baseUrl || '';
    return base.endsWith('/') ? base : `${base}/`;
  }
}

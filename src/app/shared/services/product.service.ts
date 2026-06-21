import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, startWith, delay, switchMap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { Product } from '../classes/product';
import {
  AvailableProductInventoryDtoForOnlineShop,
  HomeCategorySliderDto
} from '../models/home-category-slider.model';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';
import { isValidStoreGuid } from '../utils/shop-context.util';
import { OnlineShopStorefront } from '../models/online-shop-storefront.model';
import {
  AppliedShopCouponState,
  ApplyOnlineShopCouponResult,
  CartCouponItemDto,
  OnlineShopCheckoutService
} from './online-shop-checkout.service';
import { SearchProductSuggestion } from './online-shop-search.service';

const ONLINE_SHOP_CART_VERSION = 2;
const ONLINE_SHOP_CART_VERSION_KEY = 'onlineShopCartVersion';

function loadCartFromStorage(): Product[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  const storedVersion = Number(localStorage.getItem(ONLINE_SHOP_CART_VERSION_KEY) || '0');
  if (storedVersion !== ONLINE_SHOP_CART_VERSION) {
    localStorage.removeItem('cartItems');
    localStorage.setItem(ONLINE_SHOP_CART_VERSION_KEY, String(ONLINE_SHOP_CART_VERSION));
    return [];
  }

  try {
    return JSON.parse(localStorage.getItem('cartItems') || '[]');
  } catch {
    return [];
  }
}

const state = {
  products: JSON.parse(localStorage['products'] || '[]'),
  wishlist: JSON.parse(localStorage['wishlistItems'] || '[]'),
  compare: JSON.parse(localStorage['compareItems'] || '[]'),
  cart: loadCartFromStorage()
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  public Currency = { name: 'PKR', currency: 'RS', price: 1 } // Default Currency
  // public Currency = { name: 'Dollar', currency: 'USD', price: 1 } // Default Currency
  public OpenCart: boolean = false;
  public Products:any;

  /** Apply currency from storefront admin configuration (locked at runtime). */
  applyStoreCurrency(storefront: OnlineShopStorefront | null | undefined): void {
    if (!storefront) {
      return;
    }

    const name = storefront.currencyName?.trim();
    const symbol = storefront.currencySymbol?.trim();

    if (!name && !symbol) {
      return;
    }

    this.Currency = {
      name: name || this.Currency.name,
      currency: symbol || name || this.Currency.currency,
      price: 1,
    };
  }

  private readonly wishlistChanged = new BehaviorSubject<Product[]>(state.wishlist);
  private readonly cartChanged = new BehaviorSubject<Product[]>([...state.cart]);
  private readonly appliedCouponChanged = new BehaviorSubject<AppliedShopCouponState | null>(
    ProductService.readStoredCoupon()
  );
  private static readonly APPLIED_COUPON_KEY = 'appliedShopCoupon';
  private couponRecalcInFlight = false;

  /** In-memory index of last shop grid (API) products by inventory id. */
  private readonly shopProductById = new Map<string, Product>();
  private static readonly SHOP_PRODUCT_SS_PREFIX = 'shop_prod_';
  private static readonly EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

  /** Same cart line id (JSON numeric vs API Guid string). */
  sameLineId(a: unknown, b: unknown): boolean {
    return String(a ?? '') === String(b ?? '');
  }

  getCartLineQuantity(productId: unknown): number {
    const line = state.cart.find((item: any) => this.sameLineId(item.id, productId));
    return line ? Math.max(0, Number(line.quantity) || 0) : 0;
  }

  getRemainingStock(productId: unknown, stock: unknown): number {
    const available = Number(stock);
    if (!Number.isFinite(available) || available <= 0) {
      return 0;
    }
    return Math.max(0, available - this.getCartLineQuantity(productId));
  }

  canAddMoreToCart(productId: unknown, stock: unknown, qtyToAdd = 1): boolean {
    const addQty = Number(qtyToAdd);
    if (!Number.isFinite(addQty) || addQty < 1) {
      return false;
    }
    return this.getRemainingStock(productId, stock) >= addQty;
  }

  /** Remember shop listing rows for detail / resolver when URL uses inventory id. */
  cacheShopProducts(products: Product[]): void {
    this.shopProductById.clear();
    for (const p of products || []) {
      if (p?.id !== undefined && p?.id !== null) {
        this.shopProductById.set(String(p.id), p);
      }
    }
  }

  getCachedShopProduct(id: string | undefined | null): Product | undefined {
    if (id === undefined || id === null) {
      return undefined;
    }
    const row = this.shopProductById.get(String(id));
    return row ? { ...row } : undefined;
  }

  /** Survives refresh on detail page for id-based products. */
  persistShopProduct(product: Product): void {
    if (product?.id === undefined || product?.id === null) {
      return;
    }
    try {
      sessionStorage.setItem(
        ProductService.SHOP_PRODUCT_SS_PREFIX + String(product.id),
        JSON.stringify(product)
      );
    } catch {
      /* ignore quota / private mode */
    }
  }

  getPersistedShopProduct(id: string | undefined | null): Product | undefined {
    if (id === undefined || id === null) {
      return undefined;
    }
    try {
      const raw = sessionStorage.getItem(ProductService.SHOP_PRODUCT_SS_PREFIX + String(id));
      return raw ? (JSON.parse(raw) as Product) : undefined;
    } catch {
      return undefined;
    }
  }

  /** Resolver + detail: POS id, cached grid row, then legacy JSON slug/title. */
  resolveProductForShop(routeKey: string): Observable<Product | undefined> {
    const persisted = this.getPersistedShopProduct(routeKey);
    if (persisted) {
      return of({ ...persisted });
    }
    const cached = this.getCachedShopProduct(routeKey);
    if (cached) {
      return of({ ...cached });
    }
    return this.getProductBySlug(routeKey);
  }

  constructor(
    private http: HttpClient,
    private toastrService: ToastrService,
    private auth: AuthService,
    private tenantService: TenantService,
    private onlineShopCheckout: OnlineShopCheckoutService,
  ) { }

  private shopIds(): { tenantId: number; storeId: string } {
    const ctx = this.tenantService.snapshot;
    const storeId = ctx?.storeId ?? this.auth.storeId;
    if (!isValidStoreGuid(storeId)) {
      throw new Error('Store context is not ready.');
    }
    return {
      tenantId: ctx?.tenantId ?? this.auth.tenantId,
      storeId,
    };
  }

private apiRoot(): string {
        const b = environment.baseUrl || '';
       return b.endsWith('/') ? b : `${b}/`;
 }
  /*
    ---------------------------------------------
    ---------------  Product  -------------------
    ---------------------------------------------
  */

  // Product
  private get products(): Observable<Product[]> {
    this.Products = this.http.get<Product[]>('assets/data/products.json').pipe(map(data => data));
    this.Products.subscribe((next:any) => { localStorage['products'] = JSON.stringify(next) });
    return this.Products = this.Products.pipe(startWith(JSON.parse(localStorage['products'] || '[]')));
  }

  // Get Products
  public get getProducts(): Observable<Product[]> {
    return this.products;
  }

  // Get Products By Slug or by id (shop API inventory id / JSON id) or title slug
  public getProductBySlug(slug: string): Observable<Product | undefined> {
    return this.products.pipe(map(items => {
      if (!slug) {
        return undefined;
      }
      const norm = String(slug).trim().toLowerCase();
      return items.find((item: any) => {
        if (item.id !== undefined && item.id !== null && String(item.id).toLowerCase() === norm) {
          return true;
        }
        const titleSlug = String(item.title ?? '').replace(/\s+/g, '-').toLowerCase();
        return titleSlug === norm;
      });
    }));
  }


  /*
    ---------------------------------------------
    ---------------  Wish List  -----------------
    ---------------------------------------------
  */

  // Get Wishlist Items
  public get wishlistItems(): Observable<Product[]> {
    return this.wishlistChanged.asObservable();
  }

  private syncWishlistLocal(products: Product[]): void {
    state.wishlist = products;
    localStorage.setItem('wishlistItems', JSON.stringify(state.wishlist));
    this.wishlistChanged.next([...state.wishlist]);
  }

  private addToWishlistLocal(product: Product): void {
    if (!state.wishlist.find((item) => this.sameLineId(item.id, product.id))) {
      state.wishlist.push({ ...product });
    }
    this.syncWishlistLocal(state.wishlist);
  }

  private buildWishlistRequest(productInventoryId?: string): Record<string, unknown> {
    const { tenantId, storeId } = this.shopIds();
    const email = this.auth.getCustomerEmail();
    const payload: Record<string, unknown> = {
      tenantId,
      storeId,
      customerEmail: email ?? ''
    };
    if (productInventoryId) {
      payload.productInventoryId = productInventoryId;
    }
    return payload;
  }

  private wishlistQueryParams(): HttpParams {
    const { tenantId, storeId } = this.shopIds();
    const email = this.auth.getCustomerEmail();
    let params = new HttpParams()
      .set('TenantId', String(tenantId))
      .set('StoreId', storeId);
    if (email) {
      params = params.set('CustomerEmail', email);
    }
    return params;
  }

  loadWishlistFromApi(): Observable<Product[]> {
    const path = `${environment.urls.OnlineShopWishlist_GetWishlistForOnlineShop}`;
    return this.http.get(`${this.apiRoot()}api/services/app/${path}`, { params: this.wishlistQueryParams() }).pipe(
      map((resp: any) => {
        const rows = resp?.result ?? [];
        const products = rows
          .map((row: any) => this.mapInventoryItemToProduct(row?.product ?? row?.Product))
          .filter((p: Product) => p?.id != null);
        this.syncWishlistLocal(products);
        products.forEach((p) => this.persistShopProduct(p));
        return products;
      }),
      catchError(() => {
        this.syncWishlistLocal(state.wishlist);
        return of(state.wishlist);
      })
    );
  }

  addToWishlist(product: any): Observable<boolean> {
    const inventoryId = product?.id != null ? String(product.id) : '';
    if (!inventoryId) {
      this.toastrService.error('Product could not be added to wishlist.');
      return of(false);
    }

    if (!this.auth.isLoggedIn()) {
      this.toastrService.warning('Please sign in to use your wishlist.');
      this.auth.navigateToLogin();
      return of(false);
    }

    const email = this.auth.getCustomerEmail();
    if (!email) {
      this.toastrService.warning('Could not read your account email. Please sign in again.');
      this.auth.navigateToLogin();
      return of(false);
    }

    const path = `${environment.urls.OnlineShopWishlist_AddToWishlistForOnlineShop}`;
    return this.http.post(`${this.apiRoot()}api/services/app/${path}`, this.buildWishlistRequest(inventoryId)).pipe(
      map(() => {
        this.addToWishlistLocal(product);
        this.toastrService.success('Product has been added to wishlist.');
        return true;
      }),
      catchError((err) => {
        if (err?.status !== 400 && err?.status !== 401) {
          const msg = err?.error?.error?.message || err?.error?.error?.details || 'Could not add to wishlist.';
          this.toastrService.error(msg);
        }
        return of(false);
      })
    );
  }

  removeWishlistItem(product: Product): Observable<boolean> {
    const inventoryId = product?.id != null ? String(product.id) : '';
    if (!inventoryId) {
      return of(false);
    }

    const path = `${environment.urls.OnlineShopWishlist_RemoveFromWishlistForOnlineShop}`;
    return this.http.post(`${this.apiRoot()}api/services/app/${path}`, this.buildWishlistRequest(inventoryId)).pipe(
      map(() => {
        const next = state.wishlist.filter((item) => !this.sameLineId(item.id, product.id));
        this.syncWishlistLocal(next);
        return true;
      }),
      catchError(() => {
        const next = state.wishlist.filter((item) => !this.sameLineId(item.id, product.id));
        this.syncWishlistLocal(next);
        return of(true);
      })
    );
  }

  /*
    ---------------------------------------------
    -------------  Compare Product  -------------
    ---------------------------------------------
  */

  // Get Compare Items
  public get compareItems(): Observable<Product[]> {
    const itemsStream = new Observable(observer => {
      observer.next(state.compare);
      observer.complete();
    });
    return <Observable<Product[]>>itemsStream;
  }

  // Add to Compare
  public addToCompare(product:any): any {
    const compareItem = state.compare.find(item => this.sameLineId(item.id, product.id))
    if (!compareItem) {
      state.compare.push({
        ...product
      })
    }
    this.toastrService.success('Product has been added in compare.');
    localStorage.setItem("compareItems", JSON.stringify(state.compare));
    return true
  }

  // Remove Compare items
  public removeCompareItem(product: Product): any {
    const index = state.compare.indexOf(product);
    state.compare.splice(index, 1);
    localStorage.setItem("compareItems", JSON.stringify(state.compare));
    return true
  }

  /*
    ---------------------------------------------
    -----------------  Cart  --------------------
    ---------------------------------------------
  */

  // Get Cart Items
  public get cartItems(): Observable<Product[]> {
    return this.cartChanged.asObservable();
  }

  /** Total units in cart (sum of line quantities). */
  public get cartCount(): Observable<number> {
    return this.cartChanged.pipe(
      map((items) =>
        (items || []).reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0),
      ),
    );
  }

  private syncCartState(): void {
    localStorage.setItem(ONLINE_SHOP_CART_VERSION_KEY, String(ONLINE_SHOP_CART_VERSION));
    localStorage.setItem('cartItems', JSON.stringify(state.cart));
    this.cartChanged.next([...state.cart]);
    this.recalculateAppliedCouponIfNeeded();
  }

  public get appliedCoupon$(): Observable<AppliedShopCouponState | null> {
    return this.appliedCouponChanged.asObservable();
  }

  public getAppliedCoupon(): AppliedShopCouponState | null {
    return this.appliedCouponChanged.value;
  }

  public get couponDiscountAmount(): number {
    const applied = this.getAppliedCoupon();
    return applied?.result?.isValid ? applied.result.discountAmount : 0;
  }

  public get cartSubtotalAfterCoupon(): Observable<number> {
    return this.cartTotalAmount().pipe(
      map((subtotal) => Math.round((subtotal - this.couponDiscountAmount) * 100) / 100)
    );
  }

  private static readStoredCoupon(): AppliedShopCouponState | null {
    try {
      const raw = localStorage.getItem(ProductService.APPLIED_COUPON_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as AppliedShopCouponState;
    } catch {
      return null;
    }
  }

  private persistAppliedCoupon(stateCoupon: AppliedShopCouponState | null): void {
    if (!stateCoupon) {
      localStorage.removeItem(ProductService.APPLIED_COUPON_KEY);
    } else {
      localStorage.setItem(ProductService.APPLIED_COUPON_KEY, JSON.stringify(stateCoupon));
    }
    this.appliedCouponChanged.next(stateCoupon);
  }

  public clearAppliedCoupon(): void {
    this.couponRecalcInFlight = false;
    this.persistAppliedCoupon(null);
  }

  /** After order completes: wipe cart, coupon cache, and localStorage. */
  public clearCheckoutAfterOrder(): void {
    this.couponRecalcInFlight = false;
    state.cart = [];
    localStorage.removeItem('cartItems');
    localStorage.removeItem(ProductService.APPLIED_COUPON_KEY);
    this.appliedCouponChanged.next(null);
    this.cartChanged.next([]);
  }

  buildCartCouponItems(products: Product[]): CartCouponItemDto[] {
    return (products || []).map((p) => {
      let unit = Number(p.price) || 0;
      if (p.discount) {
        unit = unit - (unit * Number(p.discount) / 100);
      }
      unit = unit * (this.Currency.price ?? 1);
      const qty = Math.max(1, Number(p.quantity) || 1);
      const unitPrice = Math.round(unit * 100) / 100;
      const lineTotal = Math.round(unitPrice * qty * 100) / 100;
      const productId = String(p.productId ?? p.id ?? '');
      return {
        productId,
        quantity: qty,
        unitPrice,
        lineTotal
      };
    });
  }

  applyCouponCode(couponCode: string): Observable<ApplyOnlineShopCouponResult> {
    const code = (couponCode ?? '').trim();
    if (!code) {
      return of({
        isValid: false,
        message: 'Enter a coupon code.',
        eligibleSubtotal: 0,
        discountAmount: 0,
        payableAmountAfterDiscount: 0
      });
    }

    return new Observable((subscriber) => {
      this.cartTotalAmount().subscribe({
        next: (subtotal) => {
          const request = {
            couponCode: code,
            storeId: this.auth.storeId,
            customerId: null as string | null,
            cartSubtotal: Math.round(subtotal * 100) / 100,
            cartItems: this.buildCartCouponItems(state.cart)
          };
          this.onlineShopCheckout.applyCoupon(request).subscribe({
            next: (result) => {
              if (result.isValid) {
                this.persistAppliedCoupon({ couponCode: code, result });
              } else {
                this.clearAppliedCoupon();
              }
              subscriber.next(result);
              subscriber.complete();
            },
            error: (err) => {
              subscriber.error(err);
            }
          });
        },
        error: (err) => subscriber.error(err)
      });
    });
  }

  private recalculateAppliedCouponIfNeeded(): void {
    const applied = this.getAppliedCoupon();
    if (!applied?.couponCode || this.couponRecalcInFlight) {
      return;
    }
    if (!state.cart.length) {
      this.clearAppliedCoupon();
      return;
    }

    this.couponRecalcInFlight = true;
    this.applyCouponCode(applied.couponCode).subscribe({
      next: (result) => {
        this.couponRecalcInFlight = false;
        if (!result.isValid) {
          this.clearAppliedCoupon();
          this.toastrService.warning(result.message || 'Coupon is no longer valid for this cart.');
        }
      },
      error: () => {
        this.couponRecalcInFlight = false;
      }
    });
  }

  // Add to Cart
  public addToCart(product: any): any {
    const openCart = product?.openCart !== false;
    const cartProduct = { ...product };
    delete cartProduct.openCart;

    const qtyToAdd = cartProduct.quantity != null && cartProduct.quantity !== '' ? Number(cartProduct.quantity) : 1;
    if (!Number.isFinite(qtyToAdd) || qtyToAdd < 1) {
      return false;
    }

    const cartItem = state.cart.find((item: any) => this.sameLineId(item.id, cartProduct.id));
    const stock = Number(cartProduct.stock);
    const currentQty = cartItem ? Number(cartItem.quantity) || 0 : 0;
    const newQty = currentQty + qtyToAdd;

    if (!Number.isFinite(stock) || stock <= 0) {
      this.toastrService.error(
        'This product is out of stock.',
        'Out of stock',
        { progressBar: true, timeOut: 3000 },
      );
      return false;
    }
    if (currentQty >= stock) {
      this.toastrService.warning(
        'No more stock available. You already have the maximum quantity in your cart.',
        'Stock limit reached',
        { progressBar: true, timeOut: 3000 },
      );
      return false;
    }
    if (newQty > stock) {
      const remaining = Math.max(0, stock - currentQty);
      this.toastrService.warning(
        remaining > 0
          ? `No more stock available. Only ${remaining} more item(s) can be added.`
          : 'No more stock available.',
        'Stock limit reached',
        { progressBar: true, timeOut: 3000 },
      );
      return false;
    }

    if (cartItem) {
      cartItem.quantity = newQty;
    } else {
      const line = {
        ...cartProduct,
        quantity: qtyToAdd
      };
      state.cart.push(line);
      this.persistShopProduct(line);
    }

    const productName = String(cartProduct.title || cartProduct.name || 'Product').trim();
    this.toastrService.success(
      `${productName} added to your cart.`,
      'Added to cart',
      { progressBar: true, timeOut: 2500 }
    );

    if (openCart) {
      this.OpenCart = true;
    }
    this.syncCartState();
    return true;
  }

  /** Global search add-to-cart: same IDs as product detail when possible; otherwise resolve detail by inventory id. */
  addSearchSuggestionToCart(
    item: SearchProductSuggestion,
    options: { openCart?: boolean } = {},
  ): Observable<boolean> {
    const openCart = options.openCart !== false;
    const inventoryId = String(item.productInventoryId || item.id || '').trim();
    const name = item.productName || item.name || 'Product';

    console.log('Search AddToCart Payload', {
      productId: item.productId,
      productInventoryId: inventoryId,
      name,
    });

    if (!inventoryId) {
      this.toastrService.error('Product is not available for cart.');
      return of(false);
    }

    if (this.isValidCatalogProductId(item.productId, inventoryId)) {
      return of(this.pushSearchMappedCartItem(item, String(item.productId), inventoryId, openCart));
    }

    return this.getProductDetailForOnlineShop(inventoryId).pipe(
      map((resp) => {
        const detail = resp?.result ?? resp;
        if (!detail) {
          this.toastrService.error('Product is not available for cart.');
          return false;
        }

        const mapped = this.mapInventoryItemToProduct(detail);
        const resolvedInventoryId = String(mapped.id ?? inventoryId).trim();
        if (!this.isValidCatalogProductId(mapped.productId, resolvedInventoryId)) {
          console.warn('Invalid cart mapping after detail resolve', {
            productId: mapped.productId,
            productInventoryId: resolvedInventoryId,
            name: mapped.title,
          });
          this.toastrService.error('Product is not available for cart.');
          return false;
        }

        this.persistShopProduct(mapped);
        return this.addToCart({
          ...mapped,
          openCart,
        });
      }),
      catchError((err) => {
        console.warn('Search add-to-cart detail lookup failed', err);
        this.toastrService.error('Product is not available for cart.');
        return of(false);
      }),
    );
  }

  private isValidCatalogProductId(productId: unknown, inventoryId: unknown): boolean {
    const catalogId = String(productId ?? '').trim();
    const lineId = String(inventoryId ?? '').trim();
    if (!catalogId || !lineId) {
      return false;
    }
    if (catalogId === lineId) {
      return false;
    }
    if (catalogId.toLowerCase() === ProductService.EMPTY_GUID) {
      return false;
    }
    return true;
  }

  private pushSearchMappedCartItem(
    item: SearchProductSuggestion,
    productId: string,
    inventoryId: string,
    openCart: boolean,
  ): boolean {
    const imageUrl = this.normalizeImageUrl(item.pictureUrl || item.imageUrl || '') || this.defaultProductImage;
    const stock = this.resolveProductStock(item);
    const name = item.productName || item.name || 'Product';

    if (item.isAvailable === false || (stock != null && Number(stock) <= 0)) {
      return this.addToCart({
        id: inventoryId,
        productId,
        title: name,
        stock: 0,
        quantity: 1,
        openCart,
      });
    }

    const product: Product = {
      id: inventoryId,
      productId,
      title: name,
      description: item.description,
      category: item.categoryName,
      price: item.actualSellPrice ?? item.price,
      stock,
      quantity: 1,
      pictureUrl: imageUrl,
      pictureUrls: imageUrl ? [imageUrl] : [],
      images: imageUrl ? [{ src: imageUrl, alt: name }] : [],
    };
    this.persistShopProduct(product);
    return this.addToCart({
      ...product,
      openCart,
    });
  }

  // Update Cart Quantity
  public updateCartQuantity(product: Product, quantity: number): Product | boolean {
    const idx = state.cart.findIndex((item: any) => this.sameLineId(item.id, product.id));
    if (idx === -1) {
      return false;
    }
    const line = state.cart[idx] as any;
    const nextQty = (Number(line.quantity) || 0) + quantity;
    const stock = Number(line.stock);

    if (nextQty > stock) {
      this.toastrService.error('You can not add more items than available. In stock ' + stock + ' items.');
      return false;
    }

    if (nextQty < 1) {
      state.cart.splice(idx, 1);
    } else {
      state.cart[idx].quantity = nextQty;
    }
    this.syncCartState();
    return true;
  }

  // Remove Cart items
  public removeCartItem(product: Product): any {
    const idx = state.cart.findIndex((item: any) => this.sameLineId(item.id, product.id));
    if (idx !== -1) {
      state.cart.splice(idx, 1);
      this.syncCartState();
    }
    return true;
  }

  /** Clear cart (and coupon) — use clearCheckoutAfterOrder when order is placed. */
  public clearCart(): void {
    state.cart = [];
    this.clearAppliedCoupon();
    this.syncCartState();
  }

  // Total amount 
  public cartTotalAmount(): Observable<number> {
    return this.cartItems.pipe(map((product: Product[]) => {
      return product.reduce((prev, curr: Product) => {
        let price = curr.price;
        if(curr.discount) {
          price = curr.price - (curr.price * curr.discount / 100)
        }
        return (prev + price * curr.quantity) * this.Currency.price;
      }, 0);
    }));
  }

  /*
    ---------------------------------------------
    ------------  Filter Product  ---------------
    ---------------------------------------------
  */

  // Get Product Filter
  public filterProducts(filter: any): Observable<Product[]> {
    return this.products.pipe(map(product => 
      product.filter((item: Product) => {
        if (!filter.length) return true
        const Tags = filter.some((prev:any) => { // Match Tags
          if (item.tags) {
            if (item.tags.includes(prev)) {
              return prev
            }
          }
        })
        return Tags
      })
    ));
  }

  // Sorting Filter
  public sortProducts(products: Product[], payload: string): any {

    if(payload === 'ascending') {
      return products.sort((a, b) => {
        if (a.id < b.id) {
          return -1;
        } else if (a.id > b.id) {
          return 1;
        }
        return 0;
      })
    } else if (payload === 'a-z') {
      return products.sort((a, b) => {
        if (a.title < b.title) {
          return -1;
        } else if (a.title > b.title) {
          return 1;
        }
        return 0;
      })
    } else if (payload === 'z-a') {
      return products.sort((a, b) => {
        if (a.title > b.title) {
          return -1;
        } else if (a.title < b.title) {
          return 1;
        }
        return 0;
      })
    } else if (payload === 'low') {
      return products.sort((a, b) => {
        if (a.price < b.price) {
          return -1;
        } else if (a.price > b.price) {
          return 1;
        }
        return 0;
      })
    } else if (payload === 'high') {
      return products.sort((a, b) => {
        if (a.price > b.price) {
          return -1;
        } else if (a.price < b.price) {
          return 1;
        }
        return 0;
      })
    } 
  }

  /**
   * Path from tree root to the node whose id matches targetId (inclusive), or null.
   */
  public findCategoryPath(
    nodes: any[] | null | undefined,
    targetId: string | null | undefined
  ): any[] | null {
    if (!nodes?.length || targetId === undefined || targetId === null || targetId === '') {
      return null;
    }
    const tid = String(targetId);
    for (const n of nodes) {
      if (String(n.id) === tid) {
        return [n];
      }
      if (n.children?.length) {
        const sub = this.findCategoryPath(n.children, targetId);
        if (sub) {
          return [n, ...sub];
        }
      }
    }
    return null;
  }

  /** Lowercase slug for matching query ?category= values to tree titles or ids. */
  public normalizeCategoryKey(value: string | null | undefined): string {
    return String(value ?? '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/_/g, '-');
  }

  /**
   * Like {@link findCategoryPath} but also matches slugified `title` or `id` string
   * (e.g. `?category=fashion` vs title "Fashion").
   */
  public findCategoryPathFlexible(
    nodes: any[] | null | undefined,
    target: string | null | undefined
  ): any[] | null {
    const byId = this.findCategoryPath(nodes, target);
    if (byId) {
      return byId;
    }
    if (!nodes?.length || target === undefined || target === null || target === '') {
      return null;
    }
    const want = this.normalizeCategoryKey(String(target));
    for (const n of nodes) {
      if (n.children?.length) {
        const sub = this.findCategoryPathFlexible(n.children, target);
        if (sub) {
          return [n, ...sub];
        }
      }
      const idKey = this.normalizeCategoryKey(String(n.id));
      const titleKey = this.normalizeCategoryKey(String(n.title ?? ''));
      if (want && (idKey === want || titleKey === want)) {
        return [n];
      }
    }
    return null;
  }

  /*
    ---------------------------------------------
    ------------- Product Pagination  -----------
    ---------------------------------------------
  */
  public getPager(totalItems: number, currentPage: number = 1, pageSize: number = 16) {
    // calculate total pages
    let totalPages = Math.ceil(totalItems / pageSize);

    // Paginate Range
    let paginateRange = 3;

    // ensure current page isn't out of range
    if (currentPage < 1) { 
      currentPage = 1; 
    } else if (currentPage > totalPages) { 
      currentPage = totalPages; 
    }
    
    let startPage: number, endPage: number;
    if (totalPages <= 5) {
      startPage = 1;
      endPage = totalPages;
    } else if(currentPage < paginateRange - 1){
      startPage = 1;
      endPage = startPage + paginateRange - 1;
    } else {
      startPage = currentPage - 1;
      endPage =  currentPage + 1;
    }

    // calculate start and end item indexes
    let startIndex = (currentPage - 1) * pageSize;
    let endIndex = Math.min(startIndex + pageSize - 1, totalItems - 1);

    // create an array of pages to ng-repeat in the pager control
    let pages = Array.from(Array((endPage + 1) - startPage).keys()).map(i => startPage + i);

    // return object with all pager properties required by the view
    return {
      totalItems: totalItems,
      currentPage: currentPage,
      pageSize: pageSize,
      totalPages: totalPages,
      startPage: startPage,
      endPage: endPage,
      startIndex: startIndex,
      endIndex: endIndex,
      pages: pages
    };
  }

  public getCategories(): Observable<any> {
    return this.tenantService.whenReady().pipe(
      switchMap(({ tenantId, storeId }) => {
        const path =
          environment.urls?.OnlineShopProductGroup_GetHierarchyForOnline ??
          'OnlineShopProductGroup/GetProductGroupHierarchyForOnline';
        const q = `TenantId=${tenantId}&StoreId=${encodeURIComponent(storeId)}`;
        return this.http.get(`${this.apiRoot()}api/services/app/${path}?${q}`);
      }),
    );
  }

  getProductGroupsListForOnline(input: {
    tenantId?: number;
    storeId?: string;
    categoryFilter?: 'popular' | 'nonPopular' | 'all';
  }): Observable<{ id: string; name: string; image: string }[]> {
    return this.tenantService.whenReady().pipe(
      switchMap((ctx) => {
        const tenantId = input.tenantId ?? ctx.tenantId;
        const storeId = input.storeId ?? ctx.storeId;
        let q = `?TenantId=${tenantId}&StoreId=${encodeURIComponent(storeId)}`;
        if (input.categoryFilter === 'popular') {
          q += '&OnlyPopular=true';
        } else if (input.categoryFilter === 'nonPopular') {
          q += '&ExcludePopular=true';
        }
        const path = environment.urls.OnlineShopProductGroup_GetProductGroupsListForOnline;
        return this.getProductsFromAPI(`${path}${q}`).pipe(
          map((resp: { result?: unknown[] }) => {
            const rows = resp?.result ?? (Array.isArray(resp) ? resp : []);
            return (rows as Record<string, unknown>[]).map((row) => ({
              id: String(row.id ?? row.Id ?? ''),
              name: String(row.name ?? row.Name ?? ''),
              image: this.resolveCategoryPictureUrl(row.pictureUrl ?? row.PictureUrl),
            }));
          }),
          catchError(() => of([])),
        );
      }),
    );
  }

  private resolveCategoryPictureUrl(pictureUrl: unknown): string {
    const raw = pictureUrl != null ? String(pictureUrl).trim() : '';
    if (!raw) {
      return 'assets/images/product/placeholder.jpg';
    }
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('assets/')) {
      return raw;
    }
    const base = (environment.baseUrl || '').replace(/\/$/, '');
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    return `${base}${path}`;
  }

  /** Brands (manufacturers) for the shop sidebar; optional category limits to products in that group. */
  public getBrandsForOnlineShop(productGroupId?: string | null): Observable<any> {
    return this.tenantService.whenReady().pipe(
      switchMap((ctx) => {
        let url = `${this.apiRoot()}api/services/app/${environment.urls.OnlineShopBrand_GetBrandsListForOnline}?TenantId=${ctx.tenantId}`;
        if (productGroupId) {
          url += `&ProductGroupId=${encodeURIComponent(productGroupId)}`;
        }
        return this.http.get(url);
      }),
    );
  }

  /** Popular brands for the home page carousel (admin IsPopular flag). */
  getHomePopularBrandsForOnline(input?: {
    tenantId?: number;
    storeId?: string;
    maxResultCount?: number;
  }): Observable<{ id: string; name: string; image: string }[]> {
    return this.tenantService.whenReady().pipe(
      switchMap((ctx) => {
        const tenantId = input?.tenantId ?? ctx.tenantId;
        const storeId = input?.storeId ?? ctx.storeId;
        let q = `?TenantId=${tenantId}&StoreId=${encodeURIComponent(storeId)}`;
        if (input?.maxResultCount != null && input.maxResultCount > 0) {
          q += `&MaxResultCount=${input.maxResultCount}`;
        }
        const path = environment.urls.OnlineShopBrand_GetHomePopularBrandsForOnline;
        return this.getProductsFromAPI(`${path}${q}`).pipe(
          map((resp: { result?: unknown[] }) => {
            const rows = resp?.result ?? (Array.isArray(resp) ? resp : []);
            return (rows as Record<string, unknown>[])
              .map((row) => ({
                id: String(row.id ?? row.Id ?? ''),
                name: String(row.brandName ?? row.BrandName ?? ''),
                image: this.resolveCategoryPictureUrl(row.pictureUrl ?? row.PictureUrl),
              }))
              .filter((row) => row.id.length > 0);
          }),
          catchError(() => of([])),
        );
      }),
    );
  }

  private onlineShopFacetQuery(ctx: { tenantId: number; storeId: string }, categoryId?: string | null): string {
    let q = `TenantId=${ctx.tenantId}&StoreId=${encodeURIComponent(ctx.storeId)}`;
    if (categoryId) {
      q += `&CategoryId=${encodeURIComponent(categoryId)}`;
    }
    return q;
  }

  public getColorsForOnlineShop(categoryId?: string | null): Observable<any> {
    return this.tenantService.whenReady().pipe(
      switchMap((ctx) => {
        const url = `${this.apiRoot()}api/services/app/${environment.urls.OnlineShopAvailableProduct_GetProductColorsListForOnline}?${this.onlineShopFacetQuery(ctx, categoryId || null)}`;
        return this.http.get(url);
      }),
    );
  }

  public getSizesForOnlineShop(categoryId?: string | null): Observable<any> {
    return this.tenantService.whenReady().pipe(
      switchMap((ctx) => {
        const url = `${this.apiRoot()}api/services/app/${environment.urls.OnlineShopAvailableProduct_GetProductSizesListForOnline}?${this.onlineShopFacetQuery(ctx, categoryId || null)}`;
        return this.http.get(url);
      }),
    );
  }

 public getProductsFromAPI(url:any): Observable<any>{
        return this.http.get(`${this.apiRoot()}api/services/app/${url}`);
  }

  readonly defaultProductImage = 'assets/images/product/placeholder.jpg';

  /** Fix API paths that use backslashes so browsers load images correctly. */
  normalizeImageUrl(url: string | null | undefined): string {
    if (url == null || String(url).trim() === '') {
      return '';
    }
    let u = String(url).trim().replace(/\\/g, '/');
    if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('assets/')) {
      return u;
    }
    const base = (environment.baseUrl || '').replace(/\/$/, '');
    const path = u.startsWith('/') ? u : `/${u}`;
    return `${base}${path}`;
  }

  /** Merge primary pictureUrl into pictureUrls without duplicates. */
  mergeProductPictureUrls(
    pictureUrl?: string | null,
    pictureUrls?: string[] | null
  ): string[] {
    const merged: string[] = [];
    const add = (raw: string) => {
      const n = this.normalizeImageUrl(raw);
      if (n && merged.indexOf(n) === -1) {
        merged.push(n);
      }
    };
    if (pictureUrl) {
      add(String(pictureUrl));
    }
    (pictureUrls || []).forEach((u) => {
      if (u) {
        add(String(u));
      }
    });
    return merged;
  }

  /** Resolved gallery URLs for detail, quick view, and listing (first image). */
  getProductImages(product: any): string[] {
    const primary = product?.pictureUrl ?? product?.images?.[0]?.src;
    const list = product?.pictureUrls?.length
      ? product.pictureUrls
      : primary
        ? [primary]
        : (product?.images || []).map((img: any) => img?.src).filter((x: string) => !!x);

    const normalized = this.mergeProductPictureUrls(primary, list as string[]);
    return normalized.length ? normalized : [this.defaultProductImage];
  }

  /** Map POS online-shop inventory API row to shop `Product`. */
  mapInventoryItemToProduct(item: any): Product {
    const desc = item?.productDescription ?? item?.ProductDescription ?? '';
    const name = item?.productName ?? item?.ProductName ?? '';
    const pictureUrl = item?.pictureUrl ?? item?.PictureUrl;
    const pictureUrlsRaw = item?.pictureUrls ?? item?.PictureUrls;
    const imageUrls = this.mergeProductPictureUrls(pictureUrl, pictureUrlsRaw);
    const gallery = imageUrls.length ? imageUrls : [this.defaultProductImage];

    return {
      id: item.id ?? item.Id,
      title: name,
      description: desc,
      type: item.categoryName ?? item.CategoryName,
      brand: item.brandName ?? item.BrandName,
      category: item.categoryName ?? item.CategoryName,
      productId: item.productId != null || item.ProductId != null
        ? String(item.productId ?? item.ProductId)
        : undefined,
      color: item.productColor != null && String(item.productColor).trim() !== ''
        ? String(item.productColor).trim()
        : item.ProductColor != null && String(item.ProductColor).trim() !== ''
          ? String(item.ProductColor).trim()
          : undefined,
      productSize: item.productSize != null && item.productSize !== ''
        ? Number(item.productSize)
        : item.ProductSize != null && item.ProductSize !== ''
          ? Number(item.ProductSize)
          : undefined,
      price: item.actualSellPrice ?? item.ActualSellPrice,
      sale: (item.discountOnProduct ?? item.DiscountOnProduct ?? 0) > 0,
      discount: item.discountOnProduct ?? item.DiscountOnProduct ?? 0,
      stock: this.resolveProductStock(item),
      quantity: item.productQuantityPerUnit ?? item.ProductQuantityPerUnit ?? 1,
      new: !!(item.isNew ?? item.IsNew),
      pictureUrl: gallery[0],
      pictureUrls: gallery,
      images: gallery.map((src) => ({ src, alt: name })),
      tags: item.productIdTag || item.ProductIdTag ? [item.productIdTag ?? item.ProductIdTag] : [],
    };
  }

  private resolveProductStock(item: any): number {
    const isAvailable = item?.isAvailable ?? item?.IsAvailable;
    if (isAvailable === false) {
      return 0;
    }
    const stock =
      item?.productTotalQuantity ?? item?.ProductTotalQuantity
      ?? item?.productUnitStock ?? item?.ProductUnitStock
      ?? item?.stock ?? item?.Stock;
    const parsed = Number(stock);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private shopApiQuery(inventoryId: string, extra?: Record<string, string | number>): string {
    const { tenantId, storeId } = this.shopIds();
    let q = `?TenantId=${tenantId}&StoreId=${encodeURIComponent(storeId)}&ProductInventoryId=${encodeURIComponent(inventoryId)}`;
    if (extra) {
      Object.keys(extra).forEach((k) => {
        q += `&${k}=${encodeURIComponent(String(extra[k]))}`;
      });
    }
    return q;
  }

  getProductDetailForOnlineShop(productInventoryId: string): Observable<any> {
    const path = `${environment.urls.OnlineShopAvailableProduct_GetProductDetailForOnlineShop}${this.shopApiQuery(productInventoryId)}`;
    return this.getProductsFromAPI(path);
  }

  getRelatedProductsForOnlineShop(productInventoryId: string, maxCount = 4): Observable<any> {
    const path = `${environment.urls.OnlineShopAvailableProduct_GetRelatedProductsForOnlineShop}${this.shopApiQuery(productInventoryId, { MaxCount: maxCount })}`;
    return this.getProductsFromAPI(path);
  }

  getHomePopularCategoryProductSliders(input: {
    tenantId?: number;
    storeId?: string;
    productLimitPerCategory?: number;
  }): Observable<HomeCategorySliderDto[]> {
    return this.tenantService.whenReady().pipe(
      switchMap((ctx) => {
        const tenantId = input.tenantId ?? ctx.tenantId;
        const storeId = input.storeId ?? ctx.storeId;
        let q = `?TenantId=${tenantId}&StoreId=${encodeURIComponent(storeId)}`;
        if (input.productLimitPerCategory != null && input.productLimitPerCategory > 0) {
          q += `&ProductLimitPerCategory=${input.productLimitPerCategory}`;
        }
        const path =
          environment.urls.OnlineShopProduct_GetHomePopularCategoryProductSliders ??
          environment.urls.OnlineShopAvailableProduct_GetHomePopularCategoryProductSliders;
        return this.getProductsFromAPI(`${path}${q}`).pipe(
          map((resp: { result?: unknown[] }) => {
            const rows = resp?.result ?? (Array.isArray(resp) ? resp : []);
            return (rows as Record<string, unknown>[]).map((s) => this.normalizeHomeCategorySlider(s));
          }),
          catchError(() => of([] as HomeCategorySliderDto[])),
        );
      }),
    );
  }

  private normalizeHomeCategorySlider(s: Record<string, unknown>): HomeCategorySliderDto {
    const products = (s.products ?? s.Products ?? []) as Record<string, unknown>[];
    return {
      categoryId: String(s.categoryId ?? s.CategoryId ?? ''),
      categoryName: String(s.categoryName ?? s.CategoryName ?? ''),
      seeMoreUrl: (s.seeMoreUrl ?? s.SeeMoreUrl) as string | undefined,
      products: products.map((p) => this.normalizeInventoryApiRow(p))
    };
  }

  private normalizeInventoryApiRow(p: Record<string, unknown>): AvailableProductInventoryDtoForOnlineShop {
    return {
      id: String(p.id ?? p.Id ?? ''),
      productId: p.productId != null || p.ProductId != null ? String(p.productId ?? p.ProductId) : undefined,
      productIdTag: (p.productIdTag ?? p.ProductIdTag) as string | undefined,
      productName: (p.productName ?? p.ProductName) as string | undefined,
      brandId: p.brandId != null || p.BrandId != null ? String(p.brandId ?? p.BrandId) : undefined,
      brandName: (p.brandName ?? p.BrandName) as string | undefined,
      productSize: (p.productSize ?? p.ProductSize) as number | undefined,
      productColor: (p.productColor ?? p.ProductColor) as string | undefined,
      productDescription: (p.productDescription ?? p.ProductDescription) as string | undefined,
      actualSellPrice: (p.actualSellPrice ?? p.ActualSellPrice) as number | undefined,
      productMSRP: (p.productMSRP ?? p.ProductMSRP) as number | undefined,
      discountOnProduct: (p.discountOnProduct ?? p.DiscountOnProduct) as number | undefined,
      categoryName: (p.categoryName ?? p.CategoryName) as string | undefined,
      categoryId: p.categoryId != null || p.CategoryId != null ? String(p.categoryId ?? p.CategoryId) : undefined,
      storeId: p.storeId != null || p.StoreId != null ? String(p.storeId ?? p.StoreId) : undefined,
      storeName: (p.storeName ?? p.StoreName) as string | undefined,
      isFavouriteProduct: (p.isFavouriteProduct ?? p.IsFavouriteProduct) as boolean | undefined,
      isNew: (p.isNew ?? p.IsNew) as boolean | undefined,
      productTaxesId: (p.productTaxesId ?? p.ProductTaxesId) as string[] | undefined,
      pictureUrl: (p.pictureUrl ?? p.PictureUrl) as string | undefined,
      pictureUrls: (p.pictureUrls ?? p.PictureUrls) as string[] | undefined,
      productTotalQuantity:
        p.productTotalQuantity != null || p.ProductTotalQuantity != null
          ? Number(p.productTotalQuantity ?? p.ProductTotalQuantity)
          : undefined,
      productUnitStock:
        p.productTotalQuantity != null || p.ProductTotalQuantity != null
          ? Number(p.productTotalQuantity ?? p.ProductTotalQuantity)
          : p.productUnitStock != null || p.ProductUnitStock != null
            ? Number(p.productUnitStock ?? p.ProductUnitStock)
            : undefined,
      productQuantityPerUnit:
        p.productQuantityPerUnit != null || p.ProductQuantityPerUnit != null
          ? Number(p.productQuantityPerUnit ?? p.ProductQuantityPerUnit)
          : undefined,
      isAvailable: (p.isAvailable ?? p.IsAvailable) as boolean | undefined,
    };
  }
}

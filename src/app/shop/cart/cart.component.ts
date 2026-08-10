import { Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ProductService } from "../../shared/services/product.service";
import { Product } from "../../shared/classes/product";
import { AuthService } from '../../shared/services/auth.service';
import {
  OnlineShopAppliedDiscount,
  OnlineShopCheckoutService,
  OnlineShopCouponStatus,
  OnlineShopPricingResult,
  OnlineShopShippingMethod
} from '../../shared/services/online-shop-checkout.service';
import { ToastrService } from 'ngx-toastr';
import { shopProductLink } from '../../shared/constants/storefront-routes';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnDestroy {

  public products: Product[] = [];
  public couponCodeInput = '';
  public couponApplying = false;

  /** Every amount shown on this page comes from here. */
  public pricing: OnlineShopPricingResult | null = null;

  private readonly destroy$ = new Subject<void>();
  private readonly pricingRequested$ = new Subject<void>();

  constructor(
    public productService: ProductService,
    private auth: AuthService,
    private router: Router,
    private toastr: ToastrService,
    private checkout: OnlineShopCheckoutService,
  ) {
    // Coalesced so a quantity stepper clicked repeatedly issues one pricing call.
    this.pricingRequested$
      .pipe(debounceTime(250), takeUntil(this.destroy$))
      .subscribe(() => this.refreshPricing());

    this.productService.cartItems.pipe(takeUntil(this.destroy$)).subscribe((response) => {
      this.products = response;
      this.pricingRequested$.next();
    });

    this.productService.appliedCouponCodes$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.pricingRequested$.next();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  productLink(product: Product): (string | number)[] {
    return shopProductLink(product || {});
  }

  get cartSubtotal(): number {
    return this.pricing?.originalProductSubtotal ?? 0;
  }

  /**
   * Each discount the server granted, with the label the engine chose for it. Shipping promotions
   * are left out because the cart quotes no delivery.
   */
  get discountRows(): OnlineShopAppliedDiscount[] {
    return (this.pricing?.appliedDiscounts ?? [])
      .filter((d) => d.scope !== 'shipping' && d.discountAmount > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /** Delivery is quoted at checkout, so the cart total is merchandise only. */
  get cartPayableTotal(): number {
    return this.pricing?.netMerchandiseAmount ?? 0;
  }

  /**
   * Every code the shopper is holding, with the server's verdict on each. Codes the server refused
   * stay listed with their reason so they can be read and removed.
   */
  get couponStatuses(): OnlineShopCouponStatus[] {
    return this.pricing?.coupons ?? [];
  }

  /** A product-restricted coupon covers only part of the cart, which is worth spelling out. */
  isCouponPartiallyEligible(coupon: OnlineShopCouponStatus): boolean {
    return coupon.isValid
      && coupon.eligibleSubtotal > 0
      && coupon.eligibleSubtotal < (this.pricing?.subtotalAfterProductDiscounts ?? 0) - 0.005;
  }

  couponLabel(coupon: OnlineShopCouponStatus): string {
    return coupon.couponTitle || coupon.couponCode || 'Coupon';
  }

  applyCoupon(): void {
    const code = this.couponCodeInput.trim().toUpperCase();
    if (!code) {
      this.toastr.warning('Enter a coupon code.');
      return;
    }

    if (this.productService.getAppliedCouponCodes().includes(code)) {
      this.toastr.info('That code is already applied.');
      this.couponCodeInput = '';
      return;
    }

    // Priced with the new code alongside the held ones, and only kept if the server admits it.
    const codes = [...this.productService.getAppliedCouponCodes(), code];

    this.couponApplying = true;
    this.requestPricing(codes, (result) => {
      this.couponApplying = false;
      const status = result.coupons.find((x) => x.couponCode === code);

      if (status?.isAdmitted) {
        this.productService.setAppliedCouponCodes(codes);
        this.couponCodeInput = '';

        // Admitted but beaten to its scope: worth keeping, since removing another code can let it win.
        if (status.isValid) {
          this.toastr.success(status.message || 'Coupon applied.');
        } else {
          this.toastr.info(status.message || 'A better offer is already applied to this order.');
        }
        return;
      }

      this.toastr.error(status?.message || 'Invalid coupon.');
    }, () => {
      this.couponApplying = false;
    });
  }

  removeCoupon(code: string | null | undefined): void {
    if (!code) {
      return;
    }
    this.productService.removeAppliedCouponCode(code);
  }

  private refreshPricing(): void {
    this.requestPricing(this.productService.getAppliedCouponCodes());
  }

  /**
   * Prices the cart server-side. Shipping is excluded because no delivery address has been given
   * yet, so a charge here would be a guess.
   */
  private requestPricing(
    couponCodes: string[],
    onSuccess?: (result: OnlineShopPricingResult) => void,
    onError?: () => void
  ): void {
    const items = this.productService.buildPricingCartLines(this.products);
    if (!items.length) {
      this.pricing = null;
      onSuccess?.(this.emptyPricing());
      return;
    }

    this.checkout.calculatePricing({
      storeId: this.auth.storeId,
      items,
      couponCodes,
      shippingMethod: OnlineShopShippingMethod.Shipping,
      includeShipping: false
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.pricing = result;
        onSuccess?.(result);
      },
      error: (err) => {
        const msg =
          err?.error?.error?.message ||
          err?.error?.message ||
          err?.message ||
          'Could not refresh cart totals.';
        this.toastr.error(msg);
        onError?.();
      }
    });
  }

  private emptyPricing(): OnlineShopPricingResult {
    return {
      originalProductSubtotal: 0,
      catalogueDiscountTotal: 0,
      promotionalProductDiscountTotal: 0,
      productDiscountTotal: 0,
      subtotalAfterProductDiscounts: 0,
      orderDiscountTotal: 0,
      netMerchandiseAmount: 0,
      taxAmount: 0,
      originalShippingAmount: 0,
      shippingDiscountTotal: 0,
      finalShippingAmount: 0,
      totalDiscount: 0,
      finalTotal: 0,
      totalWeightKg: 0,
      billableWeightKg: 0,
      isMarginCapped: false,
      appliedDiscounts: [],
      coupons: [],
      courierOptions: [],
      shippingQuoteUnavailable: false,
      isMockRate: false
    };
  }

  // Increament
  increment(product:any, qty = 1) {
    if (!this.canIncrement(product)) {
      return;
    }
    this.productService.updateCartQuantity(product, qty);
  }

  // Decrement
  decrement(product: any, qty = -1) {
    const currentQty = Number(product?.quantity) || 0;
    if (currentQty <= 1) {
      return;
    }
    this.productService.updateCartQuantity(product, qty);
  }

  canDecrement(product: any): boolean {
    return (Number(product?.quantity) || 0) > 1;
  }

  canIncrement(product: any): boolean {
    return this.productService.canIncrementCartLine(product);
  }

  getProductStock(product: any): number {
    return this.productService.getProductStock(product);
  }

  isAtMaxInCart(product: any): boolean {
    return this.productService.isCartLineAtMax(product);
  }

  public removeItem(product: any) {
    this.productService.removeCartItem(product);
  }

  addToWishlist(product: any) {
    this.productService.addToWishlist(product).subscribe();
  }

  goToCheckout(): void {
    if (!this.auth.isLoggedIn()) {
      this.auth.navigateToLogin('/shop/checkout');
      return;
    }
    this.router.navigate(['/shop/checkout']);
  }

}

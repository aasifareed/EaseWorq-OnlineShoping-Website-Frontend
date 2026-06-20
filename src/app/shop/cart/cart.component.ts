import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ProductService } from "../../shared/services/product.service";
import { Product } from "../../shared/classes/product";
import { AuthService } from '../../shared/services/auth.service';
import { OnlineShopSettingsService } from '../../shared/services/online-shop-settings.service';
import { OnlineShopStorefront } from '../../shared/models/online-shop-storefront.model';
import { AppliedShopCouponState } from '../../shared/services/online-shop-checkout.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnInit, OnDestroy {

  public products: Product[] = [];
  public storefront: OnlineShopStorefront | null = null;
  public cartSubtotal = 0;
  public couponCodeInput = '';
  public appliedCoupon: AppliedShopCouponState | null = null;
  public couponApplying = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    public productService: ProductService,
    private auth: AuthService,
    private router: Router,
    private storefrontSettings: OnlineShopSettingsService,
    private toastr: ToastrService,
  ) {
    this.productService.cartItems.pipe(takeUntil(this.destroy$)).subscribe((response) => {
      this.products = response;
    });
    this.productService.cartTotalAmount().pipe(takeUntil(this.destroy$)).subscribe((amount) => {
      this.cartSubtotal = Number(amount) || 0;
    });
    this.productService.appliedCoupon$.pipe(takeUntil(this.destroy$)).subscribe((coupon) => {
      this.appliedCoupon = coupon;
      if (coupon?.couponCode) {
        this.couponCodeInput = coupon.couponCode;
      }
    });
  }

  ngOnInit(): void {
    this.storefrontSettings.storefront$
      .pipe(takeUntil(this.destroy$))
      .subscribe((storefront) => {
        this.storefront = storefront;
      });

    if (this.storefrontSettings.snapshot) {
      this.storefront = this.storefrontSettings.snapshot;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get storeName(): string {
    return (
      this.storefront?.storeName?.trim()
      || this.auth.tenancyName
      || 'Store'
    );
  }

  public get getTotal(): Observable<number> {
    return this.productService.cartTotalAmount();
  }

  get couponDiscount(): number {
    return this.appliedCoupon?.result?.isValid ? this.appliedCoupon.result.discountAmount : 0;
  }

  get cartPayableTotal(): number {
    if (this.appliedCoupon?.result?.isValid) {
      return this.appliedCoupon.result.payableAmountAfterDiscount;
    }
    return this.cartSubtotal;
  }

  applyCoupon(): void {
    const code = this.couponCodeInput.trim();
    if (!code) {
      this.toastr.warning('Enter a coupon code.');
      return;
    }
    this.couponApplying = true;
    this.productService.applyCouponCode(code).subscribe({
      next: (result) => {
        this.couponApplying = false;
        if (result.isValid) {
          this.toastr.success(result.message || 'Coupon applied.');
        } else {
          this.toastr.error(result.message || 'Invalid coupon.');
        }
      },
      error: (err) => {
        this.couponApplying = false;
        const msg =
          err?.error?.error?.message ||
          err?.error?.message ||
          err?.message ||
          'Could not apply coupon.';
        this.toastr.error(msg);
      }
    });
  }

  clearCoupon(): void {
    this.couponCodeInput = '';
    this.productService.clearAppliedCoupon();
  }

  // Increament
  increment(product:any, qty = 1) {
    this.productService.updateCartQuantity(product, qty);
  }

  // Decrement
  decrement(product:any, qty = -1) {
    this.productService.updateCartQuantity(product, qty);
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

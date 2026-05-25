import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ProductService } from "../../shared/services/product.service";
import { Product } from "../../shared/classes/product";
import { AuthService } from '../../shared/services/auth.service';
import { OnlineShopSettingsService } from '../../shared/services/online-shop-settings.service';
import { OnlineShopStorefront } from '../../shared/models/online-shop-storefront.model';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnInit, OnDestroy {

  public products: Product[] = [];
  public storefront: OnlineShopStorefront | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    public productService: ProductService,
    private auth: AuthService,
    private router: Router,
    private storefrontSettings: OnlineShopSettingsService,
  ) {
    this.productService.cartItems.subscribe(response => this.products = response);
  }

  ngOnInit(): void {
    this.storefrontSettings.storefront$
      .pipe(takeUntil(this.destroy$))
      .subscribe((storefront) => {
        this.storefront = storefront;
      });

    if (this.storefrontSettings.snapshot) {
      this.storefront = this.storefrontSettings.snapshot;
    } else {
      this.storefrontSettings.loadStorefront().subscribe();
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

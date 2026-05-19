import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { ProductService } from "../../shared/services/product.service";
import { Product } from "../../shared/classes/product";
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnInit {

  public products: Product[] = [];

  constructor(
    public productService: ProductService,
    private auth: AuthService,
    private router: Router
  ) {
    this.productService.cartItems.subscribe(response => this.products = response);
  }

  ngOnInit(): void {
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

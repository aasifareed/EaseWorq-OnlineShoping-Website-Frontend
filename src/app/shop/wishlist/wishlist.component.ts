import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductService } from "../../shared/services/product.service";
import { Product } from "../../shared/classes/product";

@Component({
  selector: 'app-wishlist',
  templateUrl: './wishlist.component.html',
  styleUrls: ['./wishlist.component.scss']
})
export class WishlistComponent implements OnInit {

  public products: Product[] = [];
  public loading = true;

  constructor(private router: Router,
    public productService: ProductService) {
    this.productService.wishlistItems.subscribe(response => this.products = response);
  }

  ngOnInit(): void {
    this.productService.loadWishlistFromApi().subscribe({
      next: () => { this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  async addToCart(product: any) {
    const status = await this.productService.addToCart(product);
    if (status) {
      this.router.navigate(['/shop/cart']);
      this.removeItem(product);
    }
  }

  removeItem(product: any) {
    this.productService.removeWishlistItem(product).subscribe();
  }

  productLink(product: Product): (string | number)[] {
    return ['/shop/product/left/sidebar', String(product?.id ?? '')];
  }

}

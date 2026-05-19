import { Component, Input, OnChanges } from '@angular/core';
import { Product } from '../../../../shared/classes/product';
import { ProductService } from '../../../../shared/services/product.service';

@Component({
  selector: 'app-related-product',
  templateUrl: './related-product.component.html',
  styleUrls: ['./related-product.component.scss']
})
export class RelatedProductComponent implements OnChanges {

  /** @deprecated Legacy JSON filter by category name; prefer [products] from API. */
  @Input() type: string;

  @Input() products: Product[] = [];
  @Input() loading = false;

  public displayProducts: Product[] = [];

  constructor(public productService: ProductService) { }

  ngOnChanges(): void {
    if (this.products?.length) {
      this.displayProducts = this.products;
      return;
    }
    if (this.type) {
      this.productService.getProducts.subscribe((response) => {
        this.displayProducts = response.filter((item) => item.type === this.type).slice(0, 4);
      });
    } else {
      this.displayProducts = [];
    }
  }

}

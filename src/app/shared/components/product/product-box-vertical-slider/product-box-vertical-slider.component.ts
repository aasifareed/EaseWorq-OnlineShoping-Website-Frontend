import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { ProductSlider } from '../../../data/slider';
import { Product } from '../../../classes/product';
import { ProductService } from '../../../services/product.service';

@Component({
  selector: 'app-product-box-vertical-slider',
  templateUrl: './product-box-vertical-slider.component.html',
  styleUrls: ['./product-box-vertical-slider.component.scss']
})
export class ProductBoxVerticalSliderComponent implements OnInit, OnChanges {

  @Input() title: string = 'New Product';
  @Input() type: string = 'fashion';
  /** When set, "See more" navigates to the category collection page. */
  @Input() categoryId: string | null = null;
  /** When provided, binds API products instead of static JSON catalog. */
  @Input() products: Product[] | null = null;

  public displayProducts: Product[] = [];
  public ProductSliderConfig: any = ProductSlider;

  constructor(public productService: ProductService) {}

  ngOnInit(): void {
    this.syncProducts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['products'] || changes['type']) {
      this.syncProducts();
    }
  }

  private syncProducts(): void {
    if (this.products != null) {
      this.displayProducts = this.products;
      return;
    }
    this.productService.getProducts.subscribe((response) =>
      (this.displayProducts = response.filter((item) => item.type == this.type))
    );
  }
}

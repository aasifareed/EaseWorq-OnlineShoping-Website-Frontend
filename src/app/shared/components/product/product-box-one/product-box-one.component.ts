import { Component, OnInit, OnChanges, SimpleChanges, Input, ViewChild, ViewEncapsulation, HostBinding } from '@angular/core';
import { QuickViewComponent } from "../../modal/quick-view/quick-view.component";
import { CartModalComponent } from "../../modal/cart-modal/cart-modal.component";
import { Product } from "../../../classes/product";
import { ProductService } from "../../../services/product.service";

@Component({
  selector: 'app-product-box-one',
  templateUrl: './product-box-one.component.html',
  styleUrls: ['./product-box-one.component.scss'],
  encapsulation: ViewEncapsulation.Emulated
})
export class ProductBoxOneComponent implements OnInit, OnChanges {

  @Input() product?: Product;
  @Input() currency: any = this.productService.Currency;
  @Input() thumbnail: boolean = false;
  @Input() onHowerChangeImage: boolean = false;
  @Input() cartModal: boolean = false;
  @Input() loader: boolean = false;
  /** Full-width horizontal row (shop list view). */
  @Input() listMode = false;

  @HostBinding('class.product-box-one--list')
  get hostListClass(): boolean {
    return this.listMode;
  }
  
  @ViewChild("quickView") QuickView?: QuickViewComponent;
  @ViewChild("cartModal") CartModal?: CartModalComponent;

  public ImageSrc?: string;

  constructor(private productService: ProductService) { }

  ngOnInit(): void {
    this.syncCardImage();
    if (this.loader) {
      setTimeout(() => { this.loader = false; }, 2000);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product']) {
      this.syncCardImage();
    }
  }

  get productLink(): (string | number)[] {
    if (this.product?.id != null) {
      return ['/shop/product/left/sidebar', this.product.id];
    }
    return ['/shop/collection/left/sidebar'];
  }

  /** First gallery image for listing cards (pictureUrls[0] || pictureUrl). */
  get cardImageSrc(): string {
    return this.ImageSrc || this.productService.getProductImages(this.product)[0];
  }

  private syncCardImage(): void {
    this.ImageSrc = this.productService.getProductImages(this.product)[0];
  }

  onCardImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const fallback = this.productService.defaultProductImage;
    if (img && img.src !== fallback) {
      img.src = fallback;
    }
  }

  // Get Product Color
  Color(variants:any) {
    const uniqColor = [];
    for (let i = 0; i < Object.keys(variants).length; i++) {
      if (uniqColor.indexOf(variants[i].color) === -1 && variants[i].color) {
        uniqColor.push(variants[i].color)
      }
    }
    return uniqColor
  }

  // Change Variants
  ChangeVariants(color:any, product:any) {
    product.variants.map((item:any) => {
      if (item.color === color) {
        product.images.map((img:any) => {
          if (img.image_id === item.image_id) {
            this.ImageSrc = img.src;
          }
        })
      }
    })
  }

  // Change Variants Image
  ChangeVariantsImage(src:any) {
    this.ImageSrc = src;
  }

  addToCart(product: any) {
    this.productService.addToCart(product);
  }

  addToWishlist(product: any) {
    this.productService.addToWishlist(product).subscribe();
  }

  addToCompare(product: any) {
    this.productService.addToCompare(product);
  }

}

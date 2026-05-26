import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Product } from '../../../../shared/classes/product';
import { ProductService } from '../../../../shared/services/product.service';
import { SizeModalComponent } from '../../../../shared/components/modal/size-modal/size-modal.component';

@Component({
  selector: 'app-product-left-sidebar',
  templateUrl: './product-left-sidebar.component.html',
  styleUrls: ['./product-left-sidebar.component.scss']
})
export class ProductLeftSidebarComponent implements OnInit {

  public product: Product = {};
  public relatedProducts: Product[] = [];
  public detailLoading = false;
  public relatedLoading = false;
  public counter: number = 1;
  public activeSlide = 0;
  public selectedSize: any;
  public active = 1;
  public zoomActive = false;
  public zoomOrigin = '50% 50%';

  readonly placeholderImage = 'assets/images/product/placeholder.jpg';

  @ViewChild('sizeChart') SizeChart: SizeModalComponent;

  private touchStartX = 0;

  get displayImages(): { src: string; alt: string }[] {
    const urls = this.productService.getProductImages(this.product);
    const alt = this.product?.title || 'Product';
    return urls.map((src) => ({ src, alt }));
  }

  get hasMultipleImages(): boolean {
    return this.displayImages.length > 1;
  }

  get currentImageSrc(): string {
    return this.displayImages[this.activeSlide]?.src ?? this.placeholderImage;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public productService: ProductService
  ) {}

  ngOnInit(): void {
    this.route.data.subscribe((d) => {
      const initial = (d['data'] as Product) || {};
      this.product = { ...initial };
      this.activeSlide = 0;
    });

    this.route.paramMap.subscribe((params) => {
      const inventoryId = params.get('slug');
      if (inventoryId) {
        this.loadProductDetail(inventoryId);
      }
    });
  }

  selectGalleryImage(index: number): void {
    if (index < 0 || index >= this.displayImages.length) {
      return;
    }
    this.activeSlide = index;
    this.zoomActive = false;
  }

  prevImage(): void {
    const n = this.displayImages.length;
    if (n <= 1) {
      return;
    }
    this.selectGalleryImage((this.activeSlide - 1 + n) % n);
  }

  nextImage(): void {
    const n = this.displayImages.length;
    if (n <= 1) {
      return;
    }
    this.selectGalleryImage((this.activeSlide + 1) % n);
  }

  onGalleryTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0]?.clientX ?? 0;
  }

  onGalleryTouchEnd(event: TouchEvent): void {
    const endX = event.changedTouches[0]?.clientX ?? 0;
    const delta = endX - this.touchStartX;
    if (Math.abs(delta) < 40) {
      return;
    }
    if (delta > 0) {
      this.prevImage();
    } else {
      this.nextImage();
    }
  }

  onZoomMove(event: MouseEvent): void {
    const el = event.currentTarget as HTMLElement;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    this.zoomOrigin = `${x}% ${y}%`;
    this.zoomActive = true;
  }

  onZoomLeave(): void {
    this.zoomActive = false;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && img.src !== this.placeholderImage) {
      img.src = this.placeholderImage;
    }
  }

  private loadProductDetail(inventoryId: string): void {
    this.detailLoading = true;
    this.productService.getProductDetailForOnlineShop(inventoryId).subscribe({
      next: (resp) => {
        const item = resp?.result;
        if (item) {
          const mapped = this.productService.mapInventoryItemToProduct(item);
          this.product = { ...this.product, ...mapped };
          this.activeSlide = 0;
          this.productService.persistShopProduct(this.product);
          this.productService.cacheShopProducts([this.product]);
          this.loadRelatedProducts(inventoryId);
        }
        this.detailLoading = false;
      },
      error: () => {
        this.detailLoading = false;
      }
    });
  }

  private loadRelatedProducts(inventoryId: string): void {
    this.relatedLoading = true;
    this.productService.getRelatedProductsForOnlineShop(inventoryId, 4).subscribe({
      next: (resp) => {
        const items = resp?.result ?? [];
        this.relatedProducts = items.map((item: any) => this.productService.mapInventoryItemToProduct(item));
        this.productService.cacheShopProducts(this.relatedProducts);
        this.relatedProducts.forEach((p) => this.productService.persistShopProduct(p));
        this.relatedLoading = false;
      },
      error: () => {
        this.relatedProducts = [];
        this.relatedLoading = false;
      }
    });
  }

  Color(variants: any) {
    const uniqColor = [];
    if (!variants?.length) {
      return uniqColor;
    }
    for (let i = 0; i < Object.keys(variants).length; i++) {
      if (uniqColor.indexOf(variants[i].color) === -1 && variants[i].color) {
        uniqColor.push(variants[i].color);
      }
    }
    return uniqColor;
  }

  Size(variants: any) {
    const uniqSize = [];
    if (!variants?.length) {
      return uniqSize;
    }
    for (let i = 0; i < Object.keys(variants).length; i++) {
      if (uniqSize.indexOf(variants[i].size) === -1 && variants[i].size) {
        uniqSize.push(variants[i].size);
      }
    }
    return uniqSize;
  }

  selectSize(size) {
    this.selectedSize = size;
  }

  increment() {
    this.counter++;
  }

  decrement() {
    if (this.counter > 1) {
      this.counter--;
    }
  }

  async addToCart(product: any) {
    product.quantity = this.counter || 1;
    await this.productService.addToCart(product);
  }

  async buyNow(product: any) {
    product.quantity = this.counter || 1;
    const status = await this.productService.addToCart(product);
    if (status) {
      this.router.navigate(['/shop/checkout']);
    }
  }

  addToWishlist(product: any) {
    this.productService.addToWishlist(product).subscribe();
  }
}

import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Product } from '../../../../shared/classes/product';
import { ProductService } from '../../../../shared/services/product.service';
import { SizeModalComponent } from '../../../../shared/components/modal/size-modal/size-modal.component';

@Component({
  selector: 'app-product-left-sidebar',
  templateUrl: './product-left-sidebar.component.html',
  styleUrls: ['./product-left-sidebar.component.scss']
})
export class ProductLeftSidebarComponent implements OnInit, OnDestroy {

  public product: Product = {};
  public relatedProducts: Product[] = [];
  public detailLoading = false;
  public relatedLoading = false;
  public counter: number = 1;
  public activeSlide = 0;
  public selectedSize: any;
  public active = 1;
  /** Lightbox popup (click main image) */
  public lightboxOpen = false;
  /** Stable gallery list — rebuilt only when product images change */
  public galleryImages: { src: string; alt: string }[] = [];

  readonly placeholderImage = 'assets/images/product/placeholder.svg';

  @ViewChild('sizeChart') SizeChart: SizeModalComponent;

  private touchStartX = 0;
  private lightboxTouchStartX = 0;

  get displayImages(): { src: string; alt: string }[] {
    return this.galleryImages;
  }

  get hasMultipleImages(): boolean {
    return this.galleryImages.length > 1;
  }

  get currentImageSrc(): string {
    return this.galleryImages[this.activeSlide]?.src ?? this.placeholderImage;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    public productService: ProductService
  ) {}

  ngOnInit(): void {
    this.route.data.subscribe((d) => {
      const initial = (d['data'] as Product) || {};
      this.product = { ...initial };
      this.syncImageGallery(true);
    });

    this.route.paramMap.subscribe((params) => {
      const inventoryId = params.get('slug');
      if (inventoryId) {
        this.loadProductDetail(inventoryId);
      }
    });
  }

  ngOnDestroy(): void {
    this.closeLightbox();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.lightboxOpen) {
      this.closeLightbox();
    }
  }

  trackByGalleryIndex(index: number): number {
    return index;
  }

  openLightbox(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.galleryImages.length) {
      return;
    }
    this.lightboxOpen = true;
    document.body.style.overflow = 'hidden';
    this.cdr.detectChanges();
  }

  closeLightbox(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.lightboxOpen) {
      document.body.style.overflow = '';
      return;
    }
    this.lightboxOpen = false;
    document.body.style.overflow = '';
    this.cdr.detectChanges();
  }

  selectGalleryImage(index: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (index < 0 || index >= this.galleryImages.length) {
      return;
    }
    if (this.activeSlide === index) {
      return;
    }
    this.activeSlide = index;
    this.cdr.detectChanges();
  }

  prevImage(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const n = this.galleryImages.length;
    if (n <= 1) {
      return;
    }
    this.selectGalleryImage((this.activeSlide - 1 + n) % n);
  }

  nextImage(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const n = this.galleryImages.length;
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

  onLightboxTouchStart(event: TouchEvent): void {
    this.lightboxTouchStartX = event.changedTouches[0]?.clientX ?? 0;
  }

  onLightboxTouchEnd(event: TouchEvent): void {
    const endX = event.changedTouches[0]?.clientX ?? 0;
    const delta = endX - this.lightboxTouchStartX;
    if (Math.abs(delta) < 40) {
      return;
    }
    if (delta > 0) {
      this.prevImage();
    } else {
      this.nextImage();
    }
  }

  onImageError(event: Event, index?: number): void {
    const i = typeof index === 'number' ? index : this.activeSlide;
    if (i < 0 || i >= this.galleryImages.length) {
      return;
    }
    if (this.galleryImages[i].src === this.placeholderImage) {
      return;
    }
    this.galleryImages[i] = {
      ...this.galleryImages[i],
      src: this.placeholderImage
    };
    this.cdr.markForCheck();
  }

  private syncImageGallery(resetSlide = false): void {
    const urls = this.productService.getProductImages(this.product);
    const alt = this.product?.title || 'Product';
    this.galleryImages = urls.map((src) => ({ src, alt }));
    if (resetSlide || this.activeSlide >= this.galleryImages.length) {
      this.activeSlide = 0;
    }
    this.cdr.markForCheck();
  }

  private loadProductDetail(routeKey: string): void {
    this.detailLoading = true;
    this.productService.getProductDetailForOnlineShop(routeKey).subscribe({
      next: (resp) => {
        const item = resp?.result;
        if (item) {
          const mapped = this.productService.mapInventoryItemToProduct(item);
          this.product = { ...this.product, ...mapped };
          this.syncImageGallery(true);
          this.resetCounter();
          this.productService.persistShopProduct(this.product);
          this.productService.cacheShopProducts([this.product]);
          const inventoryId = String(mapped.id || '');
          if (inventoryId) {
            this.loadRelatedProducts(inventoryId);
          }
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
    if (this.productService.canIncrementSelectable(this.product, this.counter)) {
      this.counter++;
    }
  }

  decrement() {
    if (this.counter > 1) {
      this.counter--;
    }
  }

  get selectableQuantity(): number {
    return this.productService.getSelectableQuantity(this.product);
  }

  get cartQuantity(): number {
    return this.productService.getCartQuantityForProduct(this.product);
  }

  get isFullyInCart(): boolean {
    return this.productService.isFullyInCart(this.product);
  }

  get canIncrementCounter(): boolean {
    return this.productService.canIncrementSelectable(this.product, this.counter);
  }

  get stockTone(): 'ok' | 'out' | 'cart' {
    if (this.isFullyInCart) {
      return 'cart';
    }
    if ((this.product?.stock ?? 0) <= 0 || this.selectableQuantity <= 0) {
      return 'out';
    }
    return 'ok';
  }

  get stockStatusLine(): string {
    if (this.isFullyInCart) {
      return 'In cart · Full quantity already added';
    }
    if ((this.product?.stock ?? 0) <= 0 || this.selectableQuantity <= 0) {
      return 'Out of Stock';
    }
    const qty = Number(this.product?.stock) || 0;
    const qtyLabel = qty === 1 ? 'Only 1 left' : `Only ${qty} left`;
    return `In Stock · ${qtyLabel}`;
  }

  get stockNote(): string | null {
    if (this.isFullyInCart || (this.product?.stock ?? 0) <= 0) {
      return null;
    }
    if (this.cartQuantity > 0 && this.selectableQuantity > 0) {
      return `${this.cartQuantity} in cart — you can add up to ${this.selectableQuantity} more`;
    }
    return null;
  }

  get hasProductDescription(): boolean {
    const text = (this.product?.description ?? '').toString().trim();
    if (!text) {
      return false;
    }
    // Ignore placeholder-like fallbacks stored as description
    const normalized = text.toLowerCase().replace(/\s+/g, ' ');
    return normalized !== 'no description available.'
      && normalized !== 'no product description available.';
  }

  get productDescriptionFull(): string {
    return String(this.product?.description ?? '').trim();
  }

  /** Prefer configured product display name (preserve Y69 / brand casing). */
  get displayTitle(): string {
    return (this.product?.title ?? '').toString().trim() || 'Product';
  }

  get isInWishlist(): boolean {
    return this.productService.isInWishlist(this.product);
  }

  /** Breadcrumb: Home / Shop / Category / Brand / Product — only link crumbs that can filter shop. */
  get breadcrumbTrail(): { label: string; routerLink?: any[]; queryParams?: Record<string, any>; current?: boolean }[] {
    const trail: { label: string; routerLink?: any[]; queryParams?: Record<string, any>; current?: boolean }[] = [
      { label: 'Home', routerLink: ['/home'] },
      { label: 'Shop', routerLink: ['/shop'] }
    ];

    const category = (this.product?.category || this.product?.type || '').toString().trim();
    const categoryId = (this.product as any)?.categoryId?.toString()?.trim();
    if (category) {
      trail.push({
        label: category,
        routerLink: ['/shop'],
        queryParams: categoryId ? { category: categoryId } : undefined
      });
    }

    const brand = (this.product?.brand || '').toString().trim();
    const brandId = (this.product as any)?.brandId?.toString()?.trim();
    if (brand && brand.toLowerCase() !== category.toLowerCase() && brandId) {
      const queryParams: Record<string, string> = { brand: brandId };
      if (categoryId) {
        queryParams.category = categoryId;
      }
      trail.push({
        label: brand,
        routerLink: ['/shop'],
        queryParams
      });
    }

    trail.push({ label: this.displayTitle, current: true });
    return trail;
  }

  private resetCounter(): void {
    const max = this.selectableQuantity;
    this.counter = max > 0 ? 1 : 0;
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

  toggleWishlist(product: any): void {
    if (this.productService.isInWishlist(product)) {
      this.productService.removeWishlistItem(product).subscribe();
      return;
    }
    this.productService.addToWishlist(product).subscribe();
  }
}

import {
  Component,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ViewChild,
  TemplateRef,
  Input,
  ChangeDetectorRef,
  PLATFORM_ID,
  Inject
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { Product } from '../../../classes/product';
import { ProductService } from '../../../../shared/services/product.service';
import { shopProductLink } from '../../../constants/storefront-routes';

@Component({
  selector: 'app-quick-view',
  templateUrl: './quick-view.component.html',
  styleUrls: ['./quick-view.component.scss']
})
export class QuickViewComponent implements OnInit, OnDestroy, OnChanges {

  @Input() product: Product;
  @Input() currency: any;
  @ViewChild('quickView', { static: false }) QuickView: TemplateRef<any>;

  public closeResult: string;
  public productImages: string[] = [];
  public selectedIndex = 0;
  public counter = 1;
  public modalOpen = false;
  public lightboxOpen = false;

  readonly placeholderImage = 'assets/images/product/placeholder.svg';

  private touchStartX = 0;
  private lightboxTouchStartX = 0;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private modalService: NgbModal,
    private cdr: ChangeDetectorRef,
    public productService: ProductService
  ) {}

  ngOnInit(): void {
    this.syncImageGallery();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product']) {
      this.syncImageGallery();
      this.resetCounter();
    }
  }

  get productStock(): number {
    return this.productService.getProductStock(this.product);
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
    if (this.productStock <= 0 || this.selectableQuantity <= 0) {
      return 'out';
    }
    return 'ok';
  }

  /** Combined stock line — avoids duplicating "In Stock" + "Available quantity". */
  get stockStatusLine(): string {
    if (this.isFullyInCart) {
      return 'In cart · Full quantity already added';
    }
    if (this.productStock <= 0 || this.selectableQuantity <= 0) {
      return 'Out of Stock';
    }
    const qty = this.productStock;
    const qtyLabel = qty === 1 ? 'Only 1 available' : `Only ${qty} available`;
    return `In Stock · ${qtyLabel}`;
  }

  get stockNote(): string | null {
    if (this.isFullyInCart || this.productStock <= 0) {
      return null;
    }
    if (this.cartQuantity > 0 && this.selectableQuantity > 0) {
      return `${this.cartQuantity} in cart — you can add up to ${this.selectableQuantity} more`;
    }
    return null;
  }

  get hasProductDescription(): boolean {
    return !!(this.product?.description && String(this.product.description).trim());
  }

  get productDescriptionText(): string {
    if (!this.hasProductDescription) {
      return 'No description available.';
    }
    const text = String(this.product.description).trim();
    return text.length > 200 ? `${text.substring(0, 200)}...` : text;
  }

  get selectedImage(): string {
    return this.productImages[this.selectedIndex] ?? this.placeholderImage;
  }

  get hasMultipleImages(): boolean {
    return this.productImages.length > 1;
  }

  trackByIndex(index: number): number {
    return index;
  }

  openModal(): void {
    this.resetCounter();
    this.syncImageGallery();
    this.closeLightbox();
    this.modalOpen = true;
    if (isPlatformBrowser(this.platformId)) {
      this.modalService
        .open(this.QuickView, {
          size: 'lg',
          ariaLabelledBy: 'modal-basic-title',
          centered: true,
          backdrop: true,
          keyboard: true,
          windowClass: 'Quickview',
          beforeDismiss: () => {
            if (this.lightboxOpen) {
              this.closeLightbox();
              return false;
            }
            return true;
          }
        })
        .result.then(
          (result) => {
            `Result ${result}`;
          },
          (reason) => {
            this.closeLightbox();
            this.closeResult = `Dismissed ${this.getDismissReason(reason)}`;
          }
        );
    }
  }

  private getDismissReason(reason: any): string {
    if (reason === ModalDismissReasons.ESC) {
      return 'by pressing ESC';
    }
    if (reason === ModalDismissReasons.BACKDROP_CLICK) {
      return 'by clicking on a backdrop';
    }
    return `with: ${reason}`;
  }

  syncImageGallery(): void {
    this.productImages = this.productService.getProductImages(this.product);
    this.selectedIndex = 0;
    this.cdr.markForCheck();
  }

  openLightbox(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.productImages.length) {
      return;
    }
    this.lightboxOpen = true;
    this.cdr.detectChanges();
  }

  closeLightbox(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.lightboxOpen) {
      return;
    }
    this.lightboxOpen = false;
    this.cdr.detectChanges();
  }

  selectThumbnail(index: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (index < 0 || index >= this.productImages.length) {
      return;
    }
    if (this.selectedIndex === index) {
      return;
    }
    this.selectedIndex = index;
    this.cdr.detectChanges();
  }

  prevImage(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const n = this.productImages.length;
    if (n <= 1) {
      return;
    }
    this.selectThumbnail((this.selectedIndex - 1 + n) % n);
  }

  nextImage(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const n = this.productImages.length;
    if (n <= 1) {
      return;
    }
    this.selectThumbnail((this.selectedIndex + 1) % n);
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
    const i = typeof index === 'number' ? index : this.selectedIndex;
    if (i < 0 || i >= this.productImages.length) {
      return;
    }
    if (this.productImages[i] === this.placeholderImage) {
      return;
    }
    this.productImages[i] = this.placeholderImage;
    this.cdr.markForCheck();
  }

  increment(): void {
    if (this.canIncrementCounter) {
      this.counter++;
    }
  }

  decrement(): void {
    if (this.counter > 1) {
      this.counter--;
    }
  }

  private resetCounter(): void {
    const max = this.selectableQuantity;
    this.counter = max > 0 ? 1 : 0;
  }

  async addToCart(product: any): Promise<void> {
    product.quantity = this.counter || 1;
    const status = await this.productService.addToCart(product);
    if (status) {
      this.closeLightbox();
      this.modalService.dismissAll();
    }
  }

  async buyNow(product: any): Promise<void> {
    product.quantity = this.counter || 1;
    const status = await this.productService.addToCart(product);
    if (status) {
      this.closeLightbox();
      this.modalService.dismissAll();
      this.router.navigate(['/shop/checkout']);
    }
  }

  goProductDetail(event: Event): void {
    event.preventDefault();
    if (!this.product?.id && !this.product?.slug) {
      return;
    }
    this.productService.persistShopProduct(this.product);
    this.closeLightbox();
    this.modalService.dismissAll();
    this.router.navigate(shopProductLink(this.product), {
      state: { product: this.product }
    });
  }

  ngOnDestroy(): void {
    this.closeLightbox();
    if (this.modalOpen) {
      this.modalService.dismissAll();
    }
  }
}

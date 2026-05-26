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
  public zoomActive = false;
  public zoomOrigin = '50% 50%';

  readonly placeholderImage = 'assets/images/product/placeholder.jpg';

  private touchStartX = 0;

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
    }
  }

  get selectedImage(): string {
    return this.productImages[this.selectedIndex] ?? this.placeholderImage;
  }

  get hasMultipleImages(): boolean {
    return this.productImages.length > 1;
  }

  openModal(): void {
    this.counter = 1;
    this.syncImageGallery();
    this.modalOpen = true;
    if (isPlatformBrowser(this.platformId)) {
      this.modalService
        .open(this.QuickView, {
          size: 'lg',
          ariaLabelledBy: 'modal-basic-title',
          centered: true,
          windowClass: 'Quickview'
        })
        .result.then(
          (result) => {
            `Result ${result}`;
          },
          (reason) => {
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
    this.zoomActive = false;
    this.cdr.markForCheck();
  }

  selectThumbnail(index: number): void {
    if (index < 0 || index >= this.productImages.length) {
      return;
    }
    this.selectedIndex = index;
    this.zoomActive = false;
    this.cdr.detectChanges();
  }

  prevImage(): void {
    const n = this.productImages.length;
    if (n <= 1) {
      return;
    }
    this.selectThumbnail((this.selectedIndex - 1 + n) % n);
  }

  nextImage(): void {
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
    if (img && !img.src.includes('placeholder')) {
      img.src = this.placeholderImage;
    }
  }

  increment(): void {
    this.counter++;
  }

  decrement(): void {
    if (this.counter > 1) {
      this.counter--;
    }
  }

  async addToCart(product: any): Promise<void> {
    product.quantity = this.counter || 1;
    const status = await this.productService.addToCart(product);
    if (status) {
      this.modalService.dismissAll();
    }
  }

  async buyNow(product: any): Promise<void> {
    product.quantity = this.counter || 1;
    const status = await this.productService.addToCart(product);
    if (status) {
      this.modalService.dismissAll();
      this.router.navigate(['/shop/checkout']);
    }
  }

  goProductDetail(event: Event): void {
    event.preventDefault();
    if (!this.product?.id) {
      return;
    }
    this.productService.persistShopProduct(this.product);
    this.modalService.dismissAll();
    this.router.navigate(['/shop/product/left/sidebar', this.product.id], {
      state: { product: this.product }
    });
  }

  ngOnDestroy(): void {
    if (this.modalOpen) {
      this.modalService.dismissAll();
    }
  }
}

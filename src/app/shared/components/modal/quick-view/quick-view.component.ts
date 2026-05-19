import { Component, OnInit, OnDestroy, ViewChild, TemplateRef, Input,
  Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { Product } from "../../../classes/product";
import { ProductService } from '../../../../shared/services/product.service';

@Component({
  selector: 'app-quick-view',
  templateUrl: './quick-view.component.html',
  styleUrls: ['./quick-view.component.scss']
})
export class QuickViewComponent implements OnInit, OnDestroy  {

  @Input() product: Product;
  @Input() currency: any;
  @ViewChild("quickView", { static: false }) QuickView: TemplateRef<any>;

  public closeResult: string;
  public ImageSrc: string;
  public counter: number = 1;
  public modalOpen: boolean = false;

  constructor(@Inject(PLATFORM_ID) private platformId: Object,
    private router: Router, private modalService: NgbModal,
    public productService: ProductService) { }

  ngOnInit(): void {
  }

  openModal() {
    this.counter = 1;
    this.modalOpen = true;
    if (isPlatformBrowser(this.platformId)) {
      this.modalService.open(this.QuickView, {
        size: 'lg',
        ariaLabelledBy: 'modal-basic-title',
        centered: true,
        windowClass: 'Quickview'
      }).result.then((result) => {
        `Result ${result}`;
      }, (reason) => {
        this.closeResult = `Dismissed ${this.getDismissReason(reason)}`;
      });
    }
  }

  private getDismissReason(reason: any): string {
    if (reason === ModalDismissReasons.ESC) {
      return 'by pressing ESC';
    } else if (reason === ModalDismissReasons.BACKDROP_CLICK) {
      return 'by clicking on a backdrop';
    } else {
      return `with: ${reason}`;
    }
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

  ChangeVariants(color: any, product: any) {
    product.variants.map((item: any) => {
      if (item.color === color) {
        product.images.map((img: any) => {
          if (img.image_id === item.image_id) {
            this.ImageSrc = img.src;
          }
        });
      }
    });
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
    const status = await this.productService.addToCart(product);
    if (status) {
      this.modalService.dismissAll();
    }
  }

  async buyNow(product: any) {
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

  ngOnDestroy() {
    if (this.modalOpen) {
      this.modalService.dismissAll();
    }
  }

}

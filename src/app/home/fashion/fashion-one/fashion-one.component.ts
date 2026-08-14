import { Component, OnDestroy, OnInit } from '@angular/core';
import { ProductSlider } from '../../../shared/data/slider';
import { Product } from '../../../shared/classes/product';
import { ProductService } from '../../../shared/services/product.service';
import { HomeBannerService } from '../../../shared/services/home-banner.service';
import {
  FreeShippingPromo,
  FreeShippingPromoService
} from '../../../shared/services/free-shipping-promo.service';
import { HomeCategorySliderView } from '../../../shared/models/home-category-slider.model';

@Component({
  selector: 'app-fashion-one',
  templateUrl: './fashion-one.component.html',
  styleUrls: ['./fashion-one.component.scss']
})
export class FashionOneComponent implements OnInit, OnDestroy {

  public products: Product[] = [];
  public productCollections: any[] = [];
  public active: any;
  public categorySliders: HomeCategorySliderView[] = [];
  public loadingCategorySliders = true;
  public popularBrandLogos: { id: string; name: string; image: string }[] = [];
  public loadingPopularBrands = true;
  public loadingHomeBanners = true;
  public freeShippingPromo: FreeShippingPromo | null = null;
  public codeCopied = false;

  private codeCopiedTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly defaultSliders: { image: string }[] = [];

  public sliders: { image: string }[] = [];

  constructor(
    public productService: ProductService,
    private homeBannerService: HomeBannerService,
    private freeShippingPromoService: FreeShippingPromoService
  ) {}

  public ProductSliderConfig: any = ProductSlider;

  public collections = [{
    image: 'assets/images/collection/fashion/1.jpg',
    save: 'save 50%',
    title: 'men'
  }, {
    image: 'assets/images/collection/fashion/2.jpg',
    save: 'save 50%',
    title: 'women'
  }];

  public blog = [{
    image: 'assets/images/blog/1.jpg',
    date: '25 January 2018',
    title: 'Lorem ipsum dolor sit consectetur adipiscing elit,',
    by: 'John Dio'
  }, {
    image: 'assets/images/blog/2.jpg',
    date: '26 January 2018',
    title: 'Lorem ipsum dolor sit consectetur adipiscing elit,',
    by: 'John Dio'
  }, {
    image: 'assets/images/blog/3.jpg',
    date: '27 January 2018',
    title: 'Lorem ipsum dolor sit consectetur adipiscing elit,',
    by: 'John Dio'
  }, {
    image: 'assets/images/blog/4.jpg',
    date: '28 January 2018',
    title: 'Lorem ipsum dolor sit consectetur adipiscing elit,',
    by: 'John Dio'
  }];

  ngOnInit(): void {
    this.loadHomeBanners();
    this.loadFreeShippingPromo();
    this.loadCategorySliders();
    this.loadPopularBrands();
  }

  get promoHeadline(): string {
    if (this.freeShippingPromo?.isFirstOrder) {
      return 'Your First Delivery Is FREE!';
    }
    const title = (this.freeShippingPromo?.title || '').trim();
    return title || 'Free shipping available';
  }

  get promoHeadlineMobile(): string {
    if (this.freeShippingPromo?.isFirstOrder) {
      return 'Free shipping on your first order';
    }
    return this.promoHeadline;
  }

  get promoAnnounceLabel(): string {
    const promo = this.freeShippingPromo;
    if (!promo) {
      return '';
    }
    const code = (promo.code || '').trim();
    return code
      ? `${this.promoHeadline} Use code ${code}`
      : this.promoHeadline;
  }

  async copyPromoCode(): Promise<void> {
    const code = (this.freeShippingPromo?.code || '').trim();
    if (!code) {
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        this.copyPromoCodeFallback(code);
      }
      this.showCodeCopied();
    } catch {
      try {
        this.copyPromoCodeFallback(code);
        this.showCodeCopied();
      } catch {
        // ignore clipboard failures
      }
    }
  }

  ngOnDestroy(): void {
    if (this.codeCopiedTimer) {
      clearTimeout(this.codeCopiedTimer);
      this.codeCopiedTimer = null;
    }
  }

  private showCodeCopied(): void {
    this.codeCopied = true;
    if (this.codeCopiedTimer) {
      clearTimeout(this.codeCopiedTimer);
    }
    this.codeCopiedTimer = setTimeout(() => {
      this.codeCopied = false;
      this.codeCopiedTimer = null;
    }, 1600);
  }

  private copyPromoCodeFallback(code: string): void {
    const input = document.createElement('textarea');
    input.value = code;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }

  private loadHomeBanners(): void {
    this.loadingHomeBanners = !this.sliders.length;
    this.homeBannerService.getHomeBanners().subscribe({
      next: (banners) => {
        if (banners?.length) {
          this.sliders = banners.map((b) => ({
            image: b.image,
            linkUrl: b.linkUrl,
            title: b.title,
            subTitle: b.subTitle
          }));
        } else if (!this.sliders.length) {
          this.sliders = [];
        }
        this.loadingHomeBanners = false;
      },
      error: () => {
        if (!this.sliders.length) {
          this.sliders = [];
        }
        this.loadingHomeBanners = false;
      }
    });
  }

  private loadFreeShippingPromo(): void {
    this.freeShippingPromoService.getActivePromo().subscribe({
      next: (promo) => {
        this.freeShippingPromo = promo;
      },
      error: () => {
        this.freeShippingPromo = null;
      }
    });
  }

  /** Customer-facing section titles only — POS category names stay unchanged. */
  displayCategoryName(name?: string | null): string {
    const raw = String(name || '').trim();
    if (!raw) {
      return '';
    }
    const key = raw.toLowerCase();
    const map: Record<string, string> = {
      units: 'Mobile Phones',
      unit: 'Mobile Phones',
      smartphones: 'Mobile Phones',
      phones: 'Mobile Phones'
    };
    return map[key] || raw;
  }

  private loadCategorySliders(): void {
    this.loadingCategorySliders = true;
    this.productService
      .getHomePopularCategoryProductSliders({ productLimitPerCategory: 5 })
      .subscribe({
        next: (sliders) => {
          this.categorySliders = (sliders || []).map((s) => ({
            categoryId: s.categoryId,
            categoryName: s.categoryName,
            products: (s.products || []).map((row) =>
              this.productService.mapInventoryItemToProduct(row)
            )
          }));
          this.categorySliders.forEach((slider) =>
            slider.products.forEach((p) => this.productService.persistShopProduct(p))
          );
          this.loadingCategorySliders = false;
        },
        error: () => {
          this.categorySliders = [];
          this.loadingCategorySliders = false;
        }
      });
  }

  get popularSliderCategoryIds(): string[] {
    return this.categorySliders
      .map((slider) => slider.categoryId)
      .filter((id): id is string => !!id);
  }

  private loadPopularBrands(): void {
    this.loadingPopularBrands = true;
    this.productService.getHomePopularBrandsForOnline({ maxResultCount: 20 }).subscribe({
      next: (brands) => {
        this.popularBrandLogos = brands || [];
        this.loadingPopularBrands = false;
      },
      error: () => {
        this.popularBrandLogos = [];
        this.loadingPopularBrands = false;
      }
    });
  }

  getCollectionProducts(collection: any[]) {
    return this.products.filter((item) => {
      if (item.collection?.find(i => i === collection)) {
        return item
      }
    })
  }

}

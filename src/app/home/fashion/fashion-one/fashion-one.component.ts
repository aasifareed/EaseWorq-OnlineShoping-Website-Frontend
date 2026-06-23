import { Component, OnInit } from '@angular/core';
import { ProductSlider } from '../../../shared/data/slider';
import { Product } from '../../../shared/classes/product';
import { ProductService } from '../../../shared/services/product.service';
import { HomeBannerService } from '../../../shared/services/home-banner.service';
import { HomeCategorySliderView } from '../../../shared/models/home-category-slider.model';

@Component({
  selector: 'app-fashion-one',
  templateUrl: './fashion-one.component.html',
  styleUrls: ['./fashion-one.component.scss']
})
export class FashionOneComponent implements OnInit {

  public products: Product[] = [];
  public productCollections: any[] = [];
  public active: any;
  public categorySliders: HomeCategorySliderView[] = [];
  public loadingCategorySliders = true;
  public popularBrandLogos: { id: string; name: string; image: string }[] = [];
  public loadingPopularBrands = true;
  public loadingHomeBanners = true;

  private readonly defaultSliders = [{
    image: 'https://microless.com/cdn/banners/microless-cases-sales-pc.jpg'
  },
  {
    image: 'https://microless.com/cdn/banners/gaming-chairs-promo-pc-v2.png'
  },
  {
    image: 'https://microless.com/cdn/banners/3d-printer-pc.jpg'
  },
  {
    image: 'https://microless.com/cdn/banners/wacom-pc.jpg'
  },
  {
    image: 'https://microless.com/cdn/banners/gaming-chairs-promo-pc-v2.png'
  }];

  public sliders = [...this.defaultSliders];

  constructor(
    public productService: ProductService,
    private homeBannerService: HomeBannerService
  ) {
    this.productService.getProducts.subscribe(response => {
      this.products = response.filter(item => item.type == 'fashion');
      this.products.filter((item) => {
        item.collection?.filter((collection) => {
          const index = this.productCollections.indexOf(collection);
          if (index === -1) this.productCollections.push(collection);
        })
      })
    });
  }

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
    this.loadCategorySliders();
    this.loadPopularBrands();
  }

  private loadHomeBanners(): void {
    this.loadingHomeBanners = true;
    this.sliders = [...this.defaultSliders];
    this.homeBannerService.getHomeBanners().subscribe({
      next: (banners) => {
        if (banners?.length) {
          this.sliders = banners.map((b) => ({
            image: b.image
          }));
        }
        this.loadingHomeBanners = false;
      },
      error: () => {
        this.sliders = [...this.defaultSliders];
        this.loadingHomeBanners = false;
      }
    });
  }

  private loadCategorySliders(): void {
    this.loadingCategorySliders = true;
    this.productService
      .getHomePopularCategoryProductSliders({ productLimitPerCategory: 10 })
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

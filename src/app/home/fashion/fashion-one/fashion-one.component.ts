import { Component, OnInit } from '@angular/core';
import { ProductSlider } from '../../../shared/data/slider';
import { Product } from '../../../shared/classes/product';
import { ProductService } from '../../../shared/services/product.service';
import { HomeCategorySliderView } from '../../../shared/models/home-category-slider.model';
import { environment } from 'src/environments/environment';

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

  constructor(public productService: ProductService) {
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

  public sliders = [{
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
  },
]

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

  public logo = [{
    image: 'https://microless.com/cdn/brands/1537eb5e996940fee59e6c8ff6619038.jpg',
  }, {
    image: 'https://microless.com/cdn/brands/f5d5620fadf9ce34c57d1460b0a79f45.jpg',
  }, {
    image: 'https://microless.com/cdn/brands/f66720f69165dd8b69e439898adb76b7.jpg',
  }, {
    image: 'https://microless.com/cdn/brands/lenovo.png',
  }, {
    image: 'https://microless.com/cdn/brands/ecb4d872605d44b0bbec96af20a49e4a.jpg',
  }, {
    image: 'https://microless.com/cdn/brands/a81b48490fb7d737446ca2959514ac4d.jpg',
  }, {
    image: 'https://microless.com/cdn/brands/razer.png',
  },
   {
    image: 'https://microless.com/cdn/brands/samsung.png',
  },
   {
    image: 'https://microless.com/cdn/brands/64484e27547b338983f00e7d270a6bf2.jpg',
  },
   {
    image: 'https://microless.com/cdn/brands/f9b38108e142f20ed569481ddcec24f0.jpg',
  },
];

  ngOnInit(): void {
    this.loadCategorySliders();
  }

  private loadCategorySliders(): void {
    const tenantId = Number(environment.tenantId ?? environment.shop?.tenantId ?? 1);
    const storeId = String(environment.storeId ?? environment.shop?.storeId ?? '');
    this.loadingCategorySliders = true;
    this.productService
      .getHomePopularCategoryProductSliders({ tenantId, storeId, productLimitPerCategory: 10 })
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

  getCollectionProducts(collection: any[]) {
    return this.products.filter((item) => {
      if (item.collection?.find(i => i === collection)) {
        return item
      }
    })
  }

}

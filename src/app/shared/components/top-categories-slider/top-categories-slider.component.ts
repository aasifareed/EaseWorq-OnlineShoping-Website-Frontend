import { Component, Input, OnInit } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { environment } from 'src/environments/environment';

export interface TopCategoryCard {
  id: string;
  name: string;
  image: string;
}

@Component({
  selector: 'app-top-categories-slider',
  templateUrl: './top-categories-slider.component.html',
  styleUrls: ['./top-categories-slider.component.scss']
})
export class TopCategoriesSliderComponent implements OnInit {
  @Input() gridMode = false;
  @Input() title = '';
  /** popular = IsPopular only; nonPopular = exclude popular; all = every online category with products */
  @Input() categoryFilter: 'popular' | 'nonPopular' | 'all' = 'nonPopular';

  categorySliderConfig = {
    loop: true,
    nav: true,
    dots: false,
    navContainerClass: 'owl-nav',
    navClass: ['owl-prev', 'owl-next'],
    navText: ['<i class="ti-angle-left"></i>', '<i class="ti-angle-right"></i>'],
    responsive: {
      0: { items: 2 },
      480: { items: 3 },
      768: { items: 4 },
      1024: { items: 6 }
    }
  };

  categories: TopCategoryCard[] = [];
  loading = true;

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  get sectionTitle(): string {
    if (this.title) {
      return this.title;
    }
    if (this.categoryFilter === 'popular') {
      return 'TOP CATEGORIES';
    }
    return 'EXPLORE OTHER CATEGORIES';
  }

  private loadCategories(): void {
    const tenantId = Number(environment.tenantId ?? environment.shop?.tenantId ?? 1);
    const storeId = String(environment.storeId ?? environment.shop?.storeId ?? '');
    this.loading = true;
    this.productService
      .getProductGroupsListForOnline({
        tenantId,
        storeId,
        categoryFilter: this.categoryFilter
      })
      .subscribe({
        next: (rows) => {
          this.categories = rows;
          this.loading = false;
        },
        error: () => {
          this.categories = [];
          this.loading = false;
        }
      });
  }
}

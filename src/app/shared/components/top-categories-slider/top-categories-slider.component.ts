import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { ProductService } from '../../services/product.service';

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
export class TopCategoriesSliderComponent implements OnInit, OnChanges {
  @Input() gridMode = false;
  @Input() title = '';
  /** popular = IsPopular only; nonPopular = exclude popular; all = every online category with products */
  @Input() categoryFilter: 'popular' | 'nonPopular' | 'all' = 'nonPopular';
  /** Extra category ids to hide (e.g. home page popular sliders already shown above). */
  @Input() excludeCategoryIds: string[] = [];

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
  private rawCategories: TopCategoryCard[] = [];
  loading = true;

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['excludeCategoryIds']) {
      this.applyCategoryFilters(this.rawCategories);
    }
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
    this.loading = true;
    this.productService
      .getProductGroupsListForOnline({
        categoryFilter: this.categoryFilter
      })
      .subscribe({
        next: (rows) => {
          this.rawCategories = rows || [];
          this.applyCategoryFilters(this.rawCategories);
          this.loading = false;
        },
        error: () => {
          this.categories = [];
          this.loading = false;
        }
      });
  }

  private applyCategoryFilters(rows: TopCategoryCard[]): void {
    const exclude = new Set(
      (this.excludeCategoryIds || [])
        .map((id) => String(id || '').trim().toLowerCase())
        .filter(Boolean)
    );

    this.categories = (rows || []).filter((row) => {
      const id = String(row.id || '').trim().toLowerCase();
      return id && !exclude.has(id);
    });
  }
}

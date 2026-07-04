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

  get useCarousel(): boolean {
    return this.categories.length > 6;
  }

  /** Tight equal-width columns for small category lists (no huge carousel gaps). */
  get gridTemplateColumns(): string {
    const n = this.categories.length;
    if (n <= 1) {
      return 'minmax(0, 220px)';
    }
    return `repeat(${Math.min(n, 6)}, minmax(0, 1fr))`;
  }

  categorySliderConfig: Record<string, unknown> = this.buildSliderConfig(0);

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
    this.categorySliderConfig = this.buildSliderConfig(this.categories.length);
  }

  private buildSliderConfig(count: number): Record<string, unknown> {
    const cap = (max: number) => Math.max(1, Math.min(count, max));
    return {
      loop: count > 6,
      nav: count > 1,
      dots: false,
      margin: 8,
      navContainerClass: 'owl-nav',
      navClass: ['owl-prev', 'owl-next'],
      navText: ['<i class="ti-angle-left"></i>', '<i class="ti-angle-right"></i>'],
      responsive: {
        0: { items: cap(2) },
        480: { items: cap(3) },
        768: { items: cap(4) },
        1024: { items: cap(6) }
      }
    };
  }
}

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
  /** Optional cap for homepage (e.g. 3–4 cards). */
  @Input() maxItems: number | null = null;

  get useCarousel(): boolean {
    return this.categories.length > 6;
  }

  /** Equal-width columns; cap tile width so a couple of categories don't stretch into huge banners. */
  get gridTemplateColumns(): string {
    const n = this.categories.length;
    if (n <= 1) {
      return 'minmax(0, 320px)';
    }
    return `repeat(${Math.min(n, 4)}, minmax(0, 360px))`;
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
    if (changes['excludeCategoryIds'] || changes['maxItems']) {
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
    return 'EXPLORE CATEGORIES';
  }

  /** Empty or stock placeholders — never show a product photo as a category stand-in. */
  isPlaceholderImage(imageUrl?: string): boolean {
    if (!imageUrl) {
      return true;
    }
    const normalized = imageUrl.toLowerCase();
    return normalized.includes('default-image')
      || normalized.includes('defaultattachments')
      || normalized.includes('placeholder')
      || normalized.includes('no-image');
  }

  /** Storefront label only — does not change POS category names. */
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

    let list = (rows || []).filter((row) => {
      const id = String(row.id || '').trim().toLowerCase();
      return id && !exclude.has(id);
    });

    if (this.maxItems != null && this.maxItems > 0) {
      list = list.slice(0, this.maxItems);
    }

    this.categories = list;
    this.categorySliderConfig = this.buildSliderConfig(this.categories.length);
  }

  private buildSliderConfig(count: number): Record<string, unknown> {
    const cap = (max: number) => Math.max(1, Math.min(count, max));
    return {
      loop: count > 6,
      nav: count > 1,
      dots: false,
      margin: 12,
      navContainerClass: 'owl-nav',
      navClass: ['owl-prev', 'owl-next'],
      navText: ['<i class="ti-angle-left"></i>', '<i class="ti-angle-right"></i>'],
      responsive: {
        0: { items: cap(2) },
        480: { items: cap(2) },
        768: { items: cap(3) },
        1024: { items: cap(4) }
      }
    };
  }
}

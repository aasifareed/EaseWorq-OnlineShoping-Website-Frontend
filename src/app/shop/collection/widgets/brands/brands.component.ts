import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProductService } from '../../../../shared/services/product.service';

export interface ShopBrandOption {
  id: string;
  name: string;
}

export interface ShopBrandDisplayOption extends ShopBrandOption {
  checked: boolean;
}

@Component({
  selector: 'app-brands',
  templateUrl: './brands.component.html',
  styleUrls: ['./brands.component.scss']
})
export class BrandsComponent implements OnInit, OnDestroy, OnChanges {

  @Input() categoryTree: any[] = [];
  @Input() selectedBrandIds: string[] = [];

  @Output() brandOptionsReady = new EventEmitter<ShopBrandOption[]>();

  public brandList: ShopBrandOption[] = [];
  public displayBrandList: ShopBrandDisplayOption[] = [];
  public collapse = true;
  public loading = false;

  private routeSub?: Subscription;
  private category: string | null = null;
  private lastCategoryKey = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const snapshot = this.route.snapshot.queryParams;
    this.category = snapshot['category'] ? String(snapshot['category']) : null;
    this.lastCategoryKey = this.category || '';
    this.loadBrands();

    this.routeSub = this.route.queryParams.subscribe((params) => {
      const categoryKey = params['category'] ? String(params['category']) : '';
      if (categoryKey !== this.lastCategoryKey) {
        this.lastCategoryKey = categoryKey;
        this.category = categoryKey || null;
        this.loadBrands();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedBrandIds']) {
      this.refreshDisplayList();
    }
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  private sameId(a: string, b: string): boolean {
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }

  private refreshDisplayList(): void {
    this.displayBrandList = this.brandList.map((b) => ({
      ...b,
      checked: (this.selectedBrandIds || []).some((id) => this.sameId(id, b.id)),
    }));
    this.cdr.markForCheck();
  }

  private loadBrands(): void {
    const resolvedPath = this.productService.findCategoryPathFlexible(
      this.categoryTree,
      this.category
    );
    const categoryId = resolvedPath?.length
      ? String(resolvedPath[resolvedPath.length - 1].id)
      : undefined;

    this.loading = true;
    this.productService.getBrandsForOnlineShop(categoryId || null).subscribe({
      next: (resp) => {
        const raw = resp?.result ?? resp?.items ?? [];
        this.brandList = (raw as any[])
          .map((x) => ({
            id: String(x.id ?? x.Id ?? '').trim(),
            name: String(x.brandName ?? x.BrandName ?? '')
          }))
          .filter((x) => x.id.length > 0);
        this.brandOptionsReady.emit(this.brandList);
        this.refreshDisplayList();
        this.loading = false;
      },
      error: () => {
        this.brandList = [];
        this.displayBrandList = [];
        this.brandOptionsReady.emit([]);
        this.loading = false;
      }
    });
  }

  toggleBrand(brandId: string, event: MouseEvent): void {
    event.preventDefault();
    const selected = [...(this.selectedBrandIds || [])];
    const index = selected.findIndex((id) => this.sameId(id, brandId));
    if (index === -1) {
      selected.push(brandId);
    } else {
      selected.splice(index, 1);
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { brand: selected.length ? selected.join(',') : null, page: null },
      queryParamsHandling: 'merge',
    });
  }
}

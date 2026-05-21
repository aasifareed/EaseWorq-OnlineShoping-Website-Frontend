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

export interface ShopSizeOption {
  value: string;
  label: string;
}

export interface ShopSizeDisplayOption extends ShopSizeOption {
  checked: boolean;
}

@Component({
  selector: 'app-size',
  templateUrl: './size.component.html',
  styleUrls: ['./size.component.scss']
})
export class SizeComponent implements OnInit, OnDestroy, OnChanges {

  @Input() categoryTree: any[] = [];
  @Input() selectedSizes: string[] = [];

  @Output() sizeOptionsReady = new EventEmitter<ShopSizeOption[]>();

  public sizeList: ShopSizeOption[] = [];
  public displaySizeList: ShopSizeDisplayOption[] = [];
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
    this.loadSizes();

    this.routeSub = this.route.queryParams.subscribe((params) => {
      const categoryKey = params['category'] ? String(params['category']) : '';
      if (categoryKey !== this.lastCategoryKey) {
        this.lastCategoryKey = categoryKey;
        this.category = categoryKey || null;
        this.loadSizes();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedSizes']) {
      this.refreshDisplayList();
    }
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  private sameValue(a: string, b: string): boolean {
    const sa = String(a).trim().toLowerCase();
    const sb = String(b).trim().toLowerCase();
    if (sa === sb) {
      return true;
    }
    const na = parseFloat(sa.replace(',', '.'));
    const nb = parseFloat(sb.replace(',', '.'));
    return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
  }

  private refreshDisplayList(): void {
    this.displaySizeList = this.sizeList.map((s) => ({
      ...s,
      checked: (this.selectedSizes || []).some((v) => this.sameValue(v, s.value)),
    }));
    this.cdr.markForCheck();
  }

  private loadSizes(): void {
    const resolvedPath = this.productService.findCategoryPathFlexible(
      this.categoryTree,
      this.category
    );
    const categoryId = resolvedPath?.length
      ? String(resolvedPath[resolvedPath.length - 1].id)
      : undefined;

    this.loading = true;
    this.productService.getSizesForOnlineShop(categoryId || null).subscribe({
      next: (resp) => {
        const raw = resp?.result ?? resp?.items ?? [];
        this.sizeList = (raw as any[])
          .map((x) => {
            const label = String(x.label ?? x.Label ?? x.value ?? x.Value ?? '').trim();
            return { value: label, label };
          })
          .filter((x) => x.value.length > 0);
        this.sizeOptionsReady.emit(this.sizeList);
        this.refreshDisplayList();
        this.loading = false;
      },
      error: () => {
        this.sizeList = [];
        this.displaySizeList = [];
        this.sizeOptionsReady.emit([]);
        this.loading = false;
      }
    });
  }

  toggleSize(sizeValue: string, event: MouseEvent): void {
    event.preventDefault();
    const selected = [...(this.selectedSizes || [])];
    const index = selected.findIndex((v) => this.sameValue(v, sizeValue));
    if (index === -1) {
      selected.push(sizeValue);
    } else {
      selected.splice(index, 1);
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { size: selected.length ? selected.join(',') : null, page: null },
      queryParamsHandling: 'merge',
    });
  }
}

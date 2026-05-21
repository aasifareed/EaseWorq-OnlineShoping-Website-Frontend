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

export interface ShopColorOption {
  value: string;
  label: string;
}

export interface ShopColorDisplayOption extends ShopColorOption {
  checked: boolean;
}

@Component({
  selector: 'app-colors',
  templateUrl: './colors.component.html',
  styleUrls: ['./colors.component.scss']
})
export class ColorsComponent implements OnInit, OnDestroy, OnChanges {

  @Input() categoryTree: any[] = [];
  @Input() selectedColors: string[] = [];

  @Output() colorOptionsReady = new EventEmitter<ShopColorOption[]>();

  public colorList: ShopColorOption[] = [];
  public displayColorList: ShopColorDisplayOption[] = [];
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
    this.loadColors();

    this.routeSub = this.route.queryParams.subscribe((params) => {
      const categoryKey = params['category'] ? String(params['category']) : '';
      if (categoryKey !== this.lastCategoryKey) {
        this.lastCategoryKey = categoryKey;
        this.category = categoryKey || null;
        this.loadColors();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedColors']) {
      this.refreshDisplayList();
    }
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  private sameValue(a: string, b: string): boolean {
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }

  private refreshDisplayList(): void {
    this.displayColorList = this.colorList.map((c) => ({
      ...c,
      checked: (this.selectedColors || []).some((v) => this.sameValue(v, c.value)),
    }));
    this.cdr.markForCheck();
  }

  private loadColors(): void {
    const resolvedPath = this.productService.findCategoryPathFlexible(
      this.categoryTree,
      this.category
    );
    const categoryId = resolvedPath?.length
      ? String(resolvedPath[resolvedPath.length - 1].id)
      : undefined;

    this.loading = true;
    this.productService.getColorsForOnlineShop(categoryId || null).subscribe({
      next: (resp) => {
        const raw = resp?.result ?? resp?.items ?? [];
        this.colorList = (raw as any[])
          .map((x) => {
            const label = String(x.label ?? x.Label ?? x.value ?? x.Value ?? '').trim();
            return { value: label, label };
          })
          .filter((x) => x.value.length > 0);
        this.colorOptionsReady.emit(this.colorList);
        this.refreshDisplayList();
        this.loading = false;
      },
      error: () => {
        this.colorList = [];
        this.displayColorList = [];
        this.colorOptionsReady.emit([]);
        this.loading = false;
      }
    });
  }

  toggleColor(colorValue: string, event: MouseEvent): void {
    event.preventDefault();
    const selected = [...(this.selectedColors || [])];
    const index = selected.findIndex((v) => this.sameValue(v, colorValue));
    if (index === -1) {
      selected.push(colorValue);
    } else {
      selected.splice(index, 1);
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { color: selected.length ? selected.join(',') : null, page: null },
      queryParamsHandling: 'merge',
    });
  }
}

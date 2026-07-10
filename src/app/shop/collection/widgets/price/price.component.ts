import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Output, Input, EventEmitter, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Options } from 'ngx-slider-v2';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { ProductService } from '../../../../shared/services/product.service';

@Component({
  selector: 'app-price',
  templateUrl: './price.component.html',
  styleUrls: ['./price.component.scss']
})
export class PriceComponent implements OnInit, OnDestroy, OnChanges {
  
  @Output() priceFilter : EventEmitter<any> = new EventEmitter<any>();
	
  @Input() min: number | null = null;
  @Input() max: number | null = null;

  /** Local inputs so typing is not overwritten by parent change detection before navigation completes. */
  public localMin: number | null = null;
  public localMax: number | null = null;

  public collapse: boolean = true;
  public isBrowser: boolean = false;

  private readonly filterChanges$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  options: Options = {
    floor: 0,
    ceil: 10000000
  };
  
  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    public productService: ProductService,
  ) { 
    if (isPlatformBrowser(this.platformId)) {
      this.isBrowser = true;
    }
  }

  get priceFilterLabel(): string {
    const symbol = this.productService.Currency?.currency?.trim() || 'RS';
    return `Price (${symbol})`;
  }
  
  ngOnInit(): void {
    this.syncFromInputs();
    this.filterChanges$
      .pipe(debounceTime(500), takeUntil(this.destroy$))
      .subscribe(() => this.appliedFilter());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['min'] || changes['max']) {
      this.syncFromInputs();
    }
  }

  appliedFilter(): void {
    const normalized = this.normalizeRange(
      this.parseNum(this.localMin),
      this.parseNum(this.localMax),
    );

    this.localMin = normalized.minPrice;
    this.localMax = normalized.maxPrice;
    this.priceFilter.emit(normalized);
  }

  onPriceInputChange(): void {
    this.filterChanges$.next();
  }

  private syncFromInputs(): void {
    const normalized = this.normalizeRange(
      this.parseNum(this.min),
      this.parseNum(this.max),
    );
    this.localMin = normalized.minPrice;
    this.localMax = normalized.maxPrice;
  }

  /** Ensures min is never greater than max when both values are set. */
  private normalizeRange(
    minPrice: number | null,
    maxPrice: number | null,
  ): { minPrice: number | null; maxPrice: number | null } {
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      return { minPrice: maxPrice, maxPrice: minPrice };
    }
    return { minPrice, maxPrice };
  }

  private parseNum(v: unknown): number | null {
    if (v === null || v === undefined || v === '') {
      return null;
    }
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }

}

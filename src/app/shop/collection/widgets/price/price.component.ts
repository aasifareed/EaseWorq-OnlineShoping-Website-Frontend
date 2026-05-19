import { Component, OnInit, OnChanges, SimpleChanges, Output, Input, EventEmitter, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Options } from 'ngx-slider-v2';

@Component({
  selector: 'app-price',
  templateUrl: './price.component.html',
  styleUrls: ['./price.component.scss']
})
export class PriceComponent implements OnInit, OnChanges {
  
  @Output() priceFilter : EventEmitter<any> = new EventEmitter<any>();
	
  @Input() min: number | null = null;
  @Input() max: number | null = null;

  /** Local inputs so typing is not overwritten by parent change detection before navigation completes. */
  public localMin: number | null = null;
  public localMax: number | null = null;

  public collapse: boolean = true;
  public isBrowser: boolean = false;

  options: Options = {
    floor: 0,
    ceil: 10000000
  };
  
  constructor(@Inject(PLATFORM_ID) private platformId: Object) { 
    if (isPlatformBrowser(this.platformId)) {
      this.isBrowser = true;
    }
  }
  
  ngOnInit(): void {
    this.localMin = this.min;
    this.localMax = this.max;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['min'] || changes['max']) {
      this.localMin = this.min;
      this.localMax = this.max;
    }
  }

  appliedFilter() {
    const minPrice = this.parseNum(this.localMin);
    const maxPrice = this.parseNum(this.localMax);
    this.priceFilter.emit({ minPrice, maxPrice });
  }

  private parseNum(v: unknown): number | null {
    if (v === null || v === undefined || v === '') {
      return null;
    }
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }

}

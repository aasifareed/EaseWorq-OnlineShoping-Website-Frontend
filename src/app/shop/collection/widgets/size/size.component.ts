import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Product } from '../../../../shared/classes/product';

export interface ShopSizeOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-size',
  templateUrl: './size.component.html',
  styleUrls: ['./size.component.scss']
})
export class SizeComponent {

  @Input() products: Product[] = [];
  @Input() size: string[] = [];

  @Output() sizeFilter: EventEmitter<Record<string, string | null>> = new EventEmitter();

  public collapse = true;

  /** Unique sizes from JSON `variants.size` and/or POS `productSize`. */
  get displaySizes(): ShopSizeOption[] {
    const map = new Map<string, string>();
    for (const p of this.products || []) {
      const ps = (p as Product).productSize;
      if (ps != null && String(ps).trim() !== '') {
        const label = String(ps).trim();
        const key = label.toLowerCase();
        if (!map.has(key)) {
          map.set(key, label);
        }
      }
      (p.variants || []).forEach((v: any) => {
        if (v?.size != null && String(v.size).trim() !== '') {
          const label = String(v.size).trim();
          const key = label.toLowerCase();
          if (!map.has(key)) {
            map.set(key, label);
          }
        }
      });
    }
    return [...map.entries()]
      .sort((a, b) => this.sizeSortKey(a[1]) - this.sizeSortKey(b[1]))
      .map(([, label]) => ({ value: label, label }));
  }

  private sizeSortKey(s: string): number {
    const n = parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  }

  appliedFilter(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (input.checked) {
      if (this.size.indexOf(value) === -1) {
        this.size.push(value);
      }
    } else {
      const index = this.size.indexOf(value);
      if (index !== -1) {
        this.size.splice(index, 1);
      }
    }
    const payload = this.size.length ? { size: this.size.join(',') } : { size: null };
    this.sizeFilter.emit(payload);
  }

  checked(item: string): boolean {
    return this.size.indexOf(item) !== -1;
  }
}

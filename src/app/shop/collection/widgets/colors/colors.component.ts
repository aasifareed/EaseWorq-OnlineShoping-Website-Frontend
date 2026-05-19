import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Product } from '../../../../shared/classes/product';

export interface ShopColorOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-colors',
  templateUrl: './colors.component.html',
  styleUrls: ['./colors.component.scss']
})
export class ColorsComponent {

  @Input() products: Product[] = [];
  @Input() colors: string[] = [];

  @Output() colorsFilter: EventEmitter<Record<string, string | null>> = new EventEmitter();

  public collapse = true;

  /** Unique colors from JSON `variants` and/or POS flat `color` on each product. */
  get displayColors(): ShopColorOption[] {
    const map = new Map<string, string>();
    for (const p of this.products || []) {
      const flat = (p as Product).color;
      if (flat != null && String(flat).trim() !== '') {
        const label = String(flat).trim();
        const key = label.toLowerCase();
        if (!map.has(key)) {
          map.set(key, label);
        }
      }
      (p.variants || []).forEach((v: any) => {
        if (v?.color != null && String(v.color).trim() !== '') {
          const label = String(v.color).trim();
          const key = label.toLowerCase();
          if (!map.has(key)) {
            map.set(key, label);
          }
        }
      });
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([, label]) => ({ value: label, label }));
  }

  appliedFilter(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (input.checked) {
      if (this.colors.indexOf(value) === -1) {
        this.colors.push(value);
      }
    } else {
      const index = this.colors.indexOf(value);
      if (index !== -1) {
        this.colors.splice(index, 1);
      }
    }
    const payload = this.colors.length ? { color: this.colors.join(',') } : { color: null };
    this.colorsFilter.emit(payload);
  }

  checked(item: string): boolean {
    return this.colors.indexOf(item) !== -1;
  }
}

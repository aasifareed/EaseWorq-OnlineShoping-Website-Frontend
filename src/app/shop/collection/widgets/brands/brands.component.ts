import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Product } from '../../../../shared/classes/product';

export interface ShopBrandOption {
  id: string;
  name: string;
  productCount: number;
}

@Component({
  selector: 'app-brands',
  templateUrl: './brands.component.html',
  styleUrls: ['./brands.component.scss']
})
export class BrandsComponent implements OnInit {

  @Input() products: Product[] = [];
  @Input() brands: any[] = [];
  /** When set, checkboxes use brand ids (API); otherwise names are derived from the current product page. */
  @Input() brandOptions: ShopBrandOption[] = [];

  @Output() brandsFilter: EventEmitter<any> = new EventEmitter<any>();
  
  public collapse: boolean = true;

  constructor() { 
  }

  ngOnInit(): void {
  }

  get filterbyBrand() {
    const uniqueBrands: string[] = [];
    this.products.forEach((product) => {
      if (product.brand) {
        const index = uniqueBrands.indexOf(product.brand);
        if (index === -1) {
          uniqueBrands.push(product.brand);
        }
      }
    });
    return uniqueBrands;
  }

  get displayBrands(): { value: string; label: string }[] {
    if (this.brandOptions?.length) {
      return this.brandOptions.map((b) => ({
        value: b.id,
        label: `${b.name} (${b.productCount})`
      }));
    }
    return this.filterbyBrand.map((name) => ({ value: name, label: name }));
  }

  appliedFilter(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (input.checked) {
      if (this.brands.indexOf(value) === -1) {
        this.brands.push(value);
      }
    } else {
      const index = this.brands.indexOf(value);
      if (index !== -1) {
        this.brands.splice(index, 1);
      }
    }

    const brands = this.brands.length ? { brand: this.brands.join(',') } : { brand: null };
    this.brandsFilter.emit(brands);
  }

  checked(item: string): boolean {
    return this.brands.indexOf(item) !== -1;
  }

}

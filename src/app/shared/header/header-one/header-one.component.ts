import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { OnlineShopSettingsService } from '../../services/online-shop-settings.service';
import { OnlineShopStorefront } from '../../models/online-shop-storefront.model';

@Component({
  selector: 'app-header-one',
  templateUrl: './header-one.component.html',
  styleUrls: ['./header-one.component.scss']
})
export class HeaderOneComponent implements OnInit, OnDestroy {
  
  @Input() class: string='';
  // @Input() class: string;
  @Input() themeLogo: string = 'assets/images/icon/logo.png'; // Default Logo
  @Input() topbar: boolean = true; // Default True
  /** When true, header is fixed at the top for the entire page (no scroll delay). */
  @Input() sticky: boolean = false;

  public storefront: OnlineShopStorefront | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    public productService: ProductService,
    private storefrontSettings: OnlineShopSettingsService,
  ) { }

  ngOnInit(): void {
    this.filterbyCategory();

    this.storefrontSettings.storefront$
      .pipe(takeUntil(this.destroy$))
      .subscribe((storefront) => {
        this.storefront = storefront;
      });

    if (this.storefrontSettings.snapshot) {
      this.storefront = this.storefrontSettings.snapshot;
    } else {
      this.storefrontSettings.loadStorefront().subscribe();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get storeName(): string {
    return this.storefront?.storeName?.trim() || 'EaseWorq';
  }


  categories!: Category[];
  // categories: Category[] = this.CATEGORIES;
  activeCat: Category | null = null;
  isOpen = false;
 
  openMenu() {
    this.isOpen = true;
    // default highlight first item

  }
  filterbyCategory() {
  // get filterbyCategory() {
    // const category = CATEGORIES;
    this.productService.getCategories().subscribe({
      next:(resp) =>{
        this.categories = resp.result;
      }
    });
    // return category
  }
 
  closeMenu() {
    this.isOpen = false;
    this.activeCat = null;
  }
 
  setActive(cat: Category) {
    this.activeCat = cat;
  }


}
  // categories pannel 
  // src/app/shared/data/categories.data.ts

export interface Category {
  id: number;
  title: string;
  slug: string;
  image?: string;
  children?: Category[];
}
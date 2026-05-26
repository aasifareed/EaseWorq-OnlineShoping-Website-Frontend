import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { ProductService } from "../../../shared/services/product.service";
import { Product } from '../../../shared/classes/product';
import { environment } from 'src/environments/environment';
import { CollectionToolbarBreadcrumb } from '../widgets/grid/grid.component';
import { ShopBrandOption } from '../widgets/brands/brands.component';

@Component({
  selector: 'app-collection-left-sidebar',
  templateUrl: './collection-left-sidebar.component.html',
  styleUrls: ['./collection-left-sidebar.component.scss']
})
export class CollectionLeftSidebarComponent implements OnInit {
  
  public grid: string = 'col-xl-3 col-md-6';
  public layoutView: string = 'grid-view';
  public products: Product[] = [];
  /** Same as API page result; used for color/size facet lists + cache (filters applied on server). */
  public rawProducts: Product[] = [];
  public brands: any[] = [];
  public colors: any[] = [];
  public size: any[] = [];
  /** When set, sent as MinSellPrice / MaxSellPrice to the products API. */
  public minPrice: number | null = null;
  public maxPrice: number | null = null;
  public brandOptions: ShopBrandOption[] = [];
  public tags: any[] = [];
  public category: string | null = null;
  public pageNo: number = 1;
  public paginate: any = {}; // Pagination use only
  public pageSize: any =20; // Pagination use only
  public TotalCount: any ;
  public sortBy: string=''; // Sorting Order
  // public sortBy: string; // Sorting Order
  public mobileSidebar: boolean = false;
  public loader: boolean = true;

  /** Microless-style sidebar extras (delivery counts are placeholders until API exists). */
  public deliveryOpen = true;
  public deliveryToday = false;
  public deliveryTomorrow = false;
  public includeOutOfStock = false;
  public fulfilledByShop = false;

  /** Category hierarchy for breadcrumbs / page title. */
  public categoryTree: any[] = [];
  public breadcrumbTrail: CollectionToolbarBreadcrumb[] = [];
  public pageTitle = 'Shop';

  filter: any = {};

  constructor(private route: ActivatedRoute, private router: Router,
    private viewScroller: ViewportScroller, public productService: ProductService) {   
      this.productService.getCategories().subscribe({
        next: (resp) => {
          this.categoryTree = resp.result || [];
          this.rebuildToolbarContext();
          if (this.category) {
            this.getProducts();
          }
        }
      });
      // Get Query params..
      this.route.queryParams.subscribe(params => {

        this.brands = params.brand
          ? String(Array.isArray(params.brand) ? params.brand.join(',') : params.brand)
              .split(',')
              .map((id: string) => id.trim())
              .filter((id: string) => id.length > 0)
          : [];
        this.colors = params.color
          ? String(Array.isArray(params.color) ? params.color.join(',') : params.color)
              .split(',')
              .map((v: string) => v.trim())
              .filter((v: string) => v.length > 0)
          : [];
        this.size = params.size
          ? String(Array.isArray(params.size) ? params.size.join(',') : params.size)
              .split(',')
              .map((v: string) => v.trim())
              .filter((v: string) => v.length > 0)
          : [];
        const rawMin = params['minPrice'];
        const rawMax = params['maxPrice'];
        this.minPrice = rawMin !== undefined && rawMin !== null && rawMin !== '' ? +rawMin : null;
        this.maxPrice = rawMax !== undefined && rawMax !== null && rawMax !== '' ? +rawMax : null;
        this.tags = [...this.brands, ...this.colors, ...this.size]; // All Tags Array
        
        this.category = params.category ? params.category : null;
        this.sortBy = params.sortBy ? params.sortBy : 'ascending';
        this.pageNo = params.page != null && String(params.page) !== '' ? +params.page : 1;
        this.rebuildToolbarContext();
        this.getProducts();
        // Get Filtered Products..
        // this.productService.filterProducts(this.tags).subscribe(response => {         
        //   // Sorting Filter
        //   this.products = this.productService.sortProducts(response, this.sortBy);
        //   // Category Filter
        //   if(params.category)
        //     this.products = this.products.filter(item => item.type == this.category);
        //   // Price Filter
        //   this.products = this.products.filter(item => item.price! >= this.minPrice && item.price! <= this.maxPrice) 
        //   // Paginate Products
        //   this.paginate = this.productService.getPager(this.products.length, +this.pageNo);     // get paginate object from service
        //   this.products = this.products.slice(this.paginate.startIndex, this.paginate.endIndex + 1); // get current page of items
        // })
      })
  }

  ngOnInit(): void {
    this.getProducts();
  }

  private queryWithoutCategoryPage(): Record<string, string> {
    const raw = this.route.snapshot.queryParams as Record<string, string | undefined>;
    const q: Record<string, string> = {};
    Object.keys(raw || {}).forEach((k) => {
      if (k === 'category' || k === 'page') {
        return;
      }
      const v = raw[k];
      if (v != null && v !== '') {
        q[k] = v;
      }
    });
    return q;
  }

  private queryForCategoryNode(categoryId: string): Record<string, string> {
    const q = this.queryWithoutCategoryPage();
    q.category = categoryId;
    return q;
  }

  /** Human-readable title when ?category= is a slug not present in the tree. */
  private formatFallbackCategoryTitle(raw: string): string {
    const s = raw.replace(/[-_]+/g, ' ').trim();
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  rebuildToolbarContext(): void {
    const pathRoute = ['/shop/collection/left/sidebar'];
    const catPath = this.productService.findCategoryPathFlexible(this.categoryTree, this.category);
    const trail: CollectionToolbarBreadcrumb[] = [];
    trail.push({
      label: 'Home',
      routerLink: pathRoute,
      queryParams: this.queryWithoutCategoryPage()
    });
    if (catPath?.length) {
      this.pageTitle = catPath[catPath.length - 1].title;
      catPath.forEach((node, i) => {
        const last = i === catPath.length - 1;
        trail.push({
          label: node.title,
          routerLink: last ? undefined : pathRoute,
          queryParams: last ? undefined : this.queryForCategoryNode(String(node.id)),
          current: last
        });
      });
    } else {
      this.pageTitle = this.category ? this.formatFallbackCategoryTitle(String(this.category)) : 'Shop';
      if (this.category) {
        trail.push({ label: this.pageTitle, current: true });
      } else {
        trail.push({ label: 'All products', current: true });
      }
    }
    this.breadcrumbTrail = trail;
  }

  /** Friendly chip label (brand query values are brand ids). */
  tagLabel(tag: string): string {
    const key = String(tag).trim().toLowerCase();
    const b = this.brandOptions.find((x) => String(x.id).trim().toLowerCase() === key);
    if (b) {
      return `${b.name}`;
    }
    return tag;
  }

  getProducts() {
      this.loader = true;
      let url = environment.urls.OnlineShopAvailableProduct_GetAllAvailableProductsForOnlineShop;

      const filter: Record<string, any> = {};
      filter['maxResultCount'] = this.pageSize;
      filter['skipCount'] = (this.pageNo - 1) * this.pageSize;
      filter['TenantId'] = '1';
      filter['StoreId'] = 'd4d292f5-de72-4742-b728-ea34a1706191';

      const resolvedPath = this.productService.findCategoryPathFlexible(this.categoryTree, this.category);
      const apiCategoryId = resolvedPath?.length
        ? resolvedPath[resolvedPath.length - 1].id
        : this.category;
      if (apiCategoryId) {
        filter['CategoryId'] = apiCategoryId;
      }

      if (this.brands?.length) {
        filter['BrandIds'] = this.brands;
      }

      if (this.minPrice != null && !Number.isNaN(+this.minPrice)) {
        filter['MinSellPrice'] = this.minPrice;
      }
      if (this.maxPrice != null && !Number.isNaN(+this.maxPrice)) {
        filter['MaxSellPrice'] = this.maxPrice;
      }

      if (this.colors?.length) {
        filter['ProductColors'] = this.colors;
      }
      if (this.size?.length) {
        const sizes = this.size
          .map((s) => parseFloat(String(s).replace(',', '.')))
          .filter((n) => Number.isFinite(n));
        if (sizes.length) {
          filter['ProductSizes'] = sizes;
        }
      }

      filter['ShopSortBy'] = this.sortBy && String(this.sortBy).trim() !== '' ? this.sortBy : 'ascending';

      this.filter = filter;
      url = url + this.setFilterURL();
  this.productService.getProductsFromAPI(url).subscribe({
    next: (resp) => {
      this.TotalCount = resp.result.totalCount; 
          this.paginate = this.productService.getPager(resp.result.totalCount,+this.pageNo ,this.pageSize);     // get paginate object from service

      this.rawProducts = resp.result.items.map((item: any): Product =>
        this.productService.mapInventoryItemToProduct(item)
      );
      this.productService.cacheShopProducts(this.rawProducts);
      this.rawProducts.forEach((p) => this.productService.persistShopProduct(p));
      this.products = this.rawProducts;
    },
    error: (err) => {
      console.error("API Error:", err);
      this.rawProducts = [];
      this.products = [];
      // this.loader = false;
    },
    complete: () => {
      this.loader = false;
    }
  });
}
  setFilterURL() {
    let path = '';
    Object.keys(this.filter).forEach((key) => {
      const val = this.filter[key];
      if (val === null || val === undefined || val === '') {
        return;
      }
      if (key === 'BrandIds' && Array.isArray(val)) {
        val.forEach((id: string) => {
          path = path ? path + '&' : '?';
          path += `BrandIds=${encodeURIComponent(id)}`;
        });
        return;
      }
      if (key === 'ProductColors' && Array.isArray(val)) {
        val.forEach((c: string) => {
          path = path ? path + '&' : '?';
          path += `ProductColors=${encodeURIComponent(c)}`;
        });
        return;
      }
      if (key === 'ProductSizes' && Array.isArray(val)) {
        val.forEach((n: number) => {
          path = path ? path + '&' : '?';
          path += `ProductSizes=${encodeURIComponent(String(n))}`;
        });
        return;
      }
      path = path ? path + '&' : '?';
      path += `${key}=${val}`;
    });
    return path;
  }
  // Append filter value to Url (color, size, price)
  updateFilter(tags: any) {
    const queryParams = { ...tags, page: null };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      skipLocationChange: false,
    }).finally(() => {
      this.viewScroller.setOffset([120, 120]);
      this.viewScroller.scrollToAnchor('products');
    });
  }

  // SortBy Filter
  sortByFilter(value:any) {
    this.router.navigate([], { 
      relativeTo: this.route,
      queryParams: { sortBy: value ? value : null, page: 1 },
      queryParamsHandling: 'merge', // preserve the existing query params in the route
      skipLocationChange: false  // do trigger navigation
    }).finally(() => {
      this.viewScroller.setOffset([120, 120]);
      this.viewScroller.scrollToAnchor('products'); // Anchore Link
    });
  }

  // Remove Tag
  removeTag(tag: string) {
    const params: Record<string, string | null> = {};
    if (this.brands.includes(tag)) {
      const next = this.brands.filter((val) => val !== tag);
      params.brand = next.length ? next.join(',') : null;
    }
    if (this.colors.includes(tag)) {
      const next = this.colors.filter((val) => val !== tag);
      params.color = next.length ? next.join(',') : null;
    }
    if (this.size.includes(tag)) {
      const next = this.size.filter((val) => val !== tag);
      params.size = next.length ? next.join(',') : null;
    }

    this.router.navigate([], { 
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge', // preserve the existing query params in the route
      skipLocationChange: false  // do trigger navigation
    }).finally(() => {
      this.viewScroller.setOffset([120, 120]);
      this.viewScroller.scrollToAnchor('products'); // Anchore Link
    });
  }

  // Clear Tags
  removeAllTags() {
    this.router.navigate([], { 
      relativeTo: this.route,
      queryParams: {},
      skipLocationChange: false  // do trigger navigation
    }).finally(() => {
      this.viewScroller.setOffset([120, 120]);
      this.viewScroller.scrollToAnchor('products'); // Anchore Link
    });
  }

  // product Pagination
  setPage(page: number) {
    this.router.navigate([], { 
      relativeTo: this.route,
      queryParams: { page: page },
      queryParamsHandling: 'merge', // preserve the existing query params in the route
      skipLocationChange: false  // do trigger navigation
    }).finally(() => {
      this.viewScroller.setOffset([120, 120]);
      this.viewScroller.scrollToAnchor('products'); // Anchore Link
    });
  }

  // Change Grid Layout
  updateGridLayout(value: string) {
    this.grid = value;
  }

  // Change Layout View
  updateLayoutView(value: string) {
    this.layoutView = value;
    if(value == 'list-view')
      this.grid = 'col-lg-12';
    else
      this.grid = 'col-xl-3 col-md-6';
  }

  // Mobile sidebar
  toggleMobileSidebar() {
    this.mobileSidebar = !this.mobileSidebar;
  }

}

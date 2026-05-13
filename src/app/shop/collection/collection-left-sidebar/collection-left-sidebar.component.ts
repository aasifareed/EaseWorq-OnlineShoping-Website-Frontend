import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { ProductService } from "../../../shared/services/product.service";
import { Product } from '../../../shared/classes/product';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-collection-left-sidebar',
  templateUrl: './collection-left-sidebar.component.html',
  styleUrls: ['./collection-left-sidebar.component.scss']
})
export class CollectionLeftSidebarComponent implements OnInit {
  
  public grid: string = 'col-xl-3 col-md-6';
  public layoutView: string = 'grid-view';
  public products: Product[] = [];
  public brands: any[] = [];
  public colors: any[] = [];
  public size: any[] = [];
  public minPrice: number = 0;
  public maxPrice: number = 1200;
  public tags: any[] = [];
  public category: string="";
  public pageNo: number = 1;
  public paginate: any = {}; // Pagination use only
  public pageSize: any =20; // Pagination use only
  public TotalCount: any ;
  public sortBy: string=''; // Sorting Order
  // public sortBy: string; // Sorting Order
  public mobileSidebar: boolean = false;
  public loader: boolean = true;


  filter: any = {};

  constructor(private route: ActivatedRoute, private router: Router,
    private viewScroller: ViewportScroller, public productService: ProductService) {   
      // Get Query params..
      this.route.queryParams.subscribe(params => {

        this.brands = params.brand ? params.brand.split(",") : [];
        this.colors = params.color ? params.color.split(",") : [];
        this.size  = params.size ? params.size.split(",")  : [];
        this.minPrice = params.minPrice ? params.minPrice : this.minPrice;
        this.maxPrice = params.maxPrice ? params.maxPrice : this.maxPrice;
        this.tags = [...this.brands, ...this.colors, ...this.size]; // All Tags Array
        
        this.category = params.category ? params.category : null;
        this.sortBy = params.sortBy ? params.sortBy : 'ascending';
        this.pageNo = params.page ? params.page : this.pageNo;
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
    getProducts() {
      this.loader = true;
          let url = environment.urls.OnlineShopAvailableProduct_GetAllAvailableProductsForOnlineShop;
    this.filter["maxResultCount"] = this.pageSize;
    this.filter["skipCount"] = (this.pageNo - 1) * this.pageSize;
    this.filter["skipCount"] = (this.pageNo - 1) * this.pageSize;
    this.filter["TenantId"] = "1";
    this.filter["CategoryId"] = this.category;
    this.filter["StoreId"] = "d4d292f5-de72-4742-b728-ea34a1706191";
    url = url + this.setFilterURL();
  this.productService.getProductsFromAPI(url).subscribe({
    next: (resp) => {
      // API se 'items' array nikal kar interface ke mutabiq map karna
            debugger;
this.TotalCount = resp.result.totalCount; 
            //     // Paginate Products
          this.paginate = this.productService.getPager(resp.result.totalCount,+this.pageNo ,this.pageSize);     // get paginate object from service

      this.products = resp.result.items.map((item: any): Product => {
        return {
          id: item.id, // String ID ko interface accept karega
          title: item.productName, // A1K (ZNF)
          description: item.productDescription, // A1K/Realme C2
          type: item.categoryName, // Mobile Parts/Units
          brand: item.brandName, // Oppo
          category: item.categoryName,
          price: item.actualSellPrice, // 1800
          sale: item.discountOnProduct > 0, // Agar discount hai to sale true
          discount: item.discountOnProduct, // 0
          stock: item.productUnitStock, // 2
          quantity: item.productQuantityPerUnit, // 1
          new: true, // Dynamic property based on logic
          images: [
            {
              src: item.pictureUrl, // API picture URL
              alt: item.productName
            }
          ],
          tags: [item.productIdTag] // WebP_1000
        };
      });
    },
    error: (err) => {
      console.error("API Error:", err);
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
      if (this.filter[key]) {
        path = path ? path + '&' : '?';
        path += Array.isArray(this.filter[key])
          ? `${key}=${this.filter[key].toLocaleString()}`
          : `${key}=${this.filter[key]}`;
      }
    });
    return path;
  }
  // Append filter value to Url
  updateFilter(tags: any) {
    tags.page = null; // Reset Pagination
    this.router.navigate([], { 
      relativeTo: this.route,
      queryParams: tags,
      queryParamsHandling: 'merge', // preserve the existing query params in the route
      skipLocationChange: false  // do trigger navigation
    }).finally(() => {
      this.viewScroller.setOffset([120, 120]);
      this.viewScroller.scrollToAnchor('products'); // Anchore Link
    });
  }

  // SortBy Filter
  sortByFilter(value:any) {
    this.router.navigate([], { 
      relativeTo: this.route,
      queryParams: { sortBy: value ? value : null},
      queryParamsHandling: 'merge', // preserve the existing query params in the route
      skipLocationChange: false  // do trigger navigation
    }).finally(() => {
      this.viewScroller.setOffset([120, 120]);
      this.viewScroller.scrollToAnchor('products'); // Anchore Link
    });
  }

  // Remove Tag
  removeTag(tag: any) {
  
    this.brands = this.brands.filter(val => val !== tag);
    this.colors = this.colors.filter(val => val !== tag);
    this.size = this.size.filter(val => val !== tag );

    let params = { 
      brand: this.brands.length ? this.brands.join(",") : null, 
      color: this.colors.length ? this.colors.join(",") : null, 
      size: this.size.length ? this.size.join(",") : null
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

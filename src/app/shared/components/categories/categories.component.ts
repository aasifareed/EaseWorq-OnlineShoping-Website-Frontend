import { Component, OnInit } from '@angular/core';
import { Product } from '../../classes/product';
import { ProductService } from '../../services/product.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent implements OnInit {

  public products: Product[] = [];
  public collapse: boolean = true;
activeSlug = '';
  category: any;
  constructor(public productService: ProductService,private route: ActivatedRoute) { 
    this.productService.getProducts.subscribe(product => this.products = product);
  }

  ngOnInit(): void {
      this.route.queryParams.subscribe(params => {
    this.activeSlug = params['category'] || '';
  });
  this.filterbyCategory();
  }

// activeSlug = '';
 
// Call this in your queryParams subscription
setActiveSlug(slug: string) {
  this.activeSlug = slug || '';
}
 
// Used in template — opens a node if it or any descendant is active
isOpen(cat: any): boolean {
  if (this.activeSlug === cat.id) return true;
  if (cat.children?.length) {
    return cat.children.some((c: any) =>
      this.activeSlug === c.id ||
      c.children?.some((g: any) => this.activeSlug === g.id)
    );
  }
  return false;
}
  filterbyCategory() {
  // get filterbyCategory() {
    // const category = CATEGORIES;
    this.productService.getCategories().subscribe({
      next:(resp) =>{
        this.category = resp.result;
      }
    });
    // return category
  }
  // : Category[]

}
